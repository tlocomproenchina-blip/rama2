import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Building2, Plus, Search, Loader2, RefreshCw, Users, KeyRound, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import PartnerCompanyForm from '@/components/partners/PartnerCompanyForm';
import PartnerCompanyCard from '@/components/partners/PartnerCompanyCard';

// Empresas socias (marcas blancas) que operan sobre la base de TLEC CARGO: aquí
// se dan de alta su código, sus prefijos y su llave de servicio.
export default function AdminPartnerCompanies() {
  const [companies, setCompanies] = useState([]);
  const [clientCounts, setClientCounts] = useState({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState(null); // null = cerrado, {} = nueva, {...} = editar
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await base44.entities.PartnerCompany.list('-created_date', 200);
      setCompanies(rows || []);

      try {
        const clients = await base44.entities.PartnerClient.list('-created_date', 500);
        const counts = {};
        for (const client of clients || []) {
          const code = String(client.company_code || '').toLowerCase();
          counts[code] = (counts[code] || 0) + 1;
        }
        setClientCounts(counts);
      } catch (_) {}
    } catch (e) {
      toast.error('No se pudieron cargar las empresas socias');
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const stats = useMemo(() => {
    const active = companies.filter((c) => c.is_active !== false).length;
    const withKey = companies.filter((c) => c.service_key).length;
    return { total: companies.length, active, withKey };
  }, [companies]);

  const filtered = companies.filter((c) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return [c.company_name, c.company_code, c.contact_email, c.legal_name]
      .some((v) => String(v || '').toLowerCase().includes(q));
  });

  const handleSaved = (saved) => {
    setEditing(null);
    setCompanies((prev) => {
      const exists = prev.some((c) => c.id === saved?.id);
      return exists ? prev.map((c) => (c.id === saved.id ? saved : c)) : [saved, ...prev];
    });
    load();
  };

  const handleToggleActive = async (company, value) => {
    setCompanies((prev) => prev.map((c) => (c.id === company.id ? { ...c, is_active: value } : c)));
    try {
      await base44.entities.PartnerCompany.update(company.id, { is_active: value });
      toast.success(value ? 'Empresa activada' : 'Empresa desactivada');
    } catch (e) {
      setCompanies((prev) => prev.map((c) => (c.id === company.id ? { ...c, is_active: !value } : c)));
      toast.error('No se pudo cambiar el estado');
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await base44.entities.PartnerCompany.delete(deleteTarget.id);
      setCompanies((prev) => prev.filter((c) => c.id !== deleteTarget.id));
      toast.success('Empresa eliminada');
      setDeleteTarget(null);
    } catch (e) {
      toast.error('No se pudo eliminar la empresa');
    }
    setDeleting(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-slate-800 flex items-center gap-2">
            <Building2 className="h-7 w-7 text-sky-600" /> Empresas Socias
          </h1>
          <p className="text-slate-500 max-w-2xl">
            Cada empresa socia tiene su código único, sus prefijos y su llave de servicio. Con ese código se separan sus
            paquetes, bultos, clientes y facturas dentro de esta misma app, y su app secundaria consulta y envía datos por
            la vía de servicio. Todo lo que llegue sin pre-alerta queda como huérfano para asignación manual.
          </p>
        </div>
        <Button onClick={() => setEditing({})} className="gap-2 shrink-0">
          <Plus className="h-4 w-4" /> Nueva empresa
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Card className="shadow-sm"><CardContent className="p-3 flex items-center gap-3">
          <div className="rounded-lg bg-sky-50 p-2 shrink-0"><Building2 className="h-5 w-5 text-sky-600" /></div>
          <div className="min-w-0"><p className="text-xs text-slate-500 truncate">Empresas</p><p className="text-xl font-bold text-slate-800">{stats.total}</p></div>
        </CardContent></Card>
        <Card className="shadow-sm"><CardContent className="p-3 flex items-center gap-3">
          <div className="rounded-lg bg-emerald-50 p-2 shrink-0"><Users className="h-5 w-5 text-emerald-600" /></div>
          <div className="min-w-0"><p className="text-xs text-slate-500 truncate">Activas</p><p className="text-xl font-bold text-slate-800">{stats.active}</p></div>
        </CardContent></Card>
        <Card className="shadow-sm"><CardContent className="p-3 flex items-center gap-3">
          <div className="rounded-lg bg-indigo-50 p-2 shrink-0"><KeyRound className="h-5 w-5 text-indigo-600" /></div>
          <div className="min-w-0"><p className="text-xs text-slate-500 truncate">Con llave</p><p className="text-xl font-bold text-slate-800">{stats.withKey}</p></div>
        </CardContent></Card>
      </div>

      <Card className="shadow-sm">
        <CardContent className="p-4 flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input placeholder="Buscar por nombre, código o contacto..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
          </div>
          <Button variant="outline" onClick={load} disabled={loading} className="gap-2">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} Actualizar
          </Button>
        </CardContent>
      </Card>

      {loading && companies.length === 0 ? (
        <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-sky-600" /></div>
      ) : filtered.length === 0 ? (
        <Card><CardContent className="p-10 text-center text-slate-500">
          <Building2 className="h-12 w-12 mx-auto mb-3 text-slate-300" />
          <p className="font-medium">Aún no hay empresas socias</p>
          <p className="text-sm">Crea la primera para separar su carga, sus clientes y sus facturas por código de empresa.</p>
        </CardContent></Card>
      ) : (
        <div className="grid gap-3">
          {filtered.map((company) => (
            <div key={company.id} className="space-y-1">
              <PartnerCompanyCard
                company={company}
                onEdit={(c) => setEditing(c)}
                onToggleActive={handleToggleActive}
                onDelete={(c) => setDeleteTarget(c)}
              />
              {clientCounts[String(company.company_code || '').toLowerCase()] > 0 && (
                <p className="text-[11px] text-slate-500 px-1">
                  {clientCounts[String(company.company_code || '').toLowerCase()]} cliente(s) en su padrón
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {editing && (
        <PartnerCompanyForm company={editing.id ? editing : null} onClose={() => setEditing(null)} onSaved={handleSaved} />
      )}

      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-0 md:p-4 md:pt-20" onClick={() => !deleting && setDeleteTarget(null)}>
          <Card className="w-full md:max-w-md shadow-xl" onClick={(e) => e.stopPropagation()}>
            <CardContent className="p-6 space-y-4">
              <div className="flex items-start gap-3">
                <div className="p-2.5 bg-rose-50 rounded-full shrink-0"><AlertTriangle className="h-6 w-6 text-rose-600" /></div>
                <div>
                  <h3 className="font-semibold text-slate-800">¿Eliminar {deleteTarget.company_name}?</h3>
                  <p className="text-sm text-slate-500 mt-1">
                    Se elimina el registro de la empresa. Sus paquetes, bultos y facturas ya emitidos conservan su código, pero
                    su llave de servicio deja de existir.
                  </p>
                </div>
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={deleting}>Cancelar</Button>
                <Button variant="destructive" onClick={handleDelete} disabled={deleting} className="gap-2">
                  {deleting && <Loader2 className="h-4 w-4 animate-spin" />} Sí, eliminar
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}