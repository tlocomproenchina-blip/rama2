import React, { useEffect, useMemo, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Loader2, Plus, Save, Trash2, RefreshCcw } from 'lucide-react';

export default function AdminProviders() {
  const [loading, setLoading] = useState(true);
  const [providers, setProviders] = useState([]);
  const [editing, setEditing] = useState(null);

  const empty = {
    name: '',
    mode: 'maritimo',
    is_default_for_mode: false,
    is_active: true,
    base_rate_regular: '',
    base_rate_high_risk: '',
    door_to_door_cost: '',
    consolidation_fee_percentage: '',
    per_tracking_regular: 1,
    per_tracking_high: 1,
    state_overrides: [],
    account_code: '501-01 Fletes',
    cost_center: 'Operaciones'
  };

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    try {
      const list = await base44.entities.ShippingProvider.list('-created_date', 200);
      setProviders(list);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  const startCreate = () => setEditing({ ...empty });
  const startEdit = (p) => setEditing({ ...p });
  const cancel = () => setEditing(null);

  const save = async () => {
    const data = { ...editing };
    // Coerce numbers
    ['base_rate_regular','base_rate_high_risk','door_to_door_cost','consolidation_fee_percentage','per_tracking_regular','per_tracking_high'].forEach(k => {
      if (data[k] !== '' && data[k] !== undefined) data[k] = Number(data[k]);
    });

    if (data.is_default_for_mode && data.mode === 'maritimo') {
      // Unset others as default
      const others = providers.filter(p => p.mode === 'maritimo' && p.id !== data.id && p.is_default_for_mode);
      await Promise.all(others.map(p => base44.entities.ShippingProvider.update(p.id, { is_default_for_mode: false })));
    }

    if (data.id) {
      await base44.entities.ShippingProvider.update(data.id, data);
    } else {
      await base44.entities.ShippingProvider.create(data);
    }
    setEditing(null);
    await load();
  };

  const remove = async (id) => {
    await base44.entities.ShippingProvider.delete(id);
    await load();
  };

  const addOverride = () => {
    setEditing(prev => ({ ...prev, state_overrides: [...(prev.state_overrides||[]), { state_code: '', shipping_rate: '' }] }));
  };

  const updateOverride = (idx, field, value) => {
    setEditing(prev => {
      const arr = [...(prev.state_overrides||[])];
      arr[idx] = { ...arr[idx], [field]: field === 'shipping_rate' ? value.replace(',', '.') : value };
      return { ...prev, state_overrides: arr };
    });
  };

  const removeOverride = (idx) => {
    setEditing(prev => {
      const arr = [...(prev.state_overrides||[])];
      arr.splice(idx,1);
      return { ...prev, state_overrides: arr };
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-800">Proveedores (Marítimo)</h1>
          <p className="text-slate-500">Configura proveedor por defecto, tarifas y overrides por estado</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={load}><RefreshCcw className="h-4 w-4 mr-2"/>Refrescar</Button>
          <Button onClick={startCreate}><Plus className="h-4 w-4 mr-2"/>Nuevo</Button>
        </div>
      </div>

      {editing && (
        <Card>
          <CardHeader>
            <CardTitle>{editing.id ? 'Editar Proveedor' : 'Nuevo Proveedor'}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label>Nombre</Label>
                <Input value={editing.name} onChange={e => setEditing({ ...editing, name: e.target.value })} />
              </div>
              <div>
                <Label>Modo</Label>
                <Input value={editing.mode} disabled />
              </div>
              <div className="flex items-end gap-3">
                <div>
                  <Label>Predeterminado (marítimo)</Label>
                  <div className="mt-2"><Switch checked={!!editing.is_default_for_mode} onCheckedChange={v => setEditing({ ...editing, is_default_for_mode: v })} /></div>
                </div>
                <div>
                  <Label>Activo</Label>
                  <div className="mt-2"><Switch checked={!!editing.is_active} onCheckedChange={v => setEditing({ ...editing, is_active: v })} /></div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <Label>Base Regular</Label>
                <Input type="number" step="0.01" value={editing.base_rate_regular} onChange={e => setEditing({ ...editing, base_rate_regular: e.target.value })} />
              </div>
              <div>
                <Label>Base Alto Riesgo</Label>
                <Input type="number" step="0.01" value={editing.base_rate_high_risk} onChange={e => setEditing({ ...editing, base_rate_high_risk: e.target.value })} />
              </div>
              <div>
                <Label>Puerta a Puerta</Label>
                <Input type="number" step="0.01" value={editing.door_to_door_cost} onChange={e => setEditing({ ...editing, door_to_door_cost: e.target.value })} />
              </div>
              <div>
                <Label>% Consolidación</Label>
                <Input type="number" step="0.01" value={editing.consolidation_fee_percentage} onChange={e => setEditing({ ...editing, consolidation_fee_percentage: e.target.value })} />
              </div>
              <div>
                <Label>+Tracking Regular</Label>
                <Input type="number" step="0.01" value={editing.per_tracking_regular} onChange={e => setEditing({ ...editing, per_tracking_regular: e.target.value })} />
              </div>
              <div>
                <Label>+Tracking Alto Riesgo</Label>
                <Input type="number" step="0.01" value={editing.per_tracking_high} onChange={e => setEditing({ ...editing, per_tracking_high: e.target.value })} />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">Overrides por Estado</h3>
                <Button size="sm" variant="outline" onClick={addOverride}>Agregar</Button>
              </div>
              <div className="space-y-2">
                {(editing.state_overrides || []).map((o, idx) => (
                  <div key={idx} className="grid grid-cols-1 md:grid-cols-5 gap-3 items-end">
                    <div className="md:col-span-2">
                      <Label>Estado (state_code)</Label>
                      <Input value={o.state_code} onChange={e => updateOverride(idx, 'state_code', e.target.value)} placeholder="ej: caracas" />
                    </div>
                    <div className="md:col-span-2">
                      <Label>Tarifa USD</Label>
                      <Input type="number" step="0.01" value={o.shipping_rate} onChange={e => updateOverride(idx, 'shipping_rate', e.target.value)} />
                    </div>
                    <div>
                      <Button variant="destructive" size="icon" onClick={() => removeOverride(idx)}><Trash2 className="h-4 w-4"/></Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex gap-2 justify-end pt-2">
              <Button variant="outline" onClick={cancel}>Cancelar</Button>
              <Button onClick={save}><Save className="h-4 w-4 mr-2"/>Guardar</Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Listado</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="py-16 text-slate-500 flex items-center justify-center"><Loader2 className="h-5 w-5 animate-spin mr-2"/>Cargando…</div>
          ) : (
            <>
              <div className="space-y-3 md:hidden">
                {providers.length === 0 ? (
                  <div className="text-center text-slate-500 py-6">Sin proveedores</div>
                ) : providers.map(p => (
                  <div key={p.id} className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
                    <div className="space-y-2">
                      <div>
                        <p className="text-xs text-slate-500">Nombre</p>
                        <p className="font-medium text-slate-800 break-words">{p.name}</p>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <p className="text-xs text-slate-500">Modo</p>
                          <p className="text-slate-800 capitalize">{p.mode}</p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-500">Default</p>
                          <div className="mt-1">{p.is_default_for_mode ? <Badge className="bg-blue-100 text-blue-800">Sí</Badge> : '—'}</div>
                        </div>
                        <div>
                          <p className="text-xs text-slate-500">Estado</p>
                          <div className="mt-1">{p.is_active ? <Badge className="bg-emerald-100 text-emerald-700">Activo</Badge> : <Badge className="bg-slate-200 text-slate-700">Inactivo</Badge>}</div>
                        </div>
                        <div>
                          <p className="text-xs text-slate-500">Base Reg</p>
                          <p className="text-slate-800">${(p.base_rate_regular||0).toFixed?.(2) ?? Number(p.base_rate_regular||0).toFixed(2)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-500">Base High</p>
                          <p className="text-slate-800">${(p.base_rate_high_risk||0).toFixed?.(2) ?? Number(p.base_rate_high_risk||0).toFixed(2)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-500">D2D</p>
                          <p className="text-slate-800">${(p.door_to_door_cost||0).toFixed?.(2) ?? Number(p.door_to_door_cost||0).toFixed(2)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-500">% Consol.</p>
                          <p className="text-slate-800">{Number(p.consolidation_fee_percentage || 0).toFixed(2)}%</p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-500">+Reg</p>
                          <p className="text-slate-800">${(p.per_tracking_regular||0).toFixed?.(2) ?? Number(p.per_tracking_regular||0).toFixed(2)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-500">+High</p>
                          <p className="text-slate-800">${(p.per_tracking_high||0).toFixed?.(2) ?? Number(p.per_tracking_high||0).toFixed(2)}</p>
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-col gap-2">
                      <Button size="sm" variant="outline" onClick={() => startEdit(p)}>Editar</Button>
                      <Button size="sm" variant="destructive" onClick={() => remove(p.id)}>Eliminar</Button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="hidden md:block overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nombre</TableHead>
                      <TableHead>Modo</TableHead>
                      <TableHead>Default</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead>Base Reg</TableHead>
                      <TableHead>Base High</TableHead>
                      <TableHead>D2D</TableHead>
                      <TableHead>% Consol.</TableHead>
                      <TableHead>+Reg</TableHead>
                      <TableHead>+High</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {providers.length === 0 ? (
                      <TableRow><TableCell colSpan={11} className="text-center text-slate-500">Sin proveedores</TableCell></TableRow>
                    ) : providers.map(p => (
                      <TableRow key={p.id}>
                        <TableCell className="font-medium">{p.name}</TableCell>
                        <TableCell>{p.mode}</TableCell>
                        <TableCell>{p.is_default_for_mode ? <Badge className="bg-blue-100 text-blue-800">Sí</Badge> : '—'}</TableCell>
                        <TableCell>{p.is_active ? <Badge className="bg-emerald-100 text-emerald-700">Activo</Badge> : <Badge className="bg-slate-200 text-slate-700">Inactivo</Badge>}</TableCell>
                        <TableCell>${(p.base_rate_regular||0).toFixed?.(2) ?? Number(p.base_rate_regular||0).toFixed(2)}</TableCell>
                        <TableCell>${(p.base_rate_high_risk||0).toFixed?.(2) ?? Number(p.base_rate_high_risk||0).toFixed(2)}</TableCell>
                        <TableCell>${(p.door_to_door_cost||0).toFixed?.(2) ?? Number(p.door_to_door_cost||0).toFixed(2)}</TableCell>
                        <TableCell>{Number(p.consolidation_fee_percentage || 0).toFixed(2)}%</TableCell>
                        <TableCell>${(p.per_tracking_regular||0).toFixed?.(2) ?? Number(p.per_tracking_regular||0).toFixed(2)}</TableCell>
                        <TableCell>${(p.per_tracking_high||0).toFixed?.(2) ?? Number(p.per_tracking_high||0).toFixed(2)}</TableCell>
                        <TableCell className="text-right space-x-2">
                          <Button size="sm" variant="outline" onClick={() => startEdit(p)}>Editar</Button>
                          <Button size="sm" variant="destructive" onClick={() => remove(p.id)}>Eliminar</Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}