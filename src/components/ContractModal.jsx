import React, { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { base44 } from "@/api/base44Client";

export default function ContractModal({ open, onAccept, onReject }) {
  const [loading, setLoading] = useState(true);
  const [contractText, setContractText] = useState("");
  const [appName, setAppName] = useState("Tu Cuenta");

  useEffect(() => {
    if (!open) return;
    const load = async () => {
      try {
        const [cfgs, privs] = await Promise.all([
          base44.entities.AppConfig.filter({ config_key: "main" }),
          base44.entities.PrivacyConfig.filter({ config_key: "main" })
        ]);
        const cfg = cfgs?.[0];
        const privacy = privs?.[0];
        setAppName(cfg?.app_name || "Tu Cuenta");
        const content = privacy?.terms_of_service || cfg?.contract_text;
        setContractText(
          content ||
            "Al continuar, aceptas los términos y condiciones del servicio."
        );
      } catch (_) {
        setContractText("Al continuar, aceptas los términos y condiciones del servicio.");
      }
      setLoading(false);
    };
    load();
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onReject?.(); }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Contrato de Servicio - {appName}</DialogTitle>
          <DialogDescription>
            Revisa y acepta el contrato para continuar usando la plataforma.
          </DialogDescription>
        </DialogHeader>

        <div className="mt-2">
          {loading ? (
            <div className="h-64 flex items-center justify-center text-slate-500 text-sm">Cargando contrato…</div>
          ) : (
            <div className="h-64 overflow-y-auto rounded-md border border-slate-200 p-4 bg-slate-50 text-sm leading-relaxed whitespace-pre-wrap">
              {contractText}
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-3">
          <Button variant="outline" onClick={onReject}>Rechazar</Button>
          <Button onClick={onAccept} className="bg-blue-600 hover:bg-blue-700">Acepto el contrato</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}