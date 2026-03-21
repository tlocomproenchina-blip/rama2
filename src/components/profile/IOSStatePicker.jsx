import React, { useMemo, useState } from 'react';
import { CheckCircle2, ChevronDown, Circle } from 'lucide-react';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import { cn } from '@/lib/utils';

export default function IOSStatePicker({ value, onChange, options, placeholder, hasError }) {
  const [open, setOpen] = useState(false);

  const selectedOption = useMemo(
    () => options.find((option) => option.state_code === value),
    [options, value]
  );

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          'flex min-h-[48px] w-full items-center justify-between rounded-md border bg-white px-4 py-3 text-left text-base shadow-sm transition-colors',
          hasError ? 'border-red-300' : 'border-input'
        )}
      >
        <span className={cn(!selectedOption && 'text-muted-foreground')}>
          {selectedOption?.state_name || placeholder}
        </span>
        <ChevronDown className="h-4 w-4 text-slate-400" />
      </button>

      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerContent className="rounded-t-[28px] bg-white">
          <DrawerHeader className="border-b border-slate-200 pb-4">
            <DrawerTitle className="text-left text-2xl font-medium text-slate-900">
              {placeholder}
            </DrawerTitle>
          </DrawerHeader>

          <div className="max-h-[70vh] overflow-y-auto pb-[calc(env(safe-area-inset-bottom)+1rem)]">
            {options.map((option) => {
              const isSelected = option.state_code === value;

              return (
                <button
                  key={option.state_code}
                  type="button"
                  onClick={() => {
                    onChange(option.state_code);
                    setOpen(false);
                  }}
                  className="flex w-full items-center justify-between border-b border-slate-200 px-5 py-4 text-left text-xl text-slate-900"
                >
                  <span>{option.state_name}</span>
                  {isSelected ? (
                    <CheckCircle2 className="h-6 w-6 text-slate-600" />
                  ) : (
                    <Circle className="h-6 w-6 text-slate-500" />
                  )}
                </button>
              );
            })}
          </div>
        </DrawerContent>
      </Drawer>
    </>
  );
}