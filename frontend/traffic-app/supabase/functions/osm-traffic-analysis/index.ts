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

// Accept: application/json can trigger HTTP 406 on some public Overpass instances (content negotiation).
const OVERPASS_FETCH_HEADERS: Record<string, string> = {
  'Content-Type': 'application/x-www-form-urlencoded',
  Accept: '*/*',
  'User-Agent':
    'Traffic-GeoAI/1.0 (traffic analysis; contact via https://www.openstreetmap.org/copyright)',
};

const OVERPASS_ENDPOINTS = [
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.openstreetmap.de/api/interpreter',
  'https://overpass.osm.jp/api/interpreter',
  'https://overpass.osm.ch/api/interpreter',
  'https://overpass.openstreetmap.ie/api/interpreter',
  'https://overpass-api.de/api/interpreter',
];

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

interface OverpassHttpError extends Error {
  overpassStatus?: number;
}

async function queryOverpassWithRetry(
  query: string,
  maxRetries = 8,
  startEndpointIndex = 0,
): Promise<OverpassElement[]> {
  let lastError: Error | null = null;
  const n = OVERPASS_ENDPOINTS.length;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const endpoint = OVERPASS_ENDPOINTS[(startEndpointIndex + attempt) % n];

      console.log(`Attempt ${attempt + 1}: Querying ${endpoint}`);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 90000); // 90s timeout

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: OVERPASS_FETCH_HEADERS,
        body: `data=${encodeURIComponent(query)}`,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errText = await response.text().catch(() => '');
        const err: OverpassHttpError = new Error(
          `Overpass API error: ${response.status}${errText ? ` — ${errText.slice(0, 280)}` : ''}`,
        );
        err.overpassStatus = response.status;
        throw err;
      }

      const data = await response.json();
      console.log(`Successfully retrieved ${data.elements?.length || 0} elements`);
      return data.elements || [];
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      console.log(`Attempt ${attempt + 1} failed: ${lastError.message}`);

      if (attempt < maxRetries - 1) {
        let delay = Math.pow(2, attempt) * 1000;
        const st = (error as OverpassHttpError).overpassStatus;
        if (st === 406 || st === 429) {
          delay = Math.max(delay, 5000 + attempt * 2500);
        }
        console.log(`Waiting ${delay}ms before retry...`);
        await sleep(delay);
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
    const { lat, lon, radiusMiles = 0.1 } = await req.json();

    if (!lat || !lon) {
      return new Response(
        JSON.stringify({ success: false, error: 'Latitude and longitude are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Clamp radius (miles) for performance
    const effectiveRadius = Math.min(1, Math.max(0.1, Number(radiusMiles) || 0.1));
    const radiusMeters = milesToMeters(effectiveRadius);
    const areaKm2 = Math.PI * (effectiveRadius * 1.60934) ** 2;

    console.log(`Analyzing traffic around (${lat}, ${lon}) with radius ${effectiveRadius} miles (${Math.round(radiusMeters)}m)`);

    const queryAreaStr = `(around:${radiusMeters},${lat},${lon})`;
    const roadsQuery = `
      [out:json][timeout:60];
      way["highway"~"^(motorway|trunk|primary|secondary|tertiary|residential|service|unclassified|living_street)$"]${queryAreaStr};
      out center tags;
    `;

    const trafficSignalsQuery = `
      [out:json][timeout:35];
      node["highway"="traffic_signals"]${queryAreaStr};
      out body;
    `;

    const otherInfraQuery = `
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

    console.log('Fetching OSM data (roads, traffic signals, other infra)...');
    const roadElements = await queryOverpassWithRetry(roadsQuery, 8, 0);
    await sleep(400);
    const signalElements = await queryOverpassWithRetry(trafficSignalsQuery, 8, 1);
    await sleep(400);
    const otherInfraElements = await queryOverpassWithRetry(otherInfraQuery, 8, 3);

    const infraElements = signalElements.concat(otherInfraElements);
    const allElements = roadElements.concat(infraElements);

    console.log(
      `Retrieved ${roadElements.length} road ways, ${signalElements.length} signal nodes, ${otherInfraElements.length} other infra`,
    );

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
          elementsProcessed: allElements.length,
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
