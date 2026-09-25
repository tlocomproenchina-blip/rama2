import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Camera, Keyboard, Loader2, ScanLine, X } from 'lucide-react';
import { toast } from 'sonner';

const normalizeCode = (value = '') => String(value).replace(/\r?\n/g, '').trim();

export default function BarcodeScannerModule({
  title = 'Escaneo de códigos',
  description = 'Usa la cámara o una lectora para capturar el tracking rápidamente.',
  placeholder = 'Escanea o escribe el código',
  actionLabel = 'Procesar código',
  cameraLabel = 'Usar cámara',
  onDetected,
  value,
  onValueChange,
  extraAction,
  inputClassName = '',
  autoStartCamera = false,
  continuous = false,
}) {
  const [scanValue, setScanValue] = useState('');
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraLoading, setCameraLoading] = useState(false);
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const detectorRef = useRef(null);
  const frameRef = useRef(null);
  const activeRef = useRef(false);
  const inputRef = useRef(null);

  const scanAttemptsRef = useRef(0);
  const canvasRef = useRef(null);
  const lastCodeRef = useRef('');
  const lastDetectedAtRef = useRef(0);
  const audioCtxRef = useRef(null);
  // Historial de códigos escaneados recientemente (anti-duplicado robusto).
  // No basta con comparar contra el último código: si escaneas A, luego B, y
  // al mover A pasa otra vez frente a la cámara, A se volvería a agregar.
  // Aquí guardamos todos los códigos vistos en los últimos N segundos.
  const recentCodesRef = useRef(new Map());
  const RECENT_CODE_COOLDOWN_MS = 8000; // 8s: si el mismo código se repite dentro de esta ventana, se ignora

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

  const cameraSupported = typeof window !== 'undefined' && !!navigator?.mediaDevices?.getUserMedia;
  const nativeBarcodeSupported = typeof window !== 'undefined' && 'BarcodeDetector' in window;

  const stopCamera = () => {
    activeRef.current = false;
    if (frameRef.current) {
      cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };

  const handleDetected = (value) => {
    const nextCode = normalizeCode(value);
    if (!nextCode) return;
    setScanValue(nextCode);
    onDetected?.(nextCode);
  };

  // Capture a frame to canvas, optionally rotated
  const captureFrame = useCallback((rotation = 0) => {
    const video = videoRef.current;
    if (!video || video.readyState < 2) return null;
    const canvas = canvasRef.current || document.createElement('canvas');
    canvasRef.current = canvas;
    const w = video.videoWidth;
    const h = video.videoHeight;
    if (!w || !h) return null;

    if (rotation === 0) {
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(video, 0, 0, w, h);
    } else {
      const rad = (rotation * Math.PI) / 180;
      const cos = Math.abs(Math.cos(rad));
      const sin = Math.abs(Math.sin(rad));
      canvas.width = Math.ceil(w * cos + h * sin);
      canvas.height = Math.ceil(w * sin + h * cos);
      const ctx = canvas.getContext('2d');
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate(rad);
      ctx.drawImage(video, -w / 2, -h / 2, w, h);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
    }
    return canvas;
  }, []);

  const scanFrame = async () => {
    if (!activeRef.current || !videoRef.current) return;
    scanAttemptsRef.current++;

    const video = videoRef.current;
    if (video.readyState >= 2 && nativeBarcodeSupported && detectorRef.current) {
      // Direct detection on the live video stream — fastest path.
      // BarcodeDetector ya tolera inclinaciones moderadas; no rotamos por frame
      // porque eso destruye el FPS. Solo después de varios fallos intentamos rotar.
      let detected = await detectorRef.current.detect(video).catch(() => []);
      let code = normalizeCode(detected?.[0]?.rawValue || '');

      // Tras ~0.7s sin detectar, probar rotaciones suaves cada cierto tiempo
      if (!code && scanAttemptsRef.current > 6 && scanAttemptsRef.current % 4 === 0) {
        const angles = [10, -10, 20, -20];
        for (const angle of angles) {
          if (!activeRef.current) return;
          const canvas = captureFrame(angle);
          if (!canvas) break;
          detected = await detectorRef.current.detect(canvas).catch(() => []);
          code = normalizeCode(detected?.[0]?.rawValue || '');
          if (code) break;
        }
      }

      if (code) {
        if (continuous) {
          const now = Date.now();
          // Limpia códigos antiguos del historial (vencidos)
          const recent = recentCodesRef.current;
          for (const [k, ts] of recent) {
            if (now - ts > RECENT_CODE_COOLDOWN_MS) recent.delete(k);
          }
          // Anti-duplicado robusto: revisa TODO el historial reciente, no solo el último.
          // Si el código ya fue escaneado en los últimos 8s, se ignora silenciosamente.
          const isDuplicate = recent.has(code);
          if (!isDuplicate) {
            recent.set(code, now);
            lastCodeRef.current = code;
            lastDetectedAtRef.current = now;
            handleDetected(code);
            toast.success(`Código agregado: ${code}`);
            playBeep();
            if (navigator.vibrate) navigator.vibrate(100);
            // Pausa breve antes de seguir escaneando el siguiente código (800ms vs 1200ms anterior)
            await new Promise((resolve) => setTimeout(resolve, 800));
          }
        } else {
          handleDetected(code);
          toast.success('Código detectado');
          playBeep();
          if (navigator.vibrate) navigator.vibrate(100);
          setCameraOpen(false);
          stopCamera();
          return;
        }
      }
    }

    // Limita a ~20 detecciones/segundo. Suficiente para tracking en mano y libera CPU/GPU.
    if (activeRef.current) {
      setTimeout(() => {
        frameRef.current = requestAnimationFrame(scanFrame);
      }, 50);
    }
  };

  const startCamera = async () => {
    if (!cameraSupported) return;

    setCameraLoading(true);
    // 1280x720 es el sweet spot: BarcodeDetector decodifica más rápido que en 1080p
    // y el S25 Ultra mantiene un enfoque excelente. Resoluciones mayores ralentizan.
    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: { ideal: 'environment' },
        width: { ideal: 1280 },
        height: { ideal: 720 },
        frameRate: { ideal: 30 },
      },
      audio: false,
    }).catch(() => null);

    if (!stream) {
      setCameraLoading(false);
      setCameraOpen(false);
      toast.error('No se pudo abrir la cámara');
      return;
    }

    streamRef.current = stream;
    scanAttemptsRef.current = 0;
    lastCodeRef.current = '';
    lastDetectedAtRef.current = 0;
    recentCodesRef.current = new Map();

    // Aplica capacidades avanzadas si el dispositivo las soporta (S25 Ultra sí):
    // enfoque continuo, exposición automática y modo macro/zoom suave para códigos pequeños.
    try {
      const track = stream.getVideoTracks?.()[0];
      const caps = track?.getCapabilities?.() || {};
      const advanced = [];
      if (caps.focusMode?.includes('continuous')) advanced.push({ focusMode: 'continuous' });
      if (caps.exposureMode?.includes('continuous')) advanced.push({ exposureMode: 'continuous' });
      if (caps.whiteBalanceMode?.includes('continuous')) advanced.push({ whiteBalanceMode: 'continuous' });
      // Zoom ligero ayuda a leer códigos pequeños sin perder enfoque
      if (caps.zoom && Number.isFinite(caps.zoom.min) && Number.isFinite(caps.zoom.max)) {
        const targetZoom = Math.min(caps.zoom.max, Math.max(caps.zoom.min, 1.5));
        advanced.push({ zoom: targetZoom });
      }
      if (advanced.length) await track.applyConstraints({ advanced }).catch(() => null);
    } catch (_) {}

    if (nativeBarcodeSupported) {
      // Lista priorizada: code_128 y EAN-13 son los más comunes en logística.
      // Menos formatos = decodificación más rápida.
      detectorRef.current = new window.BarcodeDetector({
        formats: ['code_128', 'ean_13', 'code_39', 'qr_code', 'ean_8', 'upc_a', 'upc_e', 'itf', 'data_matrix'],
      });
    }

    if (videoRef.current) {
      videoRef.current.srcObject = stream;
      await videoRef.current.play().catch(() => null);
    }

    activeRef.current = true;
    setCameraLoading(false);
    scanFrame();
  };

  useEffect(() => {
    if (cameraOpen) {
      startCamera();
    } else {
      stopCamera();
    }

    return () => stopCamera();
  }, [cameraOpen]);

  useEffect(() => {
    if (autoStartCamera && cameraSupported) {
      setCameraOpen(true);
    }
    // Auto-focus the input so USB barcode scanners work immediately
    if (autoStartCamera && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [autoStartCamera, cameraSupported]);

  const currentValue = value !== undefined ? value : scanValue;

  const updateValue = (nextValue) => {
    if (onValueChange) {
      onValueChange(nextValue);
    } else {
      setScanValue(nextValue);
    }
  };

  const submitScan = () => {
    const nextCode = normalizeCode(currentValue);
    if (!nextCode) return;
    handleDetected(nextCode);
  };

  return (
    <>
      <Card className="shadow-sm border-dashed">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <ScanLine className="h-4 w-4" />
            {title}
          </CardTitle>
          <p className="text-sm text-slate-500">{description}</p>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Cámara inline — se despliega arriba del campo de entrada dentro de la misma tarjeta */}
          {cameraOpen && (
            <div className="space-y-2">
              <div className="relative overflow-hidden rounded-xl border bg-black">
                <video ref={videoRef} autoPlay playsInline muted className="aspect-video w-full object-cover" />
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-6">
                  <div className="h-28 w-full max-w-md rounded-2xl border-2 border-dashed border-white/80 bg-white/10" />
                </div>
                {cameraLoading && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/60 text-white">
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Activando cámara...
                  </div>
                )}
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setCameraOpen(false)}
                  className="absolute right-2 top-2 h-8 gap-1 bg-black/60 text-white hover:bg-black/80"
                >
                  <X className="h-3.5 w-3.5" /> Cerrar cámara
                </Button>
              </div>
              <p className="text-xs text-slate-500">
                {nativeBarcodeSupported
                  ? 'Escaneo automático. No necesita estar perfectamente recto.'
                  : 'Sin lector nativo en este navegador. Usa la lectora USB o escribe el código manualmente.'}
              </p>
            </div>
          )}

          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <div className="relative w-full lg:max-w-xl xl:max-w-2xl">
              <Keyboard className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                ref={inputRef}
                value={currentValue}
                onChange={(e) => updateValue(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && submitScan()}
                placeholder={placeholder}
                className={`pl-10 ${inputClassName}`.trim()}
                autoFocus={autoStartCamera}
              />
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap lg:flex-nowrap lg:items-center">
              <Button variant="outline" onClick={submitScan} disabled={!normalizeCode(currentValue)}>
                {actionLabel}
              </Button>
              <Button variant="outline" onClick={() => setCameraOpen(true)} disabled={!cameraSupported}>
                <Camera className="mr-2 h-4 w-4" />
                {cameraLabel}
              </Button>
              {extraAction}
            </div>
          </div>
          {!nativeBarcodeSupported && cameraSupported && (
            <p className="text-xs text-amber-600">Tu navegador no soporta lectura nativa de códigos. Usa la lectora USB o escribe el código manualmente.</p>
          )}
          <p className="text-xs text-slate-500">
            La lectora USB funciona escribiendo el código en este campo y enviándolo con Enter.
          </p>
          {!cameraSupported && (
            <p className="text-xs text-amber-600">
              La cámara no está disponible en este navegador, pero la lectora USB sigue funcionando.
            </p>
          )}
        </CardContent>
      </Card>
    </>
  );
}