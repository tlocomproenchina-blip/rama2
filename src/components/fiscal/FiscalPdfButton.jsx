import React, { useState } from 'react';
import { FileText, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import FileViewerModal from '@/components/common/FileViewerModal';
import { buildFiscalPdf } from '@/lib/fiscalInvoicePdf';

// Genera en el navegador el PDF preliminar de la solicitud (nunca se presenta
// como factura fiscal emitida) y lo abre en el visor interno.
export default function FiscalPdfButton({ request, label = 'PDF preliminar', variant = 'outline', size = 'sm' }) {
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);

  const open = async () => {
    setBusy(true);
    try {
      const [cfg, fs] = await Promise.all([
        base44.entities.AppConfig.filter({ config_key: 'main' }),
        base44.entities.FiscalSettings.filter({ config_key: 'main' }),
      ]);
      const blob = buildFiscalPdf({ request, appConfig: cfg[0], settings: fs[0] });
      setUrl(URL.createObjectURL(blob));
    } catch (_) {
      toast.error('No se pudo generar el PDF');
    } finally {
      setBusy(false);
    }
  };

  const close = () => {
    if (url) URL.revokeObjectURL(url);
    setUrl('');
  };

  return (
    <>
      <Button type="button" variant={variant} size={size} disabled={busy} onClick={open}>
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />} {label}
      </Button>
      <FileViewerModal open={!!url} fileUrl={url} kind="pdf" filename={`solicitud-${request.request_number}-preliminar.pdf`} title={`Solicitud ${request.request_number} (preliminar)`} onClose={close} />
    </>
  );
}