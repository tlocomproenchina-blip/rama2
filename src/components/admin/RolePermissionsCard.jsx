import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';

export default function RolePermissionsCard({ roleName, description, roleCode, pages, pageLabels, selectedPages, onTogglePage }) {
  return (
    <Card className="overflow-hidden border-0 bg-white shadow-lg">
      <CardHeader className="border-b border-slate-100 bg-gradient-to-r from-slate-50 to-blue-50/70">
        <CardTitle className="flex items-start justify-between gap-3 text-base">
          <div>
            <span className="text-slate-900">{roleName}</span>
            <p className="mt-1 text-sm font-normal text-slate-500">{description}</p>
          </div>
          <Badge variant="outline" className="border-blue-200 text-blue-700">
            {selectedPages.length} permisos
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4">
        <div className="grid gap-3 sm:grid-cols-2">
          {pages.map((page) => {
            const checked = selectedPages.includes(page);
            return (
              <button
                key={page}
                type="button"
                onClick={() => onTogglePage(page)}
                className={`flex items-start gap-3 rounded-xl border px-3 py-3 text-left transition-all ${checked ? 'border-blue-200 bg-blue-50 shadow-sm' : 'border-slate-100 bg-white hover:border-slate-200 hover:bg-slate-50'}`}
              >
                <Checkbox checked={checked} onCheckedChange={() => onTogglePage(page)} />
                <div className="min-w-0">
                  <Label className="cursor-pointer text-sm font-medium text-slate-800">{pageLabels[page] || page}</Label>
                  <p className="mt-1 text-xs text-slate-500">{checked ? 'Visible para esta área' : 'Oculto para esta área'}</p>
                </div>
              </button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}