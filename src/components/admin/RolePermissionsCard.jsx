import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';

export default function RolePermissionsCard({ roleName, description, roleCode, pages, pageLabels, selectedPages, onTogglePage }) {
  return (
    <Card className="border-0 shadow-md">
      <CardHeader>
        <CardTitle className="flex items-center justify-between gap-3 text-base">
          <span>{roleName}</span>
          <Badge variant="outline">{roleCode}</Badge>
        </CardTitle>
        {description && <p className="text-sm text-slate-500">{description}</p>}
      </CardHeader>
      <CardContent className="space-y-3">
        {pages.map((page) => {
          const checked = selectedPages.includes(page);
          return (
            <div key={page} className="flex items-center gap-3 rounded-lg border border-slate-100 px-3 py-2">
              <Checkbox checked={checked} onCheckedChange={() => onTogglePage(page)} />
              <Label className="cursor-pointer">{pageLabels[page] || page}</Label>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}