import React, { useEffect, useRef, useState, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { Camera, AlertCircle, Zap, ZapOff } from 'lucide-react';

const TXT = {
  received: { zh: '已收货', es: 'Recibido' },
  orphan: { zh: '已创建孤儿', es: 'Huérfano creado' },
  duplicate: { zh: '已存在', es: 'Ya registrado' },
  manualBtn: { zh: '拍照', es: 'Tomar foto' },
  autoOn: { zh: '自动扫描开启', es: 'Escaneo automático activado' },
  autoOff: { zh: '自动扫描关闭', es: 'Escaneo automático desactivado' },
  initializing: { zh: '初始化中...', es: 'Inicializando...' },
  cameraError: { zh: '无法访问摄像头', es: 'No se pudo acceder a la cámara' },
  noDetector: { zh: '此浏览器不支持条码检测', es: 'Este navegador no soporta detección de códigos' },
  error: { zh: '错误', es: 'Error' },
  ready: { zh: '准备扫描', es: 'Listo para escanear' },
  processing: { zh: '处理中...', es: 'Procesando...' },
  photoFailed: { zh: '照片上传失败', es: 'No se pudo subir la foto' },
  photoFailedHint: { zh: '请检查网络后重试', es: 'Revisa la conexión e intenta de nuevo' },
  retry: { zh: '重试', es: 'Reintentar' },
  uploading: { zh: '上传中...', es: 'Subiendo...' },
  skipPhoto: { zh: '不拍照登记', es: 'Registrar sin foto' },
};

// Cooldown corto para modo automático: evita releer el mismo código.
const COOLDOWN_MS = 1500;

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

  const [status, setStatus] = useState('initializing');
  const [toast, setToast] = useState(null);
  const [manualBusy, setManualBusy] = useState(false);
  const [autoMode, setAutoMode] = useState(false);
  // Escaneo cuya foto no subió: no se registra en silencio, queda pendiente con
  // aviso para reintentar la subida o continuar de forma consciente sin foto.
  const [pendingScan, setPendingScan] = useState(null);
  const [retryingPhoto, setRetryingPhoto] = useState(false);

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
    setTimeout(() => setToast(null), 1500);
  }, []);

  // Sube la foto a Bunny con 1 reintento automático. Devuelve la URL o null.
  const uploadPhoto = useCallback(async (photoBase64) => {
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const uploadRes = await base44.functions.invoke('uploadImageToBunny', { image_base64: photoBase64 });
        const url = uploadRes?.data?.url || null;
        if (url) return url;
      } catch (_) {}
      if (attempt < 2) await new Promise((resolve) => setTimeout(resolve, 900));
    }
    return null;
  }, []);

  // Registra el escaneo en el backend con la foto ya subida (o sin foto si el
  // operador confirmó continuar sin ella).
  const submitScan = useCallback(async (tracking, photoUrl) => {
    try {
      const res = await base44.functions.invoke('processBodegaScan', {
        tracking_number: tracking || '',
        photo_url: photoUrl,
        device_id: deviceIdRef.current,
        manual: !tracking,
      });

      const data = res?.data || {};
      const resultType = data.result_type || 'huerfano';
      const shippingMark = data.shipping_mark || '';

      const toastType = resultType === 'recibido' ? 'received'
        : resultType === 'duplicado' ? 'duplicate'
        : 'orphan';
      showToast(toastType, shippingMark, tracking);
    } catch (err) {
      showToast('error', '', tracking);
    }
  }, [showToast]);

  // Procesa el escaneo: primero la foto, después el registro. Si la foto no sube,
  // el escaneo queda pendiente y se avisa en pantalla (no se pierde en silencio).
  const processScan = useCallback(async (tracking, photoBase64) => {
    if (!photoBase64) {
      await submitScan(tracking, null);
      return;
    }
    const photoUrl = await uploadPhoto(photoBase64);
    if (!photoUrl) {
      setPendingScan({ tracking, base64: photoBase64 });
      return;
    }
    await submitScan(tracking, photoUrl);
  }, [uploadPhoto, submitScan]);

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
            const photoBase64 = captureFrame();
            playBeep();
            vibrate();
            processScan(code, photoBase64);
          }
        }
      } catch (_) {}
      detectingRef.current = false;
      if (activeRef.current) {
        frameRef.current = requestAnimationFrame(scanFrame);
      }
    })();
  }, [captureFrame, processScan, playBeep, vibrate]);

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

      if (!('BarcodeDetector' in window)) {
        setStatus('noDetector');
        return;
      }

      detectorRef.current = new window.BarcodeDetector({
        formats: ['code_128', 'ean_13', 'code_39', 'qr_code', 'ean_8', 'upc_a', 'upc_e', 'itf', 'data_matrix'],
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => null);
      }

      // activeRef solo se enciende si autoMode está activo
      activeRef.current = autoMode;
      if (autoMode) scanFrame();
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

  // Botón manual: captura foto, intenta leer código de barras del frame.
  // Si detecta un código → procesa con tracking (recibido/duplicado).
  // Si no detecta ninguno → procesa como huérfano.
  const handleManualPhoto = useCallback(async () => {
    if (manualBusyRef.current) return;
    manualBusyRef.current = true;
    setManualBusy(true);
    const photoBase64 = captureFrame();
    if (!photoBase64) {
      manualBusyRef.current = false;
      setManualBusy(false);
      return;
    }
    playBeep();
    vibrate();

    // Reintentar la detección varias veces: el autofocus puede tardar un instante
    // en estabilizarse y un solo intento sobre un frame ligeramente borroso
    // manda un paquete legible directo a huérfano. Hasta 8 intentos con ~150ms.
    let detectedCode = '';
    for (let attempt = 0; attempt < 8 && !detectedCode; attempt++) {
      try {
        if (detectorRef.current && videoRef.current && videoRef.current.readyState >= 2) {
          const detected = await detectorRef.current.detect(videoRef.current).catch(() => []);
          detectedCode = detected?.[0]?.rawValue?.trim() || '';
        }
      } catch (_) {}
      if (!detectedCode && attempt < 7) {
        await new Promise((resolve) => setTimeout(resolve, 150));
      }
    }

    await processScan(detectedCode, photoBase64);
    manualBusyRef.current = false;
    setManualBusy(false);
  }, [captureFrame, processScan, playBeep, vibrate]);

  const handleRetryPendingPhoto = useCallback(async () => {
    if (!pendingScan) return;
    setRetryingPhoto(true);
    const photoUrl = await uploadPhoto(pendingScan.base64);
    setRetryingPhoto(false);
    if (!photoUrl) return;
    const pending = pendingScan;
    setPendingScan(null);
    await submitScan(pending.tracking, photoUrl);
  }, [pendingScan, uploadPhoto, submitScan]);

  const handleSkipPendingPhoto = useCallback(async () => {
    if (!pendingScan) return;
    const pending = pendingScan;
    setPendingScan(null);
    await submitScan(pending.tracking, null);
  }, [pendingScan, submitScan]);

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
      {status === 'ready' && (
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

      {status === 'noDetector' && (
        <div className="absolute inset-0 flex items-center justify-center p-6">
          <div className="text-center text-white">
            <AlertCircle className="w-12 h-12 mx-auto mb-3 text-yellow-400" />
            <p className="text-lg font-bold">{TXT.noDetector.zh}</p>
            <p className="text-sm text-white/60 mt-1">{TXT.noDetector.es}</p>
          </div>
        </div>
      )}

      {/* Foto que no subió: el escaneo todavía no se registró */}
      {pendingScan && (
        <div className="absolute inset-0 z-40 bg-black/85 flex items-center justify-center p-6">
          <div className="w-full max-w-sm rounded-2xl border-2 border-red-400/70 bg-black/70 p-5 space-y-4 text-center">
            <AlertCircle className="w-10 h-10 mx-auto text-red-400" />
            <div>
              <p className="text-red-300 text-lg font-bold">{TXT.photoFailed.zh}</p>
              <p className="text-white/80 text-sm">{TXT.photoFailed.es}</p>
            </div>
            {pendingScan.tracking && (
              <p className="font-mono text-white/90 text-sm break-all">{pendingScan.tracking}</p>
            )}
            <p className="text-white/60 text-xs">{TXT.photoFailedHint.zh} · {TXT.photoFailedHint.es}</p>
            <div className="flex flex-col gap-2">
              <button
                onClick={handleRetryPendingPhoto}
                disabled={retryingPhoto}
                className="w-full py-3 rounded-xl bg-red-500/90 text-white font-semibold disabled:opacity-60 touch-manipulation"
              >
                {retryingPhoto ? `${TXT.uploading.zh} · ${TXT.uploading.es}` : `${TXT.retry.zh} · ${TXT.retry.es}`}
              </button>
              <button
                onClick={handleSkipPendingPhoto}
                disabled={retryingPhoto}
                className="w-full py-3 rounded-xl bg-white/15 border border-white/40 text-white/90 font-semibold disabled:opacity-60 touch-manipulation"
              >
                {TXT.skipPhoto.zh} · {TXT.skipPhoto.es}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Botón manual grande y central - método principal */}
      {status === 'ready' && (
        <div className="absolute bottom-0 left-0 right-0 pb-10 flex flex-col items-center gap-3">
          <button
            onClick={handleManualPhoto}
            disabled={manualBusy}
            className="w-28 h-28 rounded-full bg-white/25 backdrop-blur-md border-4 border-white/90 flex items-center justify-center active:scale-95 transition-transform shadow-2xl disabled:opacity-50 touch-manipulation"
          >
            {manualBusy ? (
              <div className="w-8 h-8 border-4 border-white/40 border-t-white rounded-full animate-spin" />
            ) : (
              <Camera className="w-12 h-12 text-white" />
            )}
          </button>
          <div className="text-center">
            <p className="text-white text-base font-bold">{TXT.manualBtn.zh}</p>
            <p className="text-white/70 text-sm">{TXT.manualBtn.es}</p>
          </div>
        </div>
      )}
    </div>
  );
}