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
}

export interface AnalysisMetadata {
  isRouteMode: boolean;
  center: { lat: number; lon: number };
  destination: { lat: number; lon: number } | null;
  radiusMiles: number | null;
  elementsProcessed: number;
  timestamp: string;
  routeDurationEstimateStr: string | null;
  /** True when OSRM path is returned but OSM corridor scan was skipped (e.g. very long routes). */
  routeAnalysisSkipped?: boolean;
  routeAnalysisSkipReason?: string | null;
  /** True when the full road-network Overpass scan was skipped; signals may still be sampled along the corridor. */
  routeCorridorLimitedScan?: boolean;
  routeCorridorLimitedScanNote?: string | null;
}

export interface POIMarker {
  type: 'signal' | 'bus_stop' | 'station';
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
  radiusMiles: number = 0.1
): Promise<TrafficResponse> {
  try {
    const payload: any = { lat, lon };
    const hasDest =
      destLat != null &&
      destLon != null &&
      destLat !== '' &&
      destLon !== '' &&
      Number.isFinite(Number(destLat)) &&
      Number.isFinite(Number(destLon));
    if (hasDest) {
      payload.destLat = Number(destLat);
      payload.destLon = Number(destLon);
    } else {
      payload.radiusMiles = radiusMiles;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 120000);
    try {
      const response = await fetch('/api/traffic-analysis', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      const data = await response.json();

      if (!response.ok) {
        return { success: false, error: data.error || `Server error: ${response.status}` };
      }

      if (data.success === false && data.error) {
        return { success: false, error: data.error };
      }

      return data;
    } finally {
      clearTimeout(timeoutId);
    }
  } catch (error) {
    const msg =
      error instanceof Error && error.name === 'AbortError'
        ? 'Request timed out. Try a shorter route or Area Radius mode.'
        : error instanceof Error
          ? error.message
          : 'Network error communicating with the server';
    return { success: false, error: msg };
  }
}

