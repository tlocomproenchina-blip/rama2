import React, { useState } from 'react';
import { base44 } from '@/components/api/ApiQueueManager';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Search } from 'lucide-react';
import ContainerSearchResults from './ContainerSearchResults';

// Buscador independiente de contenedores: se escribe el N° de contenedor
// (el N° de orden/envío con el que se facturó la carga) y se puede acotar por
// estado de factura. Los resultados se agrupan por cliente.
const ALL = 'todas';

const STATUS_OPTIONS = [
  { value: ALL, label: 'Todas las facturas' },
  { value: 'pendiente', label: 'Pendientes' },
  { value: 'revision', label: 'En revisión' },
  { value: 'pagada', label: 'Pagadas' },
  { value: 'vencida', label: 'Vencidas' },
  { value: 'cancelada', label: 'Canceladas' },
];

const errorText = (error) => {
  const data = error?.response?.data || error?.data;
  return data?.error || error?.message || 'No se pudo buscar el contenedor';
};

export default function ContainerSearchPanel() {
  const [number, setNumber] = useState('');
  const [status, setStatus] = useState(ALL);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  const search = async (event) => {
    event?.preventDefault?.();
    const container = number.trim();
    if (!container) return;
    setLoading(true);
    setError('');
    try {
      const res = await base44.functions.invoke('searchContainer', {
        container_number: container,
        invoice_status: status === ALL ? '' : status,
      });
      setResult(res?.data || res || null);
    } catch (err) {
      setResult(null);
      setError(errorText(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="border-slate-200">
      <CardContent className="space-y-4 p-4 sm:p-5">
        <form onSubmit={search} className="flex flex-col gap-2 sm:flex-row">
          <Input
            value={number}
            onChange={(event) => setNumber(event.target.value)}
            placeholder="N° de contenedor (ej: 128)"
            inputMode="text"
            className="sm:max-w-xs"
          />
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="sm:w-52">
              <SelectValue placeholder="Estado de factura" />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button type="submit" disabled={loading || !number.trim()} className="gap-2">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            Buscar
          </Button>
        </form>

        {error && (
          <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>
        )}

        {result && !error && <ContainerSearchResults result={result} />}
      </CardContent>
    </Card>
  );
}