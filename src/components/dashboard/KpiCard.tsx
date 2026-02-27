import { Card, CardContent } from '@/components/ui/card';
import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface KpiCardProps {
  label: string;
  value: string | number;
  icon: LucideIcon;
  color: string;
  trend?: string;
  className?: string;
}

export function KpiCard({ label, value, icon: Icon, color, trend, className }: KpiCardProps) {
  return (
    <Card className={cn(
      "relative overflow-hidden border-none shadow-[var(--shadow-kpi)] hover:shadow-[var(--shadow-elevated)] transition-all duration-300",
      className
    )}>
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
  );
}
