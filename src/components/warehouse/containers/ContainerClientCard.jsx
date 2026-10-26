import React from 'react';
import { UserRound } from 'lucide-react';
import ContainerInvoiceList from './ContainerInvoiceList';
import ContainerGuideList from './ContainerGuideList';
import ContainerBultoList from './ContainerBultoList';

const shortDate = (value) => (value ? new Date(value).toLocaleDateString('es-VE') : '—');
const cbm = (value) => Number(value || 0).toFixed(3);

// Un cliente del contenedor: sus datos, sus facturas, sus guías y sus bultos.
export default function ContainerClientCard({ client }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-2">
          <div className="rounded-lg bg-slate-100 p-1.5 text-slate-600">
            <UserRound className="h-4 w-4" />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-900">{client.client_name || client.client_email}</p>
            <p className="text-[11px] text-slate-500">{client.client_email}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-[11px]">
          {client.shipping_mark && (
            <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 font-medium text-slate-700">
              {client.shipping_mark}
            </span>
          )}
          <span className="rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 font-medium text-blue-700">
            {cbm(client.cbm)} CBM
          </span>
          <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-slate-600">
            {client.packages} paquete(s)
          </span>
          <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-slate-600">
            Creado {shortDate(client.fecha_creacion)}
          </span>
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <ContainerInvoiceList invoices={client.invoices} />
        <ContainerGuideList guides={client.guides} />
        <ContainerBultoList bultos={client.bultos} />
      </div>
    </div>
  );
}