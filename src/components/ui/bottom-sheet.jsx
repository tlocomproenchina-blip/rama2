import * as React from 'react';
import { cn } from '@/lib/utils';

export function BottomSheetPanel({ className, children }) {
  return (
    <div className={cn('sm:contents', className)}>
      <div className="mx-auto mt-2 h-1.5 w-12 rounded-full bg-slate-200 sm:hidden" />
      <div className="sm:contents">{children}</div>
    </div>
  );
}