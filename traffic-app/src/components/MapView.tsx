import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { POIMarker } from '@/lib/api/traffic';

interface MapViewProps {
  center: [number, number];
  radiusMiles: number;
  onMapClick?: (lat: number, lon: number) => void;
  routeGeometry?: [number, number][] | null;
  poiMarkers?: POIMarker[];
  isRouteMode?: boolean;
  destination?: [number, number];
}

export function MapView({ 
  center, 
  radiusMiles, 
  onMapClick, 
  routeGeometry, 
  poiMarkers, 
  isRouteMode, 
  destination 
}: MapViewProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const layersRef = useRef<L.LayerGroup | null>(null);

  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    // Initialize map
    const map = L.map(mapRef.current, {
      center: center,
      zoom: 11,
      zoomControl: true,
    });

    // Light, clean tile layer
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
      subdomains: 'abcd',
      maxZoom: 20,
    }).addTo(map);

    // Layer group for easy clearing of previous visuals
    layersRef.current = L.layerGroup().addTo(map);

    // Handle map clicks
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

  // Update map contents when data changes
  useEffect(() => {
    if (!mapInstanceRef.current || !layersRef.current) return;

    const map = mapInstanceRef.current;
    const layerGroup = layersRef.current;
    
    // Clear existing layers
    layerGroup.clearLayers();

    // 1. Draw Origin Center (Apple Maps Style)
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

    // 2. Draw destination and route (If Route Mode)
    if (isRouteMode && destination) {
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
      L.marker(destination, { icon: destIcon }).addTo(layerGroup);

      if (routeGeometry && routeGeometry.length > 0) {
        const polyline = L.polyline(routeGeometry, {
          color: '#007AFF', // Apple Blue
          weight: 5,
          opacity: 0.8,
          lineJoin: 'round',
          lineCap: 'round',
        }).addTo(layerGroup);
        
        // Auto-fit map to the route line
        map.fitBounds(polyline.getBounds(), { padding: [50, 50] });
      }
    } else {
      // 3. Draw Radius Circle (If Area Mode)
      const radiusMeters = radiusMiles * 1609.34;
      const circle = L.circle(center, {
        radius: radiusMeters,
        color: '#007AFF',
        fillColor: '#007AFF',
        fillOpacity: 0.08,
        weight: 1.5,
        dashArray: '6, 6',
      }).addTo(layerGroup);
      
      // Auto-fit to circle bounds
      map.fitBounds(circle.getBounds(), { padding: [20, 20] });
    }

    // 4. Draw POIs
    if (poiMarkers && poiMarkers.length > 0) {
      poiMarkers.forEach(poi => {
        let color = '#FF3B30'; // Red for signals
        let size = 8;
        
        const poiIcon = L.divIcon({
          className: 'poi-marker',
          html: `<div style="
            width: ${size}px; height: ${size}px;
            background: ${color};
            border-radius: 50%; border: 1.5px solid #fff;
            box-shadow: 0 1px 3px rgba(0,0,0,0.3);
          "></div>`,
          iconSize: [size, size],
          iconAnchor: [size/2, size/2],
        });
        
        L.marker([poi.lat, poi.lon], { icon: poiIcon }).bindTooltip(poi.type).addTo(layerGroup);
      });
    }

  }, [center, radiusMiles, routeGeometry, poiMarkers, isRouteMode, destination]);

  return (
    <div 
      ref={mapRef} 
      className="w-full h-full rounded-xl overflow-hidden"
      style={{ minHeight: '380px' }}
    />
  );
}
