const express = require('express');
const router = express.Router();
const polyline = require('@mapbox/polyline');
const axios = require('axios');

function milesToMeters(miles) {
    return miles * 1609.34;
}

// Exact distance calculation using Haversine formula
function getDistanceFromLatLonInM(lat1, lon1, lat2, lon2) {
    const R = 6371e3; // Radius of the earth in m
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c; // Distance in m
}

async function fetchRouteFromOSRM(lat1, lon1, lat2, lon2) {
    try {
        const url = `https://router.project-osrm.org/route/v1/driving/${lon1},${lat1};${lon2},${lat2}?overview=full`;
        const response = await axios.get(url, { timeout: 10000 });
        if (response.data.code === 'Ok' && response.data.routes.length > 0) {
            const route = response.data.routes[0];
            return {
                geometry: route.geometry,
                distanceMeters: route.distance,
                durationSeconds: route.duration,
            };
        }
        throw new Error('OSRM returned no routes');
    } catch (error) {
        throw new Error(`Failed to fetch route: ${error.message}`);
    }
}

async function queryOverpassWithRetry(query, maxRetries = 3) {
    let lastError = null;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
            const endpoints = [
                'https://overpass-api.de/api/interpreter',
                'https://overpass.kumi.systems/api/interpreter',
            ];
            const endpoint = endpoints[attempt % endpoints.length];

            console.log(`Attempt ${attempt + 1}: Querying ${endpoint}`);

            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 60000); // 60s timeout

            const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: `data=${encodeURIComponent(query)}`,
                signal: controller.signal,
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                throw new Error(`Overpass API error: ${response.status}`);
            }

            const data = await response.json();
            console.log(`Successfully retrieved ${data.elements?.length || 0} elements`);
            return data.elements || [];
        } catch (error) {
            lastError = error instanceof Error ? error : new Error(String(error));
            console.log(`Attempt ${attempt + 1} failed: ${lastError.message}`);

            if (attempt < maxRetries - 1) {
                const delay = Math.pow(2, attempt) * 1000;
                console.log(`Waiting ${delay}ms before retry...`);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    }

    throw lastError || new Error('All retry attempts failed');
}

