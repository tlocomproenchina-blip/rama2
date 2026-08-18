import React, { useState } from 'react';
import { Upload, X, Link as LinkIcon, Clipboard, Loader2, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { uploadImageNoCredits } from '@/lib/imgbbUpload';

export default function QuoteProductForm({ items, onChange }) {
  const [uploadingIdx, setUploadingIdx] = useState(null);
  const [uploadError, setUploadError] = useState('');

  const updateItem = (idx, field, value) => {
    const next = [...items];
    next[idx] = { ...next[idx], [field]: value };
    onChange(next);
  };

  const addItem = () => {
    onChange([...items, { link: '', quantity: 1, image_url: '', size: '' }]);
  };

  const removeItem = (idx) => {
    onChange(items.filter((_, i) => i !== idx));
  };

  const handleImageUpload = async (idx, file) => {
    if (!file) return;
    setUploadingIdx(idx);
    setUploadError('');
    try {
      const url = await uploadImageNoCredits(file);
      updateItem(idx, 'image_url', url);
    } catch (err) {
      setUploadError('No se pudo subir la imagen');
    } finally {
      setUploadingIdx(null);
    }
  };

  const handlePaste = async (idx) => {
    try {
      const clipboardItems = await navigator.clipboard.read();
      for (const item of clipboardItems) {
        for (const type of item.types) {
          if (type.startsWith('image/')) {
            const blob = await item.getType(type);
            const file = new File([blob], `pasted-${Date.now()}.png`, { type });
            await handleImageUpload(idx, file);
            return;
          }
        }
      }
      setUploadError('No hay imagen en el portapapeles');
    } catch (err) {
      setUploadError('No se pudo acceder al portapapeles');
    }
  };

  return (
    <div className="space-y-4">
      {items.length === 0 && (
        <p className="text-sm text-gray-400 text-center py-4">Agrega al menos un producto</p>
      )}
      {items.map((item, idx) => (
        <div key={idx} className="relative rounded-xl border border-gray-200 bg-gray-50 p-4">
          <button
            type="button"
            onClick={() => removeItem(idx)}
            className="absolute right-3 top-3 text-red-500 hover:text-red-700"
          >
            <X className="h-4 w-4" />
          </button>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-semibold text-gray-600">Enlace del producto *</label>
              <div className="relative">
                <LinkIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <Input
                  type="url"
                  placeholder="https://..."
                  value={item.link || ''}
                  onChange={(e) => updateItem(idx, 'link', e.target.value)}
                  className="pl-10 pr-10"
                />
                {item.link && (
                  <a
                    href={item.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-blue-600 hover:text-blue-800"
                    title="Ir al enlace"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </a>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs font-semibold text-gray-600">Cantidad *</label>
                <Input
                  type="number"
                  min="1"
                  value={item.quantity || 1}
                  onChange={(e) => updateItem(idx, 'quantity', Number(e.target.value))}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-gray-600">Talla / Variante</label>
                <Input
                  type="text"
                  placeholder="Ej: L, Rojo"
                  value={item.size || ''}
                  onChange={(e) => updateItem(idx, 'size', e.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="mt-3">
            <label className="mb-1 block text-xs font-semibold text-gray-600">Imagen del artículo</label>
            <div className="flex flex-wrap items-center gap-2">
              <label className="cursor-pointer">
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => handleImageUpload(idx, e.target.files?.[0])}
                />
                <span className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 whitespace-nowrap">
                  <Upload className="h-4 w-4" /> Subir imagen
                </span>
              </label>
              <button
                type="button"
                onClick={() => handlePaste(idx)}
                disabled={uploadingIdx === idx}
                className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 whitespace-nowrap disabled:opacity-50"
              >
                <Clipboard className="h-4 w-4" /> Pegar imagen
              </button>
              {uploadingIdx === idx && (
                <span className="inline-flex items-center gap-1 text-xs text-purple-600">
                  <Loader2 className="h-3 w-3 animate-spin" /> Subiendo...
                </span>
              )}
              {item.image_url && uploadingIdx !== idx && (
                <img src={item.image_url} alt="producto" className="h-12 w-12 rounded-lg object-cover" />
              )}
            </div>
            {uploadError && <p className="mt-1 text-xs text-red-500">{uploadError}</p>}
          </div>
        </div>
      ))}

      <Button type="button" variant="outline" onClick={addItem} className="w-full">
        + Agregar otro producto
      </Button>
    </div>
  );
}