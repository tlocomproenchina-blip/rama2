import React, { useEffect, useRef, useState, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { Camera, Loader2, AlertCircle } from 'lucide-react';

const TXT = {
  received: { zh: '已收货', es: 'Recibido' },
  orphan: { zh: '已创建孤儿', es: 'Huérfano creado' },
  duplicate: { zh: '已存在', es: 'Ya registrado' },
  manualBtn: { zh: '无追踪号 / 拍照', es: 'Sin tracking / Foto' },
  initializing: { zh: '初始化中...', es: 'Inicializando...' },
  cameraError: { zh: '无法访问摄像头', es: 'No se pudo acceder a la cámara' },
  noDetector: { zh: '此浏览器不支持条码检测', es: 'Este navegador no soporta detección de códigos' },
  error: { zh: '错误', es: 'Error' },
  ready: { zh: '准备扫描', es: 'Listo para escanear' },
  processing: { zh: '处理中...', es: 'Procesando...' },
};

const COOLDOWN_MS = 2000;
const POST_SCAN_PAUSE_MS = 400;

export default function BodegaScan() {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const detectorRef = useRef(null);
  const frameRef = useRef(null);
  const activeRef = useRef(false);
  const detectingRef = useRef(false);
  const processingRef = useRef(false);
  const canvasRef = useRef(null);
  const recentCodesRef = useRef(new Map());
  const audioCtxRef = useRef(null);
  const deviceIdRef = useRef('');

  const [status, setStatus] = useState('initializing');
  const [toast, setToast] = useState(null);
  const [processing, setProcessing] = useState(false);

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

  const processScan = useCallback(async (tracking, photoBase64) => {
    if (processingRef.current) return;
    processingRef.current = true;
    setProcessing(true);

    try {
      let photoUrl = null;
      if (photoBase64) {
        const uploadRes = await base44.functions.invoke('uploadImageToBunny', { image_base64: photoBase64 });
        photoUrl = uploadRes?.data?.url || null;
      }

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
      playBeep();
      vibrate();
    } catch (err) {
      showToast('error', '', tracking);
    } finally {
      processingRef.current = false;
      setProcessing(false);
    }
  }, [showToast, playBeep, vibrate]);

  const scanFrame = useCallback(() => {
    if (!activeRef.current) return;
    if (processingRef.current || detectingRef.current) {
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

        if (code && !processingRef.current) {
          const now = Date.now();
          const recent = recentCodesRef.current;
          for (const [k, ts] of recent) {
            if (now - ts > COOLDOWN_MS) recent.delete(k);
          }

          if (!recent.has(code)) {
            recent.set(code, now);
            const photoBase64 = captureFrame();
            await processScan(code, photoBase64);
            await new Promise(r => setTimeout(r, POST_SCAN_PAUSE_MS));
          }
        }
      } catch (_) {}
      detectingRef.current = false;
      if (activeRef.current) {
        frameRef.current = requestAnimationFrame(scanFrame);
      }
    })();
  }, [captureFrame, processScan]);

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

      activeRef.current = true;
      setStatus('ready');
      scanFrame();
    } catch (err) {
      setStatus('cameraError');
    }
  }, [scanFrame]);

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

  const handleManualPhoto = useCallback(async () => {
    if (processingRef.current) return;
    const photoBase64 = captureFrame();
    if (!photoBase64) return;
    await processScan('', photoBase64);
  }, [captureFrame, processScan]);

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

      <div className="absolute top-4 left-4 flex items-center gap-2 text-white/80 text-xs">
        <div className={`w-2 h-2 rounded-full ${status === 'ready' ? 'bg-green-400 animate-pulse' : 'bg-yellow-400'}`} />
        <span>{status === 'ready' ? TXT.ready.zh : TXT.initializing.zh}</span>
      </div>

      {toast && (
        <div key={toast.id} className="absolute top-12 left-1/2 -translate-x-1/2 z-50 transition-all duration-200">
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

      {processing && (
        <div className="absolute top-4 right-4">
          <Loader2 className="w-6 h-6 text-white animate-spin" />
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

      {status === 'ready' && (
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2">
          <button
            onClick={handleManualPhoto}
            disabled={processing}
            className="w-20 h-20 rounded-full bg-white/20 backdrop-blur-md border-4 border-white/80 flex items-center justify-center active:scale-95 transition-transform shadow-2xl disabled:opacity-50 touch-manipulation"
          >
            <Camera className="w-8 h-8 text-white" />
          </button>
          <div className="text-center">
            <p className="text-white text-sm font-semibold">{TXT.manualBtn.zh}</p>
            <p className="text-white/60 text-xs">{TXT.manualBtn.es}</p>
          </div>
        </div>
      )}
    </div>
  );
}