import { useState, useCallback } from 'react';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

interface TablePaginationProps {
  currentPage: number;
  totalPages: number;
  totalRecords: number;
  perPage: number;
  loading?: boolean;
  onPageChange: (page: number) => void;
  className?: string;
}

export default function TablePagination({
  currentPage,
  totalPages,
  totalRecords,
  perPage,
  loading,
  onPageChange,
  className,
}: TablePaginationProps) {
  const [inputValue, setInputValue] = useState('');

  const handleGoToPage = useCallback(() => {
    const page = parseInt(inputValue, 10);
    if (!isNaN(page) && page >= 1 && page <= totalPages) {
      onPageChange(page);
      setInputValue('');
    }
  }, [inputValue, totalPages, onPageChange]);

  if (totalPages <= 1) return null;

  const from = (currentPage - 1) * perPage + 1;
  const to = Math.min(currentPage * perPage, totalRecords);

  const pages = buildPageNumbers(currentPage, totalPages);

  return (
    <div className={cn('flex items-center justify-between gap-4 flex-wrap', className)}>
      <span className="text-xs text-muted-foreground whitespace-nowrap">
        <span className="font-medium text-foreground">{from}–{to}</span> de{' '}
        <span className="font-medium text-foreground">{totalRecords.toLocaleString('pt-BR')}</span> registros
      </span>

      <div className="flex items-center gap-1">
        {/* First page */}
        <Button variant="ghost" size="icon" className="h-8 w-8" disabled={currentPage <= 1 || loading} onClick={() => onPageChange(1)} aria-label="Primeira página">
          <ChevronsLeft className="h-4 w-4" />
        </Button>

        {/* Previous */}
        <Button variant="ghost" size="icon" className="h-8 w-8" disabled={currentPage <= 1 || loading} onClick={() => onPageChange(currentPage - 1)} aria-label="Página anterior">
          <ChevronLeft className="h-4 w-4" />
        </Button>

        {/* Page numbers */}
        <div className="flex items-center gap-0.5 mx-1">
          {pages.map((p, idx) =>
            p === '...' ? (
              <span key={`ellipsis-${idx}`} className="h-8 w-8 flex items-center justify-center text-xs text-muted-foreground select-none">···</span>
            ) : (
              <Button key={p} variant={p === currentPage ? 'default' : 'ghost'} size="icon" className={cn('h-8 w-8 text-xs font-medium', p === currentPage && 'pointer-events-none')} disabled={loading} onClick={() => onPageChange(p as number)}>
                {p}
              </Button>
            ),
          )}
        </div>

        {/* Next */}
        <Button variant="ghost" size="icon" className="h-8 w-8" disabled={currentPage >= totalPages || loading} onClick={() => onPageChange(currentPage + 1)} aria-label="Próxima página">
          <ChevronRight className="h-4 w-4" />
        </Button>

        {/* Last page */}
        <Button variant="ghost" size="icon" className="h-8 w-8" disabled={currentPage >= totalPages || loading} onClick={() => onPageChange(totalPages)} aria-label="Última página">
          <ChevronsRight className="h-4 w-4" />
        </Button>

        {/* Go-to-page input */}
        <div className="flex items-center gap-1 ml-2 border-l border-border pl-2">
          <span className="text-xs text-muted-foreground whitespace-nowrap">Ir para</span>
          <Input
            type="number"
            min={1}
            max={totalPages}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleGoToPage(); }}
            placeholder={String(currentPage)}
            className="h-8 w-14 text-xs text-center px-1 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            disabled={loading}
          />
          <Button variant="outline" size="sm" className="h-8 px-2 text-xs" disabled={loading || !inputValue} onClick={handleGoToPage}>
            Ok
          </Button>
        </div>
      </div>
    </div>
  );
}

function buildPageNumbers(current: number, total: number): (number | '...')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages: (number | '...')[] = [1];
  if (current > 3) pages.push('...');
  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);
  for (let i = start; i <= end; i++) pages.push(i);
  if (current < total - 2) pages.push('...');
  pages.push(total);
  return pages;
}
