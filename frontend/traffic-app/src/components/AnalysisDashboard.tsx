import { forwardRef } from 'react';
import { motion } from 'framer-motion';
import {
  Timer,
  AlertTriangle,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  MapPin,
  Clock,
  Route
} from 'lucide-react';
import { TrafficAnalysis, AnalysisMetadata, RouteData } from '@/lib/api/traffic';

interface AnalysisDashboardProps {
  analysis: TrafficAnalysis;
  metadata: AnalysisMetadata;
  routes?: RouteData[] | null;
}

export const AnalysisDashboard = forwardRef<HTMLDivElement, AnalysisDashboardProps>(
  ({ analysis, metadata, routes }, ref) => {

    const getCongestionColor = (score: number) => {
      if (score >= 70) return 'text-destructive';
      if (score >= 45) return 'text-warning';
      if (score >= 20) return 'text-geo-orange';
      return 'text-success';
    };

    const getCongestionBgColor = (score: number) => {
      if (score >= 70) return 'bg-destructive/10';
      if (score >= 45) return 'bg-warning/10';
      if (score >= 20) return 'bg-geo-orange/10';
      return 'bg-success/10';
    };

    const getCongestionBarColor = (score: number) => {
      if (score >= 70) return 'bg-destructive';
      if (score >= 45) return 'bg-warning';
      if (score >= 20) return 'bg-geo-orange';
      return 'bg-success';
    };

    const getCongestionIcon = (score: number) => {
      if (score >= 45) return ArrowUpRight;
      if (score >= 20) return Minus;
      return ArrowDownRight;
    };

    const CongestionIcon = getCongestionIcon(analysis.congestionScore);

    // Format the time multiplier descriptor
    const getTimeImpactText = (multiplier: number) => {
      if (multiplier >= 1.25) return 'Rush Hour Penalty';
      if (multiplier > 1.0) return 'Elevated Activity';
      if (multiplier < 1.0) return 'Off-Peak Hours';
      return 'Standard Hours';
    };

    return (
      <motion.div
        ref={ref}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="space-y-5"
      >
        {/* Header */}
        <div className="card-elevated p-6">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <h2 className="text-xl font-medium text-foreground">Traffic Analysis</h2>
              <p className="text-sm text-muted-foreground mt-1 font-light">
                {metadata.elementsProcessed.toLocaleString()} infrastructure elements analyzed
              </p>
            </div>
            {/* Route Duration Badge (If Route Mode) */}
            {metadata.isRouteMode && metadata.routeDurationEstimateStr && (
              <div className="flex flex-col items-end gap-2 text-right">
                <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/50 px-4 py-2">
                  <Route className="w-4 h-4 text-primary" />
                  <span className="text-sm font-medium">Fastest Drive: {metadata.routeDurationEstimateStr}</span>
                </div>
                {routes && routes.length > 1 && (
                  <div className="flex flex-col items-end gap-1">
                    {routes.slice(1).map((r, i) => (
                      <span key={i} className="text-xs text-muted-foreground mr-1">
                        Alt Route {i + 1}: {Math.round(r.durationSeconds / 60)} minutes
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Four Main Stats Group */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Traffic Signals */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            whileHover={{ scale: 1.03 }}
            transition={{ type: "spring", stiffness: 300, damping: 20, delay: 0.1 }}
            className="card-elevated p-5 flex flex-col justify-center border-l-4 border-geo-orange cursor-default"
          >
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 rounded-xl bg-geo-orange/10">
                <MapPin className="w-4 h-4 text-geo-orange" />
              </div>
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Signals</p>
            </div>
            <p className="text-2xl font-semibold text-foreground">{analysis.trafficSignals.toLocaleString()}</p>
          </motion.div>

          {/* Time Multiplier Impact */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            whileHover={{ scale: 1.03 }}
            transition={{ type: "spring", stiffness: 300, damping: 20, delay: 0.2 }}
            className="card-elevated p-5 flex flex-col justify-center border-l-4 border-primary cursor-default"
          >
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 rounded-xl bg-primary/10">
                <Clock className="w-4 h-4 text-primary" />
              </div>
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Time Factor</p>
            </div>
            <p className="text-xl font-semibold text-foreground flex items-baseline gap-1">
              {analysis.timeMultiplier}x
              <span className="text-xs text-muted-foreground font-normal ml-1">
                ({getTimeImpactText(analysis.timeMultiplier)})
              </span>
            </p>
          </motion.div>
        </div>

        {/* Main Traffic Congestion Card */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          whileHover={{ scale: 1.01 }}
          transition={{ type: "spring", stiffness: 400, damping: 25, delay: 0.3 }}
          className="card-elevated relative overflow-hidden bg-gradient-to-br from-card to-secondary/40 p-6"
        >
          {/* Subtle background glow based on congestion score */}
          <div 
             className={`absolute -right-20 -top-20 w-40 h-40 rounded-full blur-3xl opacity-20 ${getCongestionBarColor(analysis.congestionScore)}`}
             style={{ pointerEvents: 'none' }}
          />
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-4">
              <div className={`p-3 rounded-2xl ${getCongestionBgColor(analysis.congestionScore)}`}>
                <AlertTriangle className={`w-6 h-6 ${getCongestionColor(analysis.congestionScore)}`} />
              </div>
              <div>
                <p className="text-sm text-foreground/80 font-medium">Calculated Congestion Rating</p>
                <p className={`text-4xl font-bold ${getCongestionColor(analysis.congestionScore)} tracking-tight mt-1`}>
                  {analysis.congestionLevel}
                </p>
              </div>
            </div>
            <div className="text-right">
              <div className="flex items-center justify-end gap-1.5 mb-1">
                <span className={`text-3xl font-bold ${getCongestionColor(analysis.congestionScore)}`}>
                  {analysis.congestionScore}
                </span>
                <span className="text-muted-foreground font-medium text-sm mt-1">/100</span>
              </div>
              <div className="flex items-center justify-end gap-1 text-xs text-muted-foreground font-medium">
                Score 
                <CongestionIcon className={`w-3 h-3 ${getCongestionColor(analysis.congestionScore)}`} />
              </div>
            </div>
          </div>
          
          {/* Congestion bar */}
          <div className="mt-8">
            <div className="h-3 overflow-hidden rounded-full bg-muted shadow-inner">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${analysis.congestionScore}%` }}
                transition={{ duration: 1.5, ease: 'easeOut', delay: 0.4 }}
                className={`h-full rounded-full ${getCongestionBarColor(analysis.congestionScore)} relative`}
              >
                <div className="absolute inset-0 bg-white/20 w-full h-full animate-scrolling-stripes" style={{
                   backgroundImage: 'linear-gradient(45deg,rgba(255,255,255,.15) 25%,transparent 25%,transparent 50%,rgba(255,255,255,.15) 50%,rgba(255,255,255,.15) 75%,transparent 75%,transparent)',
                   backgroundSize: '1rem 1rem'
                 }} />
              </motion.div>
            </div>
            <div className="flex justify-between text-xs text-muted-foreground font-medium mt-2 uppercase tracking-wide">
              <span>Ideal</span>
              <span className="text-destructive/80">Gridlock</span>
            </div>
          </div>
        </motion.div>

        {/* Metadata Footer */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="rounded-xl border border-border bg-muted/30 p-4 font-mono text-xs text-muted-foreground"
        >
          <div className="flex flex-wrap gap-x-6 gap-y-1.5 font-light">
            <span>Center: {metadata.center.lat.toFixed(4)}, {metadata.center.lon.toFixed(4)}</span>
            {metadata.isRouteMode && metadata.destination ? (
              <span>Dest: {metadata.destination.lat.toFixed(4)}, {metadata.destination.lon.toFixed(4)}</span>
            ) : (
              <span>Radius: {metadata.radiusMiles} mi</span>
            )}
            <span>Roads: {analysis.roads.total.toLocaleString()}</span>
            <span>{new Date(metadata.timestamp).toLocaleString()}</span>
          </div>
        </motion.div>
      </motion.div>
    );
  }
);

AnalysisDashboard.displayName = 'AnalysisDashboard';
