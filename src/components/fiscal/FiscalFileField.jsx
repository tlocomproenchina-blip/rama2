import React, { useId, useState } from 'react';
import { CheckCircle2, Loader2, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { base44 } from '@/api/base44Client';
import { validateFile } from '@/lib/fiscalCalc';
import FiscalField from '@/components/fiscal/FiscalField';
import FiscalFileLink from '@/components/fiscal/FiscalFileLink';

// Carga de imagen o PDF al almacenamiento privado. Guarda solo el file_uri.
export default function FiscalFileField({ label, hint, value, type, onChange, error, disabled }) {
  const inputId = useId();
  const [busy, setBusy] = useState(false);
  const [localError, setLocalError] = useState('');

  const pick = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const problem = validateFile(file);
    if (problem) {
      setLocalError(problem);
      return;
    }
    setLocalError('');
    setBusy(true);
    try {
      const res = await base44.integrations.Core.UploadPrivateFile({ file });
      const uri = res?.file_uri || res?.data?.file_uri;
      if (!uri) throw new Error('upload');
      onChange({ uri, type: file.type === 'application/pdf' ? 'pdf' : 'image' });
      toast.success('Archivo cargado');
    } catch (_) {
      setLocalError('No se pudo subir el archivo. Intenta de nuevo.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <FiscalField label={label} hint={hint || 'Imagen (JPG, PNG, WEBP) o PDF, máximo 8 MB'} error={error || localError}>
      <div className="rounded-xl border-2 border-dashed border-border bg-card p-3">
        {value ? (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="flex items-center gap-2 text-sm font-medium text-emerald-700">
              <CheckCircle2 className="h-4 w-4" /> Archivo cargado
            </span>
            <FiscalFileLink uri={value} type={type} label={label || 'Archivo'} />
          </div>
        ) : null}
        <input id={inputId} type="file" accept="image/jpeg,image/png,image/webp,application/pdf" className="hidden" onChange={pick} disabled={disabled || busy} />
        <label htmlFor={inputId} className={`mt-1 flex cursor-pointer items-center justify-center gap-2 rounded-lg px-3 py-3 text-sm font-medium text-primary hover:bg-accent ${disabled ? 'pointer-events-none opacity-50' : ''}`}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
          {busy ? 'Subiendo...' : value ? 'Reemplazar archivo' : 'Seleccionar archivo'}
        </label>
      </div>
    </FiscalField>
  );
}