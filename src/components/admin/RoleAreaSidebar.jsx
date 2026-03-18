import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

export default function RoleAreaSidebar({ roleOptions, roleConfigs, selectedRoleCode, onSelectRole }) {
  return (
    <Card className="border-0 shadow-lg">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Áreas</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
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
              className={`h-auto w-full justify-between rounded-2xl border px-4 py-3 ${isActive ? 'border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-50' : 'border-slate-100 bg-white text-slate-700 hover:bg-slate-50'}`}
            >
              <div className="min-w-0 text-left">
                <p className="truncate font-medium">{role?.role_name || roleCode}</p>
                <p className="truncate text-xs text-slate-500">{role?.description || 'Sin descripción'}</p>
              </div>
              <Badge variant="outline" className={isActive ? 'border-blue-200 text-blue-700' : ''}>
                {selectedCount}
              </Badge>
            </Button>
          );
        })}
      </CardContent>
    </Card>
  );
}