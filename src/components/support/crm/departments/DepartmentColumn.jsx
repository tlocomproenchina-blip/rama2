import React from 'react';
import { Droppable } from '@hello-pangea/dnd';
import { departmentDot } from '@/lib/departmentColors';
import DepartmentCaseCard from './DepartmentCaseCard';

// Columna de un departamento: recibe los casos que se arrastran a ella.
export default function DepartmentColumn({ column, items, profiles, onOpen }) {
  return (
    <div className="flex w-72 shrink-0 flex-col rounded-2xl border border-border/70 bg-muted/40">
      <div className="flex items-center justify-between gap-2 px-3 py-2.5">
        <p className="flex min-w-0 items-center gap-2 text-sm font-semibold text-foreground">
          <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${departmentDot(column.color)}`} />
          <span className="truncate">{column.name}</span>
        </p>
        <span className="rounded-full bg-card px-2 py-0.5 text-[11px] font-medium text-muted-foreground">{items.length}</span>
      </div>
      <Droppable droppableId={column.id}>
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            className={`min-h-[120px] flex-1 space-y-2 overflow-y-auto px-2 pb-2 max-h-[65vh] ${snapshot.isDraggingOver ? 'bg-accent/60' : ''} rounded-b-2xl`}
          >
            {items.map((item, index) => (
              <DepartmentCaseCard
                key={item.id}
                item={item}
                index={index}
                name={profiles[item.client_email]?.name || item.client_email}
                onOpen={onOpen}
              />
            ))}
            {provided.placeholder}
            {!items.length && !snapshot.isDraggingOver && (
              <p className="px-2 py-6 text-center text-xs text-muted-foreground">Arrastra casos aquí</p>
            )}
          </div>
        )}
      </Droppable>
    </div>
  );
}