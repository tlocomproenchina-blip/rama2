import React, { useMemo, useState } from 'react';
import { base44 } from '@/components/api/ApiQueueManager';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2, Upload } from 'lucide-react';
import { toast } from 'sonner';

const extractionSchema = {
  type: 'object',
  properties: {
    rows: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          tracking_number: { type: 'string' },
          client_email: { type: 'string' },
          shipping_mark: { type: 'string' },
          shipping_type: { type: 'string' },
          description: { type: 'string' },
          status: { type: 'string' },
          has_insurance: { type: 'boolean' },
          fob_value: { type: 'number' }
        }
      }
    }
  },
  required: ['rows']
};

function normalizeRow(row) {
  return {
    tracking_number: String(row.tracking_number || '').trim(),
    client_email: String(row.client_email || '').trim(),
    shipping_mark: String(row.shipping_mark || '').trim(),
    shipping_type: String(row.shipping_type || '').trim().toLowerCase(),
    description: String(row.description || '').trim(),
    status: String(row.status || 'pre_alerta').trim().toLowerCase() || 'pre_alerta',
    has_insurance: Boolean(row.has_insurance || false),
    fob_value: Number(row.fob_value || 0),
  };
}

function validateRows(rows) {
  const validShippingTypes = ['aereo', 'maritimo'];
  const valid = [];
  const invalid = [];

  rows.forEach((rawRow, index) => {
    const row = normalizeRow(rawRow);
    const errors = [];
    if (!row.tracking_number) errors.push('tracking_number requerido');
    if (!row.client_email) errors.push('client_email requerido');
    if (!row.description) errors.push('description requerido');
    if (!validShippingTypes.includes(row.shipping_type)) errors.push('shipping_type debe ser aereo o maritimo');

    if (errors.length) {
      invalid.push({ index: index + 1, errors, row });
    } else {
      valid.push(row);
    }
  });

  return { valid, invalid };
}

export default function PackageImportDialog({ open, onOpenChange, onImported }) {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState({ valid: [], invalid: [] });

  const preview = useMemo(() => result.valid.slice(0, 5), [result.valid]);

  const handleAnalyze = async () => {
    if (!file) {
      toast.error('Selecciona un archivo CSV o Excel');
      return;
    }

    setLoading(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    const extracted = await base44.integrations.Core.ExtractDataFromUploadedFile({ file_url, json_schema: extractionSchema });
    const rows = extracted?.output?.rows || [];
    setResult(validateRows(rows));
    setLoading(false);
  };

  const handleImport = async () => {
    if (!result.valid.length) {
      toast.error('No hay filas válidas para importar');
      return;
    }

    setImporting(true);
    await base44.entities.Package.bulkCreate(result.valid);
    setImporting(false);
    toast.success(`${result.valid.length} paquetes importados`);
    setFile(null);
    setResult({ valid: [], invalid: [] });
    onOpenChange(false);
    onImported?.();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Importar paquetes</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Archivo CSV o Excel</Label>
            <Input type="file" accept=".csv,.xlsx,.xls" onChange={(e) => setFile(e.target.files?.[0] || null)} />
            <p className="text-xs text-slate-500">Columnas requeridas: tracking_number, client_email, shipping_type, description</p>
          </div>

          <div className="flex gap-3">
            <Button variant="outline" onClick={handleAnalyze} disabled={loading || !file}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              Validar archivo
            </Button>
          </div>

          {(result.valid.length > 0 || result.invalid.length > 0) && (
            <div className="grid gap-4 md:grid-cols-2">
              <Card><CardContent className="p-4"><p className="text-sm text-slate-500">Filas válidas</p><p className="text-2xl font-bold">{result.valid.length}</p></CardContent></Card>
              <Card><CardContent className="p-4"><p className="text-sm text-slate-500">Filas inválidas</p><p className="text-2xl font-bold">{result.invalid.length}</p></CardContent></Card>
            </div>
          )}

          {preview.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium text-slate-800">Vista previa</p>
              {preview.map((row, index) => (
                <div key={`${row.tracking_number}-${index}`} className="rounded-xl border p-3 text-sm">
                  <p className="font-medium">{row.tracking_number}</p>
                  <p className="text-slate-500">{row.client_email} · {row.shipping_type}</p>
                </div>
              ))}
            </div>
          )}

          {result.invalid.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium text-rose-700">Errores detectados</p>
              {result.invalid.slice(0, 5).map((item) => (
                <div key={`invalid-${item.index}`} className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
                  Fila {item.index}: {item.errors.join(', ')}
                </div>
              ))}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cerrar</Button>
          <Button onClick={handleImport} disabled={importing || !result.valid.length}>
            {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Importar válidos
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}