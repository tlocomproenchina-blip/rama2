import React, { useState, useEffect, useMemo } from 'react';
import { base44 } from '@/components/api/ApiQueueManager';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Loader2, MapPin, DollarSign, TrendingUp } from 'lucide-react';
import { CANONICAL_STATE_NAMES } from '@/components/utils/states';

export default function CbmStateCostPanel({ ingresos }) {
  const [stateConfigs, setStateConfigs] = useState([]);
  const [pricingConfig, setPricingConfig] = useState(null);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadConfigs();
  }, []);

  const loadConfigs = async () => {
    setLoading(true);
    const [states, pricing, allUsers] = await Promise.all([
      base44.entities.StateConfig.filter({ is_active: true }, '-state_name', 50),
      base44.entities.PricingConfig.filter({ config_key: 'main' }, '-updated_date', 1),
      base44.entities.User.list('-created_date', 500),
    ]);
    setStateConfigs(states || []);
    setPricingConfig(pricing?.[0] || null);
    setUsers((allUsers || []).filter(u => u.role === 'user'));
    setLoading(false);
  };

  const stateData = useMemo(() => {
    if (!pricingConfig || !stateConfigs.length || !users.length) return [];

    // Build email → state map
    const emailToState = {};
    users.forEach(u => {
      if (u.email && u.state) {
        emailToState[u.email] = String(u.state).toLowerCase();
      }
    });

    // Build state_code → config map
    const stateConfigMap = {};
    stateConfigs.forEach(s => {
      stateConfigMap[String(s.state_code).toLowerCase()] = s;
    });

    // Group CBM by state
    const stateMap = {};
    let unassignedCbm = 0;
    let unassignedCount = 0;

    (ingresos || []).forEach(item => {
      const cbm = Number(item.cbm || 0);
      if (!cbm) return;

      const clientEmail = item.client_email;
      const stateCode = clientEmail ? emailToState[clientEmail] : null;

      if (!stateCode) {
        unassignedCbm += cbm;
        unassignedCount++;
        return;
      }

      if (!stateMap[stateCode]) {
        stateMap[stateCode] = { stateCode, cbm: 0, count: 0 };
      }
      stateMap[stateCode].cbm += cbm;
      stateMap[stateCode].count++;
    });

    const baseRate = Number(pricingConfig.base_rate_regular) || 0;
    const profitPct = Number(pricingConfig.profit_percentage) || 0;
    const doorToDoor = Number(pricingConfig.door_to_door_cost) || 0;
    const rateWithProfit = baseRate * (1 + profitPct / 100);

    const results = Object.values(stateMap).map(entry => {
      const cfg = stateConfigMap[entry.stateCode];
      const stateRate = Number(cfg?.shipping_rate) || 0;
      const stateName = CANONICAL_STATE_NAMES[entry.stateCode] || cfg?.state_name || entry.stateCode;
      const costPerCbm = rateWithProfit + stateRate + doorToDoor;
      const totalCost = costPerCbm * entry.cbm;
      const pureCostPerCbm = baseRate + stateRate + doorToDoor;
      const pureCost = pureCostPerCbm * entry.cbm;
      const profit = totalCost - pureCost;

      return {
        stateCode: entry.stateCode,
        stateName,
        cbm: entry.cbm,
        count: entry.count,
        baseRate: rateWithProfit,
        stateRate,
        doorToDoor,
        costPerCbm,
        totalCost,
        pureCost,
        profit,
      };
    }).sort((a, b) => b.totalCost - a.totalCost);

    if (unassignedCbm > 0) {
      const unPureCost = (baseRate + doorToDoor) * unassignedCbm;
      const unTotalCost = (rateWithProfit + doorToDoor) * unassignedCbm;
      results.push({
        stateCode: '__sin_estado__',
        stateName: 'Sin estado asignado',
        cbm: unassignedCbm,
        count: unassignedCount,
        baseRate: rateWithProfit,
        stateRate: 0,
        doorToDoor,
        costPerCbm: rateWithProfit + doorToDoor,
        totalCost: unTotalCost,
        pureCost: unPureCost,
        profit: unTotalCost - unPureCost,
      });
    }

    return results;
  }, [ingresos, stateConfigs, pricingConfig, users]);

  const grandTotal = useMemo(() => stateData.reduce((s, d) => s + d.totalCost, 0), [stateData]);
  const totalCbm = useMemo(() => stateData.reduce((s, d) => s + d.cbm, 0), [stateData]);
  const totalProfit = useMemo(() => stateData.reduce((s, d) => s + d.profit, 0), [stateData]);
  const totalPureCost = useMemo(() => stateData.reduce((s, d) => s + d.pureCost, 0), [stateData]);

  if (loading) {
    return (
      <Card className="border-0 shadow-lg">
        <CardContent className="p-8 flex justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
        </CardContent>
      </Card>
    );
  }

  if (!stateData.length) {
    return (
      <Card className="border-0 shadow-lg">
        <CardContent className="p-8 text-center text-slate-500">
          <MapPin className="h-12 w-12 mx-auto mb-3 text-slate-300" />
          <p className="font-medium">Sin datos por estado</p>
          <p className="text-sm mt-1">Asigna clientes a los registros de CBM para ver el desglose por estado.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card className="border-0 shadow-lg bg-gradient-to-br from-emerald-50 to-teal-50">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2.5 bg-emerald-100 rounded-xl">
              <DollarSign className="h-5 w-5 text-emerald-700" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-emerald-700 font-medium">Venta total estimada</p>
              <p className="text-xl font-bold text-emerald-900">${grandTotal.toFixed(2)}</p>
              <p className="text-[11px] text-emerald-600">{totalCbm.toFixed(3)} CBM · {stateData.filter(d => d.stateCode !== '__sin_estado__').length} estado(s)</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-lg bg-gradient-to-br from-slate-50 to-gray-50">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2.5 bg-slate-100 rounded-xl">
              <DollarSign className="h-5 w-5 text-slate-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-slate-600 font-medium">Costo puro (sin ganancia)</p>
              <p className="text-xl font-bold text-slate-800">${totalPureCost.toFixed(2)}</p>
              <p className="text-[11px] text-slate-500">Base + estado + puerta</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-lg bg-gradient-to-br from-blue-50 to-indigo-50">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2.5 bg-blue-100 rounded-xl">
              <TrendingUp className="h-5 w-5 text-blue-700" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-blue-700 font-medium">Beneficio estimado</p>
              <p className="text-xl font-bold text-blue-900">${totalProfit.toFixed(2)}</p>
              <p className="text-[11px] text-blue-600">{grandTotal > 0 ? ((totalProfit / grandTotal) * 100).toFixed(1) : '0.0'}% margen</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Breakdown header */}
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-slate-600">Desglose por estado</p>
        <Badge variant="outline" className="text-xs">
          Tarifa regular + estado + puerta a puerta
        </Badge>
      </div>

      {/* Per-state cards */}
      {stateData.map((entry) => {
        const pct = grandTotal > 0 ? (entry.totalCost / grandTotal) * 100 : 0;
        return (
          <Card key={entry.stateCode} className="border-0 shadow-sm hover:shadow-md transition-shadow">
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`p-2 rounded-lg flex-shrink-0 ${entry.stateCode === '__sin_estado__' ? 'bg-slate-100' : 'bg-blue-100'}`}>
                    <MapPin className={`h-4 w-4 ${entry.stateCode === '__sin_estado__' ? 'text-slate-500' : 'text-blue-700'}`} />
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-sm text-slate-800">{entry.stateName}</p>
                    <p className="text-xs text-muted-foreground">{entry.count} registro(s) · {entry.cbm.toFixed(3)} CBM</p>
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-lg font-bold text-emerald-700">${entry.totalCost.toFixed(2)}</p>
                  <p className="text-xs text-muted-foreground">{pct.toFixed(1)}%</p>
                </div>
              </div>

              <Progress value={pct} className="h-1.5" />

              {/* Rate breakdown */}
              <div className="grid grid-cols-3 gap-2 text-xs">
                <div className="p-2 bg-slate-50 rounded-lg text-center">
                  <p className="text-muted-foreground">Tarifa base</p>
                  <p className="font-semibold text-slate-700">${entry.baseRate.toFixed(2)}</p>
                </div>
                <div className="p-2 bg-slate-50 rounded-lg text-center">
                  <p className="text-muted-foreground">+ Estado</p>
                  <p className="font-semibold text-slate-700">${entry.stateRate.toFixed(2)}</p>
                </div>
                <div className="p-2 bg-slate-50 rounded-lg text-center">
                  <p className="text-muted-foreground">+ Puerta</p>
                  <p className="font-semibold text-slate-700">${entry.doorToDoor.toFixed(2)}</p>
                </div>
              </div>

              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Costo por CBM:</span>
                <span className="font-semibold text-slate-700">${entry.costPerCbm.toFixed(2)} × {entry.cbm.toFixed(3)} CBM</span>
              </div>
              <div className="flex items-center justify-between text-xs pt-1 border-t">
                <span className="text-blue-600 font-medium">Beneficio:</span>
                <span className="font-bold text-blue-700">${entry.profit.toFixed(2)}</span>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}