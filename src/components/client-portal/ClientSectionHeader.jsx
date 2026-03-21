import React from 'react';

export default function ClientSectionHeader({ title, description, action }) {
  return (
    <div className="rounded-3xl border border-border/70 bg-white/75 p-4 shadow-card backdrop-blur-sm md:p-5">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="space-y-1">
          <h2 className="text-xl font-bold tracking-tight text-foreground">{title}</h2>
          {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
        </div>
        {action ? <div className="flex flex-wrap gap-2">{action}</div> : null}
      </div>
    </div>
  );
}