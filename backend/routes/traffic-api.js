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

/** Shortest distance from a point to a route polyline (vertices + samples along segments; matches Overpass `around` corridor). */
function minDistanceToPolylineMeters(lat, lon, coords) {
    if (!coords || coords.length === 0) return Infinity;
    let min = Infinity;
    for (let i = 0; i < coords.length; i++) {
        const c = coords[i];
        const d = getDistanceFromLatLonInM(lat, lon, c[0], c[1]);
        if (d < min) min = d;
    }
    for (let i = 0; i < coords.length - 1; i++) {
        const a = coords[i];
        const b = coords[i + 1];
        const segLen = getDistanceFromLatLonInM(a[0], a[1], b[0], b[1]);
        const steps = Math.min(24, Math.max(1, Math.ceil(segLen / 40)));
        for (let s = 0; s <= steps; s++) {
            const t = s / steps;
            const plat = a[0] + t * (b[0] - a[0]);
            const plon = a[1] + t * (b[1] - a[1]);
            const d = getDistanceFromLatLonInM(lat, lon, plat, plon);
            if (d < min) min = d;
        }
    }
    return min;
}

/**
 * Overpass `around` can still return POIs slightly outside the disk (e.g. way centers).
 * Keep only markers that strictly lie inside the analysis region for map + counts.
 */
function filterPoiMarkersToAnalysisRegion(poiMarkers, opts) {
    const { isRouteMode, centerLat, centerLon, radiusMeters, routeCoords, routeCorridorMeters } = opts;
    if (isRouteMode) {
        // Overpass query uses `around:250` on the route; allow small margin for sampling vs true distance-to-line.
        const maxD = routeCorridorMeters != null ? routeCorridorMeters : 255;
        if (routeCoords && routeCoords.length >= 1) {
            return poiMarkers.filter((p) => minDistanceToPolylineMeters(p.lat, p.lon, routeCoords) <= maxD);
        }
        return poiMarkers;
    }
    if (radiusMeters > 0) {
        return poiMarkers.filter((p) => getDistanceFromLatLonInM(centerLat, centerLon, p.lat, p.lon) <= radiusMeters);
    }
    return poiMarkers;
}

// Estimated segment length per road type (meters) when Overpass returns no geometry — avoids huge `out geom` payloads that trigger 406/blocks on public instances.
function estimateRoadLength(roadType) {
    const avgLengths = {
        motorway: 2000,
        trunk: 1500,
        primary: 800,
        secondary: 500,
        tertiary: 400,
        residential: 200,
        service: 100,
        unclassified: 300,
        living_street: 150,
    };
    return avgLengths[roadType] || 200;
}

// Overpass: use a descriptive User-Agent; Accept: application/json can trigger HTTP 406 on some instances (content negotiation).
const OVERPASS_AXIOS_HEADERS = {
    'Content-Type': 'application/x-www-form-urlencoded',
    Accept: '*/*',
    'User-Agent':
        'Traffic-GeoAI/1.0 (traffic analysis; contact via https://www.openstreetmap.org/copyright)',
};

// Public mirrors vary in reliability; some return HTTP 200 with empty elements. Put a stable global instance first.
// Do not use overpass.osm.jp — TLS cert does not match hostname. Override with OVERPASS_URL for a private instance.
const DEFAULT_OVERPASS_ENDPOINTS = [
    'https://overpass-api.de/api/interpreter',
    'https://lz4.overpass-api.de/api/interpreter',
    'https://overpass.kumi.systems/api/interpreter',
    'https://overpass.openstreetmap.fr/api/interpreter',
    'https://overpass.osm.ch/api/interpreter',
];

