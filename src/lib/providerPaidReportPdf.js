// Informe PDF de facturas de proveedor pagadas, agrupado por cliente (shipping mark).
import { money } from '@/lib/numbers';

const fmtDate = (v) => {
  const d = v ? new Date(v) : null;
  return d && !Number.isNaN(d.getTime()) ? d.toLocaleDateString('es-VE', { timeZone: 'UTC' }) : '—';
};
const cbmText = (n) => String(Number((Number(n) || 0).toFixed(4)));

// Agrupa por shipping mark y suma los CBM de cada cliente.
export function groupPaidByClient(items = []) {
  const map = new Map();
  items.forEach((i) => {
    const key = String(i.shipping_mark || '').trim().toUpperCase() || 'SIN MARK';
    if (!map.has(key)) map.set(key, { mark: key, name: i.client_name || '', rows: [], cbm: 0, total: 0 });
    const g = map.get(key);
    g.rows.push(i);
    g.cbm += Number(i.cbm) || 0;
    g.total += Number(i.total) || 0;
    if (!g.name && i.client_name) g.name = i.client_name;
  });
  return [...map.values()].sort((a, b) => a.mark.localeCompare(b.mark));
}

export async function generatePaidProviderReportPdf(items, { from, to, client } = {}, appName = 'IMPORTACIONES TLEC CARGO') {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const left = 12;
  const right = 285;
  const groups = groupPaidByClient(items);
  const totalCbm = groups.reduce((s, g) => s + g.cbm, 0);
  const totalAmount = groups.reduce((s, g) => s + g.total, 0);
  const now = new Date();
  const period = from || to ? `Pago: ${from || '…'} a ${to || '…'}` : 'Todas las fechas de pago';
  const cols = { code: left + 4, date: left + 70, cbm: left + 110, total: left + 140, proof: left + 170 };

  const header = () => {
    doc.setFillColor(17, 24, 39);
    doc.rect(0, 0, 297, 24, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(15);
    doc.text(appName, left, 11);
    doc.setFontSize(12);
    doc.text('INFORME DE FACTURAS PAGADAS AL PROVEEDOR', left, 19);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(`${items.length} factura(s) · ${cbmText(totalCbm)} CBM · ${money(totalAmount)}`, right, 11, { align: 'right' });
    doc.text(`${period}${client ? ` · Cliente: ${client}` : ''}`, right, 19, { align: 'right' });
    doc.setTextColor(30, 41, 59);
  };

  header();
  let y = 34;
  const ensure = (h) => { if (y + h > 192) { doc.addPage(); header(); y = 34; } };

  groups.forEach((g) => {
    ensure(22);
    doc.setFillColor(255, 237, 213);
    doc.rect(left, y - 5, right - left, 8, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text(`Shipping mark: ${g.mark}${g.name ? ` · ${g.name}` : ''}`, left + 2, y);
    doc.text(`Total CBM del cliente: ${cbmText(g.cbm)}`, right - 2, y, { align: 'right' });
    y += 7;
    doc.setFontSize(8.5);
    doc.text('Código factura / contenedor', cols.code, y);
    doc.text('Fecha de pago', cols.date, y);
    doc.text('CBM', cols.cbm, y);
    doc.text('Total', cols.total, y);
    doc.text('Comprobante de pago', cols.proof, y);
    doc.setFont('helvetica', 'normal');
    y += 5;
    g.rows.forEach((r) => {
      ensure(8);
      doc.text(doc.splitTextToSize(String(r.invoice_code || '—'), 62)[0], cols.code, y);
      doc.text(fmtDate(r.paid_date), cols.date, y);
      doc.text(cbmText(r.cbm), cols.cbm, y);
      doc.text(money(r.total), cols.total, y);
      if (r.payment_proof_url) {
        doc.setTextColor(194, 65, 12);
        doc.textWithLink('Ver comprobante', cols.proof, y, { url: r.payment_proof_url });
        doc.setTextColor(30, 41, 59);
      } else {
        doc.text('Sin comprobante', cols.proof, y);
      }
      y += 6;
    });
    doc.setDrawColor(226, 232, 240);
    doc.line(left, y - 2, right, y - 2);
    y += 6;
  });

  ensure(14);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text(`Total general: ${cbmText(totalCbm)} CBM · ${money(totalAmount)}`, right, y + 4, { align: 'right' });
  doc.save(`facturas-proveedor-pagadas-${now.toISOString().slice(0, 10)}.pdf`);
}