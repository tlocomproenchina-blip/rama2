import React from 'react';
import { Building2 } from 'lucide-react';
import WarehouseAddressBlock from './WarehouseAddressBlock';

export default function WarehouseAddressCard({ user, config }) {
  const shippingMark = user?.shipping_mark || '';

  const warehouses = [
    {
      key: 'w1',
      name: config?.warehouse_name || 'Guangdong',
      address: config?.warehouse_address || '',
      phone: config?.warehouse_phone || '',
      zipcode: config?.warehouse_zipcode || ''
    },
    {
      key: 'w2',
      name: config?.warehouse2_name || 'Yiwu',
      address: config?.warehouse2_address || '',
      phone: config?.warehouse2_phone || '',
      zipcode: config?.warehouse2_zipcode || ''
    }
  ].filter((w) => w.address);

  return (
    <div className="flex-1 space-y-3 border-t lg:border-t-0 lg:border-l border-slate-200 pt-4 lg:pt-0 lg:pl-6 min-w-0">
      <div className="flex items-center gap-2 text-slate-500 text-xs md:text-sm">
        <Building2 className="h-3.5 w-3.5 lg:h-4 lg:w-4 flex-shrink-0" />
        Direcciones de nuestros almacenes
      </div>

      {warehouses.length === 0 && (
        <p className="text-slate-400 text-xs md:text-sm">Dirección no configurada</p>
      )}

      {warehouses.map((w, index) => (
        <div key={w.key} className={index > 0 ? 'pt-4 border-t border-dashed border-slate-200' : ''}>
          <WarehouseAddressBlock
            name={w.name}
            address={w.address}
            phone={w.phone}
            zipcode={w.zipcode}
            shippingMark={shippingMark}
          />
        </div>
      ))}
    </div>
  );
}