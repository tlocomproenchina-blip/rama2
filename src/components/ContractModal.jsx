import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { base44 } from '@/api/base44Client';
import { FileText, CheckCircle, XCircle, Loader2 } from 'lucide-react';

export default function ContractModal({ open, onAccept, onReject }) {
  const [contractText, setContractText] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadContract = async () => {
      const configs = await base44.entities.AppConfig.filter({ config_key: 'main' });
      if (configs.length > 0) {
        setContractText(configs[0].contract_text || 'Contrato de servicio pendiente de configuración.');
      } else {
        setContractText('Contrato de servicio pendiente de configuración por el administrador.');
      }
      setLoading(false);
    };
    if (open) loadContract();
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent className="max-w-2xl max-h-[90vh]" onPointerDownOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-blue-50 rounded-xl">
              <FileText className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <DialogTitle className="text-xl font-semibold text-slate-800">
                Contrato de Servicio
              </DialogTitle>
              <DialogDescription className="text-slate-500">
                Por favor lee y acepta el contrato para continuar
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          </div>
        ) : (
          <ScrollArea className="h-[400px] rounded-lg border border-slate-200 bg-slate-50 p-4">
            <div className="prose prose-sm max-w-none text-slate-700 whitespace-pre-wrap">
              {contractText}
            </div>
          </ScrollArea>
        )}

        <DialogFooter className="flex gap-3 mt-4">
          <Button
            variant="outline"
            onClick={onReject}
            className="flex-1 border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
          >
            <XCircle className="h-4 w-4 mr-2" />
            Rechazo
          </Button>
          <Button
            onClick={onAccept}
            className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            <CheckCircle className="h-4 w-4 mr-2" />
            Acepto
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}