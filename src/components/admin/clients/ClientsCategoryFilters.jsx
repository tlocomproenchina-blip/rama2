import React from 'react';
import { Button } from "@/components/ui/button";
import { Filter, CheckCircle, AlertTriangle, Clock, UserCheck, UserX, Package, Phone } from 'lucide-react';

export default function ClientsCategoryFilters({
  exclusiveKey,
  counts,
  registeredCount,
  statusFilter,
  activeFilter,
  packageFilter,
  whatsappFilter,
  selectStatus,
  selectActive,
  selectPackage,
  selectWhatsapp,
}) {
  return (
    <div className="flex items-start gap-2">
      <Filter className="h-4 w-4 text-slate-500 mt-2 shrink-0" />
      <div className="flex gap-2 overflow-x-auto -mx-1 px-1 pb-1 lg:flex-wrap lg:overflow-visible scrollbar-thin"
           style={{ scrollbarWidth: 'thin' }}>
        <Button
          variant="outline"
          aria-pressed={exclusiveKey === 'all'}
          size="sm"
          onClick={() => selectStatus('all')}
          className={(exclusiveKey === 'all') ? 'bg-slate-900 text-white border-slate-900' : ''}
        >
          Todos ({counts.total || registeredCount})
        </Button>
        <Button
          variant="outline"
          aria-pressed={exclusiveKey === 'with_mark'}
          size="sm"
          onClick={() => selectStatus(statusFilter === 'with_mark' ? 'all' : 'with_mark')}
          className={(exclusiveKey === 'with_mark') ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : 'border-emerald-200 text-emerald-700 hover:bg-emerald-50'}
        >
          <CheckCircle className="h-3 w-3 mr-1" /> Con Shipping Mark ({counts.withMark})
        </Button>
        <Button
          variant="outline"
          aria-pressed={exclusiveKey === 'without_mark'}
          size="sm"
          onClick={() => selectStatus(statusFilter === 'without_mark' ? 'all' : 'without_mark')}
          className={(exclusiveKey === 'without_mark') ? 'bg-amber-100 text-amber-700 border-amber-200' : 'border-amber-200 text-amber-700 hover:bg-amber-50'}
        >
          <AlertTriangle className="h-3 w-3 mr-1" /> Sin Shipping Mark ({counts.withoutMark})
        </Button>
        <Button
          variant="outline"
          aria-pressed={exclusiveKey === 'pending'}
          size="sm"
          onClick={() => selectStatus(statusFilter === 'pending' ? 'all' : 'pending')}
          className={(exclusiveKey === 'pending') ? 'bg-orange-100 text-orange-700 border-orange-200' : 'border-orange-200 text-orange-700 hover:bg-orange-50'}
        >
          <Clock className="h-3 w-3 mr-1" /> Pendientes ({counts.pending})
        </Button>
        <Button
          variant="outline"
          aria-pressed={exclusiveKey === 'incomplete'}
          size="sm"
          onClick={() => selectStatus(statusFilter === 'incomplete' ? 'all' : 'incomplete')}
          className={(exclusiveKey === 'incomplete') ? 'bg-red-100 text-red-700 border-red-200' : 'border-red-200 text-red-700 hover:bg-red-50'}
        >
          <AlertTriangle className="h-3 w-3 mr-1" /> Con Datos Faltantes ({counts.incomplete})
        </Button>
        <Button
          variant="outline"
          aria-pressed={exclusiveKey === 'active'}
          size="sm"
          onClick={() => selectActive(activeFilter === 'active' ? 'all' : 'active')}
          className={(exclusiveKey === 'active')
            ? 'bg-emerald-100 text-emerald-700 border-emerald-200'
            : 'border-emerald-200 text-emerald-700 hover:bg-emerald-50'}
        >
          <UserCheck className="h-3 w-3 mr-1" /> Activos ({counts.active})
        </Button>
        <Button
          variant="outline"
          aria-pressed={exclusiveKey === 'inactive'}
          size="sm"
          onClick={() => selectActive(activeFilter === 'inactive' ? 'all' : 'inactive')}
          className={(exclusiveKey === 'inactive')
            ? 'bg-rose-100 text-rose-700 border-rose-200'
            : 'border-rose-200 text-rose-700 hover:bg-rose-50'}
        >
          <UserX className="h-3 w-3 mr-1" /> Inactivos ({counts.inactive})
        </Button>
        <Button
          variant="outline"
          aria-pressed={exclusiveKey === 'with_packages'}
          size="sm"
          onClick={() => selectPackage(packageFilter === 'with_packages' ? 'all' : 'with_packages')}
          className={(exclusiveKey === 'with_packages')
            ? 'bg-indigo-100 text-indigo-700 border-indigo-200'
            : 'border-indigo-200 text-indigo-700 hover:bg-indigo-50'}
        >
          <Package className="h-3 w-3 mr-1" /> Con Paquetes ({counts.withPackages})
        </Button>
        <Button
          variant="outline"
          aria-pressed={exclusiveKey === 'without_packages'}
          size="sm"
          onClick={() => selectPackage(packageFilter === 'without_packages' ? 'all' : 'without_packages')}
          className={(exclusiveKey === 'without_packages')
            ? 'bg-slate-900 text-white border-slate-900'
            : 'border-slate-200 text-slate-700 hover:bg-slate-50'}
        >
          <Package className="h-3 w-3 mr-1" /> Sin Paquetes ({counts.withoutPackages})
        </Button>
        <Button
          variant="outline"
          aria-pressed={exclusiveKey === 'with_whatsapp'}
          size="sm"
          onClick={() => selectWhatsapp(whatsappFilter === 'with' ? 'all' : 'with')}
          className={(exclusiveKey === 'with_whatsapp')
            ? 'bg-green-100 text-green-700 border-green-200'
            : 'border-green-200 text-green-700 hover:bg-green-50'}
        >
          <Phone className="h-3 w-3 mr-1" /> Con WhatsApp ({counts.withWhatsapp})
        </Button>
        <Button
          variant="outline"
          aria-pressed={exclusiveKey === 'without_whatsapp'}
          size="sm"
          onClick={() => selectWhatsapp(whatsappFilter === 'without' ? 'all' : 'without')}
          className={(exclusiveKey === 'without_whatsapp')
            ? 'bg-slate-900 text-white border-slate-900'
            : 'border-slate-200 text-slate-700 hover:bg-slate-50'}
        >
          <Phone className="h-3 w-3 mr-1" /> Sin WhatsApp ({counts.withoutWhatsapp})
        </Button>
      </div>
    </div>
  );
}