function getOverpassEndpoints() {
    const u = process.env.OVERPASS_URL;
    if (u && typeof u === 'string' && u.trim().startsWith('http')) {
        const base = u.trim().replace(/\/$/, '');
        if (base.includes('/api/interpreter')) {
            return [base];
        }
        return [`${base}/api/interpreter`];
    }
    return DEFAULT_OVERPASS_ENDPOINTS;
}

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Client HTTP timeout per Overpass attempt — long waits block corridor scans; mirrors are rotated instead. */
function getOverpassHttpTimeoutMs() {
    const t = parseInt(process.env.OVERPASS_HTTP_TIMEOUT_MS || '', 10);
    if (Number.isFinite(t) && t >= 12000 && t <= 120000) return t;
    return 26000;
}

/** Overpass often returns { elements: [], remark: "runtime error: ..." } with HTTP 200. */
function parseOverpassResponse(data) {
    if (data == null || typeof data !== 'object') {
        return { elements: [], remark: null };
    }
    const remark = data.remark || data.error || null;
    const elements = Array.isArray(data.elements) ? data.elements : [];
    if (remark) {
        console.warn('Overpass remark:', String(remark).slice(0, 500));
    }
    return { elements, remark };
}

/** Approximate OSM bbox (south,west,north,east) for fallback queries when around: is finicky. */
function bboxAroundPoint(lat, lon, radiusMeters) {
    const rKm = radiusMeters / 1000;
    const dLat = rKm / 111.32;
    const cosLat = Math.cos((lat * Math.PI) / 180);
    const dLon = rKm / (111.32 * Math.max(0.2, Math.abs(cosLat)));
    return {
        south: lat - dLat,
        west: lon - dLon,
        north: lat + dLat,
        east: lon + dLon,
    };
}

/**
 * Driving routes longer than this skip the heavy road-way Overpass union and fetch traffic signals in
 * small sequential queries (one short polyline per request) so public Overpass does not time out.
 */
const ROUTE_LITE_CORRIDOR_M = 150 * 1000; // 150 km

const HIGHWAY_ROAD_RE = '^(motorway|trunk|primary|secondary|tertiary|residential|service|unclassified|living_street)$';

/**
 * One giant `around:buffer,polyline` on a long route often times out on public Overpass.
 * Split into overlapping short polylines and union them in one query.
 */
function chunkCoordsForRouteOverpass(coords, maxPointsPerChunk = 4) {
    if (!coords || coords.length < 2) return coords && coords.length ? [coords] : [];
    const chunks = [];
    const step = Math.max(1, maxPointsPerChunk - 1);
    for (let i = 0; i < coords.length; i += step) {
        const chunk = coords.slice(i, Math.min(i + maxPointsPerChunk, coords.length));
        if (chunk.length >= 2) chunks.push(chunk);
        if (i + maxPointsPerChunk >= coords.length) break;
    }
    return chunks.length ? chunks : [coords];
}

function polylineCoordsString(chunk) {
    return chunk.map((c) => `${c[0]},${c[1]}`).join(',');
}

/** Evenly spaced samples along a decoded route (for long-route corridor scans without huge Overpass unions). */
function samplePolylineEvenly(coords, maxPoints) {
    if (!coords || coords.length < 2) return coords && coords.length ? coords.slice() : [];
    if (coords.length <= maxPoints) return coords.slice();
    const out = [];
    const last = coords.length - 1;
    for (let i = 0; i < maxPoints; i++) {
        const idx = Math.round((i / (maxPoints - 1)) * last);
        out.push(coords[idx]);
    }
    const deduped = [out[0]];
    for (let i = 1; i < out.length; i++) {
        const prev = deduped[deduped.length - 1];
        const cur = out[i];
        if (cur[0] !== prev[0] || cur[1] !== prev[1]) deduped.push(cur);
    }
    return deduped.length >= 2 ? deduped : coords.slice(0, 2);
}

function dedupeOverpassElements(elements) {
    const seen = new Map();
    for (const el of elements) {
        if (el && el.type != null && el.id != null) {
            const k = `${el.type}/${el.id}`;
            if (!seen.has(k)) seen.set(k, el);
        }
    }
    return Array.from(seen.values());
}

