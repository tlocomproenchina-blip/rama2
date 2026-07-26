import React from 'react';
import { Button } from '@/components/ui/button';
import { ImagePlus, X } from 'lucide-react';

export default function TrackingPhotoUploader({ trackingCode, files = [], onChange }) {
  const inputId = `pkg-photos-${trackingCode}`;
  return (
    <div className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2">
      <p className="flex-1 min-w-0 font-mono text-xs font-semibold text-slate-700 truncate">{trackingCode}</p>
      {files.map((f, i) => (
        <div key={i} className="relative shrink-0">
          <img src={URL.createObjectURL(f)} alt={`Foto ${i + 1}`} className="h-9 w-9 rounded-md object-cover border" />
          <button
            type="button"
            onClick={() => onChange(files.filter((_, idx) => idx !== i))}
            className="absolute -top-1.5 -right-1.5 h-4 w-4 rounded-full bg-red-500 text-white flex items-center justify-center"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      ))}
      {files.length < 3 && (
        <>
          <input
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            id={inputId}
            onChange={(e) => {
              onChange([...files, ...Array.from(e.target.files || [])].slice(0, 3));
              e.target.value = '';
            }}
          />
          <Button type="button" variant="outline" size="icon" className="h-8 w-8 shrink-0" asChild>
            <label htmlFor={inputId} className="cursor-pointer"><ImagePlus className="h-4 w-4" /></label>
          </Button>
        </>
      )}
    </div>
  );
}