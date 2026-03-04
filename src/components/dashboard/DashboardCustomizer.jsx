import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";

const DEFAULT_PREFS = {
  showClients: true,
  showPackages: true,
  showStatusPie: true,
  showRecent: true,
};

export default function DashboardCustomizer({ open, onOpenChange, prefs, onSave }) {
  const [local, setLocal] = useState(DEFAULT_PREFS);

  useEffect(() => {
    setLocal({ ...DEFAULT_PREFS, ...(prefs || {}) });
  }, [prefs]);

  const toggle = (k) => setLocal((p) => ({ ...p, [k]: !p[k] }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Personalizar Dashboard</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <label className="flex items-center gap-3 text-sm">
            <Checkbox checked={!!local.showClients} onCheckedChange={() => toggle('showClients')} />
            Mostrar métricas de clientes
          </label>
          <label className="flex items-center gap-3 text-sm">
            <Checkbox checked={!!local.showPackages} onCheckedChange={() => toggle('showPackages')} />
            Mostrar métricas de paquetes
          </label>
          <label className="flex items-center gap-3 text-sm">
            <Checkbox checked={!!local.showStatusPie} onCheckedChange={() => toggle('showStatusPie')} />
            Mostrar gráfico de estado de envíos
          </label>
          <label className="flex items-center gap-3 text-sm">
            <Checkbox checked={!!local.showRecent} onCheckedChange={() => toggle('showRecent')} />
            Mostrar actividad reciente
          </label>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cerrar</Button>
          <Button onClick={() => onSave(local)} className="bg-blue-600 hover:bg-blue-700">Guardar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}