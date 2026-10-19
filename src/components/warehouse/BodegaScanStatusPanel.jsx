import React from 'react';
import { AlertCircle, CheckCircle2, Clock, Copy, HelpCircle, ImageOff, Loader2, PackagePlus, RefreshCw } from 'lucide-react';

// Estado de las capturas recientes del escáner, sobre la cámara: la toma quedó
// guardada y el backend sigue trabajando, así que aquí se ve qué pasó con cada una
// sin frenar al operador. Lo que no se pudo subir queda con su reintento.

const STATUS = {
  subiendo: { icon: Loader2, spin: true, tone: 'text-sky-300', zh: '上传中', es: 'Subiendo foto' },
  pendiente: { icon: Clock, spin: false, tone: 'text-amber-300', zh: '排队中', es: 'En cola' },
  procesando: { icon: Loader2, spin: true, tone: 'text-sky-300', zh: '处理中', es: 'Procesando' },
  procesado_recibido: { icon: CheckCircle2, tone: 'text-green-400', zh: '已收货', es: 'Recibido' },
  procesado_duplicado: { icon: Copy, tone: 'text-yellow-300', zh: '已存在', es: 'Ya registrado' },
  procesado_huerfano: { icon: PackagePlus, tone: 'text-blue-300', zh: '已创建孤儿', es: 'Huérfano' },
  procesado: { icon: CheckCircle2, tone: 'text-green-400', zh: '已完成', es: 'Procesado' },
  // Captura sin código legible: no registró nada y espera revisión o un reintento.
  sin_identificar: { icon: HelpCircle, tone: 'text-amber-300', zh: '待识别', es: 'Sin identificar' },
  error: { icon: AlertCircle, tone: 'text-red-400', zh: '需重试', es: 'Reintentar' },
};

function statusStyle(job) {
  if (job.status === 'procesado') return STATUS[`procesado_${job.result_type}`] || STATUS.procesado;
  return STATUS[job.status] || STATUS.pendiente;
}

function Row({ children }) {
  return (
    <div className="flex items-start gap-2 rounded-xl bg-black/60 backdrop-blur-md border border-white/15 px-3 py-2">
      {children}
    </div>
  );
}

export default function BodegaScanStatusPanel({ jobs = [], pendingPhotos = [], onRetryJob, onRetryUpload, onSkipPhoto }) {
  if (!jobs.length && !pendingPhotos.length) return null;

  return (
    <div className="absolute bottom-48 left-3 z-30 w-[15.5rem] space-y-2 max-h-[45vh] overflow-y-auto">
      {pendingPhotos.length > 0 && (
        <Row>
          <ImageOff className="w-4 h-4 shrink-0 mt-0.5 text-red-400" />
          <div className="min-w-0 flex-1 space-y-1">
            <p className="text-red-300 text-[11px] font-semibold leading-tight">
              {pendingPhotos.length} · 照片未上传 / Foto sin subir
            </p>
            <div className="flex flex-wrap gap-1">
              <button
                onClick={() => onRetryUpload?.(pendingPhotos[0])}
                className="flex items-center gap-1 px-2 py-1 rounded-lg bg-red-500/80 text-white text-[10px] font-semibold touch-manipulation"
              >
                <RefreshCw className="w-3 h-3" /> 重试 / Reintentar
              </button>
              <button
                onClick={() => onSkipPhoto?.(pendingPhotos[0])}
                className="px-2 py-1 rounded-lg bg-white/15 text-white/90 text-[10px] font-semibold touch-manipulation"
              >
                不拍照 / Sin foto
              </button>
            </div>
          </div>
        </Row>
      )}

      {jobs.map((job) => {
        const style = statusStyle(job);
        const Icon = style.icon;
        return (
          <Row key={job.key}>
            <Icon className={`w-4 h-4 shrink-0 mt-0.5 ${style.tone} ${style.spin ? 'animate-spin' : ''}`} />
            <div className="min-w-0 flex-1">
              <p className={`text-[11px] font-semibold leading-tight ${style.tone}`}>
                {style.zh} · {style.es}
              </p>
              {(job.shipping_mark || job.tracking_number) && (
                <p className="text-white/75 text-[10px] font-mono break-all leading-tight">
                  {job.shipping_mark || job.tracking_number}
                </p>
              )}
              {(job.status === 'error' || job.status === 'sin_identificar') && (
                <>
                  {job.error && <p className="text-white/50 text-[10px] break-words leading-tight">{job.error}</p>}
                  <div className="mt-1 flex items-start gap-2">
                    {job.photo_url && (
                      <a href={job.photo_url} target="_blank" rel="noreferrer" className="shrink-0">
                        <img
                          src={job.photo_url}
                          alt="Foto de la captura"
                          className="w-11 h-11 rounded-md object-cover border border-white/25"
                        />
                      </a>
                    )}
                    <button
                      onClick={() => onRetryJob?.(job)}
                      className={`flex items-center gap-1 px-2 py-1 rounded-lg text-white text-[10px] font-semibold touch-manipulation ${
                        job.status === 'error' ? 'bg-rose-500/80' : 'bg-amber-500/80'
                      }`}
                    >
                      <RefreshCw className="w-3 h-3" /> 重试 / Reintentar
                    </button>
                  </div>
                </>
              )}
            </div>
          </Row>
        );
      })}
    </div>
  );
}