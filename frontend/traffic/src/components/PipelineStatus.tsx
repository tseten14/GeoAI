import { motion } from 'framer-motion';
import { Database, Cpu, BarChart3, CheckCircle2, Loader2 } from 'lucide-react';

type PipelineStage = 'idle' | 'extract' | 'transform' | 'load' | 'complete';

interface PipelineStatusProps {
  stage: PipelineStage;
}

const stages = [
  { 
    id: 'extract', 
    label: 'Extract', 
    description: 'Fetching data from OpenStreetMap',
    icon: Database 
  },
  { 
    id: 'transform', 
    label: 'Transform', 
    description: 'Processing geospatial metrics',
    icon: Cpu 
  },
  { 
    id: 'load', 
    label: 'Load', 
    description: 'Preparing visualization',
    icon: BarChart3 
  },
];

export function PipelineStatus({ stage }: PipelineStatusProps) {
  if (stage === 'idle') return null;

  const getStageStatus = (stageId: string): 'pending' | 'active' | 'complete' => {
    const stageOrder = ['extract', 'transform', 'load', 'complete'];
    const currentIndex = stageOrder.indexOf(stage);
    const stageIndex = stageOrder.indexOf(stageId);

    if (stage === 'complete' || stageIndex < currentIndex) return 'complete';
    if (stageIndex === currentIndex) return 'active';
    return 'pending';
  };

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      className="card-elevated p-5"
    >
      <div className="mb-5 flex items-center gap-3">
        <div className="rounded-lg bg-primary/15 p-2">
          <Cpu className="h-4 w-4 text-primary" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-foreground">ETL pipeline</h3>
          <p className="text-xs text-muted-foreground">Processing data</p>
        </div>
      </div>

      <div className="space-y-0.5">
        {stages.map((s, index) => {
          const status = getStageStatus(s.id);
          const Icon = s.icon;

          return (
            <motion.div
              key={s.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1 }}
              className="pipeline-step"
            >
              <div 
                className={`
                  flex items-start gap-3 p-2.5 rounded-xl transition-colors
                  ${status === 'active' ? 'bg-primary/5' : ''}
                `}
              >
                <div 
                  className={`
                    p-1.5 rounded-lg transition-colors
                    ${status === 'complete' ? 'bg-success/10 text-success' : ''}
                    ${status === 'active' ? 'bg-primary/10 text-primary' : ''}
                    ${status === 'pending' ? 'bg-muted text-muted-foreground' : ''}
                  `}
                >
                  {status === 'complete' ? (
                    <CheckCircle2 className="w-4 h-4" />
                  ) : status === 'active' ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Icon className="w-4 h-4" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span 
                      className={`
                        font-medium text-sm
                        ${status === 'pending' ? 'text-muted-foreground' : 'text-foreground'}
                      `}
                    >
                      {s.label}
                    </span>
                    {status === 'active' && (
                      <span className="text-xs font-mono text-primary animate-pulse-soft">
                        Running
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground font-light mt-0.5">
                    {s.description}
                  </p>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      {stage === 'complete' && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="mt-4 p-3 rounded-xl bg-success/10 border border-success/20"
        >
          <div className="flex items-center gap-2 text-success">
            <CheckCircle2 className="w-4 h-4" />
            <span className="text-sm font-medium">Complete</span>
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}
