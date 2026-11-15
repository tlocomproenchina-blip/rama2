import React, { useState } from 'react';
import { Button } from '@/components/ui/button';

export default function PortalSimpleList({ rows, render, empty }) {
  const [limit, setLimit] = useState(50);
  if (!rows.length) return <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">{empty}</p>;
  return (
    <div className="space-y-3">
      <div className="divide-y rounded-xl border bg-card">
        {rows.slice(0, limit).map((r) => {
          const [title, sub] = render(r);
          return <div key={r.id} className="p-3"><p className="font-semibold">{title}</p><p className="text-xs text-muted-foreground">{sub}</p></div>;
        })}
      </div>
      {rows.length > limit && <Button variant="outline" onClick={() => setLimit(limit + 50)}>Ver más</Button>}
    </div>
  );
}