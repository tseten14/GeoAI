import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MapPin, Search, Navigation, Route, Map as MapIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';

interface CoordinateInputProps {
  onSubmit: (lat: number, lon: number, destLat?: number, destLon?: number, radius?: number) => void;
  isLoading: boolean;
  initialLat?: number;
  initialLon?: number;
  initialRadius?: number;
}

export function CoordinateInput({ 
  onSubmit, 
  isLoading, 
  initialLat = 40.7128, 
  initialLon = -74.006,
  initialRadius = 1
}: CoordinateInputProps) {
  const [mode, setMode] = useState<'radius' | 'route'>('radius');
  
  const [lat, setLat] = useState(initialLat.toString());
  const [lon, setLon] = useState(initialLon.toString());
  
  const [destLat, setDestLat] = useState('40.7580'); // Times Square example
  const [destLon, setDestLon] = useState('-73.9855');
  
  const [radius, setRadius] = useState(initialRadius);

  // Sync with parent when center changes (e.g. from map click)
  useEffect(() => {
    setLat(initialLat.toString());
    setLon(initialLon.toString());
  }, [initialLat, initialLon]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const latNum = parseFloat(lat);
    const lonNum = parseFloat(lon);
    
    if (isNaN(latNum) || isNaN(lonNum)) return;
    
    if (mode === 'route') {
      const dLat = parseFloat(destLat);
      const dLon = parseFloat(destLon);
      if (isNaN(dLat) || isNaN(dLon)) return;
      onSubmit(latNum, lonNum, dLat, dLon);
    } else {
      onSubmit(latNum, lonNum, undefined, undefined, radius);
    }
  };

  const handleGetCurrentLocation = (target: 'origin' | 'destination' = 'origin') => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          if (target === 'origin') {
            setLat(position.coords.latitude.toFixed(6));
            setLon(position.coords.longitude.toFixed(6));
          } else {
            setDestLat(position.coords.latitude.toFixed(6));
            setDestLon(position.coords.longitude.toFixed(6));
          }
        },
        (error) => {
          console.error('Error getting location:', error);
        }
      );
    }
  };

  const presetLocations = [
    { name: 'NYC', lat: 40.7128, lon: -74.006 },
    { name: 'LA', lat: 34.0522, lon: -118.2437 },
    { name: 'Chicago', lat: 41.8781, lon: -87.6298 },
    { name: 'London', lat: 51.5074, lon: -0.1278 },
    { name: 'Tokyo', lat: 35.6762, lon: 139.6503 },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="card-elevated p-6 space-y-6"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-primary/15 p-2.5">
            <MapPin className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground">Analysis mode</h3>
            <p className="text-sm text-muted-foreground">Radius or driving route</p>
          </div>
        </div>
      </div>

      <div className="flex rounded-lg border border-border bg-muted/40 p-1">
        <button
          type="button"
          onClick={() => setMode('radius')}
          className={`flex flex-1 items-center justify-center gap-2 rounded-md py-2 text-sm font-semibold transition-colors ${
            mode === 'radius' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <MapIcon className="h-4 w-4" /> Area radius
        </button>
        <button
          type="button"
          onClick={() => setMode('route')}
          className={`flex flex-1 items-center justify-center gap-2 rounded-md py-2 text-sm font-semibold transition-colors ${
            mode === 'route' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <Route className="h-4 w-4" /> Driving route
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        
        {/* Origin Inputs */}
        <div className="space-y-3">
          <Label className="text-xs text-muted-foreground uppercase font-semibold tracking-wider">
            {mode === 'route' ? 'Origin Point' : 'Center Point'}
          </Label>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="latitude" className="text-xs">Latitude</Label>
              <Input
                id="latitude" type="number" step="any"
                value={lat} onChange={(e) => setLat(e.target.value)}
                placeholder="40.7128"
                className="font-mono text-sm bg-secondary/50 border-border/60 h-10"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="longitude" className="text-xs">Longitude</Label>
              <Input
                id="longitude" type="number" step="any"
                value={lon} onChange={(e) => setLon(e.target.value)}
                placeholder="-74.006"
                className="font-mono text-sm bg-secondary/50 border-border/60 h-10"
              />
            </div>
          </div>
          <Button
            type="button" variant="outline" size="sm"
            onClick={() => handleGetCurrentLocation('origin')}
            className="w-full text-xs h-8"
          >
            <Navigation className="w-3 h-3 mr-2" /> Current Location
          </Button>
        </div>

        <AnimatePresence mode="wait">
          {mode === 'radius' && (
            <motion.div
              key="radius-mode"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="space-y-3 pt-2"
            >
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">Radius</Label>
                <span className="text-sm font-mono text-primary font-medium">{radius} mi</span>
              </div>
              <Slider
                value={[radius]}
                onValueChange={(value) => setRadius(value[0])}
                min={1} max={15} step={1} className="py-2"
              />
              <div className="flex justify-between text-xs text-muted-foreground font-light">
                <span>1 mi</span>
                <span>15 mi</span>
              </div>
            </motion.div>
          )}

          {mode === 'route' && (
            <motion.div
              key="route-mode"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="space-y-3 pt-2"
            >
              <Label className="text-xs text-muted-foreground uppercase font-semibold tracking-wider">
                Destination Point
              </Label>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Input
                    type="number" step="any"
                    value={destLat} onChange={(e) => setDestLat(e.target.value)}
                    placeholder="Lat"
                    className="font-mono text-sm bg-secondary/50 border-border/60 h-10"
                  />
                </div>
                <div className="space-y-1.5">
                  <Input
                    type="number" step="any"
                    value={destLon} onChange={(e) => setDestLon(e.target.value)}
                    placeholder="Lon"
                    className="font-mono text-sm bg-secondary/50 border-border/60 h-10"
                  />
                </div>
              </div>
              <Button
                type="button" variant="outline" size="sm"
                onClick={() => handleGetCurrentLocation('destination')}
                className="w-full text-xs h-8"
              >
                <Navigation className="w-3 h-3 mr-2" /> Current Location
              </Button>
            </motion.div>
          )}
        </AnimatePresence>

        {mode === 'radius' && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="space-y-2 pt-2"
          >
            <Label className="text-xs text-muted-foreground font-light">Quick Select Center</Label>
            <div className="flex flex-wrap gap-2">
              {presetLocations.map((loc) => (
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  key={loc.name} type="button" 
                  onClick={() => { setLat(loc.lat.toString()); setLon(loc.lon.toString()); }}
                  className="text-xs h-8 font-medium px-3 bg-secondary text-secondary-foreground rounded-md hover:bg-secondary/80 transition-colors"
                >
                  {loc.name}
                </motion.button>
              ))}
            </div>
          </motion.div>
        )}

        <motion.div
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          <Button 
            type="submit" 
            disabled={isLoading}
            className="w-full h-11 bg-primary hover:bg-primary/90 text-primary-foreground font-medium border-0 shadow-lg hover:shadow-primary/25 transition-all mt-4"
          >
            {isLoading ? (
              <>
                <div className="w-4 h-4 mr-2 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                Analyzing...
              </>
            ) : (
              <>
                <Search className="w-4 h-4 mr-2" />
                Analyze Traffic
              </>
            )}
          </Button>
        </motion.div>
      </form>
    </motion.div>
  );
}
