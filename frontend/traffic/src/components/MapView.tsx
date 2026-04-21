import { useEffect, useMemo, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.heat'; // Import the heatmap plugin
import { POIMarker, RouteData } from '@/lib/api/traffic';
import { filterPoisWithinRadiusMiles } from '@/lib/geo';

/** Leaflet expects [lat, lng]. Decode is normally lat-first; swap if any vertex has invalid latitude magnitude. */
function normalizeRouteLatLngs(coords: [number, number][] | undefined): L.LatLngExpression[] {
  if (!coords?.length) return [];
  const swap = coords.some(
    (pair) =>
      pair &&
      pair.length >= 2 &&
      Number.isFinite(pair[0]) &&
      Number.isFinite(pair[1]) &&
      Math.abs(pair[0]) > 90
  );
  const out: L.LatLngTuple[] = [];
  for (const pair of coords) {
    if (!pair || pair.length < 2) continue;
    let a = pair[0];
    let b = pair[1];
    if (!Number.isFinite(a) || !Number.isFinite(b)) continue;
    if (swap) {
      const t = a;
      a = b;
      b = t;
    }
    out.push([a, b]);
  }
  return out;
}

interface MapViewProps {
  center: [number, number];
  radiusMiles: number;
  onMapClick?: (lat: number, lon: number) => void;
  routes?: RouteData[] | null;
  poiMarkers?: POIMarker[];
  isRouteMode?: boolean;
  destination?: [number, number];
  poiDisplayMode?: 'heatmap' | 'points';
}

export function MapView({
  center,
  radiusMiles,
  onMapClick,
  routes,
  poiMarkers,
  isRouteMode,
  destination,
  poiDisplayMode = 'heatmap',
}: MapViewProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const layersRef = useRef<L.LayerGroup | null>(null);
  const heatLayerRef = useRef<L.HeatLayer | null>(null);

  const poisForMap = useMemo(() => {
    if (!poiMarkers?.length) return poiMarkers ?? [];
    if (isRouteMode) return poiMarkers;
    return filterPoisWithinRadiusMiles(poiMarkers, center[0], center[1], radiusMiles);
  }, [poiMarkers, isRouteMode, center, radiusMiles]);

  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    const map = L.map(mapRef.current, {
      center: center,
      zoom: 11,
      zoomControl: true,
    });

    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
      subdomains: 'abcd',
      maxZoom: 20,
    }).addTo(map);

    layersRef.current = L.layerGroup().addTo(map);

    map.on('click', (e: L.LeafletMouseEvent) => {
      if (onMapClick) {
        onMapClick(e.latlng.lat, e.latlng.lng);
      }
    });

    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!mapInstanceRef.current || !layersRef.current) return;

    const map = mapInstanceRef.current;
    const layerGroup = layersRef.current;

    layerGroup.clearLayers();
    if (heatLayerRef.current) {
      map.removeLayer(heatLayerRef.current);
      heatLayerRef.current = null;
    }

    const routePolylines: L.Polyline[] = [];

    const originIcon = L.divIcon({
      className: 'custom-marker',
      html: `
        <div style="
          width: 20px; height: 20px;
          background: linear-gradient(135deg, #007AFF 0%, #00C7BE 100%);
          border-radius: 50%; border: 2.5px solid #fff;
          box-shadow: 0 2px 8px rgba(0, 122, 255, 0.4);
        "></div>
      `,
      iconSize: [20, 20],
      iconAnchor: [10, 10],
    });
    L.marker(center, { icon: originIcon }).addTo(layerGroup);

    if (isRouteMode) {
      const destIcon = L.divIcon({
        className: 'custom-marker',
        html: `
          <div style="
            width: 20px; height: 20px;
            background: linear-gradient(135deg, #FF3B30 0%, #FF9500 100%);
            border-radius: 50%; border: 2.5px solid #fff;
            box-shadow: 0 2px 8px rgba(255, 59, 48, 0.4);
          "></div>
        `,
        iconSize: [20, 20],
        iconAnchor: [10, 10],
      });
      if (destination) {
        L.marker(destination, { icon: destIcon }).addTo(layerGroup);
      }

      if (routes && routes.length > 0) {
        for (let i = routes.length - 1; i >= 0; i--) {
          const isPrimary = i === 0;
          const route = routes[i];
          const latLngs = normalizeRouteLatLngs(route.coordinates);
          if (latLngs.length < 2) continue;

          const polyline = L.polyline(latLngs, {
            color: isPrimary ? '#007AFF' : '#6B7280',
            weight: isPrimary ? 6 : 4,
            opacity: isPrimary ? 0.95 : 0.65,
            lineJoin: 'round',
            lineCap: 'round',
            dashArray: isPrimary ? undefined : '10, 10',
            interactive: false,
          }).addTo(layerGroup);
          routePolylines.push(polyline);

          if (isPrimary) {
            map.fitBounds(polyline.getBounds(), { padding: [50, 50] });
          }
        }
      } else if (destination) {
        const b = L.latLngBounds([center, destination]);
        map.fitBounds(b, { padding: [50, 50] });
      } else {
        map.setView(center, 11);
      }
    } else {
      const radiusMeters = radiusMiles * 1609.34;
      const circle = L.circle(center, {
        radius: radiusMeters,
        color: '#007AFF',
        fillColor: '#007AFF',
        fillOpacity: 0.08,
        weight: 1.5,
        dashArray: '6, 6',
      }).addTo(layerGroup);

      map.fitBounds(circle.getBounds(), { padding: [20, 20] });
    }

    if (poisForMap && poisForMap.length > 0) {
      const labelFor = (t: POIMarker['type']) =>
        t === 'signal' ? 'Traffic signal' : t === 'bus_stop' ? 'Bus stop' : 'Rail station';

      if (poiDisplayMode === 'heatmap') {
        const heatData = poisForMap.map((poi) => [poi.lat, poi.lon, 1] as [number, number, number]);

        // @ts-expect-error leaflet.heat extends L
        heatLayerRef.current = L.heatLayer(heatData, {
          radius: 24,
          blur: 30,
          minOpacity: 0.2,
          maxZoom: 18,
          max: 1.2,
          gradient: {
            0.25: '#fffbeb',
            0.45: '#fde68a',
            0.6: '#fb923c',
            0.78: '#f97316',
            0.9: '#ea580c',
            1.0: '#b91c1c',
          },
        });
        heatLayerRef.current.addTo(map);
      } else {
        poisForMap.forEach((poi) => {
          const color =
            poi.type === 'signal' ? '#FF9500' : poi.type === 'bus_stop' ? '#007AFF' : '#5856D6';
          L.circleMarker([poi.lat, poi.lon], {
            radius: 6,
            fillColor: color,
            color: '#FFFFFF',
            weight: 1.5,
            opacity: 1,
            fillOpacity: 0.92,
          })
            .bindPopup(`<div class="text-sm font-medium">${labelFor(poi.type)}</div>`)
            .addTo(layerGroup);
        });
      }
    }

    for (const pl of routePolylines) {
      pl.bringToFront();
    }
  }, [center, radiusMiles, routes, poisForMap, isRouteMode, destination, poiDisplayMode]);

  return (
    <div
      ref={mapRef}
      className="w-full h-full min-h-[min(52vh,560px)] rounded-xl overflow-hidden"
    />
  );
}
