import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Loader2, Upload, Clipboard, Save } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

export default function GlobalContractModal({ open, onOpenChange, config, onSaved }) {
  const [contractText, setContractText] = useState(config?.contract_text || '');
  const [contractFileUrl, setContractFileUrl] = useState(config?.contract_file_url || '');
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      setContractText(config?.contract_text || '');
      setContractFileUrl(config?.contract_file_url || '');
    }
  }, [open, config]);

  const handleFileUpload = async (file) => {
    if (!file) return;
    setUploading(true);
    try {
      if (file.type.startsWith('image/')) {
        const { uploadImageNoCredits } = await import('@/lib/imgbbUpload');
        const url = await uploadImageNoCredits(file);
        setContractFileUrl(url);
      } else {
        const { file_url } = await base44.integrations.Core.UploadFile({ file });
        setContractFileUrl(file_url);
      }
      toast({ title: 'Archivo cargado' });
    } catch (err) {
      toast({ title: 'Error', description: 'No se pudo cargar el archivo', variant: 'destructive' });
    } finally {
      setUploading(false);
    }
  };

  const handlePaste = async () => {
    try {
      const clipboardItems = await navigator.clipboard.read();
      for (const item of clipboardItems) {
        for (const type of item.types) {
          if (type.startsWith('image/')) {
            const blob = await item.getType(type);
            const file = new File([blob], `contrato-${Date.now()}.png`, { type });
            await handleFileUpload(file);
            return;
          }
        }
      }
      toast({ title: 'No hay imagen en el portapapeles', variant: 'destructive' });
    } catch (err) {
      toast({ title: 'No se pudo acceder al portapapeles', variant: 'destructive' });
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      const updated = await base44.entities.AppConfig.update(config.id, {
        contract_text: contractText,
        contract_file_url: contractFileUrl
      });
      toast({ title: 'Contrato global guardado' });
      if (onSaved) onSaved(updated);
      onOpenChange(false);
    } catch (err) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Contrato Global (Presupuestos)</DialogTitle>
          <DialogDescription>
            Este contrato se aplica a todos los presupuestos. Los clientes lo verán al revisar su cotización.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Cargar archivo de contrato */}
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
            <p className="mb-2 text-xs font-semibold text-gray-600">Archivo de contrato (PDF o imagen)</p>
            <div className="flex flex-wrap items-center gap-2">
              <label className="cursor-pointer">
                <input
                  type="file"
                  accept="image/*,.pdf"
                  className="hidden"
                  onChange={(e) => { handleFileUpload(e.target.files?.[0]); e.target.value = ''; }}
                />
                <span className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 whitespace-nowrap">
                  <Upload className="h-4 w-4" /> Subir archivo
                </span>
              </label>
              <button
                type="button"
                onClick={handlePaste}
                disabled={uploading}
                className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 whitespace-nowrap disabled:opacity-50"
              >
                <Clipboard className="h-4 w-4" /> Pegar imagen
              </button>
              {uploading && (
                <span className="inline-flex items-center gap-1 text-xs text-purple-600">
                  <Loader2 className="h-3 w-3 animate-spin" /> Subiendo...
                </span>
              )}
              {contractFileUrl && !uploading && (
                <div className="flex items-center gap-2">
                  <a href={contractFileUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline">
                    Ver archivo cargado
                  </a>
                  <button type="button" onClick={() => setContractFileUrl('')} className="text-xs text-red-500 hover:underline">
                    Quitar
                  </button>
                </div>
              )}
            </div>
          </div>

          <Textarea
            value={contractText}
            onChange={(e) => setContractText(e.target.value)}
            placeholder="Escribe el contrato global para todos los presupuestos..."
            className="min-h-[240px] font-mono text-sm"
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving} style={{ backgroundColor: '#8b5cf6' }} className="text-white hover:opacity-90">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}