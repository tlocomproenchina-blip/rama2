import React from 'react';
import { History } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { normalizeRif } from '@/lib/fiscalCalc';
import FiscalField from '@/components/fiscal/FiscalField';
import FiscalFileField from '@/components/fiscal/FiscalFileField';

export default function FiscalTaxDataStep({ form, setForm, errors = {}, previous, onReuse }) {
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  return (
    <div className="space-y-5">
      {previous ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-accent/50 p-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground">Tienes datos fiscales guardados</p>
            <p className="truncate text-xs text-muted-foreground">{previous.legal_name} - {previous.rif}</p>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={onReuse}>
            <History className="h-4 w-4" /> Reutilizar mis datos
          </Button>
        </div>
      ) : null}
      <FiscalField label="Nombre o razón social *" error={errors.legal_name}>
        <Input value={form.legal_name} onChange={(e) => set('legal_name', e.target.value)} maxLength={160} placeholder="Ej: Inversiones Ejemplo, C.A." />
      </FiscalField>
      <FiscalField label="RIF *" hint="Ejemplo: J-12345678-9" error={errors.rif}>
        <Input
          value={form.rif}
          onChange={(e) => set('rif', e.target.value.toUpperCase())}
          onBlur={() => set('rif', normalizeRif(form.rif) || form.rif)}
          maxLength={14}
          placeholder="J-12345678-9"
        />
      </FiscalField>
      <FiscalField label="Dirección fiscal *" error={errors.fiscal_address}>
        <Textarea rows={3} value={form.fiscal_address} onChange={(e) => set('fiscal_address', e.target.value)} maxLength={400} placeholder="Calle, edificio, ciudad, estado" />
      </FiscalField>
      <FiscalFileField
        label="Documento RIF *"
        value={form.rif_document_uri}
        type={form.rif_document_type}
        error={errors.rif_document}
        onChange={({ uri, type }) => setForm((f) => ({ ...f, rif_document_uri: uri, rif_document_type: type }))}
      />
    </div>
  );
}