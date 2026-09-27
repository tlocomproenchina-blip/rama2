import React from 'react';
import { Building2, Filter } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { buildCompanyOptions, DEFAULT_COMPANY_CODE, ALL_COMPANIES } from '@/lib/companyScope';

// Filtro de empresa reutilizable: TLEC CARGO, una empresa socia, o todas.
export default function CompanyFilterBar({ companies = [], value, onChange, label = 'Empresa', className = '' }) {
  const options = buildCompanyOptions(companies);
  const activeOption = options.find((o) => o.value === value) || options[0];
  const isFiltered = value !== ALL_COMPANIES;

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div className="flex items-center gap-1.5 text-xs font-medium text-slate-500 shrink-0">
        {isFiltered ? <Filter className="h-3.5 w-3.5" /> : <Building2 className="h-3.5 w-3.5" />}
        <Label className="text-xs font-medium text-slate-500 cursor-default">{label}</Label>
      </div>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="h-9 w-full min-w-[11rem] max-w-[16rem]">
          <SelectValue placeholder={activeOption?.label || 'Todas las empresas'} />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              <span className="flex items-center gap-2">
                <span
                  className="h-2.5 w-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: option.color || (option.value === DEFAULT_COMPANY_CODE ? '#0f172a' : '#94a3b8') }}
                />
                {option.label}
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}