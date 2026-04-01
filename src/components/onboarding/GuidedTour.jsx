import React, { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, X, Sparkles } from 'lucide-react';
import { clientTourSteps, adminTourSteps } from './tourSteps';

const colorMap = {
  blue: 'bg-blue-500',
  amber: 'bg-amber-500',
  purple: 'bg-purple-500',
  violet: 'bg-violet-500',
  green: 'bg-green-500',
  emerald: 'bg-emerald-500',
  indigo: 'bg-indigo-500',
  sky: 'bg-sky-500',
  teal: 'bg-teal-500',
  rose: 'bg-rose-500',
  orange: 'bg-orange-500',
  slate: 'bg-slate-500',
};

function getTooltipPosition(rect, tooltipW, tooltipH) {
  const pad = 16;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  
  // Try bottom
  if (rect.bottom + pad + tooltipH < vh && rect.left + tooltipW / 2 < vw) {
    return {
      top: rect.bottom + pad,
      left: Math.max(pad, Math.min(rect.left + rect.width / 2 - tooltipW / 2, vw - tooltipW - pad)),
      arrow: 'top',
    };
  }
  // Try top
  if (rect.top - pad - tooltipH > 0) {
    return {
      top: rect.top - pad - tooltipH,
      left: Math.max(pad, Math.min(rect.left + rect.width / 2 - tooltipW / 2, vw - tooltipW - pad)),
      arrow: 'bottom',
    };
  }
  // Try right
  if (rect.right + pad + tooltipW < vw) {
    return {
      top: Math.max(pad, Math.min(rect.top + rect.height / 2 - tooltipH / 2, vh - tooltipH - pad)),
      left: rect.right + pad,
      arrow: 'left',
    };
  }
  // Fallback: center
  return {
    top: Math.max(pad, (vh - tooltipH) / 2),
    left: Math.max(pad, (vw - tooltipW) / 2),
    arrow: 'none',
  };
}

