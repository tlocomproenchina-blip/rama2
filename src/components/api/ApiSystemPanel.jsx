import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Shield, Activity, List, Zap, RefreshCcw, Clock, AlertTriangle } from 'lucide-react';
import { getApiStatus } from './ApiQueueManager';

export default function ApiSystemPanel() {
  const [status, setStatus] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);

  useEffect(() => {
    const update = () => {
      const s = getApiStatus();
      setStatus(s);
      setLastUpdated(new Date());
    };
    update();
    const id = setInterval(update, 30000); // 30s
    return () => clearInterval(id);
  }, []);

  if (!status) {
    return (
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" /> Estado de la API
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 text-slate-600">
            <RefreshCcw className="h-4 w-4 animate-spin" /> Cargando estado...
          </div>
        </CardContent>
      </Card>
    );
  }

  const isOpen = status.circuitBreakerState === 'OPEN';
  const isHalf = status.circuitBreakerState === 'HALF_OPEN';
  const badgeClass = isOpen
    ? 'bg-red-100 text-red-700 border-red-200'
    : isHalf
      ? 'bg-amber-100 text-amber-700 border-amber-200'
      : 'bg-emerald-100 text-emerald-700 border-emerald-200';

  return (
    <Card className="shadow-lg">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" /> Estado de la API
          </CardTitle>
          <div className={`px-2.5 py-1 text-xs rounded-full border ${badgeClass}`}>
            {status.circuitBreakerState}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <MetricTile icon={List} label="En cola" value={status.queueLength} color="text-blue-600" />
          <MetricTile icon={Activity} label="Lecturas" value={`${status.activeReads}/${status.maxReads}`} color="text-indigo-600" />
          <MetricTile icon={Zap} label="Escrituras" value={`${status.activeWrites}/${status.maxWrites}`} color="text-purple-600" />
          <MetricTile icon={AlertTriangle} label="Fallos" value={status.failureCount} color={status.failureCount > 0 ? 'text-red-600' : 'text-emerald-600'} />
          <MetricTile icon={DatabaseIcon} label="Cache" value={status.cacheSize} color="text-teal-600" />
          <MetricTile icon={NetworkIcon} label="Inflight" value={status.inflightSize} color="text-rose-600" />
        </div>

        <div className="mt-4 text-sm text-slate-600 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            <span>
              Actualizado {lastUpdated ? `hace ${Math.max(1, Math.round((new Date() - lastUpdated)/1000))}s` : ''}
            </span>
          </div>
          {isOpen && (
            <span className="text-red-700 text-xs">Protección activa hasta: {status.circuitOpenUntil || '—'}</span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function MetricTile({ icon: Icon, label, value, color }) {
  return (
    <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 flex items-center gap-3">
      <div className={`p-2 rounded-lg bg-white shadow-sm ${color}`}>
        <Icon className={`h-5 w-5 ${color}`} />
      </div>
      <div>
        <p className="text-xs text-slate-500">{label}</p>
        <p className="text-lg font-semibold text-slate-800">{value}</p>
      </div>
    </div>
  );
}

// Simple inline icons using existing Lucide to avoid unknown imports
function DatabaseIcon(props) {
  return <div className="h-5 w-5 rounded-sm border border-teal-500 text-teal-600 grid place-items-center" {...props}>DB</div>;
}
function NetworkIcon(props) {
  return <div className="h-5 w-5 rounded-sm border border-rose-500 text-rose-600 grid place-items-center" {...props}>IO</div>;
}