import React from 'react';

export default function StatusPill({ map, value }) {
  const s = map[value] || { label: value || '—', cls: 'bg-muted text-muted-foreground border-border' };
  return <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium ${s.cls}`}>{s.label}</span>;
}