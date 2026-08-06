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
          email: { type: 'string' },
          first_name: { type: 'string' },
          last_name: { type: 'string' },
          whatsapp: { type: 'string' },
          state: { type: 'string' },
          city: { type: 'string' },
          address: { type: 'string' },
          shipping_mark: { type: 'string' },
          is_active: { type: 'boolean' }
        }
      }
    }
  },
  required: ['rows']
};

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizeRow(row) {
  return {
    email: String(row.email || '').trim().toLowerCase(),
    first_name: String(row.first_name || '').trim(),
    last_name: String(row.last_name || '').trim(),
    whatsapp: String(row.whatsapp || '').trim(),
    state: String(row.state || '').trim(),
    city: String(row.city || '').trim(),
    address: String(row.address || '').trim(),
    shipping_mark: String(row.shipping_mark || '').trim(),
    is_active: typeof row.is_active === 'boolean' ? row.is_active : true,
  };
}

function validateRows(rows) {
  const valid = [];
  const invalid = [];
  const emails = new Set();

  rows.forEach((rawRow, index) => {
    const row = normalizeRow(rawRow);
    const errors = [];

    if (!row.email) errors.push('email requerido');
    if (row.email && !emailRegex.test(row.email)) errors.push('email inválido');
    if (row.email && emails.has(row.email)) errors.push('email duplicado en archivo');
    if (row.email) emails.add(row.email);

    if (errors.length) {
      invalid.push({ index: index + 1, errors, row });
    } else {
      valid.push(row);
    }
  });

  return { valid, invalid };
}

function buildUpdatePayload(row) {
  return {
    first_name: row.first_name || null,
    last_name: row.last_name || null,
    whatsapp: row.whatsapp || null,
    state: row.state || null,
    city: row.city || null,
    address: row.address || null,
    shipping_mark: row.shipping_mark || null,
    is_active: row.is_active,
  };
}

export default function ClientImportDialog({ open, onOpenChange, onImported }) {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState({ valid: [], invalid: [] });
  const [summary, setSummary] = useState(null);

  const preview = useMemo(() => result.valid.slice(0, 5), [result.valid]);

  const handleAnalyze = async () => {
    if (!file) {
      toast.error('Selecciona un archivo CSV o Excel');
      return;
    }

    setLoading(true);
    setSummary(null);
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
    let invited = 0;
    let updated = 0;
    let invitedOnly = 0;

    for (const row of result.valid) {
      const lookupRes = await base44.functions.invoke('listAllUsers', { emails: [row.email] });
      const existing = lookupRes?.data?.users?.[0] || null;

      if (existing?.id) {
        await base44.entities.User.update(existing.id, buildUpdatePayload(row));
        updated += 1;
        continue;
      }

      await base44.users.inviteUser(row.email, 'user');
      invited += 1;

      const lookupRes2 = await base44.functions.invoke('listAllUsers', { emails: [row.email] });
      const invitedUser = lookupRes2?.data?.users?.[0] || null;
      if (invitedUser?.id) {
        await base44.entities.User.update(invitedUser.id, buildUpdatePayload(row));
      } else {
        invitedOnly += 1;
      }
    }

    const nextSummary = { invited, updated, invitedOnly };
    setSummary(nextSummary);
    setImporting(false);
    toast.success(`Clientes procesados: ${result.valid.length}`);
    setFile(null);
    setResult({ valid: [], invalid: [] });
    onImported?.();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Importar clientes</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Archivo CSV o Excel</Label>
            <Input type="file" accept=".csv,.xlsx,.xls" onChange={(e) => setFile(e.target.files?.[0] || null)} />
            <p className="text-xs text-slate-500">Columna requerida: email. Opcionales: first_name, last_name, whatsapp, state, city, address, shipping_mark, is_active</p>
            <p className="text-xs text-slate-500">Los clientes nuevos se invitan al sistema; los existentes se actualizan.</p>
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
                <div key={`${row.email}-${index}`} className="rounded-xl border p-3 text-sm">
                  <p className="font-medium">{row.email}</p>
                  <p className="text-slate-500">{`${row.first_name || ''} ${row.last_name || ''}`.trim() || 'Sin nombre'} · {row.city || 'Sin ciudad'}</p>
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

          {summary && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
              Invitados: {summary.invited} · Actualizados: {summary.updated} · Pendientes de completar luego de invitar: {summary.invitedOnly}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cerrar</Button>
          <Button onClick={handleImport} disabled={importing || !result.valid.length}>
            {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Importar clientes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}