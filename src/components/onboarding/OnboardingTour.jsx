import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { ChevronLeft, ChevronRight, Sparkles } from 'lucide-react';
import { clientTourSteps, adminTourSteps } from './tourSteps';

const colorMap = {
  blue: 'bg-blue-100 text-blue-600',
  amber: 'bg-amber-100 text-amber-600',
  purple: 'bg-purple-100 text-purple-600',
  violet: 'bg-violet-100 text-violet-600',
  green: 'bg-green-100 text-green-600',
  emerald: 'bg-emerald-100 text-emerald-600',
  indigo: 'bg-indigo-100 text-indigo-600',
  sky: 'bg-sky-100 text-sky-600',
  teal: 'bg-teal-100 text-teal-600',
  rose: 'bg-rose-100 text-rose-600',
  orange: 'bg-orange-100 text-orange-600',
  slate: 'bg-slate-100 text-slate-600',
};

export default function OnboardingTour({ open, onClose, isAdmin }) {
  const [step, setStep] = useState(0);
  const steps = isAdmin ? adminTourSteps : clientTourSteps;
  const current = steps[step];
  const progress = ((step + 1) / steps.length) * 100;
  const Icon = current?.icon;
  const colors = colorMap[current?.color] || colorMap.blue;

  useEffect(() => {
    if (open) setStep(0);
  }, [open]);

  if (!open || !current) return null;

  const isFirst = step === 0;
  const isLast = step === steps.length - 1;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-md p-0 overflow-hidden border-0 shadow-premium">
        {/* Progress bar */}
        <div className="px-6 pt-5 pb-0">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
              {isAdmin ? 'Tour Admin' : 'Tour de Bienvenida'}
            </span>
            <span className="text-xs text-muted-foreground">{step + 1} / {steps.length}</span>
          </div>
          <Progress value={progress} className="h-1.5" />
        </div>

        {/* Content */}
        <div className="px-6 py-6 text-center space-y-4">
          <div className={`mx-auto w-16 h-16 rounded-2xl flex items-center justify-center ${colors}`}>
            {Icon && <Icon className="h-8 w-8" />}
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-bold text-slate-800 font-display">{current.title}</h2>
            <p className="text-sm text-slate-600 leading-relaxed">{current.description}</p>
          </div>
          {current.page && (
            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 rounded-full">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              <span className="text-xs font-medium text-slate-700">
                Encuéntralo en: <strong>{current.page === 'Dashboard' ? 'Dashboard' : steps.find(s => s.id === current.id)?.title}</strong>
              </span>
            </div>
          )}
        </div>

        {/* Dots */}
        <div className="flex justify-center gap-1.5 pb-3">
          {steps.map((_, i) => (
            <button
              key={i}
              onClick={() => setStep(i)}
              className={`h-2 rounded-full transition-all ${i === step ? 'w-6 bg-primary' : 'w-2 bg-slate-200 hover:bg-slate-300'}`}
            />
          ))}
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between px-6 pb-5 gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="text-muted-foreground"
          >
            Omitir
          </Button>
          <div className="flex gap-2">
            {!isFirst && (
              <Button variant="outline" size="sm" onClick={() => setStep(s => s - 1)}>
                <ChevronLeft className="h-4 w-4 mr-1" /> Anterior
              </Button>
            )}
            {isLast ? (
              <Button size="sm" onClick={onClose} className="bg-green-600 hover:bg-green-700">
                ¡Empezar! 🚀
              </Button>
            ) : (
              <Button size="sm" onClick={() => setStep(s => s + 1)}>
                Siguiente <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}