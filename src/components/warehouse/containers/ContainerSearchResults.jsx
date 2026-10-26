import React from 'react';
import { PackageX } from 'lucide-react';
import ContainerClientCard from './ContainerClientCard';

const Metric = ({ label, value }) => (
  <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
    <p className="text-[11px] uppercase tracking-wide text-slate-500">{label}</p>
    <p className="text-base font-semibold text-slate-800">{value}</p>
  </div>
);

const cbm = (value) => Number(value || 0).toFixed(3);

// Resultado de la búsqueda: resumen del contenedor y una tarjeta por cliente.
export default function ContainerSearchResults({ result }) {
  const clients = result?.clients || [];
  const totals = result?.totals || {};

  if (!clients.length) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-slate-200 px-4 py-8 text-center">
        <PackageX className="h-7 w-7 text-slate-300" />
        <p className="text-sm font-medium text-slate-700">
          No hay carga con el contenedor {result?.container}
          {result?.invoice_status ? ` en facturas ${result.invoice_status}` : ''}.
        </p>
        <p className="text-xs text-slate-500">Revisa el número o prueba con otro estado de factura.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-slate-600">
          Contenedor <span className="font-semibold text-slate-900">{result.container}</span> · {totals.clients || 0} cliente(s)
        </p>
        <p className="text-xs text-slate-500">
          {totals.paid_invoices || 0} de {totals.invoices || 0} factura(s) pagadas
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Metric label="CBM total" value={cbm(totals.cbm)} />
        <Metric label="Paquetes" value={totals.packages || 0} />
        <Metric label="Bultos" value={totals.bultos || 0} />
        <Metric label="Cajas consolidadas" value={totals.cajas || 0} />
      </div>

      <div className="space-y-3">
        {clients.map((client) => (
          <ContainerClientCard key={client.client_email || client.client_name} client={client} />
        ))}
      </div>
    </div>
  );
}