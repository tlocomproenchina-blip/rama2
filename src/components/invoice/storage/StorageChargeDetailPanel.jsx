import React, { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Loader2 } from 'lucide-react';
import {
  fetchInvoiceCharges,
  fetchStorageNotices,
  formatDate,
  invoiceNotices,
  invoiceStorageLines,
  money,
  noticeKeyFromSubject,
} from '@/lib/storageAudit';

const NoticeTile = ({ label, sent, date, hint }) => (
  <div className={`rounded-lg border px-2.5 py-2 ${sent ? 'border-emerald-200 bg-emerald-50/60' : 'border-slate-200 bg-white'}`}>
    <p className="text-[10px] uppercase tracking-wide text-slate-500">{label}</p>
    <p className={`text-[12px] font-semibold ${sent ? 'text-emerald-700' : 'text-slate-600'}`}>
      {sent ? 'Enviado' : 'Pendiente'}
    </p>
    <p className="text-[10px] text-slate-500">{date ? formatDate(date) : hint || 'sin fecha'}</p>
  </div>
);

// Detalle de una factura: avisos enviados (estado y fecha) y el desglose día por
// día de lo que se ha sumado por almacenamiento y montacargas.
export default function StorageChargeDetailPanel({ invoice }) {
  const [records, setRecords] = useState(null);
  const [notices, setNotices] = useState([]);

  useEffect(() => {
    let alive = true;
    setRecords(null);
    setNotices([]);
    Promise.all([
      fetchInvoiceCharges(invoice.id),
      fetchStorageNotices(invoice.client_email),
    ]).then(([charges, emails]) => {
      if (!alive) return;
      setRecords(charges);
      setNotices(emails);
    });
    return () => { alive = false; };
  }, [invoice.id, invoice.client_email]);

  const lines = invoiceStorageLines(invoice);
  const flags = invoiceNotices(invoice);
  const loading = records === null;
  const list = records || [];

  const registered = list.reduce((sum, row) => sum + (Number(row.amount) || 0), 0);
  const daysCharged = list.reduce((sum, row) => sum + (Number(row.days_count) || 0), 0);
  const forkliftTotal = list.reduce((sum, row) => sum + (Number(row.forklift_amount) || 0), 0);
  const chargeNoticed = list
    .filter((row) => row.notified_date)
    .map((row) => row.notified_date)
    .sort()
    .pop();

  const dateFor = (key) => notices.find((email) => noticeKeyFromSubject(email.subject) === key)?.sent_date;

  return (
    <div className="space-y-3">
      <div className="grid gap-2 sm:grid-cols-4">
        <NoticeTile
          label="Aviso de cargos"
          sent={!!chargeNoticed}
          date={chargeNoticed}
          hint="aviso automático al sumar cargos"
        />
        {flags.map((flag) => (
          <NoticeTile
            key={flag.key}
            label={`Aviso ${flag.days} días`}
            sent={flag.sent}
            date={dateFor(flag.key)}
            hint="sin email registrado"
          />
        ))}
      </div>

      <div className="grid gap-2 sm:grid-cols-3">
        <div className="rounded-lg bg-slate-50 px-2.5 py-2">
          <p className="text-[10px] uppercase tracking-wide text-slate-500">Registrado y sumado</p>
          <p className="text-sm font-bold text-slate-800">{money(registered)}</p>
          <p className="text-[10px] text-slate-500">{daysCharged} día(s) cobrados</p>
        </div>
        <div className="rounded-lg bg-slate-50 px-2.5 py-2">
          <p className="text-[10px] uppercase tracking-wide text-slate-500">Montacargas</p>
          <p className="text-sm font-bold text-slate-800">{money(forkliftTotal)}</p>
          <p className="text-[10px] text-slate-500">recargo único por palet</p>
        </div>
        <div className="rounded-lg bg-slate-50 px-2.5 py-2">
          <p className="text-[10px] uppercase tracking-wide text-slate-500">Líneas en la factura</p>
          <p className="text-sm font-bold text-slate-800">{money(lines.total)}</p>
          <p className="text-[10px] text-slate-500">almacenamiento {money(lines.storage)}</p>
        </div>
      </div>

      <div className="space-y-1.5">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Cargos registrados día por día</p>
        {loading ? (
          <div className="flex items-center gap-2 py-4 text-[11px] text-slate-500">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Cargando cargos…
          </div>
        ) : list.length === 0 ? (
          <p className="rounded-lg bg-slate-50 px-2.5 py-3 text-[11px] text-slate-500">
            Esta factura todavía no tiene cargos de almacenamiento registrados por el proceso automático.
          </p>
        ) : (
          <div className="max-h-64 overflow-y-auto rounded-lg border border-slate-200">
            <div className="grid grid-cols-[80px_1fr_90px_90px_92px] gap-2 bg-slate-50 px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
              <span>Fecha</span>
              <span>Detalle</span>
              <span className="text-right">Almac.</span>
              <span className="text-right">Total</span>
              <span className="text-right">Aviso</span>
            </div>
            {list.map((row) => (
              <div
                key={row.id}
                className="grid grid-cols-[80px_1fr_90px_90px_92px] items-center gap-2 border-t border-slate-100 px-2 py-1.5 text-[11px] text-slate-600"
              >
                <span className="font-medium text-slate-700">{row.charge_date}</span>
                <span className="truncate">
                  {row.days_count ? `Día ${row.day_number} (${row.days_count} día/s)` : `Día ${row.day_number}`}
                  {row.units_standard || row.units_large
                    ? ` · ${row.units_standard || 0} est. / ${row.units_large || 0} grande`
                    : ''}
                  {Number(row.forklift_amount) > 0 ? ` · montacargas ${money(row.forklift_amount)}` : ''}
                </span>
                <span className="text-right">{money(row.storage_amount)}</span>
                <span className="text-right font-semibold text-slate-800">{money(row.amount)}</span>
                <span className="text-right">
                  {row.notified_date
                    ? <Badge variant="outline" className="border-emerald-300 bg-emerald-50 text-[10px] text-emerald-700">{formatDate(row.notified_date)}</Badge>
                    : <Badge variant="outline" className="border-slate-300 bg-white text-[10px] text-slate-500">pendiente</Badge>}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}