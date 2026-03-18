import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

export default function RoleAreaSidebar({ roleOptions, roleConfigs, selectedRoleCode, onSelectRole }) {
  return (
    <Card className="w-full min-w-0 border-0 shadow-lg">
      <CardHeader className="pb-3 px-4 py-4">
        <CardTitle className="text-base">Áreas</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 px-3 pb-3 pt-0 sm:px-4">
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
              className={`h-auto w-full min-w-0 whitespace-normal rounded-xl border px-3 py-3 text-left ${isActive ? 'border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-50' : 'border-slate-100 bg-white text-slate-700 hover:bg-slate-50'}`}
            >
              <div className="flex w-full min-w-0 flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 text-left">
                  <p className="break-words text-sm font-medium leading-tight">{role?.role_name || roleCode}</p>
                  <p className="mt-1 break-words text-xs leading-tight text-slate-500">{role?.description || 'Sin descripción'}</p>
                </div>
                <Badge variant="outline" className={`shrink-0 self-start ${isActive ? 'border-blue-200 text-blue-700' : ''}`}>
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