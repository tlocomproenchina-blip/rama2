import React, { useEffect, useRef, useState, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { Camera, AlertCircle, Zap, ZapOff } from 'lucide-react';
import { captureScanJob, fetchScanStatus, kickScanQueue, retryScanJob } from '@/lib/bodegaScanQueue';
import BodegaScanStatusPanel from '@/components/warehouse/BodegaScanStatusPanel';

const TXT = {
  received: { zh: '已收货', es: 'Recibido' },
  orphan: { zh: '已创建孤儿', es: 'Huérfano creado' },
  duplicate: { zh: '已存在', es: 'Ya registrado' },
  manualBtn: { zh: '拍照', es: 'Tomar foto' },
  autoOn: { zh: '自动扫描开启', es: 'Escaneo automático activado' },
  autoOff: { zh: '自动扫描关闭', es: 'Escaneo automático desactivado' },
  initializing: { zh: '初始化中...', es: 'Inicializando...' },
  cameraError: { zh: '无法访问摄像头', es: 'No se pudo acceder a la cámara' },
  error: { zh: '错误', es: 'Error' },
  ready: { zh: '准备扫描', es: 'Listo para escanear' },
  serverRead: { zh: '代码在服务器读取', es: 'El código se lee en el servidor' },
  confirming: { zh: '保存中...', es: 'Guardando captura...' },
};

// Cooldown corto para modo automático: evita releer el mismo código.
const COOLDOWN_MS = 1500;
// Reintento automático de las fotos que no subieron (la captura no se pierde).
const UPLOAD_RETRY_MS = 8000;
const MAX_PENDING_PHOTOS = 10;
const MAX_JOBS_SHOWN = 5;
// Lecturas del código en el teléfono: solo como respaldo del servidor.
const HINT_ATTEMPTS = 2;
const HINT_RETRY_MS = 120;

export default function BodegaScan() {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const detectorRef = useRef(null);
  const frameRef = useRef(null);
  const activeRef = useRef(false);
  const detectingRef = useRef(false);
  const canvasRef = useRef(null);
  const recentCodesRef = useRef(new Map());
  const audioCtxRef = useRef(null);
  const deviceIdRef = useRef('');
  const manualBusyRef = useRef(false);
  const jobsRef = useRef([]);
  const pendingPhotosRef = useRef([]);
  const toastedRef = useRef(new Set());

  const [status, setStatus] = useState('initializing');
  const [toast, setToast] = useState(null);
  const [busy, setBusy] = useState(false);
  const [autoMode, setAutoMode] = useState(false);
  const [detectorReady, setDetectorReady] = useState(false);
  // Capturas recientes: lo que el backend ya procesó y lo que sigue en camino.
  const [jobs, setJobs] = useState([]);
  // Capturas cuya foto no subió: quedan aquí para reintentar, sin frenar la cámara.
  const [pendingPhotos, setPendingPhotos] = useState([]);

  // Get/create device ID and register
  useEffect(() => {
    try {
      let id = localStorage.getItem('bodega_device_id');
      if (!id) {
        id = (crypto?.randomUUID?.() || 'dev-' + Date.now() + '-' + Math.random().toString(36).slice(2));
        localStorage.setItem('bodega_device_id', id);
      }
      deviceIdRef.current = id;
      base44.functions.invoke('registerBodegaDevice', { device_id: id }).catch(() => {});
    } catch (_) {}
  }, []);

  useEffect(() => { jobsRef.current = jobs; }, [jobs]);
  useEffect(() => { pendingPhotosRef.current = pendingPhotos; }, [pendingPhotos]);

  const playBeep = useCallback(() => {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      if (!audioCtxRef.current) audioCtxRef.current = new AudioCtx();
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') ctx.resume();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'square';
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.15);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.15);
    } catch (_) {}
  }, []);

  const vibrate = useCallback(() => {
    try { if (navigator.vibrate) navigator.vibrate(100); } catch (_) {}
  }, []);

  const captureFrame = useCallback(() => {
    const video = videoRef.current;
    if (!video || video.readyState < 2) return null;
    const canvas = canvasRef.current || document.createElement('canvas');
    canvasRef.current = canvas;
    const w = video.videoWidth;
    const h = video.videoHeight;
    if (!w || !h) return null;
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, w, h);
    return canvas.toDataURL('image/jpeg', 0.85).split(',')[1];
  }, []);

  const showToast = useCallback((type, shippingMark, tracking) => {
    setToast({ type, shippingMark, tracking, id: Date.now() });
    setTimeout(() => setToast(null), 1800);
  }, []);

  const toastTypeOf = useCallback((resultType) => (
    resultType === 'recibido' ? 'received'
      : resultType === 'huerfano' ? 'orphan'
      : resultType === 'duplicado' ? 'duplicate'
      : 'error'
  ), []);

  // Código que el teléfono alcance a leer al encuadrar: viaja como respaldo junto a
  // la captura. La lectura definitiva la hace el servidor sobre la foto.
  const readHint = useCallback(async () => {
    let code = '';
    for (let attempt = 0; attempt < HINT_ATTEMPTS && !code; attempt++) {
      try {
        if (detectorRef.current && videoRef.current && videoRef.current.readyState >= 2) {
          const detected = await detectorRef.current.detect(videoRef.current).catch(() => []);
          code = detected?.[0]?.rawValue?.trim() || '';
        }
      } catch (_) {}
      if (!code && attempt < HINT_ATTEMPTS - 1) {
        await new Promise((resolve) => setTimeout(resolve, HINT_RETRY_MS));
      }
    }
    return code;
  }, []);

  const addJobRow = useCallback((jobId, hint) => {
    setJobs((prev) => [{ key: `job-${jobId}`, job_id: jobId, status: 'pendiente', tracking_number: hint || '' }, ...prev].slice(0, MAX_JOBS_SHOWN));
  }, []);

  // Toma la foto y la encola. La confirmación es la foto guardada y el trabajo en
  // la cola: el proceso completo sigue en el backend sin frenar la cámara.
  const handleCapture = useCallback(async (knownHint) => {
    const base64 = captureFrame();
    if (!base64) return;

    playBeep();
    vibrate();

    const key = `local-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    setJobs((prev) => [{ key, status: 'subiendo' }, ...prev].slice(0, MAX_JOBS_SHOWN));

    const hint = knownHint || (await readHint());

    try {
      const res = await captureScanJob({
        imageBase64: base64,
        deviceId: deviceIdRef.current,
        hintTracking: hint,
      });
      setJobs((prev) => prev.map((job) => (
        job.key === key
          ? { ...job, job_id: res.job_id, status: 'pendiente', tracking_number: hint || '' }
          : job
      )));
      kickScanQueue([res.job_id]);
    } catch (_) {
      // La captura no se pierde ni se registra a medias: queda lista para reintentar
      // la subida, y la cámara sigue disponible.
      setJobs((prev) => prev.filter((job) => job.key !== key));
      setPendingPhotos((prev) => [{ key, base64, hint }, ...prev].slice(0, MAX_PENDING_PHOTOS));
      showToast('error', '', '');
    }
  }, [captureFrame, playBeep, vibrate, readHint, showToast]);

  // Loop de escaneo automático: solo corre cuando autoMode está activo.
  const scanFrame = useCallback(() => {
    if (!activeRef.current) return;
    if (detectingRef.current) {
      frameRef.current = requestAnimationFrame(scanFrame);
      return;
    }

    detectingRef.current = true;
    (async () => {
      try {
        if (!activeRef.current || !detectorRef.current || !videoRef.current) return;
        const video = videoRef.current;
        if (video.readyState < 2) return;

        const detected = await detectorRef.current.detect(video).catch(() => []);
        const code = detected?.[0]?.rawValue?.trim();

        if (code) {
          const now = Date.now();
          const recent = recentCodesRef.current;
          for (const [k, ts] of recent) {
            if (now - ts > COOLDOWN_MS) recent.delete(k);
          }

          if (!recent.has(code)) {
            recent.set(code, now);
            handleCapture(code);
          }
        }
      } catch (_) {}
      detectingRef.current = false;
      if (activeRef.current) {
        frameRef.current = requestAnimationFrame(scanFrame);
      }
    })();
  }, [handleCapture]);

  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 30 },
        },
        audio: false,
      });

      streamRef.current = stream;

      try {
        const track = stream.getVideoTracks?.()[0];
        const caps = track?.getCapabilities?.() || {};
        const advanced = [];
        if (caps.focusMode?.includes('continuous')) advanced.push({ focusMode: 'continuous' });
        if (caps.exposureMode?.includes('continuous')) advanced.push({ exposureMode: 'continuous' });
        if (caps.whiteBalanceMode?.includes('continuous')) advanced.push({ whiteBalanceMode: 'continuous' });
        if (caps.zoom && Number.isFinite(caps.zoom.min) && Number.isFinite(caps.zoom.max)) {
          const targetZoom = Math.min(caps.zoom.max, Math.max(caps.zoom.min, 1.5));
          advanced.push({ zoom: targetZoom });
        }
        if (advanced.length) await track.applyConstraints({ advanced }).catch(() => null);
      } catch (_) {}

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => null);
      }

      // La lectura del código la hace el servidor: si el teléfono no sabe leer
      // códigos, la pantalla funciona igual con el botón de captura.
      const canDetect = 'BarcodeDetector' in window;
      if (canDetect) {
        detectorRef.current = new window.BarcodeDetector({
          formats: ['code_128', 'ean_13', 'code_39', 'qr_code', 'ean_8', 'upc_a', 'upc_e', 'itf', 'data_matrix'],
        });
      }
      setDetectorReady(canDetect);

      activeRef.current = canDetect && autoMode;
      if (activeRef.current) scanFrame();
      setStatus('ready');
    } catch (err) {
      setStatus('cameraError');
    }
  }, [scanFrame, autoMode]);

  useEffect(() => {
    startCamera();
    return () => {
      activeRef.current = false;
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
        streamRef.current = null;
      }
    };
  }, [startCamera]);

  // Toggle del modo automático: enciende/apaga el loop de detección
  const toggleAutoMode = useCallback(() => {
    setAutoMode((prev) => {
      const next = !prev;
      if (next) {
        activeRef.current = true;
        // Limpiar códigos recientes al activar para no disparar inmediatamente
        recentCodesRef.current.clear();
        scanFrame();
      } else {
        activeRef.current = false;
        if (frameRef.current) cancelAnimationFrame(frameRef.current);
      }
      return next;
    });
  }, [scanFrame]);

  // Botón manual: toma la foto y la encola. El código lo lee el servidor.
  const handleManualPhoto = useCallback(async () => {
    if (manualBusyRef.current) return;
    manualBusyRef.current = true;
    setBusy(true);
    try {
      await handleCapture();
    } finally {
      manualBusyRef.current = false;
      setBusy(false);
    }
  }, [handleCapture]);

  // Sigue las capturas en curso sin bloquear la cámara.
  const pollJobs = useCallback(async () => {
    const ids = jobsRef.current
      .filter((job) => job.job_id && (job.status === 'pendiente' || job.status === 'procesando'))
      .map((job) => job.job_id);
    if (!ids.length) return;

    let rows;
    try {
      rows = await fetchScanStatus(ids);
    } catch (_) {
      return;
    }
    if (!rows?.length) return;

    const settled = [];
    setJobs((prev) => prev.map((job) => {
      const row = rows.find((r) => r.id === job.job_id);
      if (!row || row.status === job.status) return job;
      if (row.status === 'procesado' && !toastedRef.current.has(row.id)) {
        toastedRef.current.add(row.id);
        settled.push(row);
      }
      return {
        ...job,
        status: row.status,
        result_type: row.result_type,
        tracking_number: row.tracking_number || job.tracking_number,
        shipping_mark: row.shipping_mark || '',
        error: row.error_message || null,
      };
    }));

    for (const row of settled) {
      showToast(toastTypeOf(row.result_type), row.shipping_mark, row.tracking_number);
    }
  }, [fetchScanStatus, showToast, toastTypeOf]);

  const hasPendingJobs = jobs.some((job) => job.job_id && (job.status === 'pendiente' || job.status === 'procesando'));

  useEffect(() => {
    if (!hasPendingJobs) return;
    pollJobs();
    const id = setInterval(pollJobs, 3000);
    return () => clearInterval(id);
  }, [hasPendingJobs, pollJobs]);

  const handleRetryJob = useCallback(async (job) => {
    if (!job?.job_id) return;
    setJobs((prev) => prev.map((j) => (j.key === job.key ? { ...j, status: 'pendiente', error: null } : j)));
    try {
      await retryScanJob(job.job_id);
    } catch (_) {}
    kickScanQueue([job.job_id]);
  }, []);

  // Reintenta la subida de una foto que no llegó: la captura se registra igual.
  const handleRetryUpload = useCallback(async (photo) => {
    if (!photo) return;
    setPendingPhotos((prev) => prev.filter((p) => p.key !== photo.key));
    try {
      const res = await captureScanJob({
        imageBase64: photo.base64,
        deviceId: deviceIdRef.current,
        hintTracking: photo.hint,
      });
      addJobRow(res.job_id, photo.hint);
      kickScanQueue([res.job_id]);
    } catch (_) {
      setPendingPhotos((prev) => [photo, ...prev.filter((p) => p.key !== photo.key)]);
    }
  }, [addJobRow]);

  // Registrar la carga sin foto, cuando la foto no hay forma de subirla.
  const handleSkipPhoto = useCallback(async (photo) => {
    if (!photo) return;
    setPendingPhotos((prev) => prev.filter((p) => p.key !== photo.key));
    try {
      const res = await captureScanJob({
        skipPhoto: true,
        deviceId: deviceIdRef.current,
        hintTracking: photo.hint,
      });
      addJobRow(res.job_id, photo.hint);
      kickScanQueue([res.job_id]);
    } catch (_) {
      setPendingPhotos((prev) => [photo, ...prev.filter((p) => p.key !== photo.key)]);
    }
  }, [addJobRow]);

  // Las fotos que no subieron se reintentan solas, una por vuelta.
  useEffect(() => {
    const id = setInterval(() => {
      const first = pendingPhotosRef.current[0];
      if (first) handleRetryUpload(first);
    }, UPLOAD_RETRY_MS);
    return () => clearInterval(id);
  }, [handleRetryUpload]);

  const toastBg = toast?.type === 'received' ? 'bg-green-500/90'
    : toast?.type === 'orphan' ? 'bg-blue-500/90'
    : toast?.type === 'duplicate' ? 'bg-yellow-500/90'
    : 'bg-red-500/90';

  return (
    <div className="fixed inset-0 bg-black overflow-hidden select-none">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="absolute inset-0 w-full h-full object-cover"
      />

      {status === 'ready' && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-[70%] max-w-md h-32 border-2 border-green-400/80 rounded-2xl shadow-[0_0_20px_rgba(74,222,128,0.4)]" />
        </div>
      )}

      {/* Toggle de modo automático - esquina superior derecha */}
      {status === 'ready' && detectorReady && (
        <button
          onClick={toggleAutoMode}
          className={`absolute top-4 right-4 z-30 flex items-center gap-2 px-4 py-2.5 rounded-full backdrop-blur-md border-2 shadow-lg touch-manipulation transition-colors ${
            autoMode
              ? 'bg-green-500/30 border-green-400/80 text-white'
              : 'bg-white/15 border-white/60 text-white/80'
          }`}
        >
          {autoMode ? <Zap className="w-5 h-5" /> : <ZapOff className="w-5 h-5" />}
          <span className="text-xs font-semibold">
            {autoMode ? TXT.autoOn.zh : TXT.autoOff.zh}
          </span>
        </button>
      )}

      <div className="absolute top-4 left-4 flex items-center gap-2 text-white/80 text-xs">
        <div className={`w-2 h-2 rounded-full ${status === 'ready' ? 'bg-green-400 animate-pulse' : 'bg-yellow-400'}`} />
        <span>{status === 'ready' ? TXT.ready.zh : TXT.initializing.zh}</span>
      </div>

      {!detectorReady && status === 'ready' && (
        <div className="absolute top-9 left-4 text-white/50 text-[10px]">
          {TXT.serverRead.zh} · {TXT.serverRead.es}
        </div>
      )}

      {toast && (
        <div key={toast.id} className="absolute top-16 left-1/2 -translate-x-1/2 z-50 transition-all duration-200">
          <div className={`px-6 py-4 rounded-2xl shadow-2xl backdrop-blur-md text-center min-w-[220px] ${toastBg}`}>
            <div className="text-white text-lg font-bold">
              {TXT[toast.type]?.zh || TXT.error.zh} ✓
            </div>
            <div className="text-white/80 text-sm">
              {TXT[toast.type]?.es || TXT.error.es} ✓
            </div>
            {toast.shippingMark && (
              <div className="mt-2 pt-2 border-t border-white/20">
                <div className="text-white/60 text-[10px] uppercase tracking-wider">Shipping Mark</div>
                <div className="text-white text-base font-mono font-bold">{toast.shippingMark}</div>
              </div>
            )}
          </div>
        </div>
      )}

      {status === 'cameraError' && (
        <div className="absolute inset-0 flex items-center justify-center p-6">
          <div className="text-center text-white">
            <AlertCircle className="w-12 h-12 mx-auto mb-3 text-red-400" />
            <p className="text-lg font-bold">{TXT.cameraError.zh}</p>
            <p className="text-sm text-white/60 mt-1">{TXT.cameraError.es}</p>
          </div>
        </div>
      )}

      <BodegaScanStatusPanel
        jobs={jobs}
        pendingPhotos={pendingPhotos}
        onRetryJob={handleRetryJob}
        onRetryUpload={handleRetryUpload}
        onSkipPhoto={handleSkipPhoto}
      />

      {/* Botón manual grande y central - método principal */}
      {status === 'ready' && (
        <div className="absolute bottom-0 left-0 right-0 pb-10 flex flex-col items-center gap-3">
          <button
            onClick={handleManualPhoto}
            disabled={busy}
            className="w-28 h-28 rounded-full bg-white/25 backdrop-blur-md border-4 border-white/90 flex items-center justify-center active:scale-95 transition-transform shadow-2xl disabled:opacity-60 touch-manipulation"
          >
            {busy ? (
              <div className="w-8 h-8 border-4 border-white/40 border-t-white rounded-full animate-spin" />
            ) : (
              <Camera className="w-12 h-12 text-white" />
            )}
          </button>
          <div className="text-center">
            <p className="text-white text-base font-bold">{busy ? TXT.confirming.zh : TXT.manualBtn.zh}</p>
            <p className="text-white/70 text-sm">{busy ? TXT.confirming.es : TXT.manualBtn.es}</p>
          </div>
        </div>
      )}
    </div>
  );
}