/** Build three Overpass queries for route mode (union of short `around` corridors). */
function buildRouteModeQueries(sampledCoords, bufferMeters, maxPointsPerChunk = 6) {
    const segments = chunkCoordsForRouteOverpass(sampledCoords, maxPointsPerChunk);
    const buf = bufferMeters;

    const roadParts = segments.map((seg) => {
        const pol = polylineCoordsString(seg);
        return `  way["highway"~"${HIGHWAY_ROAD_RE}"](around:${buf},${pol})`;
    });

    const signalParts = [];
    for (const seg of segments) {
        const pol = polylineCoordsString(seg);
        signalParts.push(
            `  node["highway"="traffic_signals"](around:${buf},${pol})`,
            `  node["crossing"="traffic_signals"](around:${buf},${pol})`,
            `  way["highway"="traffic_signals"](around:${buf},${pol})`,
            `  way["crossing"="traffic_signals"](around:${buf},${pol})`
        );
    }

    const otherParts = [];
    for (const seg of segments) {
        const pol = polylineCoordsString(seg);
        otherParts.push(
            `  node["highway"="bus_stop"](around:${buf},${pol})`,
            `  node["railway"="station"](around:${buf},${pol})`,
            `  way["amenity"="parking"](around:${buf},${pol})`,
            `  way["bridge"="yes"]["highway"](around:${buf},${pol})`,
            `  way["tunnel"="yes"]["highway"](around:${buf},${pol})`
        );
    }

    const roadsQuery = `
      [out:json][timeout:60];
      (
      ${roadParts.join(';\n')}
      );
      out body;
    `;

    const trafficSignalsQuery = `
      [out:json][timeout:60];
      (
      ${signalParts.join(';\n')}
      );
      out center;
    `;

    const otherInfraQuery = `
      [out:json][timeout:60];
      (
      ${otherParts.join(';\n')}
      );
      out body;
    `;

    return { roadsQuery, trafficSignalsQuery, otherInfraQuery };
}

async function fetchRouteFromOSRM(lat1, lon1, lat2, lon2) {
    try {
        const url = `https://router.project-osrm.org/route/v1/driving/${lon1},${lat1};${lon2},${lat2}?overview=full&alternatives=true`;
        const response = await axios.get(url, { timeout: 90000 });
        const data = response.data;
        if (data?.code === 'Ok' && Array.isArray(data.routes) && data.routes.length > 0) {
            return data.routes.map((route) => ({
                geometry: route.geometry,
                distanceMeters: route.distance,
                durationSeconds: route.duration,
            }));
        }
        const code = data?.code || 'Unknown';
        const hint = data?.message || '';
        throw new Error(
            code === 'NoRoute'
                ? 'OSRM could not find a driving route between these points (try closer points or check coordinates).'
                : `OSRM routing failed (${code})${hint ? `: ${hint}` : ''}`
        );
    } catch (error) {
        if (error instanceof Error && error.message.startsWith('OSRM')) {
            throw error;
        }
        throw new Error(`Failed to fetch route: ${error instanceof Error ? error.message : String(error)}`);
    }
}

