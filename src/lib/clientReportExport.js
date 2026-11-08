import * as XLSX from 'xlsx';

const d = (v) => (v ? new Date(v).toLocaleDateString('es-VE') : '');

export const SECTION_ROWS = {
  Paquetes: (data) => data.packages.map((p) => ({
    Tracking: p.tracking_number || '', Estado: p.status || '', Descripción: p.description || '',
    'Peso (kg)': p.weight ?? '', 'Valor FOB': p.fob_value ?? '', Creado: d(p.created_date)
  })),
  Facturas: (data) => data.invoices.map((i) => ({
    Número: i.invoice_number || '', Estado: i.status || '', Total: Number(i.total || 0),
    Saldo: i.balance_due ?? '', Fecha: d(i.invoice_date || i.created_date)
  })),
  Abonos: (data) => data.payments.map((p) => ({
    Factura: p.invoice_number || p.invoice_id || '', Monto: Number(p.amount || 0),
    Método: p.method || p.payment_method || '', Estado: p.status || '', Fecha: d(p.payment_date || p.created_date)
  })),
  Consolidaciones: (data) => data.consolidations.map((c) => ({
    Tracking: c.consolidation_tracking || '', Estado: c.status || '', Envío: Number(c.shipping_cost || 0),
    Seguro: Number(c.insurance_cost || 0), Total: Number(c.total_cost || 0), Creado: d(c.created_date)
  })),
  'Recibos CBM': (data) => data.cbmIngresos.map((r) => ({
    Recibo: r.receipt_number || r.recibo || '', CBM: Number(r.cbm || 0), Fecha: d(r.fecha || r.created_date)
  })),
  'Órdenes despacho': (data) => data.dispatchOrders.map((o) => ({
    Orden: o.order_number || o.id, Estado: o.status || '', Creado: d(o.created_date)
  })),
  Seguros: (data) => data.insurancePayments.map((s) => ({
    Tracking: s.tracking_number || '', Monto: Number(s.amount || 0), Estado: s.status || '', Creado: d(s.created_date)
  }))
};

function fileBase(client) {
  return (client?.shipping_mark || client?.email || 'cliente').replace(/[^\w-]+/g, '_');
}

function sheetFrom(rows) {
  return XLSX.utils.json_to_sheet(rows.length ? rows : [{ Info: 'Sin registros' }]);
}

export function downloadSection(name, data, client) {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, sheetFrom(SECTION_ROWS[name](data)), name.slice(0, 31));
  XLSX.writeFile(wb, `${fileBase(client)}_${name.replace(/\s+/g, '_')}.xlsx`);
}

export function downloadFullReport(data, client) {
  const wb = XLSX.utils.book_new();
  const profile = [{
    Nombre: client.full_name || `${client.first_name || ''} ${client.last_name || ''}`.trim(),
    Email: client.email, 'Shipping mark': client.shipping_mark || '', Ciudad: client.city || '',
    WhatsApp: client.whatsapp || ''
  }];
  XLSX.utils.book_append_sheet(wb, sheetFrom(profile), 'Perfil');
  Object.keys(SECTION_ROWS).forEach((name) => {
    XLSX.utils.book_append_sheet(wb, sheetFrom(SECTION_ROWS[name](data)), name.slice(0, 31));
  });
  XLSX.writeFile(wb, `${fileBase(client)}_reporte_completo.xlsx`);
}