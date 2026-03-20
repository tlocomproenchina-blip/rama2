import React from 'react';
import { Badge } from '@/components/ui/badge';

export default function PageHero({ icon: Icon, badge, title, description, actions, loadingLabel }) {
  return (
    <div className="rounded-3xl border border-border/70 bg-gradient-to-br from-sky-50 via-white to-blue-100 p-6 shadow-card md:p-8">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary" className="bg-white text-primary shadow-sm hover:bg-white">
              {Icon ? <Icon className="mr-1 h-3.5 w-3.5" /> : null}
              {badge}
            </Badge>
            {loadingLabel ? (
              <Badge variant="outline" className="border-blue-100 bg-white/80 text-muted-foreground">
                {loadingLabel}
              </Badge>
            ) : null}
          </div>
          <div className="space-y-2">
            <h1 className="text-3xl font-bold tracking-tight text-foreground">{title}</h1>
            <p className="max-w-2xl text-sm text-muted-foreground md:text-base">{description}</p>
          </div>
        </div>
        {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
      </div>
    </div>
  );
}