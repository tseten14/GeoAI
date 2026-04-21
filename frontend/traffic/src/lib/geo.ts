import type { POIMarker } from '@/lib/api/traffic';

/** Haversine distance in meters (matches server routes/traffic-api.js). */
export function distanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/** Keep POIs whose coordinates lie within the analysis disk (area mode). */
export function filterPoisWithinRadiusMiles(
  pois: POIMarker[],
  centerLat: number,
  centerLon: number,
  radiusMiles: number
): POIMarker[] {
  const radiusM = radiusMiles * 1609.34;
  return pois.filter((p) => distanceMeters(centerLat, centerLon, p.lat, p.lon) <= radiusM);
}
