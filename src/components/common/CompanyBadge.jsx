import React from 'react';
import { Building2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { DEFAULT_COMPANY_CODE, DEFAULT_COMPANY_NAME, normalizeCompanyCode } from '@/lib/companyScope';

// Distintivo visual de la empresa dueña de un registro (empresa socia o TLEC CARGO).
export default function CompanyBadge({ record, companies = [], className = '', showDefault = false }) {
  const code = normalizeCompanyCode(record?.company_code);
  if (!code && !showDefault) return null;

  const isDefault = !code || code === DEFAULT_COMPANY_CODE;
  const company = isDefault ? null : companies.find((c) => normalizeCompanyCode(c.company_code) === code);
  const label = isDefault ? DEFAULT_COMPANY_NAME : company?.company_name || code.toUpperCase();
  const color = isDefault ? null : company?.brand_color;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium',
        !color && 'border-slate-200 bg-slate-50 text-slate-700',
        className
      )}
      style={color ? { borderColor: `${color}55`, backgroundColor: `${color}14`, color } : undefined}
      title={isDefault ? 'Carga de TLEC CARGO' : `Empresa socia: ${label}`}
    >
      <Building2 className="h-3 w-3" />
      {label}
    </span>
  );
}