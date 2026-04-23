import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Camera, Keyboard, Loader2, ScanLine, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { base44 } from '@/api/base44Client';

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

  const [aiScanning, setAiScanning] = useState(false);
  const scanAttemptsRef = useRef(0);
  const canvasRef = useRef(null);
  const lastAiAttemptRef = useRef(0);

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

  // AI fallback: send frame to LLM for barcode reading
  const tryAiFallback = useCallback(async () => {
    if (!activeRef.current || aiScanning) return;
    const now = Date.now();
    if (now - lastAiAttemptRef.current < 8000) return; // throttle: max once per 8s
    lastAiAttemptRef.current = now;

    const canvas = captureFrame(0);
    if (!canvas) return;

    setAiScanning(true);
    try {
      const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.85));
      if (!blob || !activeRef.current) { setAiScanning(false); return; }
      const file = new File([blob], 'scan.jpg', { type: 'image/jpeg' });
      const { file_url } = await base44.integrations.Core.UploadFile({ file });

      const res = await base44.integrations.Core.InvokeLLM({
        prompt: 'Lee el código de barras o QR visible en esta imagen. Busca cualquier código de barras (1D o 2D) y extrae su valor exacto. Prioriza el código de barras principal de envío. Devuelve SOLO el valor alfanumérico del código sin espacios ni guiones. Si no puedes leer ningún código, devuelve cadena vacía.',
        file_urls: [file_url],
        response_json_schema: {
          type: 'object',
          properties: {
            barcode: { type: 'string', description: 'Valor exacto del código de barras leído, vacío si no se pudo leer' }
          }
        }
      });

      const code = normalizeCode((res?.barcode || '').replace(/[^a-zA-Z0-9]/g, ''));
      if (code && code.length >= 5 && activeRef.current) {
        handleDetected(code);
        toast.success('Código detectado con IA');
        setCameraOpen(false);
        stopCamera();
        setAiScanning(false);
        return;
      }
    } catch (_) {}
    setAiScanning(false);
  }, [aiScanning]);

  const scanFrame = async () => {
    if (!activeRef.current || !videoRef.current) return;
    scanAttemptsRef.current++;

    if (videoRef.current.readyState >= 2 && nativeBarcodeSupported && detectorRef.current) {
      // Try direct frame first
      let detected = await detectorRef.current.detect(videoRef.current).catch(() => []);
      let code = normalizeCode(detected?.[0]?.rawValue || '');

      // If direct scan fails, try rotated angles for tilted barcodes
      if (!code) {
        const angles = [5, -5, 10, -10, 15, -15];
        for (const angle of angles) {
          const canvas = captureFrame(angle);
          if (!canvas) break;
          detected = await detectorRef.current.detect(canvas).catch(() => []);
          code = normalizeCode(detected?.[0]?.rawValue || '');
          if (code) break;
        }
      }

      if (code) {
        handleDetected(code);
        toast.success('Código detectado');
        setCameraOpen(false);
        stopCamera();
        return;
      }
    }

    // After ~4 seconds of failed native scanning, try AI fallback
    if (scanAttemptsRef.current > 120) { // ~4s at 30fps
      tryAiFallback();
    }

    frameRef.current = requestAnimationFrame(scanFrame);
  };

  const startCamera = async () => {
    if (!cameraSupported) return;

    setCameraLoading(true);
    // Request high resolution for better barcode reading
    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: { ideal: 'environment' },
        width: { ideal: 1920 },
        height: { ideal: 1080 },
        focusMode: { ideal: 'continuous' },
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

    if (nativeBarcodeSupported) {
      detectorRef.current = new window.BarcodeDetector({
        formats: ['code_128', 'code_39', 'ean_13', 'ean_8', 'upc_a', 'upc_e', 'itf', 'qr_code', 'data_matrix', 'aztec', 'pdf417'],
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
            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap lg:flex-nowrap">
              <Button variant="outline" onClick={submitScan} disabled={!normalizeCode(currentValue)}>
                {actionLabel}
              </Button>
              <Button variant="outline" onClick={() => setCameraOpen(true)} disabled={!cameraSupported}>
                <Camera className="mr-2 h-4 w-4" />
                {cameraLabel}
              </Button>
              {!nativeBarcodeSupported && cameraSupported && (
                <span className="text-xs text-amber-600 self-center">Modo IA (sin lector nativo)</span>
              )}
              {extraAction}
            </div>
          </div>
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

      <Dialog open={cameraOpen} onOpenChange={setCameraOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Escanear con cámara</DialogTitle>
            <DialogDescription>
              Enfoca el código de barras dentro del recuadro para capturarlo automáticamente.
            </DialogDescription>
          </DialogHeader>
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
            {aiScanning && (
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-2 rounded-full bg-blue-600/90 px-4 py-2 text-white text-sm shadow-lg">
                <Sparkles className="h-4 w-4 animate-pulse" />
                Analizando con IA...
              </div>
            )}
          </div>
          <div className="flex items-center justify-between mt-2">
            <p className="text-xs text-slate-500">
              {nativeBarcodeSupported
                ? 'Escaneo automático + IA si no detecta en 4s. No necesita estar perfectamente recto.'
                : 'Sin lector nativo en este navegador. Usando IA para detectar códigos.'}
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => tryAiFallback()}
              disabled={aiScanning || !activeRef.current}
              className="gap-1 shrink-0"
            >
              <Sparkles className="h-3.5 w-3.5" />
              {aiScanning ? 'Analizando...' : 'Leer con IA'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}