import React, { useState, useRef } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Tag, Download } from 'lucide-react';

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
  const labelRef = useRef(null);

  const shippingMark = user?.shipping_mark || '';
  const logoUrl = config?.app_logo_url || config?.invoice_logo_url || '';
  const companyName = config?.app_name || 'TLEC CARGO';

  const handleDownloadImage = async () => {
    if (!labelRef.current) return;
    setGenerating(true);
    try {
      const { default: html2canvas } = await import('html2canvas');
      const canvas = await html2canvas(labelRef.current, {
        scale: 3,
        backgroundColor: '#ffffff',
        useCORS: true,
      });
      const link = document.createElement('a');
      link.download = `etiqueta-${shippingMark || 'envio'}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (e) {
      console.error('Error generating image:', e);
    }
    setGenerating(false);
  };

  return (
    <>
      <Button onClick={() => setOpen(true)} className="w-full gap-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white shadow-card">
        <Tag className="h-4 w-4" />
        Generar Etiqueta de Envío
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
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
                <Input value={form.content} onChange={e => setForm({ ...form, content: e.target.value })} placeholder="Ej: Ropa, Electrónicos..." />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">包装盒尺寸 (Dimensiones)</Label>
                <Input value={form.dimensions} onChange={e => setForm({ ...form, dimensions: e.target.value })} placeholder="Ej: 40×30×20 cm" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">重量 (Peso)</Label>
                <Input value={form.weight} onChange={e => setForm({ ...form, weight: e.target.value })} placeholder="Ej: 5 kg" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">箱数 (Nº de cajas)</Label>
                <Input value={form.boxCount} onChange={e => setForm({ ...form, boxCount: e.target.value })} placeholder="Ej: 1" type="number" />
              </div>
            </div>

            <div className="p-3 bg-red-50 rounded-lg border border-red-200">
              <Label className="text-red-700 font-semibold text-xs">是否含有 (¿Contiene?)</Label>
              <div className="grid grid-cols-2 gap-2 mt-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <Checkbox checked={form.hasFBrand} onCheckedChange={v => setForm({ ...form, hasFBrand: v })} />
                  <span className="text-xs sm:text-sm">F牌 (Replica)</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <Checkbox checked={form.hasBattery} onCheckedChange={v => setForm({ ...form, hasBattery: v })} />
                  <span className="text-xs sm:text-sm">带电 (Batería)</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <Checkbox checked={form.hasLiquid} onCheckedChange={v => setForm({ ...form, hasLiquid: v })} />
                  <span className="text-xs sm:text-sm">液体 (Líquido)</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <Checkbox checked={form.hasPowder} onCheckedChange={v => setForm({ ...form, hasPowder: v })} />
                  <span className="text-xs sm:text-sm">粉末 (Polvo)</span>
                </label>
              </div>
            </div>

            <Button onClick={handleDownloadImage} disabled={generating} className="w-full gap-2 text-xs sm:text-sm">
              <Download className="h-4 w-4" />
              {generating ? 'Generando...' : 'Descargar etiqueta (PNG)'}
            </Button>
          </div>

          {/* Label preview: visible on desktop, offscreen on mobile (always in DOM for html2canvas) */}
          <div className="mt-4 pt-4 border-t border-slate-200 lg:flex lg:flex-col lg:items-center" style={{ position: 'relative' }}>
            <p className="text-xs text-slate-500 mb-2 hidden lg:block">Vista previa</p>
            <div className="lg:border-2 lg:border-slate-300 lg:rounded-lg lg:overflow-hidden lg:shadow-lg max-lg:absolute max-lg:-left-[9999px] max-lg:top-0">
              <div ref={labelRef} style={{ width: 380, padding: 0, background: '#fff', fontFamily: 'Arial, sans-serif' }}>
                <LabelContent shippingMark={shippingMark} form={form} logoUrl={logoUrl} companyName={companyName} />
              </div>
            </div>
            <p className="text-xs text-slate-400 text-center lg:hidden">La etiqueta se generará al descargar</p>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function LabelContent({ shippingMark, form, logoUrl, companyName }) {
  const check = (val) => val ? '☑' : '☐';

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

      {/* Shipping Mark */}
      <div style={{ padding: '8px 12px', borderBottom: '2px solid #000', textAlign: 'center' }}>
        <div style={{ fontSize: 20, fontWeight: 900, letterSpacing: 2 }}>{shippingMark || 'SHIPPING MARK'}</div>
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

      {/* Shipping type + box count */}
      <div style={{ display: 'flex', borderBottom: '2px solid #000', minHeight: 60 }}>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px', borderRight: '1px solid #999' }}>
          <svg width="50" height="24" viewBox="0 0 60 24" fill="none">
            <rect x="0" y="8" width="42" height="14" fill="#000" />
            <rect x="42" y="4" width="16" height="18" fill="#000" />
            <rect x="45" y="6" width="10" height="8" fill="#333" />
          </svg>
          <span style={{ fontWeight: 700, fontSize: 14 }}>海运</span>
        </div>
        <div style={{ width: 120, display: 'flex', borderLeft: '1px solid #999' }}>
          <div style={{ flex: 1, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', borderRight: '1px solid #999', fontSize: 12, fontWeight: 700, paddingTop: 6 }}>
            的
          </div>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '4px 6px' }}>
            <div style={{ fontSize: 11, fontWeight: 700 }}>箱数</div>
            <div style={{ fontSize: 20, fontWeight: 900, marginTop: 2 }}>{form.boxCount || ''}</div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div style={{ padding: '8px 12px', fontSize: 11, lineHeight: 1.6, borderTop: '1px solid #999' }}>
        <div>地址：浙江省义乌市福田宗宅5区14栋6单元1-8号</div>
        <div>国仓库负责人：刘生</div>
        <div>邮编：322000</div>
        <div>电话：19858987879</div>
      </div>
    </div>
  );
}