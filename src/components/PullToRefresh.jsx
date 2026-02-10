import React, { useState, useRef, useEffect } from 'react';
import { Loader2 } from 'lucide-react';

export default function PullToRefresh({ onRefresh, children }) {
  const [pulling, setPulling] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const startY = useRef(0);
  const containerRef = useRef(null);
  const lastRefreshTime = useRef(0);

  const PULL_THRESHOLD = 80;
  const MIN_REFRESH_INTERVAL = 60000; // 60 seconds

  const handleTouchStart = (e) => {
    if (containerRef.current && containerRef.current.scrollTop === 0) {
      startY.current = e.touches[0].clientY;
    }
  };

  const handleTouchMove = (e) => {
    if (containerRef.current && containerRef.current.scrollTop === 0 && !refreshing) {
      const currentY = e.touches[0].clientY;
      const distance = currentY - startY.current;

      if (distance > 0) {
        setPulling(true);
        setPullDistance(Math.min(distance, PULL_THRESHOLD * 1.5));
      }
    }
  };

  const handleTouchEnd = async () => {
    if (pullDistance > PULL_THRESHOLD && !refreshing) {
      const now = Date.now();
      if (now - lastRefreshTime.current < MIN_REFRESH_INTERVAL) {
        setPulling(false);
        setPullDistance(0);
        return;
      }

      setRefreshing(true);
      lastRefreshTime.current = now;

      try {
        await onRefresh();
      } catch (error) {
        console.error('Refresh error:', error);
      }

      setRefreshing(false);
    }
    
    setPulling(false);
    setPullDistance(0);
  };

  return (
    <div className="relative h-full overflow-hidden">
      {/* Pull indicator */}
      <div 
        className={`absolute top-0 left-0 right-0 flex items-center justify-center transition-all z-50 ${
          pulling || refreshing ? 'opacity-100' : 'opacity-0'
        }`}
        style={{ 
          height: '60px',
          transform: `translateY(${pulling ? pullDistance - 60 : refreshing ? 0 : -60}px)`
        }}
      >
        <div className="bg-white dark:bg-slate-800 rounded-full p-3 shadow-lg">
          <Loader2 className={`h-5 w-5 text-blue-600 ${refreshing ? 'animate-spin' : ''}`} />
        </div>
      </div>

      {/* Content */}
      <div
        ref={containerRef}
        className="h-full overflow-y-auto"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{
          transform: `translateY(${pulling ? pullDistance * 0.5 : 0}px)`,
          transition: pulling ? 'none' : 'transform 0.3s ease-out'
        }}
      >
        {children}
      </div>
    </div>
  );
}