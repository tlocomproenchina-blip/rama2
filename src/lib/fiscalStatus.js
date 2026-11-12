// Estados de una solicitud de factura fiscal y del pago del IVA.
export const STATUS_META = {
  borrador: {
    label: 'Borrador',
    cls: 'bg-slate-100 text-slate-700 border-slate-200',
    hint: 'Aún no la has enviado. Puedes completarla cuando quieras.',
  },
  pago_iva_en_verificacion: {
    label: 'Pago del IVA en verificación',
    cls: 'bg-amber-100 text-amber-800 border-amber-200',
    hint: 'Finanzas está verificando tu comprobante de pago del IVA.',
  },
  comprobante_rechazado: {
    label: 'Comprobante rechazado',
    cls: 'bg-red-100 text-red-800 border-red-200',
    hint: 'Debes cargar un nuevo comprobante de pago del IVA.',
  },
  pendiente_revision_fiscal: {
    label: 'Pendiente de revisión fiscal',
    cls: 'bg-sky-100 text-sky-800 border-sky-200',
    hint: 'Pago del IVA verificado. Se revisan los datos fiscales y los conceptos.',
  },
  requiere_correccion: {
    label: 'Requiere corrección',
    cls: 'bg-orange-100 text-orange-800 border-orange-200',
    hint: 'Hay datos o documentos que debes corregir.',
  },
  aprobada: {
    label: 'Aprobada',
    cls: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    hint: 'Autorizada para emisión de la factura fiscal.',
  },
  emitida: {
    label: 'Factura fiscal emitida',
    cls: 'bg-green-600 text-white border-green-700',
    hint: 'Tu factura fiscal definitiva está disponible para descarga.',
  },
  rechazada: {
    label: 'Rechazada',
    cls: 'bg-red-600 text-white border-red-700',
    hint: 'La solicitud fue rechazada.',
  },
};

export const STATUS_ORDER = Object.keys(STATUS_META);

// El cliente solo puede editar y reenviar en estos estados.
export const CLIENT_EDITABLE = ['borrador', 'comprobante_rechazado', 'requiere_correccion'];

export const VAT_STATUS_META = {
  sin_comprobante: { label: 'Sin comprobante', cls: 'bg-slate-100 text-slate-700 border-slate-200' },
  en_verificacion: { label: 'En verificación', cls: 'bg-amber-100 text-amber-800 border-amber-200' },
  rechazado: { label: 'Rechazado', cls: 'bg-red-100 text-red-800 border-red-200' },
  verificado: { label: 'Verificado', cls: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  reemplazado: { label: 'Reemplazado', cls: 'bg-slate-100 text-slate-600 border-slate-200' },
};

export const PAYMENT_TYPES = [
  { value: 'transferencia', label: 'Transferencia bancaria' },
  { value: 'pago_movil', label: 'Pago móvil' },
  { value: 'zelle', label: 'Zelle' },
  { value: 'usdt', label: 'USDT / Criptomoneda' },
  { value: 'paypal', label: 'PayPal' },
  { value: 'efectivo', label: 'Efectivo' },
  { value: 'otro', label: 'Otro' },
];

export const paymentTypeLabel = (v) => PAYMENT_TYPES.find((t) => t.value === v)?.label || 'Otro';

export const fmtDateTime = (d) =>
  d ? new Date(d).toLocaleString('es-VE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-';

export const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString('es-VE', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '-';