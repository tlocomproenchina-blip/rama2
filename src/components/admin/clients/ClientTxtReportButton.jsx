import React, { useState, useEffect } from 'react';
import { base44 } from '@/components/api/ApiQueueManager';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { FileText, Loader2, Settings2 } from 'lucide-react';
import { toast } from 'sonner';

export default function ClientTxtReportButton() {
  const [generating, setGenerating] = useState(false);
  const [cursorOpen, setCursorOpen] = useState(false);
  const [cursor, setCursor] = useState(null);
  const [loadingCursor, setLoadingCursor] = useState(false);
  const [newNumber, setNewNumber] = useState('');
  const [savingCursor, setSavingCursor] = useState(false);

  const loadCursor = async () => {
    setLoadingCursor(true);
    try {
      const rows = await base44.entities.ClientReportCursor.filter({ config_key: 'main' }, '-updated_date', 1);
      const c = rows?.[0] || null;
      setCursor(c);
      setNewNumber(c ? String(c.last_shipping_mark_number ?? 0) : '0');
    } catch (e) {
      setCursor(null);
      setNewNumber('0');
    } finally {
      setLoadingCursor(false);
    }
  };

  useEffect(() => {
    if (cursorOpen) loadCursor();
  }, [cursorOpen]);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const res = await base44.functions.invoke('generateClientsTxtReport', {});
      const data = res?.data || {};
      if (data.error) {
        toast.error(data.error);
        return;
      }
      if (data.empty) {
        toast.info(data.message || 'No hay clientes nuevos para reportar.');
        return;
      }
      // Descargar el TXT en el navegador
      const blob = new Blob([data.content], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const stamp = new Date().toISOString().slice(0, 16).replace('T', '_').replace(':', 'h');
      a.href = url;
      a.download = `clientes_tlec_${stamp}.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success(`Reporte generado: ${data.count} clientes incluidos. Último: ${data.last_mark}`);
      // Refrescar cursor mostrado si el modal está abierto
      if (cursorOpen) loadCursor();
    } catch (e) {
      toast.error('Error al generar el reporte');
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
      const res = await base44.functions.invoke('setClientReportCursor', { number: num });
      if (res?.data?.error) {
        toast.error(res.data.error);
        return;
      }
      toast.success(`Punto de inicio actualizado a ${num}. El próximo reporte arrancará desde ${num + 1}.`);
      setCursorOpen(false);
    } catch (e) {
      toast.error('Error al actualizar el punto de inicio');
    } finally {
      setSavingCursor(false);
    }
  };

  return (
    <>
      <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
        <Button
          onClick={handleGenerate}
          disabled={generating}
          className="w-full sm:w-auto bg-slate-800 hover:bg-slate-900"
          title="Genera un TXT con los clientes nuevos desde el último reporte"
        >
          {generating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <FileText className="h-4 w-4 mr-2" />}
          Generar reporte TXT
        </Button>
        <Button
          onClick={() => setCursorOpen(true)}
          variant="outline"
          className="w-full sm:w-auto"
          title="Ajustar el punto de inicio del próximo reporte"
        >
          <Settings2 className="h-4 w-4 mr-2" />
          Punto de inicio
        </Button>
      </div>

      <Dialog open={cursorOpen} onOpenChange={setCursorOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Punto de inicio del reporte TXT</DialogTitle>
            <DialogDescription>
              El próximo reporte incluirá los clientes con número de Shipping Mark mayor al valor indicado.
            </DialogDescription>
          </DialogHeader>

          {loadingCursor ? (
            <div className="flex justify-center py-6">
              <Loader2 className="h-6 w-6 animate-spin text-slate-500" />
            </div>
          ) : (
            <div className="space-y-4 py-2">
              {cursor?.last_report_date && (
                <div className="rounded-lg border border-border bg-muted/40 p-3 text-sm space-y-1">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Último reporte:</span>
                    <span className="font-medium">{new Date(cursor.last_report_date).toLocaleString('es-VE')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Clientes incluidos:</span>
                    <span className="font-medium">{cursor.last_report_count ?? 0}</span>
                  </div>
                  {cursor.last_shipping_mark_string && (
                    <div className="flex justify-between gap-2">
                      <span className="text-slate-500 shrink-0">Último mark:</span>
                      <span className="font-mono text-xs break-all text-right">{cursor.last_shipping_mark_string}</span>
                    </div>
                  )}
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="cursor-number">Iniciar desde el número</Label>
                <Input
                  id="cursor-number"
                  type="number"
                  min="0"
                  value={newNumber}
                  onChange={(e) => setNewNumber(e.target.value)}
                  placeholder="ej: 50100"
                />
                <p className="text-xs text-slate-500">
                  Si escribes <span className="font-mono">50100</span>, el próximo reporte incluirá desde el
                  <span className="font-mono"> 50101</span> en adelante.
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