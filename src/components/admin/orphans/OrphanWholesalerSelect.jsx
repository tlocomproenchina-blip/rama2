import React from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Building2 } from 'lucide-react';

// Filtro por mayorista de las cargas sin titular: una conexión, todas o solo las
// que todavía no tienen ningún mayorista identificado.
export default function OrphanWholesalerSelect({ connections, value, onChange }) {
  return (
    <div className="flex items-center gap-2">
      <Building2 className="h-4 w-4 shrink-0 text-indigo-500" />
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="w-full sm:w-64">
          <SelectValue placeholder="Todos los mayoristas" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="todos">Todos los mayoristas</SelectItem>
          <SelectItem value="sin">Sin mayorista</SelectItem>
          {(connections || []).map((connection) => (
            <SelectItem key={connection.key} value={connection.key}>
              {connection.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}