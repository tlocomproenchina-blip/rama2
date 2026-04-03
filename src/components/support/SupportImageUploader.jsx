import React from 'react';
import { Button } from '@/components/ui/button';
import { Upload, X } from 'lucide-react';

export default function SupportImageUploader({ files, onChange, disabled, maxFiles = 3 }) {
  const handleSelect = (event) => {
    const selectedFiles = Array.from(event.target.files || []).slice(0, maxFiles);
    onChange(selectedFiles);
    event.target.value = '';
  };

  return (
    <div className="space-y-3">
      <label className="block">
        <input
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={handleSelect}
          disabled={disabled}
        />
        <div className="flex min-h-[48px] cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-border/80 bg-slate-50 px-4 py-3 text-sm text-slate-600 hover:bg-slate-100">
          <Upload className="h-4 w-4" />
          <span>Agregar hasta {maxFiles} foto{maxFiles === 1 ? '' : 's'}</span>
        </div>
      </label>
      {files.length > 0 && (
        <div className="grid gap-2 sm:grid-cols-3">
          {files.map((file, index) => (
            <div key={`${file.name}-${index}`} className="flex items-center justify-between rounded-xl border bg-white px-3 py-2 text-xs text-slate-600">
              <span className="truncate pr-2">{file.name}</span>
              <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => onChange(files.filter((_, fileIndex) => fileIndex !== index))}>
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}