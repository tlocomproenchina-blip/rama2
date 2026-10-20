import React, { useState } from 'react';
import { Eye, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import FileViewerModal from '@/components/common/FileViewerModal';
import { buildInvoiceDoc } from '@/lib/invoicePdf';

export default function Client360InvoicePdfButton({ invoice }) {
  const [loading, setLoading] = useState(false);
  const [url, setUrl] = useState(null);

  const handleOpen = async () => {
    try {
      setLoading(true);
      const doc = await buildInvoiceDoc(invoice);
      setUrl(String(doc.output('bloburl')));
    } catch (error) {
      console.error('Error generating invoice PDF:', error);
      toast.error('No se pudo abrir la factura');
    }
    setLoading(false);
  };

  const handleClose = () => {
    if (url) URL.revokeObjectURL(url);
    setUrl(null);
  };

  const fileLabel = invoice?.invoice_number ? `factura-${invoice.invoice_number}.pdf` : 'factura.pdf';

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        disabled={loading}
        title="Ver factura en PDF"
        aria-label="Ver factura en PDF"
        className="shrink-0 rounded-md border border-slate-200 bg-white p-1.5 text-slate-500 transition-colors hover:border-blue-200 hover:bg-blue-50 hover:text-blue-600 disabled:opacity-50"
      >
        {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Eye className="h-3.5 w-3.5" />}
      </button>

      <FileViewerModal
        open={!!url}
        fileUrl={url}
        kind="pdf"
        filename={fileLabel}
        title={invoice?.invoice_number ? `Factura ${invoice.invoice_number}` : 'Factura'}
        onClose={handleClose}
      />
    </>
  );
}