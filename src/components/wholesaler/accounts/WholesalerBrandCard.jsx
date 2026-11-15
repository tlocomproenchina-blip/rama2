import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Loader2, Upload } from 'lucide-react';

// Nombre, logo y dominio propio con que el mayorista ve su portal.
export default function WholesalerBrandCard({ wholesalerKey, brand, onSaved }) {
  const [form, setForm] = useState({ display_name: '', logo_url: '', domain: '' });
  const [busy, setBusy] = useState(false);
  useEffect(() => { setForm({ display_name: brand?.display_name || '', logo_url: brand?.logo_url || '', domain: brand?.domain || '' }); }, [brand]);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const upload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    const { file_url } = await base44.integrations.Core.UploadPublicFile({ file });
    setForm((f) => ({ ...f, logo_url: file_url }));
    setBusy(false);
  };
  const save = async () => {
    setBusy(true);
    await base44.functions.invoke('wholesalerAccounts', { action: 'admin_brand', wholesaler_key: wholesalerKey, ...form });
    setBusy(false);
    toast.success('Marca guardada');
    onSaved();
  };

  return (
    <Card><CardContent className="space-y-3 p-5">
      <h3 className="font-display font-semibold">Identidad del portal</h3>
      <div className="flex items-center gap-3">
        {form.logo_url ? <img src={form.logo_url} alt="Logo" className="h-14 w-14 rounded-xl border object-contain" /> : <div className="h-14 w-14 rounded-xl border bg-muted" />}
        <label className="cursor-pointer text-sm font-semibold text-link"><Upload className="mr-1 inline h-4 w-4" />Subir logo<input type="file" accept="image/*" className="hidden" onChange={upload} /></label>
      </div>
      <Input placeholder="Nombre visible" value={form.display_name} onChange={set('display_name')} />
      <Input placeholder="Dominio propio (ej: portal.mayorista.com)" value={form.domain} onChange={set('domain')} />
      <Button onClick={save} disabled={busy}>{busy && <Loader2 className="animate-spin" />}Guardar</Button>
    </CardContent></Card>
  );
}