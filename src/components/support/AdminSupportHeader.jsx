import React from 'react';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';

export default function AdminSupportHeader({ isAdmin, onCreateTicket }) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Gestión de Tickets</h1>
        <p className="text-slate-500">Administra y asigna tickets de soporte</p>
      </div>
      {isAdmin && (
        <Button onClick={onCreateTicket} className="bg-blue-600 hover:bg-blue-700">
          <Plus className="h-4 w-4 mr-2" />
          Crear Ticket
        </Button>
      )}
    </div>
  );
}