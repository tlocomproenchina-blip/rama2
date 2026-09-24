import React, { useState } from 'react';
import { base44 } from '@/components/api/ApiQueueManager';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import UniversalClientSearch from '@/components/warehouse/UniversalClientSearch';
import { PackagePlus, UserPlus, X, Loader2, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';

// Panel que aparece cuando un tracking no se encuentra en el sistema.
// Permite buscar un cliente existente o crear uno nuevo, y devuelve el
// cliente seleccionado via onAssigned para que la página cree el paquete.
export default function ManualPackageAssign({ tracking, onAssigned, onCancel }) {
  const [mode, setMode] = useState('search'); // 'search' | 'new'
  const [newEmail, setNewEmail] = useState('');
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);

  const handleCreateNew = async () => {
    const email = newEmail.trim();
    const name = newName.trim();
    if (!email || !name) {
      toast.error('Email y nombre son obligatorios');
      return;
    }
    setCreating(true);
    try {
      await base44.users.inviteUser(email, 'user');
      onAssigned({ email, full_name: name, shipping_mark: '' });
    } catch (e) {
      toast.error('No se pudo crear el cliente: ' + (e?.message || 'error desconocido'));
    } finally {
      setCreating(false);
    }
  };

  return (
    <Card className="border-amber-300 bg-amber-50/40 relative z-50">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-amber-800">
            <PackagePlus className="h-5 w-5 shrink-0" />
            <p className="font-semibold text-sm">Paquete no encontrado — asignar a cliente</p>
          </div>
          <Button variant="ghost" size="icon" onClick={onCancel} className="h-8 w-8 shrink-0">
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="rounded-lg bg-white border border-amber-200 px-3 py-2">
          <p className="text-[11px] uppercase tracking-wide text-slate-500">Tracking</p>
          <p className="font-mono text-sm font-semibold text-slate-800 break-all">{tracking}</p>
        </div>

        {mode === 'search' ? (
          <div className="space-y-2">
            <UniversalClientSearch onSelect={onAssigned} />
            <button
              onClick={() => setMode('new')}
              className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700 font-medium pt-1"
            >
              <UserPlus className="h-4 w-4" /> Crear cliente nuevo
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-slate-600">Email del cliente</Label>
              <Input
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="cliente@email.com"
                autoComplete="off"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-slate-600">Nombre completo</Label>
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Nombre y apellido"
                autoComplete="off"
              />
            </div>
            <div className="flex gap-2">
              <Button onClick={handleCreateNew} disabled={creating} className="flex-1">
                {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
                Crear y asignar
              </Button>
              <Button variant="outline" onClick={() => setMode('search')} disabled={creating}>
                <ArrowLeft className="h-4 w-4" /> Volver
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}