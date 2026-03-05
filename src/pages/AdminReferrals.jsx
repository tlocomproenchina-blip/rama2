import React, { useEffect, useMemo, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Gift, Users, Crown, Loader2, Download } from 'lucide-react';
import { toast } from 'sonner';

export default function AdminReferrals() {
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState([]);
  const [events, setEvents] = useState([]);
  const [packages, setPackages] = useState([]);
  const [config, setConfig] = useState(null);
  const [saving, setSaving] = useState(false);
  const [creditAmount, setCreditAmount] = useState(5);

  useEffect(() => {
    (async () => {
      try {
        const [cfg, usrs, evs, pkgs] = await Promise.all([
          base44.entities.AppConfig.filter({ config_key: 'main' }).catch(() => []),
          base44.entities.User.filter({ role: 'user' }).catch(() => []),
          base44.entities.ReferralEvent.list('-created_date', 500).catch(() => []),
          base44.entities.Package.list('-created_date', 10000).catch(() => [])
        ]);
        const c = cfg?.[0] || null;
        setConfig(c);
        if (c?.referral_credit_amount) setCreditAmount(Number(c.referral_credit_amount));
        setUsers(usrs || []);
        setEvents(evs || []);
        setPackages(pkgs || []);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const codeByEmail = useMemo(() => {
    const m = new Map();
    users.forEach(u => { if (u.referral_code) m.set(u.email, u.referral_code); });
    return m;
  }, [users]);

  const referrerByCode = useMemo(() => {
    const m = new Map();
    users.forEach(u => { if (u.referral_code) m.set(u.referral_code, u.email); });
    return m;
  }, [users]);

  const referees = useMemo(() => {
    // Build referee list (who used a code)
    const list = users.filter(u => !!u.referred_by_code).map(u => {
      const refEmail = referrerByCode.get(String(u.referred_by_code)) || null;
      return { referee_email: u.email, referrer_email: refEmail, referred_by_code: u.referred_by_code, created_date: u.created_date };
    });
    return list;
  }, [users, referrerByCode]);

  const packagesCountByEmail = useMemo(() => {
    const m = new Map();
    packages.forEach(p => { const k = p.client_email; m.set(k, (m.get(k) || 0) + 1); });
    return m;
  }, [packages]);

  const leaderboard = useMemo(() => {
    const counts = new Map();
    referees.forEach(r => { if (r.referrer_email) counts.set(r.referrer_email, (counts.get(r.referrer_email) || 0) + 1); });
    const arr = Array.from(counts.entries()).map(([email, count]) => {
      const u = users.find(x => x.email === email) || {};
      const pkgs = packages.filter(p => referees.some(r => r.referee_email === p.client_email && r.referrer_email === email));
      return { email, name: `${u.first_name || ''} ${u.last_name || ''}`.trim() || email, count, credit_balance: Number(u.referral_credit_balance || 0), total_referee_shipments: pkgs.length };
    });
    arr.sort((a, b) => b.count - a.count);
    return arr.slice(0, 10);
  }, [referees, users, packages]);

  const totals = useMemo(() => {
    const awarded = events.filter(e => e.event_type === 'awarded').reduce((s, e) => s + (Number(e.amount) || 0), 0);
    const redeemed = events.filter(e => e.event_type === 'redeemed').reduce((s, e) => s + (Number(e.amount) || 0), 0);
    return { awarded, redeemed };
  }, [events]);

  const saveCredit = async () => {
    setSaving(true);
    try {
      if (config) {
        await base44.entities.AppConfig.update(config.id, { referral_credit_amount: Number(creditAmount) });
      } else {
        const created = await base44.entities.AppConfig.create({ config_key: 'main', referral_credit_amount: Number(creditAmount) });
        setConfig(created);
      }
      toast.success('Monto de crédito actualizado');
    } catch (e) {
      toast.error('No se pudo guardar');
    }
    setSaving(false);
  };

  const exportCSV = () => {
    const rows = [['Referrer Email','Referrer Nombre','Referrals','Crédito','Envíos de referidos']];
    leaderboard.forEach(r => rows.push([r.email, r.name, r.count, r.credit_balance, r.total_referee_shipments]));
    const csv = rows.map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'leaderboard_referidos.csv'; a.click();
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
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2"><Gift className="h-6 w-6 text-emerald-600" /> Referidos</h1>
          <p className="text-slate-500">Configura el programa, revisa referidos y top clientes</p>
        </div>
      </div>

      {/* Configuración */}
      <Card className="border-0 shadow-lg">
        <CardHeader>
          <CardTitle className="text-lg">Configuración</CardTitle>
          <CardDescription>Monto de crédito por cada referido (para cada parte)</CardDescription>
        </CardHeader>
        <CardContent className="flex items-center gap-3">
          <Input type="number" step="0.01" value={creditAmount} onChange={(e) => setCreditAmount(e.target.value)} className="w-40" />
          <Button onClick={saveCredit} disabled={saving} className="bg-blue-600 hover:bg-blue-700">{saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null} Guardar</Button>
        </CardContent>
      </Card>

      {/* Resumen */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-0 shadow-lg"><CardContent className="p-5"><div className="text-sm text-slate-500">Crédito otorgado</div><div className="text-2xl font-bold text-emerald-600">${totals.awarded.toFixed(2)}</div></CardContent></Card>
        <Card className="border-0 shadow-lg"><CardContent className="p-5"><div className="text-sm text-slate-500">Crédito redimido</div><div className="text-2xl font-bold text-blue-600">${totals.redeemed.toFixed(2)}</div></CardContent></Card>
        <Card className="border-0 shadow-lg"><CardContent className="p-5"><div className="text-sm text-slate-500">Usuarios con código</div><div className="text-2xl font-bold text-slate-800">{users.filter(u => !!u.referral_code).length}</div></CardContent></Card>
      </div>

      <Tabs defaultValue="leaderboard">
        <TabsList>
          <TabsTrigger value="leaderboard">Top Referidores</TabsTrigger>
          <TabsTrigger value="referees">Listado de referidos</TabsTrigger>
        </TabsList>

        <TabsContent value="leaderboard" className="mt-4">
          <Card className="border-0 shadow-lg">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2"><Crown className="h-5 w-5 text-amber-500" /> Ranking</CardTitle>
              <Button variant="outline" onClick={exportCSV}><Download className="h-4 w-4 mr-2" /> Exportar</Button>
            </CardHeader>
            <CardContent>
              {leaderboard.length === 0 ? (
                <div className="text-sm text-slate-500">Sin datos aún.</div>
              ) : (
                <div className="space-y-2">
                  {leaderboard.map((r, idx) => (
                    <div key={r.email} className="flex items-center justify-between p-3 bg-white rounded-md border">
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-slate-800 truncate">{idx + 1}. {r.name}</div>
                        <div className="text-xs text-slate-500 truncate">{r.email}</div>
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge className="bg-emerald-100 text-emerald-700">{r.count} referidos</Badge>
                        <Badge variant="outline">${r.credit_balance.toFixed(2)} crédito</Badge>
                        <Badge variant="outline">{r.total_referee_shipments} envíos</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="referees" className="mt-4">
          <Card className="border-0 shadow-lg">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2"><Users className="h-5 w-5" /> Referidos</CardTitle>
              <CardDescription>Usuarios que se registraron con un código</CardDescription>
            </CardHeader>
            <CardContent>
              {referees.length === 0 ? (
                <div className="text-sm text-slate-500">Sin referidos aún.</div>
              ) : (
                <div className="space-y-2">
                  {referees.map((r) => (
                    <div key={`${r.referee_email}-${r.referred_by_code}`} className="flex items-center justify-between p-3 bg-white rounded-md border">
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-slate-800 truncate">{r.referee_email}</div>
                        <div className="text-xs text-slate-500 truncate">{new Date(r.created_date).toLocaleString('es-VE', { timeZone: 'America/Caracas' })}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-xs text-slate-500">Refirió: {r.referrer_email || 'N/D'}</div>
                        <div className="text-xs text-slate-500">Envíos: {packagesCountByEmail.get(r.referee_email) || 0}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}