export default function GuidedTour({ open, onClose, isAdmin, onOpenSidebar }) {
  const [step, setStep] = useState(0);
  const [targetRect, setTargetRect] = useState(null);
  const [tooltipPos, setTooltipPos] = useState(null);
  const tooltipRef = useRef(null);
  const steps = isAdmin ? adminTourSteps : clientTourSteps;
  const current = steps[step];

  useEffect(() => {
    if (open) setStep(0);
  }, [open]);

  const measureTarget = useCallback(() => {
    if (!current?.selector) {
      setTargetRect(null);
      setTooltipPos(null);
      return;
    }
    const el = document.querySelector(current.selector);
    if (!el) {
      setTargetRect(null);
      setTooltipPos(null);
      return;
    }
    el.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
    
    // Small delay to let scroll settle
    requestAnimationFrame(() => {
      const rect = el.getBoundingClientRect();
      setTargetRect(rect);
      
      const tw = Math.min(380, window.innerWidth - 32);
      const th = 220;
      const pos = getTooltipPosition(rect, tw, th);
      setTooltipPos(pos);
    });
  }, [current]);

  useEffect(() => {
    if (!open || !current) return;
    // Open sidebar on mobile and expand all groups so nav items are visible
    if (current.selector?.startsWith('[data-tour=')) {
      if (typeof onOpenSidebar === 'function') onOpenSidebar();
      const groups = document.querySelectorAll('[data-tour-group]');
      groups.forEach(g => {
        const gridEl = g.querySelector('.grid');
        if (gridEl && gridEl.classList.contains('grid-rows-[0fr]')) {
          const btn = g.querySelector('button');
          btn?.click();
        }
      });
    }
    
    const timer = setTimeout(measureTarget, 450);
    return () => clearTimeout(timer);
  }, [step, open, current, measureTarget]);

  // Recalc on resize
  useEffect(() => {
    if (!open) return;
    const handler = () => measureTarget();
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, [open, measureTarget]);

  // ESC to close
  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  if (!open || !current) return null;

  const isFirst = step === 0;
  const isLast = step === steps.length - 1;
  const progress = ((step + 1) / steps.length) * 100;
  const Icon = current.icon;
  const barColor = colorMap[current.color] || colorMap.blue;
  const hasTarget = !!targetRect;

  const spotlightPad = 8;

  const overlay = createPortal(
    <div className="fixed inset-0 z-[9999]" onClick={(e) => { e.stopPropagation(); }}>
      {/* Dim overlay with spotlight cutout */}
      <svg className="absolute inset-0 w-full h-full" style={{ pointerEvents: 'none' }}>
        <defs>
          <mask id="tour-mask">
            <rect width="100%" height="100%" fill="white" />
            {hasTarget && (
              <rect
                x={targetRect.left - spotlightPad}
                y={targetRect.top - spotlightPad}
                width={targetRect.width + spotlightPad * 2}
                height={targetRect.height + spotlightPad * 2}
                rx={12}
                fill="black"
              />
            )}
          </mask>
        </defs>
        <rect
          width="100%"
          height="100%"
          fill="rgba(15,23,42,0.55)"
          mask="url(#tour-mask)"
          style={{ pointerEvents: 'all', cursor: 'default' }}
          onClick={(e) => e.stopPropagation()}
        />
      </svg>

      {/* Spotlight ring */}
      {hasTarget && (
        <div
          className="absolute rounded-xl border-2 border-primary/60 shadow-[0_0_0_4px_rgba(59,130,246,0.15)] transition-all duration-300"
          style={{
            top: targetRect.top - spotlightPad,
            left: targetRect.left - spotlightPad,
            width: targetRect.width + spotlightPad * 2,
            height: targetRect.height + spotlightPad * 2,
            pointerEvents: 'none',
          }}
        />
      )}

      {/* Tooltip card */}
      <div
        ref={tooltipRef}
        className="absolute z-[10000] w-[min(380px,calc(100vw-32px))] transition-all duration-300"
        style={{
          top: hasTarget && tooltipPos ? tooltipPos.top : '50%',
          left: hasTarget && tooltipPos ? tooltipPos.left : '50%',
          transform: (!hasTarget || !tooltipPos) ? 'translate(-50%, -50%)' : undefined,
        }}
      >
        <div className="rounded-2xl bg-white border border-border/80 shadow-premium overflow-hidden">
          {/* Progress bar */}
          <div className="h-1 w-full bg-slate-100">
            <div className={`h-full ${barColor} transition-all duration-500`} style={{ width: `${progress}%` }} />
          </div>

          <div className="p-5">
            {/* Step counter + close */}
            <div className="flex items-center justify-between mb-3">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                {step + 1} de {steps.length}
              </span>
              <button onClick={onClose} className="h-7 w-7 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors">
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Icon + title */}
            <div className="flex items-start gap-3 mb-3">
              <div className={`flex-shrink-0 h-10 w-10 rounded-xl flex items-center justify-center ${barColor} text-white`}>
                {Icon && <Icon className="h-5 w-5" />}
              </div>
              <div className="min-w-0">
                <h3 className="text-base font-bold text-slate-800 font-display leading-tight">{current.title}</h3>
                {current.page && (
                  <span className="inline-flex items-center gap-1 mt-1 text-[11px] text-primary font-medium">
                    <Sparkles className="h-3 w-3" />
                    Sección: {current.title}
                  </span>
                )}
              </div>
            </div>

            {/* Description */}
            <p className="text-sm text-slate-600 leading-relaxed mb-4">{current.description}</p>

            {/* Dots */}
            <div className="flex justify-center gap-1 mb-4">
              {steps.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setStep(i)}
                  className={`h-1.5 rounded-full transition-all ${i === step ? 'w-5 bg-primary' : 'w-1.5 bg-slate-200 hover:bg-slate-300'}`}
                />
              ))}
            </div>

            {/* Navigation */}
            <div className="flex items-center justify-between gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={onClose}
                className="text-muted-foreground text-xs"
              >
                Omitir tour
              </Button>
              <div className="flex gap-2">
                {!isFirst && (
                  <Button variant="outline" size="sm" onClick={() => setStep(s => s - 1)} className="text-xs">
                    <ChevronLeft className="h-3.5 w-3.5 mr-1" /> Anterior
                  </Button>
                )}
                {isLast ? (
                  <Button size="sm" onClick={onClose} className="bg-green-600 hover:bg-green-700 text-xs">
                    ¡Empezar! 🚀
                  </Button>
                ) : (
                  <Button size="sm" onClick={() => setStep(s => s + 1)} className="text-xs">
                    Siguiente <ChevronRight className="h-3.5 w-3.5 ml-1" />
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );

  return overlay;
}