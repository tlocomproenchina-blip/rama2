import React, { useEffect, useMemo, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Gift, Copy, Link2, Users, TrendingUp, DollarSign, Share2, Loader2, Info, CalendarDays } from "lucide-react";
import { toast } from "sonner";
import ClientPageHero from '@/components/client-portal/ClientPageHero';
import PortalMetricCard from '@/components/client-portal/PortalMetricCard';

export default function MyReferrals() {
  const [loading, setLoading] = useState(true);
  const [me, setMe] = useState(null);
  const [referred, setReferred] = useState([]);
  const [rewards, setRewards] = useState([]);
  const [credits, setCredits] = useState([]);
  const [settings, setSettings] = useState(null);
  const [nextResetDate, setNextResetDate] = useState('');

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const user = await base44.auth.me();
        setMe(user);
        const { data } = await base44.functions.invoke('getMyReferralData', {});
        setReferred(data?.referredUsers || []);
        setRewards(data?.rewards || []);
        setCredits(data?.credits || []);
        // Cargar ajustes públicos del programa de referidos (elige registro correcto y fusiona con defaults)
        let rawSettings = null;
        try {
          const all = await base44.entities.ReferralSettings.filter({});
          if (Array.isArray(all) && all.length) {
            const mains = all.filter(s => s.config_key === 'main' && (s.enabled ?? true));
            const enabled = all.filter(s => (s.enabled ?? true));
            const byUpdated = [...all].sort((a,b) => new Date(b.updated_date || 0) - new Date(a.updated_date || 0));
            rawSettings = mains[0] || enabled[0] || byUpdated[0] || null;
          }
        } catch (_) {}
        try {
          const schema = await base44.entities.ReferralSettings.schema();
          const defaults = {
            referrer_credit_per_cbm: schema.properties?.referrer_credit_per_cbm?.default ?? 0,
            agent_referrer_credit_per_cbm: schema.properties?.agent_referrer_credit_per_cbm?.default ?? (schema.properties?.referrer_credit_per_cbm?.default ?? 0),
            credit_expiration_days: schema.properties?.credit_expiration_days?.default ?? 60,
            max_credit_apply_percent: schema.properties?.max_credit_apply_percent?.default,
            max_credit_apply_usd: schema.properties?.max_credit_apply_usd?.default,
            agent_role_codes: schema.properties?.agent_role_codes?.default ?? ['agente','agent'],
          };
          const merged = { ...defaults, ...(rawSettings || {}) };
          // Normalizar tipos numéricos y arrays y evitar 0 no deseado
          merged.referrer_credit_per_cbm = Number(merged.referrer_credit_per_cbm);
          if (!merged.referrer_credit_per_cbm || merged.referrer_credit_per_cbm < 0) merged.referrer_credit_per_cbm = Number(defaults.referrer_credit_per_cbm);
          merged.agent_referrer_credit_per_cbm = Number(merged.agent_referrer_credit_per_cbm);
          if (!merged.agent_referrer_credit_per_cbm || merged.agent_referrer_credit_per_cbm < 0) merged.agent_referrer_credit_per_cbm = merged.referrer_credit_per_cbm;
          if (typeof merged.max_credit_apply_percent === 'string') merged.max_credit_apply_percent = Number(merged.max_credit_apply_percent);
          if (typeof merged.max_credit_apply_usd === 'string') merged.max_credit_apply_usd = Number(merged.max_credit_apply_usd);
          if (!Array.isArray(merged.agent_role_codes) && typeof merged.agent_role_codes === 'string') merged.agent_role_codes = [merged.agent_role_codes];
          setSettings(merged);
        } catch (_) {
          // Último recurso: usar valores seguros por defecto
          setSettings({ referrer_credit_per_cbm: 15, agent_referrer_credit_per_cbm: 25, credit_expiration_days: 60, agent_role_codes: ['agente','agent'] });
        }
        // Calcular próximo reinicio mensual (1er día del próximo mes)
        try {
          const now = new Date();
          const next = new Date(now.getFullYear(), now.getMonth() + 1, 1);
          setNextResetDate(next.toLocaleDateString());
        } catch (_) {
          setNextResetDate('');
        }
      } catch (e) {
        toast.error('No se pudieron cargar tus datos de referidos');
      }
      setLoading(false);
    };
    load();
  }, []);

  const referralCode = me?.referral_code;
  const referralLink = useMemo(() => {
    if (!referralCode) return '';
    try {
      return `${window.location.origin}?ref=${encodeURIComponent(referralCode)}`;
    } catch (_) { return `?ref=${encodeURIComponent(referralCode)}`; }
  }, [referralCode]);

  const totalCbm = useMemo(() => rewards.reduce((s, r) => s + (Number(r.cbm_rewarded)||0), 0), [rewards]);
  const totalCredits = useMemo(() => rewards.reduce((s, r) => s + (Number(r.credit_generated)||0), 0), [rewards]);
  const availableCredits = useMemo(() => {
    const nowIso = new Date().toISOString();
    return credits
      .filter(c => c.status === 'available' && (!c.expires_at || c.expires_at > nowIso))
      .reduce((s, c) => s + (Number(c.amount_usd)||0), 0);
  }, [credits]);
  const appliedCredits = useMemo(() => credits.filter(c => c.status === 'applied').reduce((s, c) => s + (Number(c.amount_usd)||0), 0), [credits]);

  const isAgent = useMemo(() => {
    if (!settings || !me) return false;
    const codes = settings.agent_role_codes || ['agente', 'agent'];
    return !!me.custom_role && codes.includes(me.custom_role);
  }, [settings, me]);

  const earnPerCbm = useMemo(() => {
    const num = (v) => {
      if (v === null || v === undefined) return NaN;
      const s = typeof v === 'string' ? v.replace(',', '.') : v;
      const n = Number(s);
      return Number.isFinite(n) ? n : NaN;
    };
    const base = num(settings?.referrer_credit_per_cbm);
    const agent = num(settings?.agent_referrer_credit_per_cbm);

    // Selecciona según rol con degradación inteligente
    let chosen = isAgent ? (agent > 0 ? agent : base) : (base > 0 ? base : agent);

    // Último recurso a defaults seguros si sigue inválido/<=0
    if (!Number.isFinite(chosen) || chosen <= 0) {
      chosen = isAgent ? 25 : 15;
    }
    return chosen;
  }, [settings, isAgent]);

  const expirationDays = settings?.credit_expiration_days ?? 60;
  const maxApplyPercent = settings?.max_credit_apply_percent;
  const maxApplyUsd = settings?.max_credit_apply_usd;

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(referralLink);
      toast.success('Enlace copiado');
    } catch {
      toast.error('No se pudo copiar');
    }
  };

  const shareWhatsApp = () => {
    const text = `Únete a TLEC Cargo con mi enlace y obtén un servicio de envíos confiable. ${referralLink}`;
    const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
  };

  if (loading) {
    return (
      <div className="min-h-[50vh] grid place-items-center"><Loader2 className="h-8 w-8 animate-spin text-blue-600" /></div>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <ClientPageHero
        icon={Gift}
        eyebrow="Gestión básica"
        title="Mis Referidos"
        description="Comparte tu enlace y sigue tus créditos con una experiencia más clara y ejecutiva."
        badges={[isAgent ? 'Tarifa agente' : 'Programa estándar', `${referred.length} referidos`].filter(Boolean)}
        action={<Button variant="outline" onClick={() => window.location.reload()}>Actualizar</Button>}
        aside={
          <div className="space-y-3">
            <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Crédito por CBM</p>
            <p className="text-3xl font-bold tracking-tight text-foreground">${earnPerCbm.toFixed(2)}</p>
            <p className="text-sm text-muted-foreground">Tus créditos vencen en {expirationDays} días y se aplican según las reglas del programa.</p>
          </div>
        }
      />

      {/* Cómo funciona */}
      <Card className="border-border/70 bg-card/95 shadow-card">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Info className="h-4 w-4 text-sky-600" />
            ¿Cómo funciona?
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 space-y-2 text-sm text-slate-700">
          <ul className="list-disc pl-5 space-y-1">
            <li>Comparte tu enlace con amigos y clientes.</li>
            <li>Cuando tus referidos envían y se factura su carga, generas créditos.</li>
            <li>
              Ganas $ {earnPerCbm.toFixed(2)} por cada CBM totalizado de tus referidos
              {isAgent && (<Badge className="ml-1 bg-indigo-100 text-indigo-700 border-indigo-200">Tarifa agente</Badge>)}.
            </li>
            <li>Tus créditos vencen en {expirationDays} días.</li>
            {typeof maxApplyPercent === 'number' && (
              <li>
                Puedes aplicar hasta {(maxApplyPercent * 100).toFixed(0)}% del subtotal
                {typeof maxApplyUsd === 'number' && maxApplyUsd > 0 && (
                  <span> (tope $</span>
                )}
                {typeof maxApplyUsd === 'number' && maxApplyUsd > 0 && (
                  <>{maxApplyUsd.toFixed(2)}<span>)</span></>
                )}
              </li>
            )}
          </ul>
          {nextResetDate && (
            <div className="mt-3 flex items-center gap-2 text-slate-600">
              <CalendarDays className="h-4 w-4 text-amber-600" />
              <span className="text-xs">Próximo reinicio: <span className="font-medium text-slate-800">{nextResetDate}</span></span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Enlace de referidos */}
      <Card className="border-border/70 bg-card/95 shadow-card">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Tu enlace de referidos</CardTitle>
        </CardHeader>
        <CardContent className="p-4 flex flex-col md:flex-row gap-3 items-stretch md:items-center">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <Link2 className="h-4 w-4 text-slate-400" />
              <span className="text-sm text-slate-600">Compártelo con tus amigos</span>
            </div>
            <Input readOnly value={referralLink || 'Generando...'} className="mt-2" />
            {me?.referred_by_user_id && (
              <p className="text-xs text-slate-500 mt-2">Tú fuiste invitado por otro cliente, ¡también puedes invitar!</p>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={copyLink}><Copy className="h-4 w-4" /> Copiar</Button>
            <Button onClick={shareWhatsApp} className="bg-emerald-600 hover:bg-emerald-700"><Share2 className="h-4 w-4" /> WhatsApp</Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <PortalMetricCard title="Clientes referidos" value={referred.length} subtitle="Contactos vinculados" icon={Users} tone="blue" />
        <PortalMetricCard title="CBM acumulado" value={totalCbm.toFixed(2)} subtitle="Volumen total generado" icon={TrendingUp} tone="violet" />
        <PortalMetricCard title="Créditos generados" value={`$${totalCredits.toFixed(2)}`} subtitle="Histórico del programa" icon={Gift} tone="amber" />
        <PortalMetricCard title="Créditos disponibles" value={`$${availableCredits.toFixed(2)}`} subtitle={`Aplicados: $${appliedCredits.toFixed(2)}`} icon={DollarSign} tone="blue" />
      </div>

      {/* Últimas recompensas */}
      <Card className="border-border/70 bg-card/95 shadow-card">
        <CardHeader className="pb-2"><CardTitle>Últimas recompensas</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Factura</TableHead>
                <TableHead>CBM</TableHead>
                <TableHead>Crédito</TableHead>
                <TableHead>Estado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rewards.length === 0 && (
                <TableRow><TableCell colSpan={5} className="text-center text-slate-500">Aún no tienes recompensas</TableCell></TableRow>
              )}
              {rewards.slice(0, 10).map((r) => (
                <TableRow key={r.id}>
                  <TableCell>{new Date(r.created_date).toLocaleDateString()}</TableCell>
                  <TableCell className="font-mono text-xs">{r.invoice_id}</TableCell>
                  <TableCell>{Number(r.cbm_rewarded||0).toFixed(2)}</TableCell>
                  <TableCell>${Number(r.credit_generated||0).toFixed(2)}</TableCell>
                  <TableCell>
                    {r.status === 'active' ? (
                      <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200">Activa</Badge>
                    ) : (
                      <Badge className="bg-rose-100 text-rose-700 border-rose-200">Reversada</Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Tus referidos */}
      <Card className="border-border/70 bg-card/95 shadow-card">
        <CardHeader className="pb-2"><CardTitle>Tus referidos</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Se unió</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {referred.length === 0 && (
                <TableRow><TableCell colSpan={3} className="text-center text-slate-500">Aún no tienes referidos</TableCell></TableRow>
              )}
              {referred.map(u => (
                <TableRow key={u.id}>
                  <TableCell>{u.first_name ? `${u.first_name} ${u.last_name||''}`.trim() : (u.full_name || '—')}</TableCell>
                  <TableCell>{u.email}</TableCell>
                  <TableCell>{u.referral_joined_at ? new Date(u.referral_joined_at).toLocaleDateString() : new Date(u.created_date).toLocaleDateString()}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}