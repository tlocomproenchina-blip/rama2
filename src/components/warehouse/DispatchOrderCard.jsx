import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { FileDown, Pencil, Trash2, Ban, Package as PackageIcon, Receipt } from 'lucide-react';
import { groupItemsByReceipt } from '@/lib/dispatchOrderGroups';

export default function DispatchOrderCard({ order, onEdit, onDelete, onCancel, onDownload }) {
  const items = Array.isArray(order.items) ? order.items : [];
  const cancelled = order.status === 'cancelada';
  const receiptGroups = groupItemsByReceipt(items);
  const hasReceipts = receiptGroups.some((g) => g.receipt !== 'Sin recibo');

  return (
    <Card className={cancelled ? 'border-rose-200 bg-rose-50/50' : ''}>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-2 flex-wrap">
          <div className="min-w-0">
            <p className="font-mono text-sm font-semibold text-slate-800 break-all">{order.order_number || '—'}</p>
            <p className="text-sm text-slate-700 break-words">{order.client_name || order.client_email}</p>
            <p className="text-xs text-slate-500 break-all">
              {order.shipping_mark ? `${order.shipping_mark} · ` : ''}
              {order.dispatched_date ? new Date(order.dispatched_date).toLocaleString('es-VE') : ''}
            </p>
          </div>
          <Badge className={cancelled ? 'bg-rose-600 text-white' : 'bg-emerald-600 text-white'}>
            {cancelled ? 'Cancelada' : 'Emitida'}
          </Badge>
        </div>

        <div className="flex items-center gap-2 text-sm text-slate-600">
          <PackageIcon className="h-4 w-4 shrink-0" />
          <span>{items.length} paquete{items.length !== 1 ? 's' : ''}</span>
        </div>

        {/* Agrupación por recibo */}
        <div className="space-y-2">
          {receiptGroups.map((group) => (
            <div key={group.receipt} className="rounded-lg border border-slate-200 bg-slate-50/60 p-2">
              <div className="flex items-center gap-2 mb-1.5">
                <Receipt className="h-3.5 w-3.5 text-blue-600 shrink-0" />
                <span className="text-xs font-semibold text-slate-700">
                  {hasReceipts && group.receipt !== 'Sin recibo' ? `Recibo ${group.receipt}` : group.receipt}
                </span>
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                  {group.count} paquete{group.count !== 1 ? 's' : ''}
                </Badge>
              </div>
              <ul className="space-y-0.5 pl-5">
                {group.items.map((item, idx) => (
                  <li key={idx} className="text-xs font-mono text-slate-600 break-all">
                    {item.tracking_number}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => onDownload(order)}>
            <FileDown className="h-4 w-4" /> PDF
          </Button>
          <Button variant="outline" size="sm" onClick={() => onEdit(order)}>
            <Pencil className="h-4 w-4" /> Modificar
          </Button>
          {!cancelled && (
            <Button variant="outline" size="sm" className="text-amber-700 border-amber-300" onClick={() => onCancel(order)}>
              <Ban className="h-4 w-4" /> Cancelar
            </Button>
          )}
          <Button variant="outline" size="sm" className="text-rose-600 border-rose-300" onClick={() => onDelete(order)}>
            <Trash2 className="h-4 w-4" /> Borrar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}