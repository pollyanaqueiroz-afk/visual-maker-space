import { useState, useEffect, useRef } from 'react';

interface UseCountUpOptions {
  end: number;
  duration?: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  separator?: string;
  enabled?: boolean;
}

export function useCountUp({
  end,
  duration = 1200,
  decimals = 0,
  prefix = '',
  suffix = '',
  separator = '.',
  enabled = true,
}: UseCountUpOptions) {
  const [display, setDisplay] = useState(prefix + '0' + suffix);
  const frameRef = useRef<number>();
  const prevEnd = useRef(0);

  useEffect(() => {
    if (!enabled) {
      setDisplay(prefix + formatNum(end, decimals, separator) + suffix);
      return;
    }

    const startVal = prevEnd.current;
    const diff = end - startVal;
    if (diff === 0) return;

    const startTime = performance.now();

    const tick = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = startVal + diff * eased;
      setDisplay(prefix + formatNum(current, decimals, separator) + suffix);
      if (progress < 1) {
        frameRef.current = requestAnimationFrame(tick);
      } else {
        prevEnd.current = end;
      }
    };

    frameRef.current = requestAnimationFrame(tick);
    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
    };
  }, [end, duration, decimals, prefix, suffix, separator, enabled]);

  return display;
}

function formatNum(n: number, decimals: number, separator: string): string {
  const fixed = Math.abs(n).toFixed(decimals);
  const [int, dec] = fixed.split('.');
  const formatted = int.replace(/\B(?=(\d{3})+(?!\d))/g, separator);
  return (n < 0 ? '-' : '') + formatted + (dec ? ',' + dec : '');
}
