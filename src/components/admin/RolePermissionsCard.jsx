import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';

export default function RolePermissionsCard({ roleName, description, roleCode, pages, pageLabels, selectedPages, onTogglePage }) {
  return (
    <Card className="overflow-hidden border-0 bg-white shadow-lg">
      <CardHeader className="border-b border-slate-100 bg-gradient-to-r from-slate-50 to-blue-50/70 px-3 py-2.5 sm:px-4 sm:py-3">
        <CardTitle className="flex items-start justify-between gap-2 text-sm">
          <div>
            <span className="text-slate-900">{roleName}</span>
            <p className="mt-1 text-xs font-normal text-slate-500">{description}</p>
          </div>
          <Badge variant="outline" className="border-blue-200 text-blue-700 text-[11px]">
            {selectedPages.length} permisos
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-3">
        <div className="grid gap-2 sm:grid-cols-2">
          {pages.map((page) => {
            const checked = selectedPages.includes(page);
            return (
              <button
                key={page}
                type="button"
                onClick={() => onTogglePage(page)}
                className={`flex items-start gap-2 rounded-lg border px-3 py-1.5 text-left transition-all ${checked ? 'border-blue-200 bg-blue-50 shadow-sm' : 'border-slate-100 bg-white hover:border-slate-200 hover:bg-slate-50'}`}
              >
                <Checkbox checked={checked} onCheckedChange={() => onTogglePage(page)} className="!h-5 !w-5 !rounded-sm !self-start sm:!h-5 sm:!w-5" />
                <div className="min-w-0 pt-0.5">
                  <Label className="cursor-pointer text-[13px] font-medium text-slate-800 leading-tight">{pageLabels[page] || page}</Label>
                  <p className="mt-0.5 text-[11px] text-slate-500">{checked ? 'Visible para esta área' : 'Oculto para esta área'}</p>
                </div>
              </button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}