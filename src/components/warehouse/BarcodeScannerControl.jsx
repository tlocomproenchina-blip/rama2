import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Camera, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

const CAMERA_FORMATS = ['code_128', 'code_39', 'ean_13', 'ean_8', 'upc_a', 'upc_e', 'codabar', 'itf', 'qr_code'];

export default function BarcodeScannerControl({
  value,
  onChange,
  onSubmit,
  placeholder = 'Escanea o escribe el código',
  buttonLabel = 'Procesar',
  helperText,
  submitDisabled = false,
  className,
}) {
  const [open, setOpen] = useState(false);
  const [cameraLoading, setCameraLoading] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const detectorRef = useRef(null);

  const stopCamera = useCallback(() => {
    const tracks = streamRef.current?.getTracks?.() || [];
    tracks.forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  const handleDetected = useCallback((code) => {
    const cleaned = code?.trim();
    if (!cleaned) return;
    onChange?.(cleaned);
    onSubmit?.(cleaned);
    setOpen(false);
  }, [onChange, onSubmit]);

  useEffect(() => () => stopCamera(), [stopCamera]);

  useEffect(() => {
    if (!open) {
      stopCamera();
      return;
    }

    if (!window.BarcodeDetector) {
      setCameraError('Tu navegador no permite lectura por cámara aquí. Puedes usar la lectora o escribir el código.');
      return;
    }

    setCameraError('');
    setCameraLoading(true);
    detectorRef.current = new window.BarcodeDetector({ formats: CAMERA_FORMATS });

    navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: 'environment' } },
      audio: false,
    }).then((stream) => {
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
      setCameraLoading(false);
    }).catch(() => {
      setCameraError('No se pudo abrir la cámara del dispositivo.');
      setCameraLoading(false);
    });

    return stopCamera;
  }, [open, stopCamera]);

  useEffect(() => {
    if (!open || !detectorRef.current || !videoRef.current) return;

    const interval = setInterval(() => {
      const video = videoRef.current;
      if (!video || video.readyState < 2) return;

      Promise.resolve(detectorRef.current.detect(video)).then((codes) => {
        const code = codes?.[0]?.rawValue;
        if (code) handleDetected(code);
      }).catch(() => null);
    }, 450);

    return () => clearInterval(interval);
  }, [open, handleDetected]);

  return (
    <>
      <div className={cn('space-y-2', className)}>
        <div className="flex flex-col gap-3 md:flex-row">
          <Input
            value={value}
            onChange={(e) => onChange?.(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && onSubmit?.(value)}
            placeholder={placeholder}
            className="flex-1"
          />
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(true)} className="shrink-0">
              <Camera className="h-4 w-4 mr-2" /> Cámara
            </Button>
            <Button
              type="button"
              onClick={() => onSubmit?.(value)}
              disabled={submitDisabled || !value?.trim()}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {buttonLabel}
            </Button>
          </div>
        </div>
        {helperText ? <p className="text-xs text-slate-500">{helperText}</p> : null}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          className="sm:max-w-xl"
          onPointerDownOutside={(e) => e.preventDefault()}
          onInteractOutside={(e) => e.preventDefault()}
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle>Escanear código</DialogTitle>
            <DialogDescription>Apunta la cámara al código de barras para capturarlo automáticamente.</DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="overflow-hidden rounded-xl border bg-black">
              <video ref={videoRef} autoPlay playsInline muted className="aspect-video w-full object-cover" />
            </div>

            {cameraLoading ? (
              <div className="flex items-center gap-2 text-sm text-slate-500">
                <Loader2 className="h-4 w-4 animate-spin" /> Iniciando cámara...
              </div>
            ) : null}

            {cameraError ? (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
                {cameraError}
              </div>
            ) : null}

            <p className="text-xs text-slate-500">
              Si tienes una lectora USB, también puedes escanear directo sobre el campo de texto.
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}