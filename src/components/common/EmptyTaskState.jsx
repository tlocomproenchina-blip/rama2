import React from 'react';

// Estado vacío compacto para una pestaña de tarea sin contenido.
export default function EmptyTaskState({ icon: Icon, title, description }) {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-card px-4 py-10 text-center">
      <Icon className="mx-auto mb-2 h-8 w-8 text-muted-foreground/60" />
      <p className="text-sm font-semibold text-foreground">{title}</p>
      {description && <p className="mt-1 text-xs text-muted-foreground">{description}</p>}
    </div>
  );
}