async function queryOverpassWithRetry(query, maxRetries = 8, startEndpointIndex = 0) {
    let lastError = null;
    const endpoints = getOverpassEndpoints();
    const n = endpoints.length;
    const httpTimeout = getOverpassHttpTimeoutMs();

    for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
            const endpoint = endpoints[(startEndpointIndex + attempt) % n];

            console.log(`Attempt ${attempt + 1}: Querying ${endpoint}`);

            const body = `data=${encodeURIComponent(query)}`;
            const response = await axios.post(endpoint, body, {
                headers: OVERPASS_AXIOS_HEADERS,
                timeout: httpTimeout,
                maxContentLength: Infinity,
                maxBodyLength: Infinity,
                validateStatus: (status) => status === 200,
                responseType: 'json',
                transitional: { clarifyTimeoutError: true },
            });

            const { elements, remark } = parseOverpassResponse(response.data);
            if (elements.length === 0 && attempt < maxRetries - 1) {
                // Some mirrors return HTTP 200 with [] while others return real data for the same query.
                // We must rotate through mirrors (not stop after 2 tries), or signal/infra counts stay at 0.
                const rotateEmptyMirrors = !remark && attempt < Math.min(n, maxRetries - 1);
                if (remark || rotateEmptyMirrors) {
                    if (remark) {
                        console.warn('Overpass returned 0 elements with a remark (timeout or overload); trying another mirror...');
                    } else {
                        console.warn('Overpass returned 0 elements; trying another mirror...');
                    }
                    const delay = Math.pow(2, attempt) * 800;
                    await sleep(delay);
                    continue;
                }
            }
            console.log(`Successfully retrieved ${elements.length} elements`);
            return elements;
        } catch (error) {
            const status = axios.isAxiosError(error) && error.response ? error.response.status : undefined;
            const snippet =
                axios.isAxiosError(error) && error.response && typeof error.response.data === 'string'
                    ? error.response.data.slice(0, 280)
                    : '';
            const msg =
                status != null
                    ? `Overpass API error: ${status}${snippet ? ` — ${snippet}` : ''}`
                    : error instanceof Error
                      ? error.message
                      : String(error);
            lastError = new Error(msg);
            if (status != null) {
                lastError.overpassStatus = status;
            }
            console.log(`Attempt ${attempt + 1} failed: ${lastError.message}`);

            if (attempt < maxRetries - 1) {
                const st = lastError.overpassStatus;
                const isTimeoutMsg =
                    lastError.message.includes('timeout') || lastError.message.includes('ETIMEDOUT');
                // Rotate mirrors quickly on overload (504/503/429) or client timeout — do not wait 5s+ per mirror.
                const quickRotate =
                    st === 429 ||
                    st === 502 ||
                    st === 503 ||
                    st === 504 ||
                    isTimeoutMsg;
                const delay = quickRotate
                    ? 350 + attempt * 200
                    : Math.min(8000, Math.pow(2, attempt) * 1000);
                console.log(`Waiting ${delay}ms before retry...`);
                await sleep(delay);
            }
        }
    }

    throw lastError || new Error('All retry attempts failed');
}

/**
 * Long routes: many small Overpass queries along the polyline. One failure must not drop OSRM geometry.
 * Uses node-only traffic_signal queries (lighter than ways) and rotates mirror offset per segment.
 * @returns {{ elements: Array, failedSegments: number }}
 */
async function querySignalsAlongRouteSegmentsSequential(segments, bufferMeters) {
    const buf = bufferMeters;
    const merged = [];
    const seen = new Map();
    const nMirrors = getOverpassEndpoints().length;
    let failedSegments = 0;
    let segIdx = 0;
    for (const seg of segments) {
        if (!seg || seg.length < 2) continue;
        const pol = polylineCoordsString(seg);
        const q = `
[out:json][timeout:32];
(
  node["highway"="traffic_signals"](around:${buf},${pol});
  node["crossing"="traffic_signals"](around:${buf},${pol});
);
out center;
`;
        try {
            const els = await queryOverpassWithRetry(q, 4, segIdx % nMirrors);
            for (const el of els) {
                if (el && el.type != null && el.id != null) {
                    const k = `${el.type}/${el.id}`;
                    if (!seen.has(k)) {
                        seen.set(k, el);
                        merged.push(el);
                    }
                }
            }
        } catch (err) {
            failedSegments++;
            console.warn(
                `Corridor segment Overpass failed (${failedSegments}/${segments.length}):`,
                err instanceof Error ? err.message : err
            );
        }
        segIdx++;
        await sleep(280);
    }
    if (failedSegments > 0) {
        console.warn(
            `Long-route signal scan: ${failedSegments} segment(s) failed; kept ${merged.length} OSM elements.`
        );
    }
    return { elements: merged, failedSegments };
}

