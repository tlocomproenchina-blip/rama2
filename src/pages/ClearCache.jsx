import React, { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle2, AlertCircle } from "lucide-react";

export default function ClearCache() {
  const [status, setStatus] = useState("idle"); // idle | running | done | error
  const [details, setDetails] = useState("");

  useEffect(() => {
    const clearAll = async () => {
      setStatus("running");
      try {
        // 1) Storage APIs
        try { localStorage.clear(); } catch {}
        try { sessionStorage.clear(); } catch {}

        // 2) Cache Storage (PWA caches)
        if ("caches" in window) {
          const keys = await caches.keys();
          await Promise.all(keys.map((k) => caches.delete(k)));
        }

        // 3) Unregister Service Workers (so they don't re-populate caches)
        if (navigator.serviceWorker) {
          const regs = await navigator.serviceWorker.getRegistrations();
          await Promise.all(regs.map((r) => r.unregister()));
        }

        setStatus("done");
        setDetails("Caché limpiada correctamente. Recargando...");
        // Pequeña pausa para que el usuario vea el estado
        setTimeout(() => {
          // Recarga dura para evitar recursos cacheados
          window.location.replace("/");
        }, 1200);
      } catch (e) {
        setStatus("error");
        setDetails(e?.message || "Error desconocido al limpiar caché");
      }
    };

    clearAll();
  }, []);

  return (
    <div className="min-h-[60vh] flex items-center justify-center p-4">
      <Card className="w-full max-w-md border-0 shadow-md">
        <CardContent className="p-6 text-center space-y-3">
          {status === "running" && (
            <>
              <Loader2 className="h-8 w-8 animate-spin mx-auto text-blue-600" />
              <h2 className="text-lg font-semibold text-slate-800">Borrando caché del navegador...</h2>
              <p className="text-slate-600 text-sm">Incluye localStorage, sessionStorage y cachés PWA.</p>
            </>
          )}

          {status === "done" && (
            <>
              <CheckCircle2 className="h-8 w-8 mx-auto text-emerald-600" />
              <h2 className="text-lg font-semibold text-slate-800">Completado</h2>
              <p className="text-slate-600 text-sm">{details}</p>
            </>
          )}

          {status === "error" && (
            <>
              <AlertCircle className="h-8 w-8 mx-auto text-rose-600" />
              <h2 className="text-lg font-semibold text-slate-800">Hubo un problema</h2>
              <p className="text-slate-600 text-sm">{details}</p>
              <div className="pt-2">
                <Button onClick={() => window.location.reload()} className="bg-blue-600 hover:bg-blue-700">
                  Reintentar
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}