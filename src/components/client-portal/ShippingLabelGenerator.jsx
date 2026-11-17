import React, { useState, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Tag, Download, Printer, Loader2, QrCode, FileText } from 'lucide-react';
import { toast } from 'sonner';
import ShippingLabelContent from '@/components/client-portal/labels/ShippingLabelContent';

export default function ShippingLabelGenerator({ user, config }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    content: '',
    dimensions: '',
    weight: '',
    hasFBrand: false,
    hasBattery: false,
    hasLiquid: false,
    hasPowder: false,
    boxCount: '',
  });
  const [generating, setGenerating] = useState(false);
  const [labelCode, setLabelCode] = useState(null);
  const [labelId, setLabelId] = useState(null);
  const labelRefs = useRef([]);

  const shippingMark = user?.shipping_mark || '';
  const logoUrl = config?.app_logo_url || config?.invoice_logo_url || '';
  const companyName = config?.app_name || 'IMPORTACIONES TLEC CARGO';

  const boxCount = Math.max(1, Number(form.boxCount) || 1);
  const isMultiBox = boxCount > 1;

  const resetState = () => {
    setLabelCode(null);
    setLabelId(null);
    labelRefs.current = [];
    setForm({
      content: '',
      dimensions: '',
      weight: '',
      hasFBrand: false,
      hasBattery: false,
      hasLiquid: false,
      hasPowder: false,
      boxCount: '',
    });
  };

  const handleGenerate = async () => {
    if (!form.content.trim()) {
      toast.error('El contenido es requerido para generar la etiqueta');
      return;
    }
    if (!form.weight.trim()) {
      toast.error('El peso es requerido para generar la etiqueta');
      return;
    }
    if (!form.boxCount || Number(form.boxCount) < 1) {
      toast.error('El número de cajas es requerido para generar la etiqueta');
      return;
    }
    if (!shippingMark) {
      toast.error('Necesitas un Shipping Mark asignado para generar etiquetas');
      return;
    }

    setGenerating(true);
    try {
      const { data } = await base44.functions.invoke('generateShippingLabel', {
        content: form.content,
        dimensions: form.dimensions,
        weight: form.weight,
        has_fbrand: form.hasFBrand,
        has_battery: form.hasBattery,
        has_liquid: form.hasLiquid,
        has_powder: form.hasPowder,
        box_count: boxCount,
      });
      if (data?.label) {
        setLabelCode(data.label.label_code);
        setLabelId(data.label.id);
        toast.success(isMultiBox
          ? `Etiqueta generada: ${boxCount} cajas (PDF con ${boxCount} páginas)`
          : 'Etiqueta generada y guardada');
      }
    } catch (e) {
      toast.error(e?.response?.data?.error || 'Error al generar la etiqueta');
    }
    setGenerating(false);
  };

  const renderCanvasForBox = async (idx) => {
    const { default: html2canvas } = await import('html2canvas');
    return await html2canvas(labelRefs.current[idx], {
      scale: 3,
      backgroundColor: '#ffffff',
      useCORS: true,
    });
  };

  const handleDownload = async () => {
    if (!labelCode) return;
    setGenerating(true);
    try {
      if (!isMultiBox) {
        // 1 caja → PNG (igual que antes)
        const canvas = await renderCanvasForBox(0);
        const link = document.createElement('a');
        link.download = `etiqueta-${labelCode}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
      } else {
        // 2+ cajas → PDF multi-página
        const { jsPDF } = await import('jspdf');
        let pdf = null;
        for (let i = 0; i < boxCount; i++) {
          const canvas = await renderCanvasForBox(i);
          const imgData = canvas.toDataURL('image/png');
          const w = canvas.width;
          const h = canvas.height;
          if (i === 0) {
            pdf = new jsPDF({
              orientation: w > h ? 'landscape' : 'portrait',
              unit: 'px',
              format: [w, h],
              hotfixes: ['px_scaling'],
            });
          } else {
            pdf.addPage([w, h], w > h ? 'landscape' : 'portrait');
          }
          pdf.addImage(imgData, 'PNG', 0, 0, w, h);
        }
        pdf.save(`etiquetas-${labelCode}-${boxCount}cajas.pdf`);
      }
    } catch (e) {
      console.error('Error generating file:', e);
      toast.error('Error al generar el archivo');
    }
    setGenerating(false);
  };

  const handlePrint = async () => {
    if (!labelCode) return;
    setGenerating(true);
    try {
      const canvases = [];
      for (let i = 0; i < boxCount; i++) {
        canvases.push(await renderCanvasForBox(i));
      }
      const win = window.open('', '_blank', 'width=420,height=600');
      if (!win) {
        alert('Permite las ventanas emergentes para imprimir la etiqueta.');
        setGenerating(false);
        return;
      }
      const images = canvases
        .map((c) => `<img src="${c.toDataURL('image/png')}" />`)
        .join('');
      win.document.write(`
        <html>
          <head>
            <title>Etiqueta ${labelCode}</title>
            <style>
              @page { margin: 0; size: auto; }
              body { margin: 0; padding: 0; display: flex; flex-direction: column; align-items: center; }
              img { width: 380px; max-width: 100%; display: block; page-break-after: always; }
              img:last-child { page-break-after: auto; }
            </style>
          </head>
          <body>
            ${images}
          </body>
        </html>
      `);
      win.document.close();
      setTimeout(() => {
        win.focus();
        win.print();
      }, 400);
    } catch (e) {
      console.error('Error printing:', e);
      toast.error('Error al imprimir');
    }
    setGenerating(false);
  };

  return (
    <>
      <Button onClick={() => setOpen(true)} className="w-full gap-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white shadow-card">
        <Tag className="h-4 w-4" />
        Generar Etiqueta de Envío
      </Button>

      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetState(); }}>
        <DialogContent className="w-[calc(100vw-2rem)] max-w-3xl max-h-[90vh] overflow-y-auto p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base sm:text-lg"><Tag className="h-5 w-5 text-amber-600" />Generar Etiqueta</DialogTitle>
            <DialogDescription className="text-xs sm:text-sm">Completa los datos para generar tu etiqueta de envío</DialogDescription>
          </DialogHeader>

          {/* Form */}
          <div className="space-y-3 mt-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">包装盒内容 (Contenido)</Label>
                <Input value={form.content} onChange={e => setForm({ ...form, content: e.target.value })} placeholder="Ej: Ropa, Electrónicos..." disabled={!!labelCode} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">包装盒尺寸 (Dimensiones)</Label>
                <Input value={form.dimensions} onChange={e => setForm({ ...form, dimensions: e.target.value })} placeholder="Ej: 40×30×20 cm" disabled={!!labelCode} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">重量 (Peso)</Label>
                <Input value={form.weight} onChange={e => setForm({ ...form, weight: e.target.value })} placeholder="Ej: 5 kg" disabled={!!labelCode} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">箱数 (Nº de cajas)</Label>
                <Input value={form.boxCount} onChange={e => setForm({ ...form, boxCount: e.target.value })} placeholder="Ej: 1" type="number" min="1" disabled={!!labelCode} />
                {isMultiBox && (
                  <p className="text-[11px] text-amber-600 font-medium">
                    Se generarán {boxCount} etiquetas (Caja 1 de {boxCount} … Caja {boxCount} de {boxCount}) en un PDF.
                  </p>
                )}
              </div>
            </div>

            <div className="p-3 bg-red-50 rounded-lg border border-red-200">
              <Label className="text-red-700 font-semibold text-xs">是否含有 (¿Contiene?)</Label>
              <div className="grid grid-cols-2 gap-2 mt-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <Checkbox checked={form.hasFBrand} onCheckedChange={v => !labelCode && setForm({ ...form, hasFBrand: v })} disabled={!!labelCode} />
                  <span className="text-xs sm:text-sm">F牌 (Replica)</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <Checkbox checked={form.hasBattery} onCheckedChange={v => !labelCode && setForm({ ...form, hasBattery: v })} disabled={!!labelCode} />
                  <span className="text-xs sm:text-sm">带电 (Batería)</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <Checkbox checked={form.hasLiquid} onCheckedChange={v => !labelCode && setForm({ ...form, hasLiquid: v })} disabled={!!labelCode} />
                  <span className="text-xs sm:text-sm">液体 (Líquido)</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <Checkbox checked={form.hasPowder} onCheckedChange={v => !labelCode && setForm({ ...form, hasPowder: v })} disabled={!!labelCode} />
                  <span className="text-xs sm:text-sm">粉末 (Polvo)</span>
                </label>
              </div>
            </div>

            {/* Botón generar o código generado */}
            {!labelCode ? (
              <Button onClick={handleGenerate} disabled={generating} className="w-full gap-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white">
                {generating ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /> Generando...</>
                ) : (
                  <><QrCode className="h-4 w-4" /> Generar código QR y guardar</>
                )}
              </Button>
            ) : (
              <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-200 flex items-center gap-2">
                <QrCode className="h-5 w-5 text-emerald-600 flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-emerald-800">Etiqueta generada</p>
                  <p className="text-sm font-mono font-bold text-emerald-900 truncate">{labelCode}</p>
                  {isMultiBox && <p className="text-[11px] text-emerald-700">{boxCount} cajas · PDF con {boxCount} páginas</p>}
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-2">
              <Button onClick={handleDownload} disabled={generating || !labelCode} variant="outline" className="gap-2 text-xs sm:text-sm">
                {isMultiBox ? <FileText className="h-4 w-4" /> : <Download className="h-4 w-4" />}
                {generating ? 'Generando...' : isMultiBox ? 'Descargar PDF' : 'Descargar PNG'}
              </Button>
              <Button onClick={handlePrint} disabled={generating || !labelCode} className="gap-2 text-xs sm:text-sm">
                <Printer className="h-4 w-4" />
                {generating ? 'Generando...' : `Imprimir${isMultiBox ? ` (${boxCount})` : ''}`}
              </Button>
            </div>
          </div>

          {/* Label preview: N copias en el DOM (visibles en desktop, offscreen en mobile) */}
          <div className="mt-4 pt-4 border-t border-slate-200 lg:flex lg:flex-col lg:items-center lg:gap-3" style={{ position: 'relative' }}>
            <p className="text-xs text-slate-500 mb-2 hidden lg:block">
              Vista previa {isMultiBox ? `(${boxCount} etiquetas)` : ''}
            </p>
            {Array.from({ length: boxCount }).map((_, i) => (
              <div
                key={i}
                ref={el => (labelRefs.current[i] = el)}
                className="lg:border-2 lg:border-slate-300 lg:rounded-lg lg:overflow-hidden lg:shadow-lg max-lg:absolute max-lg:-left-[9999px] max-lg:top-0"
                style={{ width: 380 }}
              >
                <div style={{ width: 380, padding: 0, background: '#fff', fontFamily: 'Arial, sans-serif' }}>
                  <LabelContent
                    shippingMark={shippingMark}
                    form={form}
                    logoUrl={logoUrl}
                    companyName={companyName}
                    config={config}
                    labelCode={labelCode}
                    boxIndex={i + 1}
                    boxTotal={boxCount}
                  />
                </div>
              </div>
            ))}
            <p className="text-xs text-slate-400 text-center lg:hidden">{labelCode ? 'Etiqueta lista para descargar' : 'Genera el código para ver la etiqueta'}</p>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

const LabelContent = ShippingLabelContent;