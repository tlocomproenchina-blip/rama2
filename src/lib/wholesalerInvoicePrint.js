import { cbmFmt, money } from '@/lib/wholesalerScope';

const esc = (v) => String(v ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function doorDetail(c) {
  return c.door_to_door_per_cbm != null
    ? `${cbmFmt(c.cbm)} CBM × ${money(c.door_to_door_per_cbm)}/CBM`
    : `${Number(c.bultos) || 0} bulto(s) × ${money(c.rate_per_bulto)}/bulto`;
}

// Abre la factura en una ventana imprimible (se puede guardar como PDF).
export function printWholesalerInvoice(inv) {
  const rows = (inv.clients || []).map((c) => `
    <tr><td><b>${esc(c.client_name)}</b><br><small>${esc(c.shipping_mark)} · ${esc(c.client_email)}</small></td>
    <td>${cbmFmt(c.cbm)}</td><td>${Number(c.received_trackings ?? c.packages) || 0}</td>
    <td>${money(c.shipping_amount)}<br><small>${cbmFmt(c.cbm)} × ${money(c.rate_per_cbm)}</small></td>
    <td>${money(c.door_to_door_amount)}<br><small>${doorDetail(c)}</small></td>
    <td>${money(c.handling_amount)}</td><td><b>${money(c.total)}</b></td></tr>`).join('');
  const t = inv.totals || {};
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>Factura ${esc(inv.invoice_number)}</title>
  <style>body{font-family:Inter,Arial,sans-serif;color:#111827;padding:32px}h1{margin:0}table{width:100%;border-collapse:collapse;margin-top:20px;font-size:12px}
  th,td{border-bottom:1px solid #e5e7eb;padding:8px;text-align:left;vertical-align:top}th{background:#f97415;color:#111827}small{color:#6b7280}
  .tot{margin-top:16px;text-align:right;font-size:14px}</style></head><body>
  <p style="color:#f97415;font-weight:700;letter-spacing:.2em;font-size:11px">IMPORTACIONES TLEC CARGO</p>
  <h1>Factura ${esc(inv.invoice_number)}</h1>
  <p>Mayorista: <b>${esc(inv.wholesaler_name)}</b> · Emitida: ${new Date(inv.emitted_date).toLocaleString('es-VE')}</p>
  <table><thead><tr><th>Cliente</th><th>CBM</th><th>Paquetes</th><th>Envío</th><th>Puerta a puerta</th><th>Manejo</th><th>Total</th></tr></thead><tbody>${rows}</tbody></table>
  <div class="tot">Envío ${money(t.shipping)} · Puerta a puerta ${money(t.door_to_door)} · Manejo ${money(t.handling)}<br><b style="font-size:18px">Total a pagar: ${money(t.total)} USD</b></div>
  ${inv.notes ? `<p><small>${esc(inv.notes)}</small></p>` : ''}
  <script>window.onload=()=>window.print()</script></body></html>`;
  const w = window.open('', '_blank');
  if (w) { w.document.write(html); w.document.close(); }
}