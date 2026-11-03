import React from 'react';
import { createPortal } from 'react-dom';
import { Draggable } from '@hello-pangea/dnd';
import { supervisionState, SUPERVISION_STYLE } from '@/lib/supervisionState';

const PRIORITY = {
  urgente: 'bg-red-100 text-red-700', alta: 'bg-orange-100 text-orange-700',
  media: 'bg-blue-100 text-blue-700', baja: 'bg-slate-100 text-slate-600',
};

// Tarjeta arrastrable de un caso dentro de la columna de su departamento.
// Mientras se arrastra se dibuja en el body: las animaciones de página (transform)
// desplazaban la tarjeta lejos del cursor.
export default function DepartmentCaseCard({ item, index, name, onOpen }) {
  const sup = SUPERVISION_STYLE[supervisionState(item)];
  return (
    <Draggable draggableId={item.id} index={index}>
      {(provided, snapshot) => {
        const card = (
          <div
            ref={provided.innerRef}
            {...provided.draggableProps}
            {...provided.dragHandleProps}
            onClick={() => onOpen(item.client_email, item.id)}
            className={`cursor-grab rounded-xl border p-2.5 text-left active:cursor-grabbing ${sup ? sup.card : 'bg-card'} ${
              snapshot.isDragging ? 'z-[9999] border-primary/50 shadow-premium' : 'border-border hover:brightness-[0.98]'
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <p className="truncate text-sm font-semibold text-foreground">{name}</p>
              <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${PRIORITY[item.priority] || PRIORITY.media}`}>{item.priority}</span>
            </div>
            <p className="truncate text-[11px] text-muted-foreground">{item.ticket_number} · {item.subject}</p>
            <div className="flex flex-wrap gap-1">
              {sup && <span className={`mt-1.5 inline-block rounded-full px-2 py-0.5 text-[10px] font-medium ${sup.badge}`}>{sup.label}</span>}
              {item.waiting && <span className="mt-1.5 inline-block rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-medium text-rose-700">Espera respuesta</span>}
            </div>
          </div>
        );
        return snapshot.isDragging ? createPortal(card, document.body) : card;
      }}
    </Draggable>
  );
}