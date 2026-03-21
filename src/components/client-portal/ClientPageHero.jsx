import React from 'react';
import { Badge } from '@/components/ui/badge';

export default function ClientPageHero({ icon: Icon, eyebrow = 'Área cliente', title, description, badges = [], action, aside }) {
  return (
    <div className="overflow-hidden rounded-[calc(var(--radius)+0.75rem)] border border-border/70 bg-gradient-to-br from-sky-50 via-white to-blue-100 shadow-card">
      <div className="grid gap-6 p-6 md:grid-cols-[1.2fr_0.8fr] md:p-8">
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary" className="bg-white text-primary shadow-sm hover:bg-white">{eyebrow}</Badge>
            {badges.map((badge) => (
              <Badge key={badge} variant="outline" className="border-blue-100 bg-white/80 text-muted-foreground">
                {badge}
              </Badge>
            ))}
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              {Icon ? <div className="rounded-2xl bg-white/85 p-3 text-primary shadow-sm"><Icon className="h-5 w-5" /></div> : null}
              <h1 className="text-3xl font-bold tracking-tight text-foreground md:text-4xl">{title}</h1>
            </div>
            <p className="max-w-2xl text-sm text-muted-foreground md:text-base">{description}</p>
          </div>
          {action ? <div className="flex flex-wrap gap-3">{action}</div> : null}
        </div>
        {aside ? <div className="rounded-[1.75rem] border border-blue-100 bg-white/82 p-5 shadow-card backdrop-blur-sm">{aside}</div> : <div />}
      </div>
    </div>
  );
}