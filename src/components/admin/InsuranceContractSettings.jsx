import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { FileText } from 'lucide-react';

export default function InsuranceContractSettings({ config, setConfig }) {
  const updateField = (key, value) => {
    setConfig((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <Card className="rounded-2xl border-0 shadow-lg">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <FileText className="h-5 w-5 text-emerald-600" />
          Contrato de la aseguradora
        </CardTitle>
        <CardDescription>
          Texto y/o archivo del contrato que el cliente debe aceptar al activar el seguro obligatorio. Se mostrará un enlace "ver contrato" en la pre-alerta.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label className="text-sm font-medium">Texto del contrato</Label>
          <Textarea
            value={config?.insurance_contract_text || ''}
            onChange={(e) => updateField('insurance_contract_text', e.target.value)}
            placeholder="Pega aquí los términos y condiciones de la aseguradora..."
            rows={6}
            className="resize-y"
          />
          <p className="text-xs text-slate-500">Si dejas esto vacío y solo subes un archivo, el modal mostrará solo el enlace de descarga.</p>
        </div>
        <div className="space-y-2">
          <Label className="text-sm font-medium">URL del archivo del contrato (PDF o imagen)</Label>
          <Input
            type="url"
            value={config?.insurance_contract_file_url || ''}
            onChange={(e) => updateField('insurance_contract_file_url', e.target.value)}
            placeholder="https://..."
          />
          <p className="text-xs text-slate-500">Sube el archivo a Bunny CDN o un host público y pega la URL aquí.</p>
        </div>
      </CardContent>
    </Card>
  );
}