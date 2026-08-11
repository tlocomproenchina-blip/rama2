import React, { useState, useEffect, useRef } from 'react';
import { base44 } from '@/components/api/ApiQueueManager';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Upload, X, FileText, ImageIcon, ChevronDown, Check, Search } from 'lucide-react';
import { uploadImageNoCredits } from '@/lib/imgbbUpload';

const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);

export default function ProviderCreditForm({ onSave, onCancel, saving }) {
  const [form, setForm] = useState({
    provider_name: '',
    provider_id: '',
    invoice_number: '',
    invoice_amount: '',
    paid_amount: '',
    payment_date: new Date().toISOString().slice(0, 10),
    notes: '',
  });
  const [invoiceImage, setInvoiceImage] = useState(null);
  const [receiptImage, setReceiptImage] = useState(null);
  const [uploadingInvoice, setUploadingInvoice] = useState(false);
  const [uploadingReceipt, setUploadingReceipt] = useState(false);

  // Proveedores registrados (ShippingProvider)
  const [providers, setProviders] = useState([]);
  const [providerSearch, setProviderSearch] = useState('');
  const [showProviderDropdown, setShowProviderDropdown] = useState(false);
  const providerDropdownRef = useRef(null);

  useEffect(() => {
    (async () => {
      try {
        const rows = await base44.entities.ShippingProvider.list('-updated_date', 200);
        setProviders(rows || []);
      } catch (_) {
        setProviders([]);
      }
    })();
  }, []);

  // Cerrar dropdown al hacer click fuera
  useEffect(() => {
    const handler = (e) => {
      if (providerDropdownRef.current && !providerDropdownRef.current.contains(e.target)) {
        setShowProviderDropdown(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const filteredProviders = providers.filter((p) => {
    if (!providerSearch.trim()) return true;
    const q = providerSearch.trim().toLowerCase();
    return (
      p.name?.toLowerCase().includes(q) ||
      p.mode?.toLowerCase().includes(q)
    );
  });

  const handleSelectProvider = (p) => {
    setForm({ ...form, provider_name: p.name, provider_id: p.id });
    setProviderSearch(p.name);
    setShowProviderDropdown(false);
  };

  const creditAmount = Math.max(0, num(form.paid_amount) - num(form.invoice_amount));

  const handleImageUpload = async (file, type) => {
    if (!file) return;
    const setter = type === 'invoice' ? setUploadingInvoice : setUploadingReceipt;
    setter(true);
    try {
      const url = await uploadImageNoCredits(file);
      if (type === 'invoice') setInvoiceImage(url);
      else setReceiptImage(url);
    } catch (err) {
      alert(err.message || 'Error al subir la imagen');
    }
    setter(false);
  };

  const handleSubmit = () => {
    if (!form.provider_name.trim()) {
      alert('Ingresa el nombre del proveedor');
      return;
    }
    if (num(form.invoice_amount) <= 0 || num(form.paid_amount) <= 0) {
      alert('Ingresa montos válidos mayores a 0');
      return;
    }
    if (creditAmount <= 0) {
      alert('El monto pagado debe ser mayor al monto de la factura para generar un saldo a favor');
      return;
    }
    onSave({
      provider_name: form.provider_name.trim(),
      provider_id: form.provider_id || '',
      invoice_number: form.invoice_number.trim(),
      invoice_amount: num(form.invoice_amount),
      paid_amount: num(form.paid_amount),
      credit_amount: creditAmount,
      payment_date: new Date(form.payment_date).toISOString(),
      invoice_image_url: invoiceImage || '',
      receipt_image_url: receiptImage || '',
      notes: form.notes.trim(),
    });
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="relative" ref={providerDropdownRef}>
          <Label className="text-xs text-slate-600">Proveedor *</Label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
            <Input
              value={providerSearch}
              onChange={(e) => {
                setProviderSearch(e.target.value);
                setForm({ ...form, provider_name: e.target.value, provider_id: '' });
                setShowProviderDropdown(true);
              }}
              onFocus={() => setShowProviderDropdown(true)}
              placeholder="Buscar proveedor registrado..."
              className="pl-10 pr-8"
            />
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
          </div>
          {showProviderDropdown && (
            <div className="absolute z-50 mt-1 w-full max-h-56 overflow-y-auto rounded-lg border border-border bg-white shadow-lg">
              {filteredProviders.length === 0 ? (
                <div className="px-3 py-3 text-sm text-slate-500">
                  No hay proveedores registrados. Escribe el nombre manualmente.
                </div>
              ) : (
                filteredProviders.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => handleSelectProvider(p)}
                    className="w-full flex items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-slate-50 border-b border-border/40 last:border-0"
                  >
                    <div className="min-w-0">
                      <span className="font-medium text-slate-700 truncate block">{p.name}</span>
                      {p.mode && (
                        <span className="text-xs text-slate-400 capitalize">{p.mode}</span>
                      )}
                    </div>
                    {form.provider_id === p.id && <Check className="h-4 w-4 text-emerald-600 shrink-0" />}
                  </button>
                ))
              )}
            </div>
          )}
          {form.provider_id && (
            <p className="text-xs text-emerald-600 mt-1 flex items-center gap-1">
              <Check className="h-3 w-3" /> Proveedor seleccionado de la lista
            </p>
          )}
        </div>
        <div>
          <Label className="text-xs text-slate-600">N° de Factura</Label>
          <Input
            value={form.invoice_number}
            onChange={(e) => setForm({ ...form, invoice_number: e.target.value })}
            placeholder="Ej: FAC-2026-001"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <Label className="text-xs text-slate-600">Monto Factura (USD) *</Label>
          <Input
            type="number"
            step="0.01"
            min="0"
            value={form.invoice_amount}
            onChange={(e) => setForm({ ...form, invoice_amount: e.target.value })}
            placeholder="100.00"
          />
        </div>
        <div>
          <Label className="text-xs text-slate-600">Monto Pagado (USD) *</Label>
          <Input
            type="number"
            step="0.01"
            min="0"
            value={form.paid_amount}
            onChange={(e) => setForm({ ...form, paid_amount: e.target.value })}
            placeholder="150.00"
          />
        </div>
        <div>
          <Label className="text-xs text-slate-600">Fecha *</Label>
          <Input
            type="date"
            value={form.payment_date}
            onChange={(e) => setForm({ ...form, payment_date: e.target.value })}
          />
        </div>
      </div>

      {/* Cálculo automático del monto a favor */}
      <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 flex items-center justify-between">
        <span className="text-sm font-medium text-emerald-700">Monto a favor (pagado − factura)</span>
        <span className="text-xl font-bold text-emerald-700">${creditAmount.toFixed(2)}</span>
      </div>

      {/* Subida de imágenes */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <ImageUploader
          label="Foto de la Factura"
          imageUrl={invoiceImage}
          uploading={uploadingInvoice}
          onUpload={(f) => handleImageUpload(f, 'invoice')}
          onClear={() => setInvoiceImage(null)}
          onPaste={(f) => handleImageUpload(f, 'invoice')}
        />
        <ImageUploader
          label="Foto del Comprobante de Pago"
          imageUrl={receiptImage}
          uploading={uploadingReceipt}
          onUpload={(f) => handleImageUpload(f, 'receipt')}
          onClear={() => setReceiptImage(null)}
          onPaste={(f) => handleImageUpload(f, 'receipt')}
        />
      </div>

      <div>
        <Label className="text-xs text-slate-600">Notas (opcional)</Label>
        <Textarea
          value={form.notes}
          onChange={(e) => setForm({ ...form, notes: e.target.value })}
          placeholder="Notas adicionales sobre este sobre pago..."
          rows={2}
        />
      </div>

      <div className="flex gap-2 justify-end pt-2">
        <Button variant="outline" onClick={onCancel} disabled={saving}>Cancelar</Button>
        <Button onClick={handleSubmit} disabled={saving || uploadingInvoice || uploadingReceipt} className="bg-emerald-600 hover:bg-emerald-700">
          {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
          Guardar saldo a favor
        </Button>
      </div>
    </div>
  );
}

function ImageUploader({ label, imageUrl, uploading, onUpload, onClear, onPaste }) {
  const inputRef = useRef(null);

  const handlePaste = (e) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        const file = item.getAsFile();
        if (file) onPaste(file);
        break;
      }
    }
  };

  return (
    <div>
      <Label className="text-xs text-slate-600">{label}</Label>
      {imageUrl ? (
        <div className="relative mt-1 rounded-lg border border-border overflow-hidden group">
          <img src={imageUrl} alt={label} className="w-full h-32 object-cover" />
          <button
            type="button"
            onClick={onClear}
            className="absolute top-1 right-1 bg-rose-600 text-white rounded-full p-1 shadow hover:bg-rose-700"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      ) : (
        <div
          tabIndex={0}
          onPaste={handlePaste}
          onClick={() => !uploading && inputRef.current?.click()}
          className="mt-1 flex flex-col items-center justify-center h-32 rounded-lg border-2 border-dashed border-border bg-slate-50 cursor-pointer hover:bg-slate-100 transition-colors focus:outline-none focus:border-emerald-400 focus:bg-emerald-50/30"
        >
          {uploading ? (
            <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
          ) : (
            <>
              <ImageIcon className="h-6 w-6 text-slate-400 mb-1" />
              <span className="text-xs text-slate-500">Click para subir · Ctrl+V para pegar</span>
            </>
          )}
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => onUpload(e.target.files?.[0])}
            disabled={uploading}
          />
        </div>
      )}
    </div>
  );
}