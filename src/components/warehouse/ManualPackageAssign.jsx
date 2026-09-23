import React, { useState, useEffect, useRef } from 'react';
import { base44 } from '@/components/api/ApiQueueManager';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PackagePlus, UserPlus, X, Loader2, ArrowLeft, Clock, Search } from 'lucide-react';
import { toast } from 'sonner';

// Panel que aparece cuando un tracking no se encuentra en el sistema.
// Busca clientes en el cache local (IndexedDB) primero, con fallback al servidor.
// Permite "Asignar más tarde" para no bloquear el escaneo.
export default function ManualPackageAssign({ tracking, onAssigned, onCancel, onAssignLater, searchClientsLocal }) {
  const [mode, setMode] = useState('search'); // 'search' | 'new'
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);
  const debounceRef = useRef(null);

  // Buscar clientes (local primero, servidor como fallback)
  useEffect(() => {
    if (mode !== 'search') return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query.trim()) {
      setResults([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        // Buscar SIEMPRE en la base de datos local (IndexedDB) — funciona offline
        if (searchClientsLocal) {
          const local = await searchClientsLocal(query);
          setResults(local);
          setLoading(false);
          return;
        }
        // Solo si no hay función local (no debería pasar), fallback al servidor
        const server = await base44.entities.User.filter({ role: 'user' }, '-created_date', 50);
        const filtered = (server || []).filter((c) => {
          const q = query.toLowerCase();
          return (
            (c.email || '').toLowerCase().includes(q) ||
            (c.full_name || '').toLowerCase().includes(q) ||
            (c.shipping_mark || '').toLowerCase().includes(q)
          );
        }).slice(0, 20);
        setResults(filtered);
      } catch (_) {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => debounceRef.current && clearTimeout(debounceRef.current);
  }, [query, mode, searchClientsLocal]);

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
    <Card className="border-amber-300 bg-amber-50/40">
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
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar por nombre, email o shipping mark..."
                className="pl-9"
                autoFocus
                autoComplete="off"
              />
            </div>
            {loading && (
              <div className="flex items-center justify-center py-2">
                <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
              </div>
            )}
            {!loading && query && results.length === 0 && (
              <p className="text-center text-xs text-slate-400 py-2">Sin resultados. Prueba crear un cliente nuevo.</p>
            )}
            {!loading && results.length > 0 && (
              <ul className="space-y-1 max-h-40 overflow-y-auto">
                {results.map((c) => (
                  <li key={c.email}>
                    <button
                      onClick={() => onAssigned(c)}
                      className="w-full text-left rounded-lg border border-border bg-white px-3 py-2 hover:border-blue-400 hover:bg-blue-50/50 transition-colors"
                    >
                      <p className="text-sm font-medium text-slate-800 truncate">{c.full_name || c.email}</p>
                      <p className="text-xs text-slate-500 truncate">{c.email}</p>
                      {c.shipping_mark && (
                        <p className="text-xs font-mono text-blue-600 mt-0.5">{c.shipping_mark}</p>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <div className="flex flex-col gap-2 pt-1">
              <button
                onClick={() => setMode('new')}
                className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700 font-medium"
              >
                <UserPlus className="h-4 w-4" /> Crear cliente nuevo
              </button>
              {onAssignLater && (
                <button
                  onClick={onAssignLater}
                  className="flex items-center gap-1.5 text-sm text-amber-600 hover:text-amber-700 font-medium"
                >
                  <Clock className="h-4 w-4" /> Asignar más tarde y seguir escaneando
                </button>
              )}
            </div>
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