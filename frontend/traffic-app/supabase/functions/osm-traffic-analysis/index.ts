const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface TrafficAnalysis {
  roads: {
    total: number;
    byType: Record<string, number>;
    totalLength: number;
  };
  intersections: number;
  trafficSignals: number;
  speedLimits: Record<string, number>;
  oneWayRoads: number;
  parkingAreas: number;
  busStops: number;
  railwayStations: number;
  bridgesAndTunnels: number;
  roadDensity: number;
  connectivityScore: number;
}

interface OverpassElement {
  type: string;
  id: number;
  tags?: Record<string, string>;
  nodes?: number[];
  center?: { lat: number; lon: number };
  bounds?: { minlat: number; minlon: number; maxlat: number; maxlon: number };
}

async function queryOverpassWithRetry(query: string, maxRetries = 3): Promise<OverpassElement[]> {
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      // Use different Overpass endpoints for load balancing
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
        // Exponential backoff: 1s, 2s, 4s
        const delay = Math.pow(2, attempt) * 1000;
        console.log(`Waiting ${delay}ms before retry...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  throw lastError || new Error('All retry attempts failed');
}

function milesToMeters(miles: number): number {
  return miles * 1609.34;
}

// Estimate road length based on road type (average lengths in meters)
function estimateRoadLength(roadType: string): number {
  const avgLengths: Record<string, number> = {
    motorway: 2000,
    trunk: 1500,
    primary: 800,
    secondary: 500,
    tertiary: 400,
    residential: 200,
    service: 100,
    unclassified: 300,
    living_street: 150,
    pedestrian: 100,
    track: 500,
    path: 200,
    footway: 100,
    cycleway: 150,
  };
  return avgLengths[roadType] || 200;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { lat, lon, radiusMiles = 5 } = await req.json();

    if (!lat || !lon) {
      return new Response(
        JSON.stringify({ success: false, error: 'Latitude and longitude are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Cap radius at 5 miles for performance
    const effectiveRadius = Math.min(radiusMiles, 5);
    const radiusMeters = milesToMeters(effectiveRadius);
    const areaKm2 = Math.PI * (effectiveRadius * 1.60934) ** 2;

    console.log(`Analyzing traffic around (${lat}, ${lon}) with radius ${effectiveRadius} miles (${Math.round(radiusMeters)}m)`);

    // Optimized query: Use 'out center' instead of 'out geom', shorter timeout
    // Split into focused queries for better performance
    const roadsQuery = `
      [out:json][timeout:45];
      way["highway"~"^(motorway|trunk|primary|secondary|tertiary|residential|service|unclassified|living_street)$"](around:${radiusMeters},${lat},${lon});
      out center tags;
    `;

    const infrastructureQuery = `
      [out:json][timeout:30];
      (
        node["highway"="traffic_signals"](around:${radiusMeters},${lat},${lon});
        node["highway"="bus_stop"](around:${radiusMeters},${lat},${lon});
        node["railway"="station"](around:${radiusMeters},${lat},${lon});
        way["amenity"="parking"](around:${radiusMeters},${lat},${lon});
        way["bridge"="yes"]["highway"](around:${radiusMeters},${lat},${lon});
        way["tunnel"="yes"]["highway"](around:${radiusMeters},${lat},${lon});
      );
      out center tags;
    `;

    // Run queries in parallel for speed
    console.log('Fetching road data...');
    const [roadElements, infraElements] = await Promise.all([
      queryOverpassWithRetry(roadsQuery),
      queryOverpassWithRetry(infrastructureQuery),
    ]);

    console.log(`Retrieved ${roadElements.length} roads, ${infraElements.length} infrastructure elements`);

    // Process the data
    const analysis: TrafficAnalysis = {
      roads: {
        total: 0,
        byType: {},
        totalLength: 0,
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
    };

    const nodeConnections: Map<number, number> = new Map();

    // Process roads
    for (const element of roadElements) {
      if (element.type === 'way' && element.tags?.highway) {
        const roadType = element.tags.highway;
        
        analysis.roads.total++;
        analysis.roads.byType[roadType] = (analysis.roads.byType[roadType] || 0) + 1;

        // Estimate road length based on type
        analysis.roads.totalLength += estimateRoadLength(roadType);

        if (element.tags.oneway === 'yes') {
          analysis.oneWayRoads++;
        }

        if (element.tags.maxspeed) {
          const speedLimit = element.tags.maxspeed;
          analysis.speedLimits[speedLimit] = (analysis.speedLimits[speedLimit] || 0) + 1;
        }

        // Count node connections for intersections (estimate)
        if (element.nodes) {
          for (const nodeId of element.nodes) {
            nodeConnections.set(nodeId, (nodeConnections.get(nodeId) || 0) + 1);
          }
        }
      }
    }

    // Process infrastructure
    for (const element of infraElements) {
      if (element.type === 'node') {
        if (element.tags?.highway === 'traffic_signals') {
          analysis.trafficSignals++;
        }
        if (element.tags?.highway === 'bus_stop') {
          analysis.busStops++;
        }
        if (element.tags?.railway === 'station') {
          analysis.railwayStations++;
        }
      }

      if (element.type === 'way') {
        if (element.tags?.amenity === 'parking') {
          analysis.parkingAreas++;
        }
        if (element.tags?.bridge === 'yes' || element.tags?.tunnel === 'yes') {
          analysis.bridgesAndTunnels++;
        }
      }
    }

    // Estimate intersections (nodes connected to 3+ roads)
    for (const connections of nodeConnections.values()) {
      if (connections >= 3) {
        analysis.intersections++;
      }
    }

    // Calculate road density (km of road per km²)
    const totalLengthKm = analysis.roads.totalLength / 1000;
    analysis.roadDensity = Math.round((totalLengthKm / areaKm2) * 100) / 100;
    analysis.roads.totalLength = Math.round(totalLengthKm * 100) / 100;

    // Calculate connectivity score (0-100)
    const baseScore = Math.min(analysis.intersections / 100, 1) * 30;
    const signalScore = Math.min(analysis.trafficSignals / 50, 1) * 20;
    const densityScore = Math.min(analysis.roadDensity / 15, 1) * 30;
    const transitScore = Math.min((analysis.busStops + analysis.railwayStations) / 20, 1) * 20;
    analysis.connectivityScore = Math.round(baseScore + signalScore + densityScore + transitScore);

    console.log('Analysis complete:', JSON.stringify(analysis, null, 2));

    return new Response(
      JSON.stringify({
        success: true,
        data: analysis,
        metadata: {
          center: { lat, lon },
          radiusMiles: effectiveRadius,
          radiusKm: Math.round(effectiveRadius * 1.60934 * 100) / 100,
          areaKm2: Math.round(areaKm2 * 100) / 100,
          elementsProcessed: roadElements.length + infraElements.length,
          timestamp: new Date().toISOString(),
        },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error analyzing traffic:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to analyze traffic';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
