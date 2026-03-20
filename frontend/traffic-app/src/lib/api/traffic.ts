export interface TrafficAnalysis {
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
  congestionScore: number;
  congestionLevel: string;
  timeMultiplier: number;
}

export interface AnalysisMetadata {
  isRouteMode: boolean;
  center: { lat: number; lon: number };
  destination: { lat: number; lon: number } | null;
  radiusMiles: number | null;
  elementsProcessed: number;
  timestamp: string;
  routeDurationEstimateStr: string | null;
}

export interface POIMarker {
  type: 'signal';
  lat: number;
  lon: number;
  id: number;
}

export interface RouteData {
  coordinates: [number, number][];
  durationSeconds: number;
  distanceMeters: number;
}

export interface TrafficVisualData {
  routes: RouteData[] | null;
  poiMarkers: POIMarker[];
}

export interface TrafficResponse {
  success: boolean;
  error?: string;
  data?: TrafficAnalysis;
  metadata?: AnalysisMetadata;
  visualData?: TrafficVisualData;
}

export async function analyzeTraffic(
  lat: number,
  lon: number,
  destLat?: number,
  destLon?: number,
  radiusMiles: number = 5
): Promise<TrafficResponse> {
  try {
    const payload: any = { lat, lon };
    if (destLat && destLon) {
      payload.destLat = destLat;
      payload.destLon = destLon;
    } else {
      payload.radiusMiles = radiusMiles;
    }

    const response = await fetch('/api/traffic-analysis', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();

    if (!response.ok) {
      return { success: false, error: data.error || `Server error: ${response.status}` };
    }

    if (data.success === false && data.error) {
      return { success: false, error: data.error };
    }

    return data;
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Network error communicating with the server'
    };
  }
}

