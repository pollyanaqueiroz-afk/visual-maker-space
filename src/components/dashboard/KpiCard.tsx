import { useState, useCallback, useRef } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';

interface KpiCardProps {
  label: string;
  value: string | number;
  icon: LucideIcon;
  color: string;
  trend?: string;
  className?: string;
  onClick?: () => void;
  active?: boolean;
  overdue?: boolean;
}

export function KpiCard({ label, value, icon: Icon, color, trend, className, onClick, active, overdue }: KpiCardProps) {
  const [ripples, setRipples] = useState<{ x: number; y: number; id: number }[]>([]);
  const nextId = useRef(0);

  const handleClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const id = nextId.current++;
    setRipples(prev => [...prev, { x, y, id }]);
    setTimeout(() => setRipples(prev => prev.filter(r => r.id !== id)), 600);
    onClick?.();
  }, [onClick]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
    >
      <Card 
        className={cn(
          "relative overflow-hidden border-none shadow-[var(--shadow-kpi)] hover:shadow-[var(--shadow-elevated)] transition-all duration-300",
          onClick && "cursor-pointer hover:scale-[1.02]",
          active && "ring-2 ring-primary shadow-[var(--shadow-elevated)]",
          overdue && "animate-pulse",
          className
        )}
        onClick={handleClick}
      >
        {/* Ripple effect */}
        {ripples.map(r => (
          <span
            key={r.id}
            className="absolute rounded-full bg-primary/20 animate-[ripple_0.6s_ease-out_forwards] pointer-events-none"
            style={{ left: r.x - 20, top: r.y - 20, width: 40, height: 40 }}
          />
        ))}

        {/* Ring animation for active */}
        {active && (
          <span className="absolute inset-0 rounded-lg border-2 border-primary/40 animate-[ring-pulse_1.5s_ease-in-out_infinite] pointer-events-none" />
        )}

        <CardContent className="p-5 flex items-start justify-between gap-3">
          <div className="flex flex-col gap-1 min-w-0">
            <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{label}</span>
            <span className="text-3xl font-extrabold tracking-tight text-foreground leading-none">{value}</span>
            {trend && (
              <span className="text-[10px] font-medium text-muted-foreground mt-0.5">{trend}</span>
            )}
          </div>
          <div className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
            color
          )}>
            <Icon className="h-5 w-5 text-inherit" />
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
