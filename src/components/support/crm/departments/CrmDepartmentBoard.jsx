import React, { useState } from 'react';
import { DragDropContext } from '@hello-pangea/dnd';
import { Settings2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import DepartmentColumn from './DepartmentColumn';
import DepartmentManagerDialog from './DepartmentManagerDialog';

const NONE = 'sin_departamento';

// Tablero de casos por departamento: arrastra cada caso a la columna que lo atiende.
export default function CrmDepartmentBoard({ cases = [], profiles = {}, deps, onMove, onOpen }) {
  const [manageOpen, setManageOpen] = useState(false);
  const { departments } = deps;
  const known = new Set(departments.map((d) => d.id));
  const columns = [{ id: NONE, name: 'Sin departamento', color: 'gray' }, ...departments];

  const byColumn = Object.fromEntries(columns.map((c) => [c.id, []]));
  cases.forEach((c) => byColumn[known.has(c.department_id) ? c.department_id : NONE].push(c));

  const onDragEnd = ({ draggableId, source, destination }) => {
    if (!destination || destination.droppableId === source.droppableId) return;
    onMove(draggableId, departments.find((d) => d.id === destination.droppableId) || null);
  };

  return (
    <div className="w-full min-w-0 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">Arrastra cada caso a su departamento. Haz clic en una tarjeta para abrirla.</p>
        <Button size="sm" variant="outline" onClick={() => setManageOpen(true)}>
          <Settings2 className="h-4 w-4" /> Departamentos
        </Button>
      </div>
      <DragDropContext onDragEnd={onDragEnd}>
        <div className="grid w-full min-w-0 grid-cols-1 gap-3 pb-2 sm:grid-cols-2 2xl:flex 2xl:overflow-x-auto">
          {columns.map((col) => (
            <DepartmentColumn key={col.id} column={col} items={byColumn[col.id]} profiles={profiles} onOpen={onOpen} />
          ))}
        </div>
      </DragDropContext>
      <DepartmentManagerDialog
        open={manageOpen}
        onOpenChange={setManageOpen}
        departments={departments}
        onCreate={deps.create}
        onRemove={deps.remove}
      />
    </div>
  );
}