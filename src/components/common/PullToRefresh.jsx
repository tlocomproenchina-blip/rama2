import React, { useRef, useState, useEffect } from "react";
import { Loader2, ArrowDown } from "lucide-react";

export default function PullToRefresh({ onRefresh, threshold = 60, maxPull = 100, disabled = false }) {
  const startY = useRef(0);
  const pulling = useRef(false);
  const [offset, setOffset] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (disabled) return;

    const onTouchStart = (e) => {
      if (typeof window === "undefined") return;
      if (window.scrollY > 0 || refreshing) return;
      pulling.current = true;
      startY.current = e.touches[0].clientY;
      setOffset(0);
    };

    const onTouchMove = (e) => {
      if (!pulling.current || refreshing) return;
      const dy = e.touches[0].clientY - startY.current;
      if (dy > 0 && typeof window !== "undefined" && window.scrollY === 0) {
        // prevent native pull-to-refresh bounce
        try { e.preventDefault(); } catch {}
        const pull = Math.min(maxPull, dy * 0.6);
        setOffset(pull);
      }
    };

    const onTouchEnd = async () => {
      if (!pulling.current || refreshing) return;
      const shouldRefresh = offset >= threshold;
      pulling.current = false;
      if (shouldRefresh) {
        setRefreshing(true);
        setOffset(threshold);
        try {
          if (onRefresh) {
            await onRefresh();
          }
        } finally {
          setRefreshing(false);
          setOffset(0);
        }
      } else {
        setOffset(0);
      }
    };

    window.addEventListener("touchstart", onTouchStart, { passive: false });
    window.addEventListener("touchmove", onTouchMove, { passive: false });
    window.addEventListener("touchend", onTouchEnd, { passive: true });

    return () => {
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onTouchEnd);
    };
  }, [offset, refreshing, onRefresh, disabled, threshold, maxPull]);

  return (
    <div
      aria-hidden
      className="fixed top-0 left-0 right-0 z-40 pointer-events-none flex justify-center"
      style={{ height: offset, transition: pulling.current || refreshing ? "none" : "height .2s ease" }}
    >
      <div className="mt-2 px-2 py-1 rounded-full bg-white/80 border text-slate-600 text-xs flex items-center gap-1 shadow-sm">
        {refreshing ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <ArrowDown className={`h-3.5 w-3.5 ${offset >= threshold ? "text-emerald-600 rotate-180" : ""}`} />
        )}
        <span>
          {refreshing
            ? "Actualizando..."
            : offset >= threshold
            ? "Suelta para actualizar"
            : "Desliza para actualizar"}
        </span>
      </div>
    </div>
  );
}