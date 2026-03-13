import { useRef, useEffect, ReactNode } from 'react';

interface TopScrollableTableProps {
  children: ReactNode;
  className?: string;
  deps?: any[];
}

/**
 * Wraps a table with a synchronized top scrollbar for horizontal navigation.
 * Standard component used across all hub tables.
 */
export function TopScrollableTable({ children, className = '', deps = [] }: TopScrollableTableProps) {
  const topScrollRef = useRef<HTMLDivElement>(null);
  const tableScrollRef = useRef<HTMLDivElement>(null);
  const topScrollInnerRef = useRef<HTMLDivElement>(null);

  // Sync top scrollbar width with actual table scroll width
  useEffect(() => {
    const syncWidth = () => {
      if (tableScrollRef.current && topScrollInnerRef.current) {
        topScrollInnerRef.current.style.width = tableScrollRef.current.scrollWidth + 'px';
      }
    };
    syncWidth();
    const observer = new MutationObserver(syncWidth);
    if (tableScrollRef.current) {
      observer.observe(tableScrollRef.current, { childList: true, subtree: true });
    }
    window.addEventListener('resize', syncWidth);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', syncWidth);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  // Synchronize scroll positions
  useEffect(() => {
    const topEl = topScrollRef.current;
    const tableEl = tableScrollRef.current;
    if (!topEl || !tableEl) return;
    let syncing = false;
    const syncTop = () => {
      if (syncing) return;
      syncing = true;
      tableEl.scrollLeft = topEl.scrollLeft;
      syncing = false;
    };
    const syncTable = () => {
      if (syncing) return;
      syncing = true;
      topEl.scrollLeft = tableEl.scrollLeft;
      syncing = false;
    };
    topEl.addEventListener('scroll', syncTop);
    tableEl.addEventListener('scroll', syncTable);
    return () => {
      topEl.removeEventListener('scroll', syncTop);
      tableEl.removeEventListener('scroll', syncTable);
    };
  }, []);

  return (
    <>
      <div ref={topScrollRef} className="overflow-x-auto" style={{ height: '12px' }}>
        <div ref={topScrollInnerRef} style={{ height: '1px' }} />
      </div>
      <div ref={tableScrollRef} className={`relative w-full overflow-auto ${className}`}>
        {children}
      </div>
    </>
  );
}
