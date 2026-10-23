import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Camera, Keyboard, Loader2, ScanLine, X } from 'lucide-react';
import { toast } from 'sonner';
import { normalizeScannedCode as normalizeCode } from '@/lib/codeScan';

export default function BarcodeScannerModule({
  title = 'Escaneo de códigos',
  description = 'Usa la cámara o una lectora para capturar el tracking rápidamente.',
  placeholder = 'Escanea o escribe el código',
  actionLabel = 'Procesar código',
  cameraLabel = 'Usar cámara',
  onDetected,
  onPhotoCaptured,
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
  const [detectorReady, setDetectorReady] = useState(null);
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

  // Recorta la franja central que ve el usuario y la amplía. Los códigos finos o
  // lejanos (barras pequeñas, QR impresos chicos) se leen mucho mejor así que
  // sobre el fotograma completo.
  const captureCenterCrop = useCallback((scale = 2) => {
    const video = videoRef.current;
    if (!video || video.readyState < 2) return null;
    const w = video.videoWidth;
    const h = video.videoHeight;
    if (!w || !h) return null;

    const sx = Math.round(w * 0.08);
    const sw = Math.round(w * 0.84);
    const sy = Math.round(h * 0.28);
    const sh = Math.round(h * 0.44);

    const canvas = document.createElement('canvas');
    canvas.width = Math.min(1800, Math.round(sw * scale));
    canvas.height = Math.round((canvas.width / sw) * sh);
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(video, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
    return canvas;
  }, []);

  // Foto del paquete en el instante en que se detecta el código: se entrega al
  // consumidor para que la suba y la guarde junto con la recepción.
  const emitPhoto = (code) => {
    if (!onPhotoCaptured) return;
    try {
      const canvas = captureFrame();
      if (!canvas) return;
      const base64 = canvas.toDataURL('image/jpeg', 0.85).split(',')[1];
      if (base64) onPhotoCaptured(code, base64);
    } catch (_) {}
  };

  // Lee todos los códigos de un fotograma: un mismo cuadro puede traer la
  // etiqueta y el QR nuevo a la vez, así que no se mira solo el primero.
  const detectFrom = async (source) => {
    if (!detectorRef.current || !source) return '';
    const found = await detectorRef.current.detect(source).catch(() => []);
    for (const item of found || []) {
      const value = normalizeCode(item?.rawValue || '');
      if (value) return value;
    }
    return '';
  };

  const scanFrame = async () => {
    if (!activeRef.current || !videoRef.current) return;
    scanAttemptsRef.current++;

    const video = videoRef.current;
    if (video.readyState >= 2) {
      // Lectura directa sobre el video en vivo — la ruta más rápida.
      let code = await detectFrom(video);

      // Si aún no hay lectura, se recorta y amplía la franja central donde el
      // usuario ubica el código.
      if (!code && scanAttemptsRef.current > 2) {
        const crop = captureCenterCrop();
        if (crop) code = await detectFrom(crop);
      }

      // Última opción: fotogramas ligeramente rotados (código torcido o de lado).
      if (!code && scanAttemptsRef.current > 6 && scanAttemptsRef.current % 4 === 0) {
        for (const angle of [10, -10, 20, -20]) {
          if (!activeRef.current) return;
          const canvas = captureFrame(angle);
          if (!canvas) break;
          code = await detectFrom(canvas);
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
            emitPhoto(code);
            handleDetected(code);
            toast.success(`Código agregado: ${code}`);
            playBeep();
            if (navigator.vibrate) navigator.vibrate(100);
            // Pausa breve antes de seguir escaneando el siguiente código (800ms vs 1200ms anterior)
            await new Promise((resolve) => setTimeout(resolve, 800));
          }
        } else {
          emitPhoto(code);
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
      // Solo se piden los formatos que este navegador realmente soporta: si se
      // incluye uno desconocido el detector falla al crearse y deja de leer todo,
      // tanto códigos de barras como QR. code_128, EAN y qr_code van primero.
      const wished = [
        'code_128', 'qr_code', 'ean_13', 'code_39', 'ean_8', 'upc_a', 'upc_e',
        'itf', 'code_93', 'codabar', 'data_matrix', 'pdf417', 'aztec',
      ];
      let formats = wished;
      try {
        const supported = await window.BarcodeDetector.getSupportedFormats?.();
        if (Array.isArray(supported) && supported.length) {
          formats = wished.filter((format) => supported.includes(format));
        }
      } catch (_) {}
      try {
        detectorRef.current = formats.length
          ? new window.BarcodeDetector({ formats })
          : new window.BarcodeDetector();
      } catch (_) {
        try {
          detectorRef.current = new window.BarcodeDetector();
        } catch (_) {
          detectorRef.current = null;
        }
      }
      setDetectorReady(!!detectorRef.current);
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
          {description ? <p className="text-sm text-slate-500">{description}</p> : null}
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
              <p className={`text-xs ${detectorReady === false ? 'text-amber-600' : 'text-slate-500'}`}>
                {detectorReady === false
                  ? 'No se pudo activar el lector de códigos en este navegador. Usa la lectora USB o escribe el código.'
                  : 'Lee código de barras y QR automáticamente. Acércalo y evita el reflejo si no toma la lectura.'}
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