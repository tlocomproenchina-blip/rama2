import React from 'react';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function CampaignRecipientGroupSelect({ value, onChange, eligibleCount, selectedCount, disabled }) {
  return (
    <div className="space-y-2">
      <Label htmlFor="campaign-group">Seleccionar Grupo</Label>
      <Select value={value} onValueChange={onChange} disabled={disabled}>
        <SelectTrigger id="campaign-group">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="elegibles">Con Shipping Mark ({eligibleCount})</SelectItem>
          <SelectItem value="personalizada">
            Selección personalizada{selectedCount > 0 ? ` (${selectedCount})` : ''}
          </SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}