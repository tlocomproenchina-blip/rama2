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
          codigo_ruta: { type: 'string' },
          tipo_ruta: { type: 'string' },
          origen: { type: 'string' },
          destino: { type: 'string' },
          fecha_salida: { type: 'string' },
          fecha_estimada_entrega: { type: 'string' },
          estado: { type: 'string' },
          total_paradas: { type: 'number' },
          observaciones: { type: 'string' }
        }
      }
    }
  },
  required: ['rows']
};

function normalizeRow(row) {
  return {
    codigo_ruta: String(row.codigo_ruta || '').trim(),
    tipo_ruta: String(row.tipo_ruta || '').trim().toLowerCase(),
    origen: String(row.origen || '').trim(),
    destino: String(row.destino || '').trim(),
    fecha_salida: String(row.fecha_salida || '').trim(),
    fecha_estimada_entrega: String(row.fecha_estimada_entrega || '').trim(),
    estado: String(row.estado || 'planificada').trim().toLowerCase() || 'planificada',
    total_paradas: Number(row.total_paradas || 0),
    observaciones: String(row.observaciones || '').trim(),
  };
}

function validateRows(rows) {
  const validTypes = ['urbana', 'interurbana'];
  const validStates = ['planificada', 'asignada', 'en_curso', 'completada', 'cancelada'];
  const valid = [];
  const invalid = [];

  rows.forEach((rawRow, index) => {
    const row = normalizeRow(rawRow);
    const errors = [];
    if (!row.codigo_ruta) errors.push('codigo_ruta requerido');
    if (!row.origen) errors.push('origen requerido');
    if (!row.destino) errors.push('destino requerido');
    if (!validTypes.includes(row.tipo_ruta)) errors.push('tipo_ruta debe ser urbana o interurbana');
    if (!validStates.includes(row.estado)) errors.push('estado inválido');

    if (errors.length) {
      invalid.push({ index: index + 1, errors, row });
    } else {
      valid.push(row);
    }
  });

  return { valid, invalid };
}

export default function RutaImportDialog({ open, onOpenChange, onImported }) {
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
    await base44.entities.Ruta.bulkCreate(result.valid);
    setImporting(false);
    toast.success(`${result.valid.length} rutas importadas`);
    setFile(null);
    setResult({ valid: [], invalid: [] });
    onOpenChange(false);
    onImported?.();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Importar rutas</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Archivo CSV o Excel</Label>
            <Input type="file" accept=".csv,.xlsx,.xls" onChange={(e) => setFile(e.target.files?.[0] || null)} />
            <p className="text-xs text-slate-500">Columnas requeridas: codigo_ruta, tipo_ruta, origen, destino, estado</p>
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
                <div key={`${row.codigo_ruta}-${index}`} className="rounded-xl border p-3 text-sm">
                  <p className="font-medium">{row.codigo_ruta}</p>
                  <p className="text-slate-500">{row.origen} → {row.destino} · {row.tipo_ruta}</p>
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