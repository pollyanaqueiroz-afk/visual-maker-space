import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

interface TableSkeletonProps {
  rows?: number;
  columns?: number;
  className?: string;
}

export function TableSkeleton({ rows = 8, columns = 5, className }: TableSkeletonProps) {
  return (
    <div className={cn('space-y-2', className)}>
      {/* Header */}
      <div className="flex gap-3 px-4 py-3">
        {Array.from({ length: columns }).map((_, c) => (
          <Skeleton key={`h-${c}`} className="h-4 flex-1 rounded" />
        ))}
      </div>
      {/* Rows */}
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex gap-3 px-4 py-3 border-t border-border/40">
          {Array.from({ length: columns }).map((_, c) => (
            <Skeleton
              key={`${r}-${c}`}
              className="h-4 flex-1 rounded"
              style={{ maxWidth: c === 0 ? '60px' : undefined }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
