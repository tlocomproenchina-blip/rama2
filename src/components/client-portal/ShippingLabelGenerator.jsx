import React, { useState, useRef, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Tag, Download, Printer, Loader2, QrCode } from 'lucide-react';
import JsBarcode from 'jsbarcode';
import { toast } from 'sonner';

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
  const labelRef = useRef(null);
  const barcodeRef = useRef(null);

  const shippingMark = user?.shipping_mark || '';
  const logoUrl = config?.app_logo_url || config?.invoice_logo_url || '';
  const companyName = config?.app_name || 'TLEC CARGO';

  // Render barcode cuando se asigna el código
  useEffect(() => {
    if (labelCode && barcodeRef.current) {
      try {
        JsBarcode(barcodeRef.current, labelCode, {
          format: 'CODE128',
          displayValue: true,
          fontSize: 12,
          fontOptions: 'bold',
          height: 50,
          width: 1.8,
          margin: 2,
          textMargin: 2,
        });
      } catch (e) {
        console.error('Error rendering barcode:', e);
      }
    }
  }, [labelCode, open]);

  const resetState = () => {
    setLabelCode(null);
    setLabelId(null);
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
        box_count: Number(form.boxCount) || 1,
      });
      if (data?.label) {
        setLabelCode(data.label.label_code);
        setLabelId(data.label.id);
        toast.success('Etiqueta generada y guardada');
      }
    } catch (e) {
      toast.error(e?.response?.data?.error || 'Error al generar la etiqueta');
    }
    setGenerating(false);
  };

  const renderCanvas = async () => {
    const { default: html2canvas } = await import('html2canvas');
    return await html2canvas(labelRef.current, {
      scale: 3,
      backgroundColor: '#ffffff',
      useCORS: true,
    });
  };

  const handleDownloadImage = async () => {
    if (!labelRef.current || !labelCode) return;
    setGenerating(true);
    try {
      const canvas = await renderCanvas();
      const link = document.createElement('a');
      link.download = `etiqueta-${labelCode}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (e) {
      console.error('Error generating image:', e);
      toast.error('Error al generar la imagen');
    }
    setGenerating(false);
  };

  const handlePrint = async () => {
    if (!labelRef.current || !labelCode) return;
    setGenerating(true);
    try {
      const canvas = await renderCanvas();
      const dataUrl = canvas.toDataURL('image/png');
      const win = window.open('', '_blank', 'width=420,height=600');
      if (!win) {
        alert('Permite las ventanas emergentes para imprimir la etiqueta.');
        setGenerating(false);
        return;
      }
      win.document.write(`
        <html>
          <head>
            <title>Etiqueta ${labelCode}</title>
            <style>
              @page { margin: 0; size: auto; }
              body { margin: 0; padding: 0; display: flex; justify-content: center; }
              img { width: 380px; max-width: 100%; }
            </style>
          </head>
          <body>
            <img src="${dataUrl}" onload="window.focus(); window.print(); window.onafterprint=function(){window.close();}" />
          </body>
        </html>
      `);
      win.document.close();
    } catch (e) {
      console.error('Error printing image:', e);
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
                <Input value={form.boxCount} onChange={e => setForm({ ...form, boxCount: e.target.value })} placeholder="Ej: 1" type="number" disabled={!!labelCode} />
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
                  <><QrCode className="h-4 w-4" /> Generar código de barras y guardar</>
                )}
              </Button>
            ) : (
              <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-200 flex items-center gap-2">
                <QrCode className="h-5 w-5 text-emerald-600 flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-emerald-800">Etiqueta generada</p>
                  <p className="text-sm font-mono font-bold text-emerald-900 truncate">{labelCode}</p>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-2">
              <Button onClick={handleDownloadImage} disabled={generating || !labelCode} variant="outline" className="gap-2 text-xs sm:text-sm">
                <Download className="h-4 w-4" />
                {generating ? 'Generando...' : 'Descargar PNG'}
              </Button>
              <Button onClick={handlePrint} disabled={generating || !labelCode} className="gap-2 text-xs sm:text-sm">
                <Printer className="h-4 w-4" />
                {generating ? 'Generando...' : 'Imprimir'}
              </Button>
            </div>
          </div>

          {/* Label preview: visible on desktop, offscreen on mobile (always in DOM for html2canvas) */}
          <div className="mt-4 pt-4 border-t border-slate-200 lg:flex lg:flex-col lg:items-center" style={{ position: 'relative' }}>
            <p className="text-xs text-slate-500 mb-2 hidden lg:block">Vista previa</p>
            <div className="lg:border-2 lg:border-slate-300 lg:rounded-lg lg:overflow-hidden lg:shadow-lg max-lg:absolute max-lg:-left-[9999px] max-lg:top-0">
              <div ref={labelRef} style={{ width: 380, padding: 0, background: '#fff', fontFamily: 'Arial, sans-serif' }}>
                <LabelContent
                  shippingMark={shippingMark}
                  form={form}
                  logoUrl={logoUrl}
                  companyName={companyName}
                  config={config}
                  labelCode={labelCode}
                  barcodeRef={barcodeRef}
                />
              </div>
            </div>
            <p className="text-xs text-slate-400 text-center lg:hidden">{labelCode ? 'Etiqueta lista para descargar' : 'Genera el código para ver la etiqueta'}</p>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function LabelContent({ shippingMark, form, logoUrl, companyName, config, labelCode, barcodeRef }) {
  const check = (val) => val ? '☑' : '☐';

  // Dirección del almacén: preferir almacén 2 (Yiwu) si está activo, sino almacén 1
  const useWarehouse2 = !!(config?.warehouse2_address && config.warehouse2_address.trim());
  const warehouseAddress = (useWarehouse2 ? config.warehouse2_address : config?.warehouse_address) || '';
  const warehousePhone = (useWarehouse2 ? config.warehouse2_phone : config?.warehouse_phone) || '';
  const warehouseZipcode = (useWarehouse2 ? config.warehouse2_zipcode : config?.warehouse_zipcode) || '';
  const warehouseName = (useWarehouse2 ? config.warehouse2_name : config?.warehouse_name) || '';

  return (
    <div style={{ width: 380, fontSize: 12, color: '#000', lineHeight: 1.4 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', borderBottom: '3px solid #000', padding: '10px 12px' }}>
        <div style={{ width: 48, height: 48, border: '2px solid #000', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: 28, marginRight: 10, flexShrink: 0 }}>
          M
        </div>
        <div style={{ flex: 1, fontSize: 11, lineHeight: 1.5 }}>
          <div>若无此入仓单</div>
          <div>将默认拒收处理</div>
          <div>贴外箱/装箱内</div>
          <div>《填写信息不可缺失》</div>
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          {logoUrl ? (
            <img src={logoUrl} alt="Logo" crossOrigin="anonymous" style={{ width: 50, height: 50, objectFit: 'contain' }} />
          ) : (
            <div style={{ fontSize: 11, fontWeight: 700 }}>{companyName}</div>
          )}
        </div>
      </div>

      {/* Shipping Mark / Label Code */}
      <div style={{ padding: '8px 12px', borderBottom: '2px solid #000', textAlign: 'center' }}>
        <div style={{ fontSize: 20, fontWeight: 900, letterSpacing: 2 }}>{labelCode || shippingMark || 'SHIPPING MARK'}</div>
      </div>

      {/* Fields */}
      <div style={{ padding: '6px 12px', borderBottom: '1px solid #999' }}>
        <div style={{ fontWeight: 700, marginBottom: 2 }}>包装盒内容</div>
        <div style={{ minHeight: 22, borderBottom: '1px dotted #999', paddingBottom: 2 }}>{form.content || ''}</div>
      </div>
      <div style={{ padding: '6px 12px', borderBottom: '1px solid #999' }}>
        <div style={{ fontWeight: 700, marginBottom: 2 }}>包装盒尺寸</div>
        <div style={{ minHeight: 22, borderBottom: '1px dotted #999', paddingBottom: 2 }}>{form.dimensions || ''}</div>
      </div>
      <div style={{ padding: '6px 12px', borderBottom: '1px solid #999' }}>
        <div style={{ fontWeight: 700, marginBottom: 2 }}>重量</div>
        <div style={{ minHeight: 22, borderBottom: '1px dotted #999', paddingBottom: 2 }}>{form.weight || ''}</div>
      </div>

      {/* Checkboxes */}
      <div style={{ padding: '8px 12px', borderBottom: '1px solid #999' }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#dc2626', marginBottom: 6 }}>是否含有</div>
        <div style={{ fontSize: 13, fontWeight: 700 }}>
          F牌:{check(form.hasFBrand)} / 带电:{check(form.hasBattery)} / 液体:{check(form.hasLiquid)} / 粉末:{check(form.hasPowder)}
        </div>
      </div>

      {/* Barcode + box count */}
      <div style={{ display: 'flex', borderBottom: '2px solid #000', minHeight: 70 }}>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '4px 8px', borderRight: '1px solid #999' }}>
          {labelCode ? (
            <svg ref={barcodeRef} style={{ maxWidth: '100%', height: 'auto' }}></svg>
          ) : (
            <div style={{ width: '100%', height: 50, background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 10 }}>
              CÓDIGO DE BARRAS
            </div>
          )}
        </div>
        <div style={{ width: 100, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '4px 6px' }}>
          <div style={{ fontSize: 11, fontWeight: 700 }}>箱数</div>
          <div style={{ fontSize: 20, fontWeight: 900, marginTop: 2 }}>{form.boxCount || ''}</div>
          <div style={{ fontSize: 10, fontWeight: 700, marginTop: 4, color: '#444' }}>海运</div>
        </div>
      </div>

      {/* Footer */}
      <div style={{ padding: '8px 12px', fontSize: 11, lineHeight: 1.6, borderTop: '1px solid #999' }}>
        {warehouseAddress && <div>地址：{warehouseAddress}</div>}
        {warehouseName && <div>仓库负责人：{warehouseName}</div>}
        {warehouseZipcode && <div>邮编：{warehouseZipcode}</div>}
        {warehousePhone && <div>电话：{warehousePhone}</div>}
      </div>
    </div>
  );
}