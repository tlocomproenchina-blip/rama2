import React, { useEffect, useMemo, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Trash2, Search, Loader2, Clock, Undo2, Eye } from 'lucide-react';
import { toast } from 'sonner';

export default function AdminAccountDeletions() {
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState([]);
  const [query, setQuery] = useState('');
  const [auditsOpen, setAuditsOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [audits, setAudits] = useState([]);
  const [cancellingId, setCancellingId] = useState(null);

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    const list = await base44.entities.User.filter({ deletion_requested: true }, '-deletion_requested_at', 200);
    setUsers(Array.isArray(list) ? list : []);
    setLoading(false);
  };

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    return users.filter(u =>
      (u.email || '').toLowerCase().includes(q) ||
      (u.full_name || '').toLowerCase().includes(q)
    );
  }, [users, query]);

  const daysRemaining = (u) => {
    const start = u?.deletion_requested_at ? Date.parse(u.deletion_requested_at) : null;
    if (!start) return '-';
    const msLeft = (start + 7*24*60*60*1000) - Date.now();
    return Math.max(0, Math.ceil(msLeft / (24*60*60*1000)));
  };

  const openAudits = async (u) => {
    setSelectedUser(u);
    setAuditsOpen(true);
    const logs = await base44.entities.DeletionAudit.filter({ user_email: u.email }, '-at', 200);
    setAudits(logs || []);
  };

  const adminCancel = async (u) => {
    setCancellingId(u.id);
    try {
      await base44.functions.invoke('adminCancelAccountDeletion', { user_id: u.id, reason: 'Reversión por administrador' });
      toast.success('Solicitud cancelada');
      await load();
    } catch (e) {
      toast.error('No se pudo cancelar');
    } finally {
      setCancellingId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-blue-600" /></div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <Trash2 className="h-6 w-6 text-amber-700 mt-0.5" />
          <div>
            <h1 className="text-2xl font-bold text-amber-900">Solicitudes de Eliminación</h1>
            <p className="text-amber-800 text-sm">Revisa y revierte solicitudes de eliminación de cuentas.</p>
          </div>
        </div>
      </div>

      <Card className="border-0 shadow">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Solicitudes pendientes ({users.length})</span>
            <Button variant="outline" onClick={load}>Refrescar</Button>
          </CardTitle>
          <CardDescription>Usa la búsqueda para localizar por email o nombre.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-4 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input className="pl-10" placeholder="Buscar usuario..." value={query} onChange={(e)=>setQuery(e.target.value)} />
          </div>

          {filtered.length === 0 ? (
            <div className="text-center py-8 text-slate-500">No hay solicitudes.</div>
          ) : (
            <div className="rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Usuario</TableHead>
                    <TableHead>Solicitado</TableHead>
                    <TableHead>Restan</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map(u => (
                    <TableRow key={u.id}>
                      <TableCell>
                        <div className="font-medium">{u.full_name || 'Sin nombre'}</div>
                        <div className="text-xs text-slate-500">{u.email}</div>
                      </TableCell>
                      <TableCell>{u.deletion_requested_at ? new Date(u.deletion_requested_at).toLocaleString() : '-'}</TableCell>
                      <TableCell className="flex items-center gap-1"><Clock className="h-4 w-4 text-slate-500" />{daysRemaining(u)} días</TableCell>
                      <TableCell className="text-right space-x-2">
                        <Button variant="outline" size="sm" onClick={()=>openAudits(u)}>
                          <Eye className="h-4 w-4 mr-1" /> Historial
                        </Button>
                        <Button 
                          variant="destructive" 
                          size="sm" 
                          className="bg-rose-600 hover:bg-rose-700"
                          onClick={()=>adminCancel(u)}
                          disabled={cancellingId===u.id}
                        >
                          {cancellingId===u.id ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Undo2 className="h-4 w-4 mr-1" />}
                          Revertir
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={auditsOpen} onOpenChange={setAuditsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Historial de {selectedUser?.email}</DialogTitle>
            <DialogDescription>Registros de auditoría relacionados con la eliminación.</DialogDescription>
          </DialogHeader>
          <div className="max-h-80 overflow-auto space-y-2">
            {audits.length === 0 ? (
              <div className="text-sm text-slate-500">Sin registros.</div>
            ) : (
              audits.map((a) => (
                <div key={a.id} className="p-3 border rounded-lg">
                  <div className="text-sm"><strong>Acción:</strong> {a.action}</div>
                  <div className="text-xs text-slate-600">{new Date(a.at).toLocaleString()} • por {a.performed_by_role} {a.performed_by || ''}</div>
                  {a.reason && (<div className="text-xs mt-1">Motivo: {a.reason}</div>)}
                </div>
              ))
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={()=>setAuditsOpen(false)}>Cerrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}