router.post('/traffic-analysis', async (req, res) => {
    try {
        const { lat, lon, destLat, destLon, radiusMiles: rawRadiusMiles } = req.body;

        if (lat == null || lon == null) {
            return res.status(400).json({ success: false, error: 'Origin latitude and longitude are required' });
        }

        const latN = parseFloat(lat);
        const lonN = parseFloat(lon);
        if (!Number.isFinite(latN) || !Number.isFinite(lonN)) {
            return res.status(400).json({ success: false, error: 'Invalid latitude or longitude' });
        }
        if (latN < -90 || latN > 90 || lonN < -180 || lonN > 180) {
            return res.status(400).json({ success: false, error: 'Coordinates out of range' });
        }

        let radiusMi = 0.1;
        if (rawRadiusMiles !== undefined && rawRadiusMiles !== null && rawRadiusMiles !== '') {
            const r = parseFloat(rawRadiusMiles);
            if (Number.isFinite(r)) {
                radiusMi = Math.min(1, Math.max(0.1, r));
            }
        }

        const isRouteMode = destLat != null && destLon != null && destLat !== '' && destLon !== '';
        let routeData = null;
        let queryAreaStr = '';
        let searchRadiusMeters = 0;
        let routeGeoJsonCoordsList = [];

        let destLatN = NaN;
        let destLonN = NaN;
        if (isRouteMode) {
            destLatN = parseFloat(destLat);
            destLonN = parseFloat(destLon);
            if (!Number.isFinite(destLatN) || !Number.isFinite(destLonN)) {
                return res.status(400).json({ success: false, error: 'Invalid destination coordinates' });
            }
        }

        let roadsQuery;
        let trafficSignalsQuery;
        let otherInfraQuery;
        let isLiteCorridor = false;
        let useChunkedRouteSignals = false;
        let routeChunkedSampleCoords = null;

        if (isRouteMode) {
            console.log(`Fetching route from (${latN}, ${lonN}) to (${destLatN}, ${destLonN})`);
            const allRoutes = await fetchRouteFromOSRM(latN, lonN, destLatN, destLonN);
            routeData = allRoutes[0]; // Primary route is still used for stats

            const routeDistanceM = Number(routeData.distanceMeters);
            if (!Number.isFinite(routeDistanceM) || routeDistanceM <= 0) {
                return res.status(400).json({
                    success: false,
                    error:
                        'Could not determine driving distance for this route (OSRM). Check coordinates and try again.',
                });
            }

            // Decode all routes for the map (needed before long-route early return)
            routeGeoJsonCoordsList = allRoutes.map((r) => ({
                coordinates: polyline.decode(r.geometry).map((c) => [c[0], c[1]]), // [lat, lon]
                durationSeconds: r.durationSeconds,
                distanceMeters: r.distanceMeters,
            }));

            const decodedCoords = routeGeoJsonCoordsList[0].coordinates;
            isLiteCorridor = routeDistanceM > ROUTE_LITE_CORRIDOR_M;
            if (isLiteCorridor) {
                const km = routeDistanceM / 1000;
                console.log(
                    `Route ${km.toFixed(0)} km exceeds ${ROUTE_LITE_CORRIDOR_M / 1000} km: chunked traffic-signal scan only (full road OSM union skipped)`
                );
                useChunkedRouteSignals = true;
                routeChunkedSampleCoords = samplePolylineEvenly(decodedCoords, 6);
                roadsQuery = null;
                trafficSignalsQuery = null;
                otherInfraQuery = null;
            } else {
                // Cap samples and use fatter chunks so the union stays under public Overpass limits (avoids HTTP 400).
                const sampledCoords = samplePolylineEvenly(decodedCoords, 10);

                // 250 m corridor; union of short polylines (OK for shorter drives)
                const routeQueries = buildRouteModeQueries(sampledCoords, 250, 6);
                roadsQuery = routeQueries.roadsQuery;
                trafficSignalsQuery = routeQueries.trafficSignalsQuery;
                otherInfraQuery = routeQueries.otherInfraQuery;
            }
        } else {
            searchRadiusMeters = milesToMeters(radiusMi);
            console.log(`Analyzing radius around (${latN}, ${lonN}) with radius ${radiusMi} miles (${Math.round(searchRadiusMeters)} m)`);
            const queryAreaStr = `(around:${searchRadiusMeters},${latN},${lonN})`;

            roadsQuery = `
      [out:json][timeout:60];
      way["highway"~"${HIGHWAY_ROAD_RE}"]${queryAreaStr};
      out body;
    `;

            trafficSignalsQuery = `
      [out:json][timeout:35];
      (
        node["highway"="traffic_signals"]${queryAreaStr};
        node["crossing"="traffic_signals"]${queryAreaStr};
        way["highway"="traffic_signals"]${queryAreaStr};
        way["crossing"="traffic_signals"]${queryAreaStr};
      );
      out center;
    `;

            otherInfraQuery = `
      [out:json][timeout:45];
      (
        node["highway"="bus_stop"]${queryAreaStr};
        node["railway"="station"]${queryAreaStr};
        way["amenity"="parking"]${queryAreaStr};
        way["bridge"="yes"]["highway"]${queryAreaStr};
        way["tunnel"="yes"]["highway"]${queryAreaStr};
      );
      out body;
    `;
        }

        let roadElements = [];
        let signalElements = [];
        let otherInfraElements = [];
        let longRouteSignalSegmentsFailed = 0;
        let routeUnionFallbackApplied = false;

        if (useChunkedRouteSignals) {
            if (routeChunkedSampleCoords && routeChunkedSampleCoords.length >= 2) {
                const segments = chunkCoordsForRouteOverpass(routeChunkedSampleCoords, 5);
                console.log(
                    `Fetching OSM data (${segments.length} sequential traffic-signal corridor queries; long route)...`
                );
                const segRes = await querySignalsAlongRouteSegmentsSequential(segments, 320);
                longRouteSignalSegmentsFailed = segRes.failedSegments;
                signalElements = dedupeOverpassElements(segRes.elements);
            } else {
                console.warn('Chunked route signals skipped: insufficient sample coordinates');
            }
        } else if (isRouteMode) {
            console.log('Fetching OSM data (roads, then traffic signals, then other infra)...');
            try {
                if (roadsQuery) {
                    roadElements = await queryOverpassWithRetry(roadsQuery, 8, 0);
                    roadElements = dedupeOverpassElements(roadElements);
                }
                await sleep(400);
                signalElements = await queryOverpassWithRetry(trafficSignalsQuery, 8, 0);
                signalElements = dedupeOverpassElements(signalElements);
                await sleep(400);
                if (otherInfraQuery) {
                    otherInfraElements = await queryOverpassWithRetry(otherInfraQuery, 8, 0);
                    otherInfraElements = dedupeOverpassElements(otherInfraElements);
                }
            } catch (err) {
                const msg = err instanceof Error ? err.message : String(err);
                console.warn(
                    'Route-mode Overpass union failed (query too large or instance error); falling back to chunked signal-only scan:',
                    msg
                );
                routeUnionFallbackApplied = true;
                roadElements = [];
                otherInfraElements = [];
                const decodedCoords = routeGeoJsonCoordsList[0]?.coordinates;
                if (decodedCoords && decodedCoords.length >= 2) {
                    const fallbackSamples = samplePolylineEvenly(decodedCoords, 10);
                    const segments = chunkCoordsForRouteOverpass(fallbackSamples, 5);
                    console.log(
                        `Fetching OSM data (${segments.length} sequential traffic-signal corridor queries; route fallback)...`
                    );
                    const segRes = await querySignalsAlongRouteSegmentsSequential(segments, 320);
                    longRouteSignalSegmentsFailed = segRes.failedSegments;
                    signalElements = dedupeOverpassElements(segRes.elements);
                } else {
                    throw err;
                }
            }
        } else {
            console.log('Fetching OSM data (roads, then traffic signals, then other infra)...');
            if (roadsQuery) {
                roadElements = await queryOverpassWithRetry(roadsQuery, 8, 0);
                roadElements = dedupeOverpassElements(roadElements);
            }
            await sleep(400);
            signalElements = await queryOverpassWithRetry(trafficSignalsQuery, 8, 0);
            signalElements = dedupeOverpassElements(signalElements);
            if (signalElements.length === 0) {
                const bb = bboxAroundPoint(latN, lonN, searchRadiusMeters);
                const bboxStr = `(${bb.south},${bb.west},${bb.north},${bb.east})`;
                const trafficSignalsBboxQuery = `
      [out:json][timeout:35];
      (
        node["highway"="traffic_signals"]${bboxStr};
        node["crossing"="traffic_signals"]${bboxStr};
        way["highway"="traffic_signals"]${bboxStr};
        way["crossing"="traffic_signals"]${bboxStr};
      );
      out center;
    `;
                console.log('Traffic-signal around-query returned 0 elements; retrying with bbox fallback...');
                signalElements = await queryOverpassWithRetry(trafficSignalsBboxQuery, 8, 0);
            }
            await sleep(400);
            if (otherInfraQuery) {
                otherInfraElements = await queryOverpassWithRetry(otherInfraQuery, 8, 0);
                otherInfraElements = dedupeOverpassElements(otherInfraElements);
            }
        }

        const infraElements = signalElements.concat(otherInfraElements);
        const allElements = roadElements.concat(infraElements);
        console.log(
            `Retrieved ${roadElements.length} road ways, ${signalElements.length} traffic-signal nodes, ${otherInfraElements.length} other infra elements`
        );

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
                            }
                        }
                    } else {
                        wayLength = estimateRoadLength(roadType);
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
            const elLat =
                element.lat != null
                    ? element.lat
                    : element.center && element.center.lat != null
                      ? element.center.lat
                      : undefined;
            const elLon =
                element.lon != null
                    ? element.lon
                    : element.center && element.center.lon != null
                      ? element.center.lon
                      : undefined;

            // Tally tags and store marker info for frontend mapping (heatmap / points need lat/lon)
            const isTrafficSignalLike =
                element.tags?.highway === 'traffic_signals' || element.tags?.crossing === 'traffic_signals';
            if (isTrafficSignalLike) {
                analysis.trafficSignals++;
                if (elLat != null && elLon != null) {
                    poiMarkers.push({ type: 'signal', lat: elLat, lon: elLon, id: element.id });
                }
            }
            if (element.tags?.highway === 'bus_stop') {
                analysis.busStops++;
                if (elLat != null && elLon != null) {
                    poiMarkers.push({ type: 'bus_stop', lat: elLat, lon: elLon, id: element.id });
                }
            }
            if (element.tags?.railway === 'station') {
                analysis.railwayStations++;
                if (elLat != null && elLon != null) {
                    poiMarkers.push({ type: 'station', lat: elLat, lon: elLon, id: element.id });
                }
            }
            if (element.tags?.amenity === 'parking') {
                analysis.parkingAreas++;
            }
            if (element.tags?.bridge === 'yes' || element.tags?.tunnel === 'yes') {
                analysis.bridgesAndTunnels++;
            }
        }

        const routeCoordsForFilter =
            isRouteMode && routeGeoJsonCoordsList[0] ? routeGeoJsonCoordsList[0].coordinates : null;
        const filteredPois = filterPoiMarkersToAnalysisRegion(poiMarkers, {
            isRouteMode,
            centerLat: latN,
            centerLon: lonN,
            radiusMeters: searchRadiusMeters,
            routeCoords: routeCoordsForFilter,
            routeCorridorMeters: 340,
        });
        poiMarkers.length = 0;
        for (const p of filteredPois) poiMarkers.push(p);

        analysis.trafficSignals = filteredPois.filter((p) => p.type === 'signal').length;
        analysis.busStops = filteredPois.filter((p) => p.type === 'bus_stop').length;
        analysis.railwayStations = filteredPois.filter((p) => p.type === 'station').length;

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

        // Weighted Infrastructure Congestion Math (static OSM only—no time-of-day factor)
        const activeUnitsKm2 = areaKm2 > 0 ? areaKm2 : 1; 

        const signalDensityScore = Math.min((analysis.trafficSignals / activeUnitsKm2) / 15, 1) * 30; // 15 signals/km² = max 30pts
        const intersectionsScore = Math.min((analysis.intersections / activeUnitsKm2) / 50, 1) * 20;
        const heavyRoadsScore = Math.min((weightedRoadScore / activeUnitsKm2) / 60, 1) * 20; 
        const oneWayRatio = roadElements.length > 0 ? analysis.oneWayRoads / roadElements.length : 0;
        const managementScore = oneWayRatio * 10;

        const rawCongestion = (signalDensityScore * 1.3) + (intersectionsScore * 1.3) + (heavyRoadsScore * 1.3) + managementScore;
        analysis.congestionScore = Math.min(Math.round(rawCongestion), 100);

        analysis.congestionLevel =
            analysis.congestionScore >= 75 ? 'Severe' :
            analysis.congestionScore >= 60 ? 'Heavy' :
            analysis.congestionScore >= 40 ? 'Moderate' :
            analysis.congestionScore >= 20 ? 'Light' : 'Minimal';

        console.log(
            `Analysis complete. Signals: ${analysis.trafficSignals}, map POIs: ${poiMarkers.length}. Final Score: ${analysis.congestionScore}`
        );

        const poiMarkersForMap = poiMarkers.slice(0, 2500);

        return res.json({
            success: true,
            data: analysis,
            metadata: {
                isRouteMode,
                center: { lat: latN, lon: lonN },
                destination: isRouteMode ? { lat: destLatN, lon: destLonN } : null,
                radiusMiles: isRouteMode ? null : radiusMi,
                elementsProcessed: allElements.length,
                timestamp: new Date().toISOString(),
                routeDurationEstimateStr: isRouteMode ? `${Math.round(routeData.durationSeconds / 60)} minutes` : null,
                routeCorridorLimitedScan: isRouteMode && isLiteCorridor ? true : undefined,
                routeCorridorLimitedScanNote:
                    isRouteMode && isLiteCorridor
                        ? 'This route is longer than ~150 km. Traffic signals are sampled along the corridor in small OSM requests; full road-network scan was skipped to avoid timeouts.'
                        : undefined,
                routeSignalScanDegraded:
                    isRouteMode && isLiteCorridor && longRouteSignalSegmentsFailed > 0 ? true : undefined,
                routeSignalScanNote:
                    isRouteMode && isLiteCorridor && longRouteSignalSegmentsFailed > 0
                        ? `Some OSM corridor requests failed (${longRouteSignalSegmentsFailed} segment(s)). The driving route is still shown; signal markers may be incomplete.`
                        : undefined,
                routeUnionFallbackApplied: isRouteMode && routeUnionFallbackApplied ? true : undefined,
                routeUnionFallbackNote:
                    isRouteMode && routeUnionFallbackApplied
                        ? 'The full corridor OSM query was rejected or failed; traffic signals were loaded with smaller requests along the route. Road and other POI detail from that pass may be missing.'
                        : undefined,
            },
            visualData: {
                routes: isRouteMode ? routeGeoJsonCoordsList : null,
                poiMarkers: poiMarkersForMap,
            },
        });
    } catch (error) {
        console.error('Error analyzing traffic:', error);
        const errorMessage = error instanceof Error ? error.message : 'Failed to analyze traffic';
        return res.status(500).json({ success: false, error: errorMessage });
    }
});

module.exports = router;
