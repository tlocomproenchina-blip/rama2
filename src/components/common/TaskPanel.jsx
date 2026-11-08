import React, { useRef } from 'react';

// Contenido de una pestaña de tarea. Se monta la primera vez que se abre y después solo se
// oculta, así no se pierde lo que el usuario tenía a medio hacer al cambiar de pestaña.
export default function TaskPanel({ tab, active, idPrefix = 'task', className = 'space-y-4', children }) {
  const visited = useRef(false);
  const selected = active === tab;
  if (selected) visited.current = true;
  if (!visited.current) return null;
  return (
    <div
      id={`${idPrefix}-panel-${tab}`}
      role="tabpanel"
      aria-labelledby={`${idPrefix}-tab-${tab}`}
      hidden={!selected}
      className={selected ? className : undefined}
    >
      {children}
    </div>
  );
}