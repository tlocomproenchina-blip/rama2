import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

export default function RoleAreaSidebar({ roleOptions, roleConfigs, selectedRoleCode, onSelectRole }) {
  return (
    <Card className="w-full min-w-0 overflow-hidden border-0 shadow-lg">
      <CardHeader className="px-3 py-3 pb-2 sm:px-4 sm:py-4 sm:pb-3">
        <CardTitle className="text-base">Áreas</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 overflow-hidden px-2 pb-2 pt-0 sm:px-4 sm:pb-4">
        {roleOptions.map((roleCode) => {
          const role = roleConfigs[roleCode];
          const isActive = selectedRoleCode === roleCode;
          const selectedCount = role?.visible_pages?.length || 0;

          return (
            <Button
              key={roleCode}
              type="button"
              variant="ghost"
              onClick={() => onSelectRole(roleCode)}
              className={`h-auto w-full min-w-0 max-w-full items-start rounded-xl border px-3 py-2.5 text-left !whitespace-normal overflow-hidden ${isActive ? 'border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-50' : 'border-slate-100 bg-white text-slate-700 hover:bg-slate-50'}`}
            >
              <div className="flex w-full min-w-0 items-start justify-between gap-2 overflow-hidden">
                <div className="min-w-0 text-left">
                  <p className="break-words text-sm font-medium leading-tight">{role?.role_name || roleCode}</p>
                  <p className="mt-1 break-words text-[11px] leading-tight text-slate-500">{role?.description || 'Sin descripción'}</p>
                </div>
                <Badge variant="outline" className={`shrink-0 self-start justify-center text-center tabular-nums min-w-8 px-0 text-[11px] ${isActive ? 'border-blue-200 text-blue-700' : ''}`}>
                  {selectedCount}
                </Badge>
              </div>
            </Button>
          );
        })}
      </CardContent>
    </Card>
  );
}