import React from 'react';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Loader2, Save, Bot, Eye, Send } from 'lucide-react';

export default function AiTicketSettingsCard({ appConfig, setAppConfig, onSave, saving }) {
  const enabled = !!appConfig.ai_ticket_autoresponder_enabled;
  const mode = appConfig.ai_ticket_response_mode === 'review' ? 'review' : 'direct';

  return (
    <div className="p-4 md:p-6 bg-violet-50 rounded-xl border border-violet-200 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-violet-100 rounded-lg">
            <Bot className="h-5 w-5 text-violet-600" />
          </div>
          <div>
            <h3 className="font-semibold text-slate-800 text-lg">Asistente IA para Tickets</h3>
            <p className="text-sm text-slate-600">Responde automáticamente los tickets de soporte leyendo el historial y los datos del cliente.</p>
          </div>
        </div>
        <Switch
          checked={enabled}
          onCheckedChange={(checked) => setAppConfig({ ...appConfig, ai_ticket_autoresponder_enabled: checked })}
        />
      </div>

      {enabled && (
        <div className="space-y-3">
          <Label className="font-medium text-slate-800">Modo de respuesta</Label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setAppConfig({ ...appConfig, ai_ticket_response_mode: 'direct' })}
              className={`flex items-start gap-3 p-4 rounded-xl border-2 transition-all text-left ${mode === 'direct' ? 'border-violet-500 bg-white shadow-sm' : 'border-violet-200 bg-white/60 hover:bg-white'}`}
            >
              <Send className={`h-5 w-5 mt-0.5 ${mode === 'direct' ? 'text-violet-600' : 'text-slate-400'}`} />
              <div>
                <p className="font-semibold text-slate-800 text-sm">Envío directo</p>
                <p className="text-xs text-slate-600 mt-1">La IA responde al cliente automáticamente al instante.</p>
              </div>
            </button>
            <button
              type="button"
              onClick={() => setAppConfig({ ...appConfig, ai_ticket_response_mode: 'review' })}
              className={`flex items-start gap-3 p-4 rounded-xl border-2 transition-all text-left ${mode === 'review' ? 'border-violet-500 bg-white shadow-sm' : 'border-violet-200 bg-white/60 hover:bg-white'}`}
            >
              <Eye className={`h-5 w-5 mt-0.5 ${mode === 'review' ? 'text-violet-600' : 'text-slate-400'}`} />
              <div>
                <p className="font-semibold text-slate-800 text-sm">Revisión previa</p>
                <p className="text-xs text-slate-600 mt-1">La IA genera un borrador que tú apruebas antes de enviar.</p>
              </div>
            </button>
          </div>
          <div className="p-3 bg-white rounded-lg border border-violet-200">
            <p className="text-xs text-slate-600">
              <strong>La IA puede:</strong> consultar paquetes, pre-alertas, recibos (con estado de tránsito/BL), facturas y órdenes de despacho del cliente del ticket. Si no puede responder, pide más info o escala a un agente humano.
            </p>
          </div>
        </div>
      )}

      <Button onClick={onSave} disabled={saving} className="w-full">
        {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
        Guardar configuración
      </Button>
    </div>
  );
}