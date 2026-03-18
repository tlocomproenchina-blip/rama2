import React from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function PullToRefresh({ children, onRefresh, enabled = true }) {
  const startY = React.useRef(0);
  const canPull = React.useRef(false);
  const [pullDistance, setPullDistance] = React.useState(0);
  const [refreshing, setRefreshing] = React.useState(false);
  const threshold = 72;
  const maxPull = 96;

  const handleTouchStart = (e) => {
    if (!enabled || refreshing || window.scrollY > 0) return;
    startY.current = e.touches[0].clientY;
    canPull.current = true;
  };

  const handleTouchMove = (e) => {
    if (!canPull.current || refreshing) return;
    const delta = e.touches[0].clientY - startY.current;
    if (delta <= 0 || window.scrollY > 0) {
      setPullDistance(0);
      return;
    }
    e.preventDefault();
    setPullDistance(Math.min(maxPull, delta * 0.55));
  };

  const handleTouchEnd = async () => {
    if (!canPull.current) return;
    canPull.current = false;

    if (pullDistance < threshold || !onRefresh) {
      setPullDistance(0);
      return;
    }

    setRefreshing(true);
    setPullDistance(threshold);
    await Promise.resolve(onRefresh());
    setRefreshing(false);
    setPullDistance(0);
  };

  return (
    <div
      className="relative overscroll-y-contain"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <div className="pointer-events-none sticky top-0 z-20 flex h-0 items-center justify-center overflow-visible">
        <div
          className="flex items-center gap-2 rounded-full bg-white/95 px-3 py-2 text-xs font-medium text-slate-600 shadow"
          style={{
            transform: `translateY(${Math.max(8, pullDistance - 44)}px)`,
            opacity: pullDistance > 0 || refreshing ? 1 : 0,
            transition: 'transform 180ms ease, opacity 180ms ease'
          }}
        >
          <Loader2 className={cn('h-4 w-4', (refreshing || pullDistance >= threshold) && 'animate-spin text-blue-600')} />
          {refreshing ? 'Actualizando...' : pullDistance >= threshold ? 'Suelta para actualizar' : 'Desliza para actualizar'}
        </div>
      </div>

      <div
        style={{
          transform: `translateY(${pullDistance}px)`,
          transition: 'transform 180ms ease'
        }}
      >
        {children}
      </div>
    </div>
  );
}