import React from 'react';
import { Search, SlidersHorizontal, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function PortalFilterPanel({ draft, onChange, onApply, onClear, wholesalers, loading }) {
  const set = (patch) => onChange({ ...draft, ...patch });
  const options = wholesalers || [];

  return (
    <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <div className="flex items-center gap-2">
        <SlidersHorizontal className="h-4 w-4 text-muted-foreground" />
        <h2 className="font-display text-base font-semibold text-foreground">Filtros de consulta</h2>
      </div>

      <form
        className="mt-4 space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          onApply();
        }}
      >
        <div className="space-y-1.5">
          <Label htmlFor="portal-q" className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Buscar tracking o Shipping Mark
          </Label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="portal-q"
              value={draft.q || ''}
              onChange={(event) => set({ q: event.target.value })}
              placeholder="Introduce el número de tracking o Shipping Mark"
              className="h-11 pl-9"
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Estado de recepción</Label>
            <Select value={draft.estado || 'todos'} onValueChange={(value) => set({ estado: value === 'todos' ? '' : value })}>
              <SelectTrigger className="h-11">
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="por_recibir">Por recibir</SelectItem>
                <SelectItem value="recibido">Recibido</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Foto de entrega</Label>
            <Select value={draft.foto || 'todos'} onValueChange={(value) => set({ foto: value === 'todos' ? '' : value })}>
              <SelectTrigger className="h-11">
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="con">Con foto</SelectItem>
                <SelectItem value="sin">Sin foto</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Origen del registro</Label>
            <Select value={draft.origen || 'todos'} onValueChange={(value) => set({ origen: value === 'todos' ? '' : value })}>
              <SelectTrigger className="h-11">
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="mayorista">Cliente mayorista</SelectItem>
                <SelectItem value="directo">Registro directo</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Mayorista</Label>
            <Select value={draft.wholesaler_key || 'todos'} onValueChange={(value) => set({ wholesaler_key: value === 'todos' ? '' : value })}>
              <SelectTrigger className="h-11">
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                {options.map((item) => (
                  <SelectItem key={item.key} value={item.key}>{item.name || item.key}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="portal-client" className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Cliente
            </Label>
            <Input
              id="portal-client"
              value={draft.cliente || ''}
              onChange={(event) => set({ cliente: event.target.value })}
              placeholder="Correo del cliente"
              className="h-11"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="portal-registro-desde" className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Fecha de registro desde
            </Label>
            <Input
              id="portal-registro-desde"
              type="date"
              value={draft.registro_desde || ''}
              onChange={(event) => set({ registro_desde: event.target.value })}
              className="h-11"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="portal-registro-hasta" className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Fecha de registro hasta
            </Label>
            <Input
              id="portal-registro-hasta"
              type="date"
              value={draft.registro_hasta || ''}
              onChange={(event) => set({ registro_hasta: event.target.value })}
              className="h-11"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="portal-recepcion-desde" className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Recepción desde
            </Label>
            <Input
              id="portal-recepcion-desde"
              type="date"
              value={draft.recepcion_desde || ''}
              onChange={(event) => set({ recepcion_desde: event.target.value })}
              className="h-11"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="portal-recepcion-hasta" className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Recepción hasta
            </Label>
            <Input
              id="portal-recepcion-hasta"
              type="date"
              value={draft.recepcion_hasta || ''}
              onChange={(event) => set({ recepcion_hasta: event.target.value })}
              className="h-11"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button type="submit" disabled={loading} className="h-11 bg-slate-900 px-6 text-white hover:bg-slate-800">
            {loading ? 'Consultando…' : 'Definir filtros'}
          </Button>
          <Button type="button" variant="ghost" onClick={onClear} disabled={loading} className="h-11">
            <X className="mr-1 h-4 w-4" /> Limpiar
          </Button>
        </div>
      </form>
    </section>
  );
}