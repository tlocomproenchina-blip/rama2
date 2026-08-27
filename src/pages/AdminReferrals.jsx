import React, { useEffect, useMemo, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Loader2, Gift, DollarSign, TrendingUp, Crown, RefreshCw, Settings as SettingsIcon, Users } from "lucide-react";
import { toast } from "sonner";

export default function AdminReferrals() {
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState([]);
  const [rewards, setRewards] = useState([]);
  const [credits, setCredits] = useState([]);
  const [settings, setSettings] = useState(null);
  const [savingSettings, setSavingSettings] = useState(false);

  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  // temporales (se aplican con el botón Aplicar)
  const [tempFromDate, setTempFromDate] = useState("");
  const [tempToDate, setTempToDate] = useState("");

  // inputs de filtro (temporales)
  const [refQueryInput, setRefQueryInput] = useState(""); // email o shipping mark del referidor
  const [statusInput, setStatusInput] = useState("all"); // all | pendiente | aplicado
  const [minCbmInput, setMinCbmInput] = useState("");
  const [minCreditInput, setMinCreditInput] = useState("");

  // filtros aplicados
  const [refQuery, setRefQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [minCbm, setMinCbm] = useState("");
  const [minCredit, setMinCredit] = useState("");

  const [adjustOpen, setAdjustOpen] = useState(false);
  const [adjustData, setAdjustData] = useState({ email: "", amount: "", notes: "" });

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [u, r, c, s] = await Promise.all([
          base44.functions.invoke('listAllUsers', { role: 'user', limit: 5000 }).then(r => r?.data?.users || []),
          base44.entities.ReferralCbmReward.filter({}, '-created_date', 1000),
          base44.entities.CreditsLedger.filter({}, '-created_date', 2000),
          base44.entities.ReferralSettings.filter({ config_key: 'main' })
        ]);
        setUsers(u || []);
        setRewards(r || []);
        setCredits(c || []);
        if (s && s.length > 0) setSettings(s[0]);
        else setSettings({ config_key: 'main', enabled: true, referrer_credit_per_cbm: 15, credit_expiration_days: 60, max_credit_apply_percent: 0.3, min_invoice_subtotal_usd: 95, agent_enabled: true, agent_referrer_credit_per_cbm: 25, agent_role_codes: ['agente','agent'] });
      } catch (e) {
        toast.error('No se pudieron cargar datos de referidos');
      }
      setLoading(false);
    };
    load();
  }, []);

  const inRange = (iso) => {
    if (!iso) return false;
    const d = new Date(iso);
    const start = fromDate ? new Date(fromDate + 'T00:00:00') : null;
    const end = toDate ? new Date(toDate + 'T23:59:59') : null;
    if (start && d < start) return false;
    if (end && d > end) return false;
    return true;
  };

  // yyyy-mm-dd respetando zona local
  const fmtDate = (d) => {
    const dt = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
    return dt.toISOString().slice(0, 10);
  };

  const referredUsers = useMemo(() => users.filter(u => !!u.referred_by_user_id), [users]);
  const rewardsInRange = useMemo(() => rewards.filter(r => inRange(r.created_date)), [rewards, fromDate, toDate]);
  const creditsInRange = useMemo(() => credits.filter(c => inRange(c.created_date)), [credits, fromDate, toDate]);

  // claves de créditos aplicados (user_id|invoice_id)
  const appliedCreditKeys = useMemo(() => {
    const set = new Set();
    creditsInRange
      .filter(c => c.status === 'applied' && c.related_invoice_id && c.user_id)
      .forEach(c => set.add(`${c.user_id}|${c.related_invoice_id}`));
    return set;
  }, [creditsInRange]);

  // recompensas filtradas por filtros adicionales
  const filteredRewards = useMemo(() => {
    let list = rewardsInRange;

    if (refQuery.trim()) {
      const q = refQuery.trim().toLowerCase();
      list = list.filter(rw => {
        const ref = users.find(u => u.id === rw.referrer_user_id);
        const email = (ref?.email || '').toLowerCase();
        const mark = (ref?.shipping_mark || '').toLowerCase();
        return email.includes(q) || mark.includes(q);
      });
    }

    if (statusFilter !== 'all') {
      list = list.filter(rw => {
        const key = `${rw.referrer_user_id}|${rw.invoice_id}`;
        const hasApplied = appliedCreditKeys.has(key);
        return statusFilter === 'aplicado' ? hasApplied : (!hasApplied && rw.status !== 'reversed');
      });
    }

    if (minCbm !== "" && !isNaN(Number(minCbm))) {
      list = list.filter(rw => Number(rw.cbm_rewarded || 0) >= Number(minCbm));
    }
    if (minCredit !== "" && !isNaN(Number(minCredit))) {
      list = list.filter(rw => Number(rw.credit_generated || 0) >= Number(minCredit));
    }

    return list;
  }, [rewardsInRange, users, refQuery, statusFilter, minCbm, minCredit, appliedCreditKeys]);

  // créditos aplicados asociados a las recompensas filtradas
  const filteredCreditsApplied = useMemo(() => {
    if (filteredRewards.length === 0) return [];
    const keys = new Set(filteredRewards.map(rw => `${rw.referrer_user_id}|${rw.invoice_id}`));
    return creditsInRange.filter(c => c.status === 'applied' && keys.has(`${c.user_id}|${c.related_invoice_id}`));
  }, [creditsInRange, filteredRewards]);

  const totalReferralCbm = useMemo(() => filteredRewards.reduce((s, r) => s + (Number(r.cbm_rewarded)||0), 0), [filteredRewards]);
  const totalCreditsGenerated = useMemo(() => filteredRewards.reduce((s, r) => s + (Number(r.credit_generated)||0), 0), [filteredRewards]);
  const totalCreditsApplied = useMemo(() => filteredCreditsApplied.reduce((s, c) => s + (Number(c.amount_usd)||0), 0), [filteredCreditsApplied]);
  const totalCreditsReversed = useMemo(() => creditsInRange.filter(c => c.status === 'reversed').reduce((s, c) => s + (Number(c.amount_usd)||0), 0), [creditsInRange]);

  const leaderboard = useMemo(() => {
    const map = new Map();
    filteredRewards.forEach(r => {
      const key = r.referrer_user_id;
      if (!map.has(key)) map.set(key, { referrer_user_id: key, cbm: 0, credits: 0, referredSet: new Set() });
      const obj = map.get(key);
      obj.cbm += Number(r.cbm_rewarded)||0;
      obj.credits += Number(r.credit_generated)||0;
      obj.referredSet.add(r.referred_user_id);
    });
    const arr = Array.from(map.values()).map(x => ({
      referrer_user_id: x.referrer_user_id,
      cbm: x.cbm,
      credits: x.credits,
      referred_count: x.referredSet.size,
      referrer: users.find(u => u.id === x.referrer_user_id)
    }));
    return arr.sort((a,b) => b.credits - a.credits).slice(0, 10);
  }, [filteredRewards, users]);

  const handleSaveSettings = async () => {
    try {
      setSavingSettings(true);
      if (settings.id) await base44.entities.ReferralSettings.update(settings.id, settings);
      else await base44.entities.ReferralSettings.create(settings);
      toast.success('Ajustes guardados');
    } catch (e) {
      toast.error('No se pudieron guardar los ajustes');
    }
    setSavingSettings(false);
  };

  const handleReverseReward = async (reward) => {
    try {
      if (reward.status === 'reversed') { toast.error('Ya está reversado'); return; }
      await base44.entities.ReferralCbmReward.update(reward.id, { status: 'reversed' });
      await base44.entities.CreditsLedger.create({
        user_id: reward.referrer_user_id,
        source: 'reversal',
        amount_usd: -Math.abs(Number(reward.credit_generated)||0),
        status: 'reversed',
        related_invoice_id: reward.invoice_id,
        notes: 'Reversa manual desde Referidos'
      });
      setRewards(prev => prev.map(r => r.id === reward.id ? { ...r, status: 'reversed' } : r));
      toast.success('Recompensa reversada');
    } catch (e) {
      toast.error('No se pudo reversar');
    }
  };

  const handleManualAdjust = async () => {
    try {
      const email = adjustData.email.trim();
      const amt = Number(adjustData.amount);
      if (!email || !amt) { toast.error('Email y monto requeridos'); return; }
      const res = await base44.functions.invoke('listAllUsers', { emails: [email] });
      const u = res?.data?.users || [];
      if (u.length === 0) { toast.error('Usuario no encontrado'); return; }
      await base44.entities.CreditsLedger.create({
        user_id: u[0].id,
        source: 'manual_adjustment',
        amount_usd: amt,
        status: 'available',
        notes: adjustData.notes || 'Ajuste manual'
      });
      toast.success('Ajuste aplicado');
      setAdjustOpen(false);
    } catch (e) {
      toast.error('No se pudo aplicar el ajuste');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-blue-600" /></div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Gestión de Referidos</h1>
          <p className="text-slate-500">Recompensas por CBM cuando la factura está emitida (pendiente)</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
          <Button variant="outline" className="w-full sm:w-auto" onClick={() => window.location.reload()}><RefreshCw className="h-4 w-4 mr-1" />Actualizar</Button>
          <Button variant="outline" className="w-full sm:w-auto" onClick={() => setAdjustOpen(true)}><DollarSign className="h-4 w-4 mr-1" />Ajuste manual</Button>
        </div>
      </div>

      {/* Filtros */}
      <Card className="border-0 shadow-md">
        <CardContent className="p-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div>
              <Label>Desde</Label>
              <Input type="date" value={tempFromDate} onChange={(e) => setTempFromDate(e.target.value)} />
            </div>
            <div>
              <Label>Hasta</Label>
              <Input type="date" value={tempToDate} onChange={(e) => setTempToDate(e.target.value)} />
            </div>
            <div>
              <Label>Referidor (email/mark)</Label>
              <Input placeholder="ej: juan@correo.com o TLEC-123" value={refQueryInput} onChange={(e)=> setRefQueryInput(e.target.value)} />
            </div>
            <div>
              <Label>Estado</Label>
              <Select value={statusInput} onValueChange={setStatusInput}>
                <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="pendiente">Pendiente</SelectItem>
                  <SelectItem value="aplicado">Aplicado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Mín. CBM</Label>
                <Input type="number" step="0.01" value={minCbmInput} onChange={(e)=> setMinCbmInput(e.target.value)} />
              </div>
              <div>
                <Label>Mín. crédito (USD)</Label>
                <Input type="number" step="0.01" value={minCreditInput} onChange={(e)=> setMinCreditInput(e.target.value)} />
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-slate-500 mr-1">Rangos rápidos:</span>
            <Button variant="outline" size="sm" onClick={() => { const n=new Date(); setTempFromDate(fmtDate(n)); setTempToDate(fmtDate(n)); }}>Hoy</Button>
            <Button variant="outline" size="sm" onClick={() => { const n=new Date(); const s=new Date(); s.setDate(n.getDate()-6); setTempFromDate(fmtDate(s)); setTempToDate(fmtDate(n)); }}>7 días</Button>
            <Button variant="outline" size="sm" onClick={() => { const n=new Date(); const s=new Date(); s.setDate(n.getDate()-29); setTempFromDate(fmtDate(s)); setTempToDate(fmtDate(n)); }}>30 días</Button>
            <Button variant="outline" size="sm" onClick={() => { const n=new Date(); const s=new Date(n.getFullYear(), n.getMonth(), 1); setTempFromDate(fmtDate(s)); setTempToDate(fmtDate(n)); }}>Mes actual</Button>
            <Button variant="outline" size="sm" onClick={() => { const n=new Date(); const s=new Date(n.getFullYear(), n.getMonth()-1, 1); const e=new Date(n.getFullYear(), n.getMonth(), 0); setTempFromDate(fmtDate(s)); setTempToDate(fmtDate(e)); }}>Mes anterior</Button>
            <Button variant="outline" size="sm" onClick={() => { const n=new Date(); const q=Math.floor(n.getMonth()/3); const s=new Date(n.getFullYear(), q*3, 1); setTempFromDate(fmtDate(s)); setTempToDate(fmtDate(n)); }}>Trimestre actual</Button>
            <Button variant="outline" size="sm" onClick={() => { const n=new Date(); const s=new Date(n.getFullYear(), 0, 1); setTempFromDate(fmtDate(s)); setTempToDate(fmtDate(n)); }}>Año actual</Button>
            <div className="ml-auto flex gap-2">
              <Button onClick={() => { setFromDate(tempFromDate); setToDate(tempToDate); setRefQuery(refQueryInput.trim()); setStatusFilter(statusInput); setMinCbm(minCbmInput); setMinCredit(minCreditInput); }}>Aplicar</Button>
              <Button variant="outline" onClick={() => { setTempFromDate(""); setTempToDate(""); setFromDate(""); setToDate(""); setRefQueryInput(""); setStatusInput("all"); setMinCbmInput(""); setMinCreditInput(""); setRefQuery(""); setStatusFilter("all"); setMinCbm(""); setMinCredit(""); }}>Limpiar</Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Métricas */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-0 shadow-md"><CardContent className="p-5 flex items-center justify-between"><div><p className="text-sm text-slate-500">Usuarios referidos</p><p className="text-3xl font-bold text-slate-800">{referredUsers.length}</p></div><Users className="h-6 w-6 text-blue-600" /></CardContent></Card>
        <Card className="border-0 shadow-md"><CardContent className="p-5 flex items-center justify-between"><div><p className="text-sm text-slate-500">CBM por referidos</p><p className="text-3xl font-bold text-slate-800">{totalReferralCbm.toFixed(2)}</p></div><TrendingUp className="h-6 w-6 text-emerald-600" /></CardContent></Card>
        <Card className="border-0 shadow-md"><CardContent className="p-5 flex items-center justify-between"><div><p className="text-sm text-slate-500">Créditos generados</p><p className="text-3xl font-bold text-slate-800">${totalCreditsGenerated.toFixed(2)}</p></div><Gift className="h-6 w-6 text-fuchsia-600" /></CardContent></Card>
        <Card className="border-0 shadow-md"><CardContent className="p-5 flex items-center justify-between"><div><p className="text-sm text-slate-500">Créditos aplicados</p><p className="text-3xl font-bold text-slate-800">${totalCreditsApplied.toFixed(2)}</p></div><DollarSign className="h-6 w-6 text-amber-600" /></CardContent></Card>
      </div>

      {/* Detalle de usuarios referidos */}
      <Card className="border-0 shadow-md">
        <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2"><Users className="h-5 w-5 text-blue-600" />Usuarios Referidos ({referredUsers.length})</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Referido</TableHead>
                <TableHead>Shipping Mark</TableHead>
                <TableHead>Referido por</TableHead>
                <TableHead>Fecha registro</TableHead>
                <TableHead>Recompensas</TableHead>
                <TableHead>CBM total</TableHead>
                <TableHead>Crédito gen.</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {referredUsers.length === 0 && (
                <TableRow><TableCell colSpan={7} className="text-center text-slate-500">Sin usuarios referidos</TableCell></TableRow>
              )}
              {referredUsers.map((ru) => {
                const referrer = users.find(u => u.id === ru.referred_by_user_id);
                const ruRewards = rewards.filter(rw => rw.referred_user_id === ru.id && rw.status !== 'reversed');
                const ruCbm = ruRewards.reduce((s, r) => s + (Number(r.cbm_rewarded)||0), 0);
                const ruCredit = ruRewards.reduce((s, r) => s + (Number(r.credit_generated)||0), 0);
                return (
                  <TableRow key={ru.id}>
                    <TableCell>
                      <div className="font-medium text-slate-800">{ru.first_name || ru.full_name || '—'}</div>
                      <div className="text-xs text-slate-500">{ru.email}</div>
                    </TableCell>
                    <TableCell className="font-mono text-xs">{ru.shipping_mark || '—'}</TableCell>
                    <TableCell>
                      {referrer ? (
                        <>
                          <div className="font-medium text-slate-800">{referrer.first_name || referrer.full_name || '—'}</div>
                          <div className="text-xs text-slate-500">{referrer.email}</div>
                          {referrer.shipping_mark && <div className="text-xs text-slate-400 font-mono">{referrer.shipping_mark}</div>}
                        </>
                      ) : (
                        <span className="text-xs text-slate-400">Usuario eliminado</span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-slate-500">{ru.created_date ? new Date(ru.created_date).toLocaleDateString('es-VE') : '—'}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">{ruRewards.length}</Badge>
                    </TableCell>
                    <TableCell>{ruCbm.toFixed(2)}</TableCell>
                    <TableCell className="font-semibold text-emerald-700">${ruCredit.toFixed(2)}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Leaderboard */}
      <Card className="border-0 shadow-md">
        <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2"><Crown className="h-5 w-5 text-amber-500" />Top Referidores</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>#</TableHead>
                <TableHead>Referidor</TableHead>
                <TableHead>Clientes</TableHead>
                <TableHead>CBM</TableHead>
                <TableHead>Créditos</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {leaderboard.length === 0 && (
                <TableRow><TableCell colSpan={5} className="text-center text-slate-500">Sin datos</TableCell></TableRow>
              )}
              {leaderboard.map((row, idx) => (
                <TableRow key={row.referrer_user_id}>
                  <TableCell>{idx + 1}</TableCell>
                  <TableCell>{row.referrer?.first_name || row.referrer?.full_name || row.referrer?.email || row.referrer_user_id}</TableCell>
                  <TableCell>{row.referred_count}</TableCell>
                  <TableCell>{row.cbm.toFixed(2)}</TableCell>
                  <TableCell>${row.credits.toFixed(2)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Rewards list */}
      <Card className="border-0 shadow-md">
        <CardHeader className="pb-2"><CardTitle>Recompensas por factura</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Factura</TableHead>
                <TableHead>Referidor</TableHead>
                <TableHead>Referido</TableHead>
                <TableHead>CBM</TableHead>
                <TableHead>Crédito</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredRewards.length === 0 && (
                <TableRow><TableCell colSpan={7} className="text-center text-slate-500">Sin recompensas con los filtros</TableCell></TableRow>
              )}
              {filteredRewards.map((rw) => {
                const referrer = users.find(u => u.id === rw.referrer_user_id);
                const referred = users.find(u => u.id === rw.referred_user_id);
                return (
                  <TableRow key={rw.id}>
                    <TableCell className="font-mono text-xs">{rw.invoice_id}</TableCell>
                    <TableCell>{referrer?.first_name || referrer?.email || rw.referrer_user_id}</TableCell>
                    <TableCell>{referred?.first_name || referred?.email || rw.referred_user_id}</TableCell>
                    <TableCell>{Number(rw.cbm_rewarded||0).toFixed(2)}</TableCell>
                    <TableCell>${Number(rw.credit_generated||0).toFixed(2)}</TableCell>
                    <TableCell>
                      {rw.status === 'active' ? (
                        <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200">Activa</Badge>
                      ) : (
                        <Badge className="bg-rose-100 text-rose-700 border-rose-200">Reversada</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="outline" disabled={rw.status !== 'active'} onClick={() => handleReverseReward(rw)}>Reversar</Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Ajustes */}
      <Card className="border-0 shadow-md">
        <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2"><SettingsIcon className="h-5 w-5" />Ajustes</CardTitle></CardHeader>
        <CardContent className="p-4 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <Label>$ por CBM (referidor)</Label>
            <Input type="number" value={settings?.referrer_credit_per_cbm ?? 15} onChange={(e)=> setSettings({ ...settings, referrer_credit_per_cbm: Number(e.target.value) })} />
          </div>
          <div>
            <Label>$ por CBM (Agente)</Label>
            <Input type="number" value={settings?.agent_referrer_credit_per_cbm ?? 25} onChange={(e)=> setSettings({ ...settings, agent_referrer_credit_per_cbm: Number(e.target.value) })} />
          </div>
          <div>
            <Label>Roles de Agente (separados por coma)</Label>
            <Input
              value={(Array.isArray(settings?.agent_role_codes) ? settings.agent_role_codes : []).join(',')}
              onChange={(e)=> {
                const arr = e.target.value.split(',').map(x => x.trim()).filter(Boolean);
                setSettings({ ...settings, agent_role_codes: arr });
              }}
              placeholder="agente, agent"
            />
          </div>
          <div>
            <Label>% máx. aplicar por factura</Label>
            <Input type="number" step="0.01" value={settings?.max_credit_apply_percent ?? 0.3} onChange={(e)=> setSettings({ ...settings, max_credit_apply_percent: Number(e.target.value) })} />
          </div>
          <div>
            <Label>Tope fijo (USD) opcional</Label>
            <Input type="number" value={settings?.max_credit_apply_usd ?? ''} onChange={(e)=> setSettings({ ...settings, max_credit_apply_usd: e.target.value === '' ? undefined : Number(e.target.value) })} />
          </div>
          <div>
            <Label>Mínimo subtotal (USD)</Label>
            <Input type="number" value={settings?.min_invoice_subtotal_usd ?? 95} onChange={(e)=> setSettings({ ...settings, min_invoice_subtotal_usd: Number(e.target.value) })} />
          </div>
          <div>
            <Label>Vencimiento de crédito (días)</Label>
            <Input type="number" value={settings?.credit_expiration_days ?? 60} onChange={(e)=> setSettings({ ...settings, credit_expiration_days: Number(e.target.value) })} />
          </div>
          <div className="flex items-end"><Button onClick={handleSaveSettings} disabled={savingSettings}>{savingSettings ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Guardando</> : 'Guardar ajustes'}</Button></div>
        </CardContent>
      </Card>

      {/* Diálogo de ajuste manual */}
      <Dialog open={adjustOpen} onOpenChange={setAdjustOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Ajuste manual de crédito</DialogTitle>
            <DialogDescription>Agrega o descuenta crédito del usuario (usa monto negativo para descontar).</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Email del usuario</Label>
              <Input value={adjustData.email} onChange={(e)=> setAdjustData({ ...adjustData, email: e.target.value })} placeholder="cliente@correo.com" />
            </div>
            <div>
              <Label>Monto (USD)</Label>
              <Input type="number" step="0.01" value={adjustData.amount} onChange={(e)=> setAdjustData({ ...adjustData, amount: e.target.value })} placeholder="Ej: 10 o -5" />
            </div>
            <div>
              <Label>Notas</Label>
              <Input value={adjustData.notes} onChange={(e)=> setAdjustData({ ...adjustData, notes: e.target.value })} placeholder="Motivo del ajuste" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={()=> setAdjustOpen(false)}>Cancelar</Button>
            <Button onClick={handleManualAdjust}>Aplicar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}