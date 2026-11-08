import React, { useRef } from 'react';

// Barra de pestañas por tarea: fija arriba al desplazarse, ícono + nombre corto, indicador
// naranja en la activa y contador opcional. Se maneja con flechas, Inicio y Fin.
export default function TaskTabs({ tabs, active, onChange, label = 'Tareas', idPrefix = 'task' }) {
  const refs = useRef({});
  const enabled = tabs.filter((t) => !t.disabled);

  const onKeyDown = (e) => {
    const index = enabled.findIndex((t) => t.key === active);
    let next = null;
    if (e.key === 'ArrowRight') next = enabled[(index + 1) % enabled.length];
    if (e.key === 'ArrowLeft') next = enabled[(index - 1 + enabled.length) % enabled.length];
    if (e.key === 'Home') next = enabled[0];
    if (e.key === 'End') next = enabled[enabled.length - 1];
    if (!next) return;
    e.preventDefault();
    onChange(next.key);
    refs.current[next.key]?.focus();
  };

  return (
    <div className="sticky top-[5.75rem] z-20 -mx-1 bg-background/95 px-1 py-2 lg:top-16">
      <div
        role="tablist"
        aria-label={label}
        onKeyDown={onKeyDown}
        className="!flex !flex-nowrap !gap-1 rounded-2xl border border-border bg-card p-1 shadow-card"
      >
        {tabs.map(({ key, label: text, icon: Icon, badge, disabled }) => {
          const selected = active === key;
          return (
            <button
              key={key}
              ref={(el) => { refs.current[key] = el; }}
              id={`${idPrefix}-tab-${key}`}
              type="button"
              role="tab"
              aria-selected={selected}
              aria-controls={`${idPrefix}-panel-${key}`}
              tabIndex={selected ? 0 : -1}
              disabled={disabled}
              onClick={() => onChange(key)}
              className={`flex flex-1 flex-col items-center justify-center gap-0.5 rounded-xl px-1 py-1.5 text-[11px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40 sm:flex-row sm:gap-2 sm:text-sm ${
                selected ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'
              }`}
            >
              <span className="relative">
                <Icon className="h-4 w-4" />
                {badge > 0 && (
                  <span className={`absolute -right-3 -top-1.5 min-w-4 rounded-full px-1 text-center text-[9px] leading-4 ${selected ? 'bg-secondary text-secondary-foreground' : 'bg-primary text-primary-foreground'}`}>
                    {badge > 99 ? '99+' : badge}
                  </span>
                )}
              </span>
              <span className="max-w-full truncate">{text}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}