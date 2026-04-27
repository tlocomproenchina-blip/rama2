import React from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Loader2 } from 'lucide-react';

export default function BulkProgressIndicator({ progress }) {
  if (!progress) return null;
  const done = progress.total - progress.remaining;
  const pct = progress.total > 0 ? Math.round((done / progress.total) * 100) : 0;

  return (
    <Card className="border-0 shadow-lg bg-amber-50 animate-pulse">
      <CardContent className="p-4 flex items-center gap-4">
        <Loader2 className="h-5 w-5 animate-spin text-amber-600" />
        <div className="flex-1">
          <p className="text-sm font-semibold text-amber-800">
            Procesando... {progress.remaining} de {progress.total} restantes
          </p>
          <div className="mt-1.5 h-2 w-full bg-amber-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-amber-600 rounded-full transition-all duration-300"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
        <span className="text-lg font-bold text-amber-700 tabular-nums">
          {done}/{progress.total}
        </span>
      </CardContent>
    </Card>
  );
}