import { useState, useCallback, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useToast } from '@/components/ui/use-toast';
import { Header } from '@/components/Header';
import { CoordinateInput } from '@/components/CoordinateInput';
import { MapView } from '@/components/MapView';
import { PipelineStatus } from '@/components/PipelineStatus';
import { AnalysisDashboard } from '@/components/AnalysisDashboard';
import { analyzeTraffic, TrafficAnalysis, AnalysisMetadata, POIMarker, RouteData } from '@/lib/api/traffic';
import { AlertCircle, Map as MapIcon, Route } from 'lucide-react';

import { useSearchParams } from 'react-router-dom';

type PipelineStage = 'idle' | 'extract' | 'transform' | 'load' | 'complete';

export default function Index() {
  const { toast } = useToast();
  const [searchParams] = useSearchParams();

  const urlLat = searchParams.get('lat');
  const urlLng = searchParams.get('lng');
  const urlRadius = searchParams.get('radius');

  const initialLat = urlLat ? parseFloat(urlLat) : 40.7128;
  const initialLng = urlLng ? parseFloat(urlLng) : -74.006;
  const initialRadius = urlRadius ? parseInt(urlRadius, 10) : 1;

  const [isLoading, setIsLoading] = useState(false);
  const [pipelineStage, setPipelineStage] = useState<PipelineStage>('idle');
  const [center, setCenter] = useState<[number, number]>([initialLat, initialLng]);
  const [radius, setRadius] = useState(initialRadius);
  const [analysis, setAnalysis] = useState<TrafficAnalysis | null>(null);
  const [metadata, setMetadata] = useState<AnalysisMetadata | null>(null);
  
  // New Visual Data State
  const [routes, setRoutes] = useState<RouteData[] | null>(null);
  const [poiMarkers, setPoiMarkers] = useState<POIMarker[]>([]);
  const [poiDisplayMode, setPoiDisplayMode] = useState<'heatmap' | 'points'>('heatmap');

  // We use a ref so we only auto-analyze once on mount
  const hasAutoAnalyzed = useRef(false);

  const handleAnalyze = useCallback(async (lat: number, lon: number, destLat?: number, destLon?: number, radiusMiles?: number) => {
    setIsLoading(true);
    setAnalysis(null);
    setMetadata(null);
    setRoutes(null);
    setPoiMarkers([]);
    setCenter([lat, lon]);
    if (radiusMiles) setRadius(radiusMiles);

    // Simulate ETL stages
    setPipelineStage('extract');
    await new Promise(resolve => setTimeout(resolve, 600));

    setPipelineStage('transform');

    try {
      const response = await analyzeTraffic(lat, lon, destLat, destLon, radiusMiles);

      if (!response) {
        throw new Error('No response from server');
      }
      if (response.success && response.data && response.metadata) {
        setPipelineStage('load');
        await new Promise(resolve => setTimeout(resolve, 400));

        setAnalysis(response.data);
        setMetadata(response.metadata);
        
        if (response.visualData) {
          if (response.visualData.routes) setRoutes(response.visualData.routes);
          if (response.visualData.poiMarkers) setPoiMarkers(response.visualData.poiMarkers);
        }
        
        setPipelineStage('complete');

        toast({
          title: 'Analysis Complete',
          description: `${response.metadata.elementsProcessed.toLocaleString()} elements processed`,
        });
      } else {
        throw new Error(response.error || 'Failed to analyze traffic data');
      }
    } catch (error) {
      console.error('Analysis error:', error);
      setPipelineStage('idle');
      toast({
        title: 'Analysis Failed',
        description: error instanceof Error ? error.message : 'An error occurred',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  // Effect to perform initial analysis if coordinates are provided in URL
  useEffect(() => {
    if (urlLat && urlLng && !hasAutoAnalyzed.current) {
      hasAutoAnalyzed.current = true;
      handleAnalyze(initialLat, initialLng, undefined, undefined, initialRadius);
    }
  }, [urlLat, urlLng, initialLat, initialLng, initialRadius, handleAnalyze]);

  const handleMapClick = useCallback((lat: number, lon: number) => {
    // In a more complex app, this might update the origin or destination depending on mode
    setCenter([lat, lon]);
  }, []);

  return (
    <div className="min-h-screen bg-transparent">
      <Header />

      <main className="geo-main-shell py-6">
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
          {/* Left Sidebar - Input & Pipeline */}
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
            className="lg:col-span-4 space-y-5"
          >
            <CoordinateInput
              onSubmit={handleAnalyze}
              isLoading={isLoading}
              initialLat={center[0]}
              initialLon={center[1]}
              initialRadius={radius}
            />

            <AnimatePresence>
              {pipelineStage !== 'idle' && (
                <PipelineStatus stage={pipelineStage} />
              )}
            </AnimatePresence>
          </motion.div>

          {/* Main Content - Map & Results */}
          <div className="lg:col-span-8 space-y-5">
            {/* Map Section */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 20, delay: 0.1 }}
              className="card-elevated overflow-hidden"
            >
              <div className="flex items-center justify-between border-b border-border px-4 py-3">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-primary/15 p-2">
                    {metadata?.isRouteMode ? (
                      <Route className="h-4 w-4 text-primary" />
                    ) : (
                      <MapIcon className="h-4 w-4 text-primary" />
                    )}
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-foreground">
                      {metadata?.isRouteMode ? 'Route corridor' : 'Analysis area'}
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      {metadata?.isRouteMode 
                        ? 'Driving path and nearby infrastructure' 
                        : 'Click to select location'
                      }
                    </p>
                  </div>
                </div>
                
                {/* Visual Toggle */}
                {poiMarkers && poiMarkers.length > 0 && (
                  <div className="flex rounded-lg border border-border bg-muted/40 p-1">
                    <button
                      type="button"
                      onClick={() => setPoiDisplayMode('heatmap')}
                      className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                        poiDisplayMode === 'heatmap'
                          ? 'bg-card text-foreground shadow-sm'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      Heatmap
                    </button>
                    <button
                      type="button"
                      onClick={() => setPoiDisplayMode('points')}
                      className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                        poiDisplayMode === 'points'
                          ? 'bg-card text-foreground shadow-sm'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      Points
                    </button>
                  </div>
                )}
              </div>
              <div className="h-[380px]">
                <MapView
                  center={center}
                  radiusMiles={radius}
                  onMapClick={handleMapClick}
                  routes={routes}
                  poiMarkers={poiMarkers}
                  isRouteMode={metadata?.isRouteMode || false}
                  destination={metadata?.destination ? [metadata.destination.lat, metadata.destination.lon] : undefined}
                  poiDisplayMode={poiDisplayMode}
                />
              </div>
            </motion.div>

            {/* Results Section */}
            <AnimatePresence mode="wait">
              {analysis && metadata ? (
                <AnalysisDashboard analysis={analysis} metadata={metadata} routes={routes} />
              ) : !isLoading && pipelineStage === 'idle' ? (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="card-elevated p-10 text-center"
                >
                  <div className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-xl bg-primary/15">
                    <AlertCircle className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="mb-2 text-base font-semibold text-foreground">Ready to analyze</h3>
                  <p className="mx-auto max-w-sm text-sm text-muted-foreground">
                    Enter coordinates or click on the map, then click "Analyze Traffic" to start.
                  </p>
                </motion.div>
              ) : null}
            </AnimatePresence>
          </div>
        </div>
      </main>
    </div>
  );
}
