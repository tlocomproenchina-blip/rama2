import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { FileText, Loader2, Settings2 } from 'lucide-react';
import { toast } from 'sonner';

// Reporte TXT de los clientes de esta copia, con su propio punto de inicio
// (misma mecánica que el reporte global de Gestión de Clientes).
export default function CopyClientTxtReportButton({ app, onReportChanged }) {
  const [cursor, setCursor] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [cursorOpen, setCursorOpen] = useState(false);
  const [loadingCursor, setLoadingCursor] = useState(false);
  const [newNumber, setNewNumber] = useState('');
  const [savingCursor, setSavingCursor] = useState(false);

  const loadCursor = async () => {
    setLoadingCursor(true);
    try {
      const { data } = await base44.functions.invoke('manageIntegratedApps', { action: 'get_cursor', app_id: app.id });
      const info = data?.cursor || null;
      setCursor(info);
      setNewNumber(String(info?.cursor_number ?? 0));
    } catch (_) {
      setCursor(null);
      setNewNumber('0');
    } finally {
      setLoadingCursor(false);
    }
  };

  useEffect(() => { loadCursor(); }, [app.id]);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const { data } = await base44.functions.invoke('generateCopyClientsTxtReport', { app_id: app.id });
      if (data?.error) {
        toast.error(data.error);
        return;
      }
      if (data?.empty) {
        toast.info(data.message || 'No hay clientes nuevos de esta copia para reportar.');
        return;
      }
      const blob = new Blob([data.content], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const stamp = new Date().toISOString().slice(0, 16).replace('T', '_').replace(':', 'h');
      a.href = url;
      a.download = `clientes_${app.slug}_${stamp}.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success(`Reporte de ${app.name}: ${data.count} clientes incluidos.`);
      await loadCursor();
      if (onReportChanged) onReportChanged();
    } catch (_) {
      toast.error('No se pudo generar el reporte de esta copia');
    } finally {
      setGenerating(false);
    }
  };

  const handleSaveCursor = async () => {
    const num = Number(newNumber);
    if (Number.isNaN(num) || num < 0 || !Number.isInteger(num)) {
      toast.error('Ingresa un número entero válido mayor o igual a 0.');
      return;
    }
    setSavingCursor(true);
    try {
      const { data } = await base44.functions.invoke('manageIntegratedApps', {
        action: 'set_cursor',
        app_id: app.id,
        number: num
      });
      if (!data?.ok) {
        toast.error(data?.error || 'No se pudo guardar el punto de inicio');
        return;
      }
      toast.success(`Punto de inicio de ${app.name} actualizado a ${num}.`);
      setCursorOpen(false);
      await loadCursor();
      if (onReportChanged) onReportChanged();
    } catch (_) {
      toast.error('No se pudo guardar el punto de inicio');
    } finally {
      setSavingCursor(false);
    }
  };

  return (
    <>
      {cursor?.last_report_date && (
        <p className="text-[11px] text-slate-400">
          Último reporte: {new Date(cursor.last_report_date).toLocaleDateString('es-VE')} · {cursor.last_report_count || 0} clientes
          {cursor.last_mark ? ` · último mark ${cursor.last_mark}` : ''}
        </p>
      )}

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <Button variant="outline" size="sm" onClick={handleGenerate} disabled={generating} className="gap-1.5">
          {generating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileText className="h-3.5 w-3.5" />}
          Generar reporte TXT
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setCursorOpen(true);
            loadCursor();
          }}
          className="gap-1.5"
        >
          <Settings2 className="h-3.5 w-3.5" /> Punto de inicio
        </Button>
      </div>

      <Dialog open={cursorOpen} onOpenChange={setCursorOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Punto de inicio del reporte de {app.name}</DialogTitle>
            <DialogDescription>
              El próximo reporte incluirá los clientes de esta copia con número de Shipping Mark mayor al valor indicado.
            </DialogDescription>
          </DialogHeader>

          {loadingCursor ? (
            <div className="flex justify-center py-6">
              <Loader2 className="h-6 w-6 animate-spin text-slate-500" />
            </div>
          ) : (
            <div className="space-y-4 py-2">
              {cursor?.last_report_date ? (
                <div className="rounded-lg border border-border bg-muted/40 p-3 text-sm space-y-1">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Último reporte:</span>
                    <span className="font-medium">{new Date(cursor.last_report_date).toLocaleString('es-VE')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Clientes incluidos:</span>
                    <span className="font-medium">{cursor.last_report_count ?? 0}</span>
                  </div>
                  {cursor.last_mark && (
                    <div className="flex justify-between gap-2">
                      <span className="text-slate-500 shrink-0">Último mark:</span>
                      <span className="font-mono text-xs break-all text-right">{cursor.last_mark}</span>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-sm text-slate-500">Esta copia todavía no ha generado ningún reporte.</p>
              )}
              <div className="space-y-2">
                <Label htmlFor="copy-cursor-number">Iniciar desde el número</Label>
                <Input
                  id="copy-cursor-number"
                  type="number"
                  min="0"
                  value={newNumber}
                  onChange={(e) => setNewNumber(e.target.value)}
                  placeholder="ej: 1200"
                />
                <p className="text-xs text-slate-500">
                  Si escribes <span className="font-mono">1200</span>, el próximo reporte incluirá desde el
                  <span className="font-mono"> 1201</span> en adelante.
                </p>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setCursorOpen(false)} disabled={savingCursor}>
              Cancelar
            </Button>
            <Button onClick={handleSaveCursor} disabled={savingCursor || loadingCursor}>
              {savingCursor ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              Guardar punto de inicio
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}