router.post('/traffic-analysis', async (req, res) => {
    try {
        const { lat, lon, destLat, destLon, radiusMiles = 5 } = req.body;

        if (!lat || !lon) {
            return res.status(400).json({ success: false, error: 'Origin latitude and longitude are required' });
        }

        const isRouteMode = !!(destLat && destLon);
        let routeData = null;
        let queryAreaStr = '';
        let searchRadiusMeters = 0;
        let routeGeoJsonCoords = [];

        if (isRouteMode) {
            console.log(`Fetching route from (${lat}, ${lon}) to (${destLat}, ${destLon})`);
            routeData = await fetchRouteFromOSRM(lat, lon, destLat, destLon);
            const decodedCoords = polyline.decode(routeData.geometry);
            // Sample coordinates to prevent massive Overpass queries on long routes
            // The Overpass 'around' feature using a polyline creates a massive complex polygon buffer
            // which often times out on the public free API when > 15-20 points are used.
            // We sample it down to 15 key waypoints for the query, which provides a fast and "good enough" corridor analysis.
            const maxPoints = 15;
            const step = Math.max(1, Math.floor(decodedCoords.length / maxPoints));
            
            // Extract roughly evenly spaced points, making sure to preserve origin and destination
            const sampledCoords = [];
            for (let i = 0; i < decodedCoords.length; i += step) {
                sampledCoords.push(decodedCoords[i]);
            }
            if (sampledCoords[sampledCoords.length - 1] !== decodedCoords[decodedCoords.length - 1]) {
                sampledCoords.push(decodedCoords[decodedCoords.length - 1]);
            }
            
            // Format for Overpass `around` polyline syntax: lat1,lon1,lat2,lon2,...
            const overpassPolyline = sampledCoords.map(coord => `${coord[0]},${coord[1]}`).join(',');
            
            routeGeoJsonCoords = decodedCoords.map(coord => [coord[0], coord[1]]); // Full geometry for frontend map rendering

            // In route mode, search 250 meters around the simplified route line
            queryAreaStr = `(around:250,${overpassPolyline})`;
        } else {
            const effectiveRadius = Math.min(radiusMiles, 5);
            searchRadiusMeters = milesToMeters(effectiveRadius);
            console.log(`Analyzing radius around (${lat}, ${lon}) with radius ${effectiveRadius} miles`);
            queryAreaStr = `(around:${searchRadiusMeters},${lat},${lon})`;
        }

        const roadsQuery = `
      [out:json][timeout:45];
      way["highway"~"^(motorway|trunk|primary|secondary|tertiary|residential|service|unclassified|living_street)$"]${queryAreaStr};
      out body geom;
    `;

        const infrastructureQuery = `
      [out:json][timeout:30];
      (
        node["highway"="traffic_signals"]${queryAreaStr};
        node["highway"="bus_stop"]${queryAreaStr};
        node["railway"="station"]${queryAreaStr};
        way["amenity"="parking"]${queryAreaStr};
        way["bridge"="yes"]["highway"]${queryAreaStr};
        way["tunnel"="yes"]["highway"]${queryAreaStr};
      );
      out center tags;
    `;

        console.log('Fetching road and infrastructure data...');
        const [roadElements, infraElements] = await Promise.all([
            queryOverpassWithRetry(roadsQuery),
            queryOverpassWithRetry(infrastructureQuery),
        ]);

        console.log(`Retrieved ${roadElements.length} roads, ${infraElements.length} infrastructure elements`);

        const analysis = {
            roads: {
                total: 0,
                byType: {},
                totalLength: 0, // In meters
            },
            intersections: 0,
            trafficSignals: 0,
            speedLimits: {},
            oneWayRoads: 0,
            parkingAreas: 0,
            busStops: 0,
            railwayStations: 0,
            bridgesAndTunnels: 0,
            roadDensity: 0,
            connectivityScore: 0,
            congestionScore: 0,
            congestionLevel: 'Minimal',
            timeMultiplier: 1.0
        };

        const nodeConnections = new Map();
        const namedRoads = new Set();
        let weightedRoadScore = 0; // Heavier weight for primary/motorways vs residential
        const poiMarkers = []; 

        if (isRouteMode) {
            // Simplified metric for route length
            analysis.roads.totalLength = routeData.distanceMeters;
        }

        for (const element of roadElements) {
            if (element.type === 'way' && element.tags?.highway) {
                const roadType = element.tags.highway;

                if (element.tags.name) {
                    namedRoads.add(element.tags.name);
                }

                analysis.roads.byType[roadType] = (analysis.roads.byType[roadType] || 0) + 1;

                // Add weighted scores based on road capacity/typical congestion
                if (['motorway', 'trunk', 'primary'].includes(roadType)) weightedRoadScore += 3;
                else if (['secondary', 'tertiary'].includes(roadType)) weightedRoadScore += 2;
                else weightedRoadScore += 1;

                if (!isRouteMode) {
                    let wayLength = 0;
                    if (element.geometry && element.geometry.length > 1) {
                        for (let i = 0; i < element.geometry.length - 1; i++) {
                            const p1 = element.geometry[i];
                            const p2 = element.geometry[i + 1];
                            if (p1 && p2 && p1.lat && p1.lon && p2.lat && p2.lon) {
                                wayLength += getDistanceFromLatLonInM(p1.lat, p1.lon, p2.lat, p2.lon);
                                // Optional: You could collect geometries for drawing roads here,
                                // but we omit it for performance unless strictly needed
                            }
                        }
                    }
                    analysis.roads.totalLength += wayLength;
                }

                if (element.tags.oneway === 'yes') analysis.oneWayRoads++;
                if (element.tags.maxspeed) {
                    const speedLimit = element.tags.maxspeed;
                    analysis.speedLimits[speedLimit] = (analysis.speedLimits[speedLimit] || 0) + 1;
                }

                if (element.nodes) {
                    for (const nodeId of element.nodes) {
                        nodeConnections.set(nodeId, (nodeConnections.get(nodeId) || 0) + 1);
                    }
                }
            }
        }

        analysis.roads.total = namedRoads.size;

        for (const element of infraElements) {
            const elLat = element.lat || (element.center && element.center.lat);
            const elLon = element.lon || (element.center && element.center.lon);

            // Tally tags and store marker info for frontend mapping
            if (element.tags?.highway === 'traffic_signals') {
                analysis.trafficSignals++;
                if (elLat && elLon) poiMarkers.push({ type: 'signal', lat: elLat, lon: elLon, id: element.id });
            }
            if (element.tags?.highway === 'bus_stop') {
                analysis.busStops++;
            }
            if (element.tags?.railway === 'station') {
                analysis.railwayStations++;
            }
            if (element.tags?.amenity === 'parking') {
                analysis.parkingAreas++;
            }
            if (element.tags?.bridge === 'yes' || element.tags?.tunnel === 'yes') {
                analysis.bridgesAndTunnels++;
            }
        }

        for (const connections of nodeConnections.values()) {
            if (connections >= 3) {
                analysis.intersections++;
            }
        }

        const areaKm2 = isRouteMode 
            ? (analysis.roads.totalLength / 1000) * 0.1 // rough proxy for route corridor
            : Math.PI * (searchRadiusMeters / 1000) ** 2;

        const totalLengthKm = analysis.roads.totalLength / 1000;
        analysis.roadDensity = Math.round((totalLengthKm / areaKm2) * 100) / 100 || 0;
        analysis.roads.totalLength = Math.round(totalLengthKm * 100) / 100;

        // Weighted Infrastructure Congestion Math
        const activeUnitsKm2 = areaKm2 > 0 ? areaKm2 : 1; 

        // Rush Hour Time Multiplier
        // We evaluate based on server's local time for simplicity. 
        // 7-9 AM (+25%), 4-6 PM (+30%)
        const currentHour = new Date().getHours();
        if (currentHour >= 7 && currentHour < 9) analysis.timeMultiplier = 1.25;
        else if (currentHour >= 16 && currentHour < 18) analysis.timeMultiplier = 1.30;
        else if (currentHour >= 11 && currentHour < 14) analysis.timeMultiplier = 1.10; // lunch
        else if (currentHour < 5 || currentHour > 22) analysis.timeMultiplier = 0.60; // night time
        
        const signalDensityScore = Math.min((analysis.trafficSignals / activeUnitsKm2) / 15, 1) * 30; // 15 signals/km² = max 30pts
        const intersectionsScore = Math.min((analysis.intersections / activeUnitsKm2) / 50, 1) * 20;
        const heavyRoadsScore = Math.min((weightedRoadScore / activeUnitsKm2) / 60, 1) * 20; 
        const oneWayRatio = roadElements.length > 0 ? analysis.oneWayRoads / roadElements.length : 0;
        const managementScore = oneWayRatio * 10;

        // Apply Time Multiplier to Base Score, distributing the leftover 20 points originally allocated to schools/hospitals
        let rawCongestion = (signalDensityScore * 1.3) + (intersectionsScore * 1.3) + (heavyRoadsScore * 1.3) + managementScore;
        analysis.congestionScore = Math.min(Math.round(rawCongestion * analysis.timeMultiplier), 100);

        analysis.congestionLevel =
            analysis.congestionScore >= 75 ? 'Severe' :
            analysis.congestionScore >= 60 ? 'Heavy' :
            analysis.congestionScore >= 40 ? 'Moderate' :
            analysis.congestionScore >= 20 ? 'Light' : 'Minimal';

        console.log(`Analysis complete. Signals: ${analysis.trafficSignals}. Final Score: ${analysis.congestionScore} (${analysis.timeMultiplier}x Time Multiplier)`);

        return res.json({
            success: true,
            data: analysis,
            metadata: {
                isRouteMode,
                center: { lat, lon },
                destination: isRouteMode ? { lat: destLat, lon: destLon } : null,
                radiusMiles: isRouteMode ? null : milesToMeters(searchRadiusMeters) / 1609.34,
                elementsProcessed: roadElements.length + infraElements.length,
                timestamp: new Date().toISOString(),
                routeDurationEstimateStr: isRouteMode ? `${Math.round(routeData.durationSeconds / 60)} minutes` : null
            },
            visualData: {
                routeCoordinates: isRouteMode ? routeGeoJsonCoords : null,
                poiMarkers: poiMarkers // Send the max 1500 limit points for Leaflet overlay
            }
        });
    } catch (error) {
        console.error('Error analyzing traffic:', error);
        const errorMessage = error instanceof Error ? error.message : 'Failed to analyze traffic';
        return res.status(500).json({ success: false, error: errorMessage });
    }
});

module.exports = router;
