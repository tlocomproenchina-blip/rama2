import React, { useCallback, useEffect, useState } from 'react';
import { base44 } from '@/components/api/ApiQueueManager';
import PageHero from '@/components/common/PageHero';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Building2, Plus, Loader2, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import PartnerCompanyCard from '@/components/partners/PartnerCompanyCard';
import PartnerCompanyDialog from '@/components/partners/PartnerCompanyDialog';
import PartnerUsagePanel from '@/components/partners/PartnerUsagePanel';

export default function AdminPartners() {
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [revealedKey, setRevealedKey] = useState('');
  const [usageCompany, setUsageCompany] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await base44.entities.Company.list('-created_date', 200);
      setCompanies((rows || []).filter((row) => !row.is_platform_owner && row.company_code !== 'TLEC'));
    } catch {
      toast.error('No se pudieron cargar las empresas socias');
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const call = async (payload) => {
    const res = await base44.functions.invoke('managePartnerCompany', payload);
    const data = res?.data || res;
    if (data?.error) throw new Error(data.error);
    return data;
  };

  const handleSave = async (form) => {
    setSaving(true);
    try {
      const data = await call({ action: editing ? 'update' : 'create', company_id: editing?.id, company: form });
      if (data.service_key) setRevealedKey(data.service_key);
      toast.success(editing ? 'Empresa socia actualizada' : 'Empresa socia creada con su llave de servicio');
      setDialogOpen(false);
      setEditing(null);
      await load();
    } catch (error) {
      toast.error(error.message);
    }
    setSaving(false);
  };

  const handleRotate = async (company) => {
    try {
      const data = await call({ action: 'rotate_key', company_id: company.id });
      setRevealedKey(data.service_key || '');
      toast.success('Llave rotada: reemplázala en la app de esa empresa');
      await load();
    } catch (error) {
      toast.error(error.message);
    }
  };

  const handleStatus = async (company, status) => {
    try {
      await call({ action: 'set_status', company_id: company.id, status });
      toast.success(status === 'activa' ? 'Acceso activado' : 'Acceso cortado: su app ya no lee ni escribe');
      await load();
    } catch (error) {
      toast.error(error.message);
    }
  };

  const handleProbe = async (company) => {
    try {
      const data = await call({ action: 'probe', company_id: company.id });
      const failed = (data.probes || []).filter((probe) => !probe.ok);
      if (failed.length) toast.error(`Canal con problemas en «${failed[0].label}»: ${failed[0].error}`);
      else toast.success('Canal operativo: llave, configuración y lectura responden');
    } catch (error) {
      toast.error(error.message);
    }
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHero
        icon={Building2}
        badge="Empresas socias"
        title="Empresas socias"
        description="Cada socia opera su propia app con su marca, sus tarifas y sus usuarios, sobre esta misma base de datos y con su llave de servicio."
      />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-slate-500">
          {loading ? 'Cargando…' : `${companies.length} empresa(s) registrada(s)`}
        </p>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={load} className="gap-2">
            <RefreshCw className="h-4 w-4" /> Actualizar
          </Button>
          <Button onClick={() => { setEditing(null); setDialogOpen(true); }} className="gap-2">
            <Plus className="h-4 w-4" /> Nueva empresa socia
          </Button>
        </div>
      </div>

      {revealedKey ? (
        <Card className="border-emerald-200 bg-emerald-50">
          <CardContent className="space-y-1 p-4">
            <p className="text-sm font-semibold text-emerald-800">Llave de servicio</p>
            <p className="text-xs text-emerald-700">
              Cópiala y guárdala como secreto propio en la app de esa empresa: es la que autoriza todo su acceso.
            </p>
            <code className="mt-1 block break-all rounded-lg bg-white px-3 py-2 text-xs text-slate-700">{revealedKey}</code>
            <Button variant="ghost" size="sm" onClick={() => setRevealedKey('')} className="text-emerald-800">
              Ocultar
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        </div>
      ) : companies.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 p-10 text-center text-slate-500">
          Todavía no hay empresas socias. Crea la primera para generar su llave y su configuración.
        </div>
      ) : (
        <div className="space-y-3">
          {companies.map((company) => (
            <PartnerCompanyCard
              key={company.id}
              company={company}
              onEdit={() => { setEditing(company); setDialogOpen(true); }}
              onRotate={() => handleRotate(company)}
              onToggleStatus={(status) => handleStatus(company, status)}
              onProbe={() => handleProbe(company)}
              onViewUsage={() => setUsageCompany(company)}
            />
          ))}
        </div>
      )}

      <PartnerCompanyDialog
        open={dialogOpen}
        company={editing}
        saving={saving}
        onClose={() => { setDialogOpen(false); setEditing(null); }}
        onSave={handleSave}
      />
      <PartnerUsagePanel company={usageCompany} onClose={() => setUsageCompany(null)} />
    </div>
  );
}