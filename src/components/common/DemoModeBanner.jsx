import React from 'react';
import { FlaskConical } from 'lucide-react';

export default function DemoModeBanner({ message }) {
  if (!message) return null;
  return (
    <div className="sticky top-0 z-[60] flex items-center justify-center gap-2 bg-amber-400 px-4 py-2 text-center text-sm font-semibold text-amber-950 shadow-sm">
      <FlaskConical className="h-4 w-4 flex-shrink-0" />
      <span>{message}</span>
    </div>
  );
}