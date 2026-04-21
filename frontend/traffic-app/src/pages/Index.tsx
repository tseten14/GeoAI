import { useState, useCallback, useRef } from 'react';
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
  const initialRadius = (() => {
    if (!urlRadius) return 0.1;
    const trimmed = urlRadius.trim();
    // Old links used radius=1 as the default; new default is 0.1 mi (use 1.01 in URL if you need exactly 1 mi)
    if (trimmed === '1' || trimmed === '1.0') return 0.1;
    const r = parseFloat(urlRadius);
    if (Number.isNaN(r)) return 0.1;
    return Math.min(1, Math.max(0.1, r));
  })();

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
  /** Set while a driving-route request is in flight so the map shows route markers instead of the radius circle before metadata exists */
  const [pendingRouteDest, setPendingRouteDest] = useState<[number, number] | null>(null);
  /** Form tab: keeps map in route UI even before a route response (avoids showing a stale radius analysis). */
  const [formMode, setFormMode] = useState<'radius' | 'route'>('radius');
  /** Parsed destination while Driving route tab is selected (map preview before analyze). */
  const [routeDestPreview, setRouteDestPreview] = useState<[number, number] | null>(null);

  /** Prevents overlapping analyses from clearing each other's loading / route UI. */
  const analysisRequestIdRef = useRef(0);

  const handleAnalyze = useCallback(async (lat: number, lon: number, destLat?: number, destLon?: number, radiusMiles?: number) => {
    const requestId = ++analysisRequestIdRef.current;

    setIsLoading(true);
    setAnalysis(null);
    setMetadata(null);
    setRoutes(null);
    setPoiMarkers([]);
    setCenter([lat, lon]);
    if (radiusMiles != null && Number.isFinite(radiusMiles)) setRadius(radiusMiles);

    const dLat = destLat != null ? Number(destLat) : NaN;
    const dLon = destLon != null ? Number(destLon) : NaN;
    const isRouteRequest = Number.isFinite(dLat) && Number.isFinite(dLon);
    setPendingRouteDest(isRouteRequest ? [dLat, dLon] : null);
    if (isRouteRequest) setRouteDestPreview(null);

    // Simulate ETL stages
    setPipelineStage('extract');
    await new Promise(resolve => setTimeout(resolve, 600));

    if (requestId !== analysisRequestIdRef.current) return;

    setPipelineStage('transform');

    try {
      const response = await analyzeTraffic(lat, lon, destLat, destLon, radiusMiles);

      if (requestId !== analysisRequestIdRef.current) return;

      if (!response) {
        throw new Error('No response from server');
      }
      if (response.success && response.data && response.metadata) {
        setPipelineStage('load');
        await new Promise(resolve => setTimeout(resolve, 400));

        if (requestId !== analysisRequestIdRef.current) return;

        setAnalysis(response.data);
        setMetadata(response.metadata);
        
        if (response.visualData) {
          if (response.visualData.routes) setRoutes(response.visualData.routes);
          if (response.visualData.poiMarkers) setPoiMarkers(response.visualData.poiMarkers);
        }
        
        setPipelineStage('complete');

        if (response.metadata.routeSignalScanDegraded) {
          toast({
            title: 'Route and signals (partial)',
            description:
              response.metadata.routeSignalScanNote ||
              'Some OSM requests failed; the line shows your route. Orange dots are traffic signals where data was retrieved.',
          });
        } else if (response.metadata.routeUnionFallbackApplied) {
          toast({
            title: 'Route analyzed (reduced OSM detail)',
            description:
              response.metadata.routeUnionFallbackNote ||
              'Signals were loaded in smaller chunks along the route; some road and POI detail may be missing.',
          });
        } else if (response.metadata.routeAnalysisSkipped) {
          toast({
            title: 'Driving route shown',
            description:
              response.metadata.routeAnalysisSkipReason ||
              'OSM infrastructure scan was skipped for this long route. The map shows the driving path only.',
          });
        } else {
          toast({
            title: 'Analysis Complete',
            description: `${response.metadata.elementsProcessed.toLocaleString()} elements processed`,
          });
        }
      } else {
        throw new Error(response.error || 'Failed to analyze traffic data');
      }
    } catch (error) {
      if (requestId !== analysisRequestIdRef.current) return;
      console.error('Analysis error:', error);
      setPipelineStage('idle');
      toast({
        title: 'Analysis Failed',
        description: error instanceof Error ? error.message : 'An error occurred',
        variant: 'destructive',
      });
    } finally {
      if (requestId !== analysisRequestIdRef.current) return;
      setIsLoading(false);
      setPendingRouteDest(null);
    }
  }, [toast]);

  const handleFormModeChange = useCallback((next: 'radius' | 'route') => {
    setFormMode(next);
    setAnalysis(null);
    setMetadata(null);
    setRoutes(null);
    setPoiMarkers([]);
    setPipelineStage('idle');
    if (next === 'radius') {
      setRouteDestPreview(null);
    } else {
      setPoiDisplayMode('points');
    }
  }, []);

  const handleMapClick = useCallback((lat: number, lon: number) => {
    if (isLoading) return;
    setCenter([lat, lon]);
    // Invalidate prior results so the radius circle cannot drift away from where POIs were computed.
    setAnalysis(null);
    setMetadata(null);
    setPoiMarkers([]);
    setRoutes(null);
    setPipelineStage('idle');
  }, [isLoading]);

  const routeDest =
    metadata?.destination != null
      ? ([metadata.destination.lat, metadata.destination.lon] as [number, number])
      : pendingRouteDest ?? routeDestPreview;
  const mapRouteMode = Boolean(
    metadata?.isRouteMode || pendingRouteDest != null || formMode === 'route'
  );

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
            className="lg:col-span-3 space-y-5"
          >
            <CoordinateInput
              onSubmit={handleAnalyze}
              isLoading={isLoading}
              initialLat={center[0]}
              initialLon={center[1]}
              initialRadius={radius}
              mode={formMode}
              onModeChange={handleFormModeChange}
              onDestinationPreviewChange={(dlat, dlon) => setRouteDestPreview([dlat, dlon])}
            />

            <AnimatePresence>
              {pipelineStage !== 'idle' && (
                <PipelineStatus stage={pipelineStage} />
              )}
            </AnimatePresence>
          </motion.div>

          {/* Main Content - Map & Results */}
          <div className="lg:col-span-9 space-y-5">
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
                    {mapRouteMode ? (
                      <Route className="h-4 w-4 text-primary" />
                    ) : (
                      <MapIcon className="h-4 w-4 text-primary" />
                    )}
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-foreground">
                      {mapRouteMode ? 'Route corridor' : 'Analysis area'}
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      {mapRouteMode
                        ? 'Driving path and nearby infrastructure'
                        : 'Click to select location'}
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
              <div className="h-[min(76vh,920px)] min-h-[min(52vh,560px)] w-full">
                <MapView
                  center={center}
                  radiusMiles={radius}
                  onMapClick={handleMapClick}
                  routes={routes}
                  poiMarkers={poiMarkers}
                  isRouteMode={mapRouteMode}
                  destination={routeDest}
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
