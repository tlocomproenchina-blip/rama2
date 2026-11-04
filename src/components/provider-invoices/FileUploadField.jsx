import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Upload, Loader2, FileCheck } from 'lucide-react';
import { uploadToBunny } from '@/lib/providerInvoicesApi';
import { toast } from 'sonner';

export default function FileUploadField({ value, onChange, label = 'Cargar foto o PDF' }) {
  const [busy, setBusy] = useState(false);
  const handle = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setBusy(true);
    try { onChange(await uploadToBunny(file)); } catch (err) { toast.error(err?.response?.data?.error || 'No se pudo subir el archivo'); }
    setBusy(false);
  };
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button type="button" variant="outline" asChild disabled={busy}>
        <label className="cursor-pointer">
          {busy ? <Loader2 className="animate-spin" /> : <Upload />} {label}
          <input type="file" accept="image/*,application/pdf" className="hidden" onChange={handle} />
        </label>
      </Button>
      {value && <a href={value} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-sm text-primary underline"><FileCheck className="h-4 w-4" />Ver archivo</a>}
    </div>
  );
}