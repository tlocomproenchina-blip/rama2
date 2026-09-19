import React, { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { FileText, Download, Loader2 } from "lucide-react";

export default function InsuranceContractModal({ open, onClose, config }) {
  const [loading, setLoading] = useState(true);
  const [contractText, setContractText] = useState("");

  useEffect(() => {
    if (!open) return;
    const text = config?.insurance_contract_text || "";
    setContractText(text);
    setLoading(false);
  }, [open, config]);

  const fileUrl = config?.insurance_contract_file_url;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-emerald-600" />
            Contrato de la Aseguradora
          </DialogTitle>
          <DialogDescription>
            Revisa los términos y condiciones del seguro de carga obligatorio.
          </DialogDescription>
        </DialogHeader>

        <div className="mt-2">
          {loading ? (
            <div className="h-64 flex items-center justify-center text-slate-500 text-sm">
              <Loader2 className="h-5 w-5 animate-spin mr-2" /> Cargando contrato…
            </div>
          ) : contractText ? (
            <div className="h-64 overflow-y-auto rounded-md border border-slate-200 p-4 bg-slate-50 text-sm leading-relaxed whitespace-pre-wrap">
              {contractText}
            </div>
          ) : (
            <div className="h-32 flex items-center justify-center text-slate-500 text-sm">
              No hay texto de contrato configurado.
            </div>
          )}
        </div>

        {fileUrl && (
          <div className="mt-2">
            <a
              href={fileUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-sm font-medium text-blue-600 hover:text-blue-700"
            >
              <Download className="h-4 w-4" />
              Descargar contrato (PDF/imagen)
            </a>
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-3">
          <Button variant="outline" onClick={onClose}>Cerrar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}