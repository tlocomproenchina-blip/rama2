import React from 'react';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

// Servicio con el que salen los correos de la campaña.
export default function EmailProviderSelect({ value, onChange }) {
  return (
    <div className="space-y-2">
      <Label>Enviar con</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="brevo">Brevo</SelectItem>
          <SelectItem value="base44">Base44</SelectItem>
        </SelectContent>
      </Select>
      <p className="text-xs text-muted-foreground">
        {value === 'brevo'
          ? 'Sale por Brevo. Si se agota la cuota diaria de Brevo, el resto sale automáticamente por Base44.'
          : 'Sale por el servicio de correo de Base44 y usa créditos de integración (1 por correo).'}
      </p>
    </div>
  );
}