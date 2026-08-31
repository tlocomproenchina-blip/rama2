import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import { Upload, ChevronDown, Plus, Trash2, Loader2, Package } from 'lucide-react';
import { uploadImageNoCredits } from '@/lib/imgbbUpload';
import { toast } from 'sonner';

export default function ShippingMarkExamplesEditor({ examples, onChange, onSave, saving }) {
  const list = Array.isArray(examples) ? examples : [];
  const [openIndex, setOpenIndex] = useState(null);
  const [uploadingIndex, setUploadingIndex] = useState(null);

  const update = (index, patch) => {
    const next = list.map((item, i) => (i === index ? { ...item, ...patch } : item));
    onChange(next);
  };

  const addExample = () => {
    const newItem = { title: '', image_url: '', description: '' };
    onChange([...list, newItem]);
    setOpenIndex(list.length);
  };

  const removeExample = (index) => {
    onChange(list.filter((_, i) => i !== index));
    setOpenIndex(null);
  };

  const handleUpload = async (index, file) => {
    if (!file) return;
    setUploadingIndex(index);
    try {
      const file_url = await uploadImageNoCredits(file);
      update(index, { image_url: file_url });
      toast.success('Imagen subida');
    } catch (error) {
      toast.error('Error al subir imagen');
    }
    setUploadingIndex(null);
  };

  return (
    <Card className="rounded-2xl border-0 shadow-lg">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Package className="h-5 w-5 text-slate-600" />
          Ejemplos de Shipping Mark por plataforma
        </CardTitle>
        <CardDescription>
          Crea ejemplos desplegables por plataforma (Pinduoduo, 1688, Taobao, Alibaba, Tmall, etc.). Cada ejemplo se muestra al cliente como una sección colapsable.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 p-4 md:space-y-4 md:p-6">
        {list.length === 0 && (
          <div className="text-center py-8 text-slate-500 text-sm border border-dashed border-slate-200 rounded-xl">
            No hay ejemplos por plataforma. Toca "Agregar ejemplo" para crear el primero.
          </div>
        )}

        {list.map((item, index) => (
          <Collapsible
            key={index}
            open={openIndex === index}
            onOpenChange={(open) => setOpenIndex(open ? index : null)}
            className="border border-slate-200 rounded-xl bg-slate-50/60"
          >
            <CollapsibleTrigger asChild>
              <button
                type="button"
                className="flex items-center justify-between w-full p-4 text-left rounded-xl hover:bg-slate-100/70 transition-colors"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <Package className="h-4 w-4 text-slate-500 shrink-0" />
                  <span className="font-medium text-slate-800 truncate">
                    {item.title || `Ejemplo ${index + 1}`}
                  </span>
                  {item.image_url && (
                    <img
                      src={item.image_url}
                      alt={item.title}
                      className="h-8 w-8 object-cover rounded border border-slate-200 shrink-0"
                    />
                  )}
                </div>
                <ChevronDown
                  className={`h-4 w-4 text-slate-500 shrink-0 transition-transform ${openIndex === index ? 'rotate-180' : ''}`}
                />
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="p-4 pt-0 space-y-4">
                <div className="space-y-2">
                  <Label>Título de la plataforma</Label>
                  <Input
                    value={item.title || ''}
                    onChange={(e) => update(index, { title: e.target.value })}
                    placeholder="Ej: Pinduoduo, 1688, Taobao, Alibaba, Tmall..."
                  />
                </div>

                <div className="space-y-2">
                  <Label>Imagen de ejemplo</Label>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
                    <div className="flex-1 min-w-0">
                      <label className="block">
                        <div className="flex items-center gap-2 px-4 py-2 border border-slate-300 rounded-lg cursor-pointer hover:bg-slate-50 transition-colors whitespace-nowrap">
                          <Upload className="h-4 w-4 text-slate-600 shrink-0" />
                          <span className="text-sm text-slate-700 truncate">
                            {uploadingIndex === index ? 'Subiendo...' : 'Seleccionar archivo'}
                          </span>
                        </div>
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => handleUpload(index, e.target.files[0])}
                          disabled={uploadingIndex === index}
                        />
                      </label>
                      <p className="text-xs text-slate-500 mt-1">
                        {item.image_url ? 'Archivo cargado' : 'Sin archivos seleccionados'}
                      </p>
                    </div>
                    {item.image_url && (
                      <div className="flex-shrink-0 relative">
                        <img
                          src={item.image_url}
                          alt={item.title || 'Ejemplo'}
                          className="h-24 w-auto object-contain rounded border border-slate-200"
                        />
                        <button
                          type="button"
                          onClick={() => update(index, { image_url: '' })}
                          className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-white border border-slate-200 shadow-sm flex items-center justify-center text-slate-400 hover:text-red-500"
                          aria-label="Quitar imagen"
                        >
                          ×
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Descripción</Label>
                  <Textarea
                    value={item.description || ''}
                    onChange={(e) => update(index, { description: e.target.value })}
                    placeholder="Explica cómo debe quedar el shipping mark en esta plataforma..."
                    rows={3}
                  />
                </div>

                <div className="flex justify-end">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => removeExample(index)}
                    className="border-red-200 text-red-600 hover:bg-red-50"
                  >
                    <Trash2 className="h-4 w-4 mr-1" />
                    Eliminar ejemplo
                  </Button>
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>
        ))}

        <Button
          variant="outline"
          onClick={addExample}
          className="w-full border-dashed"
        >
          <Plus className="h-4 w-4 mr-2" />
          Agregar ejemplo
        </Button>

        <Button onClick={onSave} disabled={saving} className="w-full">
          {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
          Guardar ejemplos
        </Button>
      </CardContent>
    </Card>
  );
}