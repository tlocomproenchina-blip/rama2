import React from 'react';
import { Trash2, Plus, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatCurrency, calcItemTotals } from '@/lib/quoteUtils';
import QuoteImageUploader from './QuoteImageUploader';
import PriceInput from './PriceInput';

export default function QuoteProductTable({ items, servicePercentage, conversionRate, onChange, readOnly, showPricing }) {
  const updateItem = (idx, field, value) => {
    const next = [...items];
    next[idx] = { ...next[idx], [field]: value };
    if (showPricing && (field === 'unit_price' || field === 'quantity' || field === 'currency')) {
      const totals = calcItemTotals(next[idx], servicePercentage, conversionRate);
      next[idx] = { ...next[idx], ...totals };
    }
    onChange(next);
  };

  const addItem = () => {
    onChange([...items, { link: '', quantity: 1, image_url: '', size: '', unit_price: 0, currency: 'CNY', subtotal: 0, service_amount: 0, total: 0, total_usd: 0 }]);
  };

  const removeItem = (idx) => {
    onChange(items.filter((_, i) => i !== idx));
  };

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-bold" style={{ color: '#c52899' }}>Productos</h3>
        {!readOnly && (
          <Button type="button" size="sm" onClick={addItem} style={{ backgroundColor: '#8b5cf6' }} className="text-white hover:opacity-90">
            <Plus className="h-4 w-4" /> Agregar Producto
          </Button>
        )}
      </div>

      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs uppercase text-gray-500">
            <tr>
              <th className="px-2 py-2 text-left">Cant.</th>
              <th className="px-2 py-2 text-left">Enlace del Producto</th>
              <th className="px-2 py-2 text-left">Imagen</th>
              <th className="px-2 py-2 text-left">Talla</th>
              {showPricing && <th className="px-2 py-2 text-left">Precio Unit.</th>}
              {showPricing && <th className="px-2 py-2 text-left">Moneda</th>}
              {showPricing && <th className="px-2 py-2 text-right">Subtotal</th>}
              {showPricing && <th className="px-2 py-2 text-right">Servicio {servicePercentage}%</th>}
              {showPricing && <th className="px-2 py-2 text-right">Total</th>}
              {showPricing && <th className="px-2 py-2 text-right">Total ($)</th>}
              {!readOnly && <th className="px-2 py-2"></th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {items.length === 0 && (
              <tr><td colSpan={12} className="px-3 py-6 text-center text-gray-400">No hay productos agregados</td></tr>
            )}
            {items.map((item, idx) => {
              const sym = item.currency === 'USD' ? '$' : '¥';
              return (
                <tr key={idx} className="align-top">
                  <td className="px-2 py-2">
                    <Input
                      type="number"
                      min="1"
                      value={item.quantity || 0}
                      readOnly={readOnly}
                      onChange={(e) => updateItem(idx, 'quantity', Number(e.target.value))}
                      className="w-16 h-9"
                    />
                  </td>
                  <td className="px-2 py-2">
                    <div className="flex items-center gap-1">
                      <Input
                        type="url"
                        placeholder="https://..."
                        value={item.link || ''}
                        readOnly={readOnly}
                        onChange={(e) => updateItem(idx, 'link', e.target.value)}
                        className="min-w-[180px] h-9"
                      />
                      {item.link && (
                        <a
                          href={item.link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="shrink-0 text-blue-600 hover:text-blue-800"
                          title="Ir al enlace"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      )}
                    </div>
                  </td>
                  <td className="px-2 py-2">
                    <QuoteImageUploader
                      imageUrl={item.image_url}
                      onChange={(url) => updateItem(idx, 'image_url', url)}
                      disabled={readOnly}
                    />
                  </td>
                  <td className="px-2 py-2">
                    <Input
                      type="text"
                      placeholder="Talla"
                      value={item.size || ''}
                      readOnly={readOnly}
                      onChange={(e) => updateItem(idx, 'size', e.target.value)}
                      className="w-20 h-9"
                    />
                  </td>
                  {showPricing && (
                    <td className="px-2 py-2">
                      <PriceInput
                        value={item.unit_price}
                        readOnly={readOnly}
                        onChange={(v) => updateItem(idx, 'unit_price', v)}
                        className="w-24 h-9"
                      />
                    </td>
                  )}
                  {showPricing && (
                    <td className="px-2 py-2">
                      <Select
                        value={item.currency || 'CNY'}
                        onValueChange={(v) => updateItem(idx, 'currency', v)}
                        disabled={readOnly}
                      >
                        <SelectTrigger className="w-20 h-9"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="CNY">¥ CNY</SelectItem>
                          <SelectItem value="USD">$ USD</SelectItem>
                        </SelectContent>
                      </Select>
                    </td>
                  )}
                  {showPricing && <td className="px-2 py-2 text-right font-medium">{sym}{(item.subtotal || 0).toFixed(2)}</td>}
                  {showPricing && <td className="px-2 py-2 text-right font-medium">{sym}{(item.service_amount || 0).toFixed(2)}</td>}
                  {showPricing && <td className="px-2 py-2 text-right font-bold">{sym}{(item.total || 0).toFixed(2)}</td>}
                  {showPricing && <td className="px-2 py-2 text-right font-bold" style={{ color: '#10b981' }}>${(item.total_usd || 0).toFixed(2)}</td>}
                  {!readOnly && (
                    <td className="px-2 py-2">
                      <button type="button" onClick={() => removeItem(idx)} className="text-red-500 hover:text-red-700">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}