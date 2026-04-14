import React, { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Camera, Keyboard, Loader2, ScanLine } from 'lucide-react';
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
}) {
  const [scanValue, setScanValue] = useState('');
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraLoading, setCameraLoading] = useState(false);
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const detectorRef = useRef(null);
  const frameRef = useRef(null);
  const activeRef = useRef(false);

  const cameraSupported = typeof window !== 'undefined' && 'BarcodeDetector' in window && !!navigator?.mediaDevices?.getUserMedia;

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

  const scanFrame = async () => {
    if (!activeRef.current || !videoRef.current || !detectorRef.current) return;

    if (videoRef.current.readyState >= 2) {
      const detected = await detectorRef.current.detect(videoRef.current).catch(() => []);
      const code = normalizeCode(detected?.[0]?.rawValue || '');
      if (code) {
        handleDetected(code);
        toast.success('Código detectado');
        setCameraOpen(false);
        stopCamera();
        return;
      }
    }

    frameRef.current = requestAnimationFrame(scanFrame);
  };

  const startCamera = async () => {
    if (!cameraSupported) return;

    setCameraLoading(true);
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: 'environment' } },
      audio: false,
    }).catch(() => null);

    if (!stream) {
      setCameraLoading(false);
      setCameraOpen(false);
      toast.error('No se pudo abrir la cámara');
      return;
    }

    streamRef.current = stream;
    detectorRef.current = new window.BarcodeDetector({
      formats: ['code_128', 'code_39', 'ean_13', 'ean_8', 'upc_a', 'upc_e', 'itf', 'qr_code'],
    });

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
                value={currentValue}
                onChange={(e) => updateValue(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && submitScan()}
                placeholder={placeholder}
                className={`pl-10 ${inputClassName}`.trim()}
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
              {extraAction}
            </div>
          </div>
          <p className="text-xs text-slate-500">
            La lectora USB funciona escribiendo el código en este campo y enviándolo con Enter.
          </p>
          {!cameraSupported && (
            <p className="text-xs text-amber-600">
              La cámara no está disponible en este navegador, pero la lectora sigue funcionando.
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
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}