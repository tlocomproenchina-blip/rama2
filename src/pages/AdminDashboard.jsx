import React, { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  Package, 
  Layers, 
  Users, 
  DollarSign,
  AlertTriangle,
  CheckCircle2,
  Truck,
  Clock,
  ArrowRight,
  TrendingUp,
  Loader2,
  MapPin,
  Shield,
  AlertCircle
} from 'lucide-react';
import { LineChart, Line, BarChart, Bar, AreaChart, Area, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import StatusBadge from '@/components/StatusBadge';
import ChangeDetectionBadge from '@/components/ChangeDetectionBadge';
import { format, subDays, startOfDay } from 'date-fns';
import { toast } from 'sonner';

export default function AdminDashboard({ user }) {
  // Block access if not admin
  if (!user || user.role !== 'admin') {
    return (
      <div className="flex items-center justify-center h-screen">
        <Card className="max-w-md p-8 text-center">
          <AlertCircle className="h-12 w-12 text-red-600 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-slate-800 mb-2">Acceso Denegado</h2>
          <p className="text-slate-600">Solo los administradores pueden acceder a este panel.</p>
        </Card>
      </div>
    );
  }

  const [stats, setStats] = useState({
    totalPackages: 0,
    preAlertas: 0,
    recibidos: 0,
    enTransito: 0,
    disponibles: 0,
    entregados: 0,
    consolidaciones: 0,
    pendientesPago: 0,
    clientes: 0,
    totalIngresos: 0,
    asegurados: 0,
    valorSeguro: 0
  });
  const [analyticsKPIs, setAnalyticsKPIs] = useState({
    activeClients: 0,
    packagesInTransit: 0,
    validatedRevenue: 0,
    avgValidationTime: 0
  });
  const [recentPackages, setRecentPackages] = useState([]);
  const [pendingPayments, setPendingPayments] = useState([]);
  const [chartData, setChartData] = useState({ daily: [], statusDist: [], shippingType: [], revenue: [], validationTimes: [] });
  const [loading, setLoading] = useState(true);

  const [recentChanges, setRecentChanges] = useState([]);
  const [lastRefreshTime, setLastRefreshTime] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [isVisible, setIsVisible] = useState(true);
  const [nextRefreshIn, setNextRefreshIn] = useState(0);
  const [cooldownActive, setCooldownActive] = useState(false);
  const [cooldownRemaining, setCooldownRemaining] = useState(0);
  
  const intervalRef = useRef(null);
  const countdownRef = useRef(null);
  const cooldownRef = useRef(null);
  const cooldownTimerRef = useRef(null);
  const lastRefreshRef = useRef(Date.now());
  const lastManualRefreshRef = useRef(0);
  const refreshLockRef = useRef(false);

  // Visibility change handler
  useEffect(() => {
    const handleVisibilityChange = () => {
      setIsVisible(document.visibilityState === 'visible');
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  // Polling hybrid system
  useEffect(() => {
    if (cooldownActive) return;

    const startAutoRefresh = () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (countdownRef.current) clearInterval(countdownRef.current);

      const interval = isVisible ? 60 * 1000 : 5 * 60 * 1000;
      let remaining = interval / 1000;

      // Countdown timer
      countdownRef.current = setInterval(() => {
        setNextRefreshIn(--remaining);
      }, 1000);

      // Auto-refresh
      intervalRef.current = setInterval(() => {
        autoRefresh();
      }, interval);

      setNextRefreshIn(interval / 1000);
    };

    startAutoRefresh();

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, [isVisible, cooldownActive]);

  const autoRefresh = async () => {
    try {
      lastRefreshRef.current = Date.now();
      await loadDashboardData();
    } catch (error) {
      console.error('Auto-refresh error:', error);
    }
  };

  const handleRateLimitCooldown = () => {
    setCooldownActive(true);
    const cooldownMs = 10 * 60 * 1000;
    let remaining = 10;

    setCooldownRemaining(remaining);
    
    cooldownTimerRef.current = setInterval(() => {
      remaining--;
      setCooldownRemaining(remaining);
      
      if (remaining <= 0) {
        clearInterval(cooldownTimerRef.current);
        setCooldownActive(false);
        toast.success('Auto-refresh reanudado');
      }
    }, 60000);

    setTimeout(() => {
      setCooldownActive(false);
    }, cooldownMs);
  };

  const handleRefresh = async () => {
    const now = Date.now();
    const timeSinceLastManual = (now - lastManualRefreshRef.current) / 1000;

    if (timeSinceLastManual < 60) {
      const remainingTime = Math.ceil(60 - timeSinceLastManual);
      toast.error(`Espera ${remainingTime}s antes de actualizar manualmente`);
      return;
    }

    if (refreshLockRef.current) {
      toast.info('Actualización en progreso...');
      return;
    }

    setRefreshing(true);
    lastManualRefreshRef.current = now;
    lastRefreshRef.current = now;
    
    // Restart intervals
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (countdownRef.current) clearInterval(countdownRef.current);
    
    await loadDashboardData();
    setRefreshing(false);
    toast.success('Dashboard actualizado');
  };

  // Granular data loading functions for partial refresh
  const loadPackagesData = async () => {
    // Query recent packages (last 30 days, limit 100)
    const thirtyDaysAgo = subDays(new Date(), 30).toISOString();
    const startTime = performance.now();
    console.log('🔍 [PERF] Loading packages...');
    const recentPackages = await base44.entities.Package.list('-created_date', 100);
    const duration = performance.now() - startTime;
    console.log(`✅ [PERF] Packages loaded: ${recentPackages.length} records in ${duration.toFixed(0)}ms`);
    
    // Calculate counts from recent data
    const receivedCount = recentPackages.filter(p => p.status === 'recibido').length;
    const preAlertCount = recentPackages.filter(p => p.status === 'pre_alerta').length;
    const consolidatedCount = recentPackages.filter(p => p.status === 'consolidado').length;
    const inTransitCount = recentPackages.filter(p => p.status === 'en_transito').length;
    const entregadosCount = recentPackages.filter(p => p.status === 'entregado').length;
    const disponiblesCount = recentPackages.filter(p => p.status === 'disponible').length;

    // Calculate chart data for last 7 days from recent data
    const last7Days = [];
    for (let i = 6; i >= 0; i--) {
      const date = startOfDay(subDays(new Date(), i));
      const nextDate = new Date(date.getTime() + 24*60*60*1000);
      const count = recentPackages.filter(p => {
        const pDate = new Date(p.created_date);
        return pDate >= date && pDate < nextDate;
      }).length;
      last7Days.push({ date: format(date, 'dd MMM'), count });
    }

    setStats(prev => ({
      ...prev,
      totalPackages: recentPackages.length,
      recibidos: receivedCount,
      preAlertas: preAlertCount,
      enTransito: inTransitCount,
      entregados: entregadosCount,
      disponibles: disponiblesCount
    }));

    setChartData(prev => ({ ...prev, daily: last7Days }));
    setRecentPackages(recentPackages.slice(0, 5));
    return recentPackages;
  };

  const loadConsolidationsData = async () => {
    // Query recent consolidations (last 30 days, limit 100)
    const startTime = performance.now();
    console.log('🔍 [PERF] Loading consolidations...');
    const recentCons = await base44.entities.Consolidation.list('-created_date', 100);
    const duration = performance.now() - startTime;
    console.log(`✅ [PERF] Consolidations loaded: ${recentCons.length} records in ${duration.toFixed(0)}ms`);
    
    // Calculate counts and metrics
    const transiting = recentCons.filter(c => c.status === 'en_transito').length;
    const available = recentCons.filter(c => c.status === 'disponible').length;
    const delivered = recentCons.filter(c => c.status === 'entregado').length;
    const pendingPayment = recentCons.filter(c => c.status === 'pago_validado').length;

    const totalRevenue = recentCons.reduce((sum, c) => sum + (c.total_cost || 0), 0);
    
    const shippingType = [
      { name: 'Aéreo', value: recentCons.filter(c => c.shipping_type === 'aereo').length },
      { name: 'Marítimo', value: recentCons.filter(c => c.shipping_type === 'maritimo').length }
    ];

    const statusDist = [
      { name: 'En Tránsito', value: transiting },
      { name: 'Pago Validado', value: pendingPayment },
      { name: 'Disponible', value: available },
      { name: 'Entregado', value: delivered }
    ];

    const validationTimesData = recentCons
      .filter(c => c.payment_validation_date && c.payment_date)
      .map(c => ({
        name: c.consolidation_tracking?.substring(0, 6) || 'N/A',
        hours: Math.round((new Date(c.payment_validation_date) - new Date(c.payment_date)) / (1000*60*60))
      }))
      .slice(0, 10);

    const revenueByDay = [];
    for (let i = 6; i >= 0; i--) {
      const date = startOfDay(subDays(new Date(), i));
      const nextDate = new Date(date.getTime() + 24*60*60*1000);
      const dayRevenue = recentCons
        .filter(c => {
          const cDate = new Date(c.created_date);
          return cDate >= date && cDate < nextDate;
        })
        .reduce((sum, c) => sum + (c.total_cost || 0), 0);
      revenueByDay.push({ date: format(date, 'dd MMM'), revenue: dayRevenue });
    }

    const pendingPays = recentCons.filter(c => c.status === 'pago_validado').slice(0, 3);

    setStats(prev => ({
      ...prev,
      consolidaciones: recentCons.length,
      pendientesPago: pendingPayment,
      totalIngresos: totalRevenue
    }));

    setChartData(prev => ({ ...prev, statusDist, shippingType, revenue: revenueByDay, validationTimes: validationTimesData }));
    setPendingPayments(pendingPays);
    return recentCons;
  };

  const loadUsersData = async () => {
    // Query users with limit
    const startTime = performance.now();
    console.log('🔍 [PERF] Loading users...');
    const users = await base44.entities.User.list('-created_date', 200);
    const duration = performance.now() - startTime;
    console.log(`✅ [PERF] Users loaded: ${users.length} records in ${duration.toFixed(0)}ms`);
    const activeClients = users.filter(u => u.profile_completed).length;
    
    setStats(prev => ({ 
      ...prev, 
      clientes: users.length 
    }));
    
    return { users, activeClients };
  };

  const loadDashboardData = async () => {
    // Check refresh lock to prevent concurrent loads
    if (refreshLockRef.current) {
      console.log('⚠️ [PERF] Refresh already in progress, skipping...');
      return;
    }

    try {
      refreshLockRef.current = true;
      const dashboardStartTime = performance.now();
      console.log('🚀 [PERF] ===== DASHBOARD LOAD START =====');
      console.log(`👤 [PERF] User role: ${user?.role}, Email: ${user?.email}`);
      
      // Double-check admin status before queries
      if (user?.role !== 'admin') {
        console.error('❌ [PERF] Non-admin attempting to load admin dashboard');
        throw new Error('Unauthorized: Admin role required');
      }
      
      // Load packages and consolidations sequentially (no Promise.all)
      const packages = await loadPackagesData();
      const consolidations = await loadConsolidationsData();
      
      // Load users separately
      const { users, activeClients } = await loadUsersData();

      // Calculate insurance stats from packages
      const insuredPackages = packages.filter(p => p.has_insurance);
      const totalInsuredValue = insuredPackages.reduce((sum, p) => sum + (p.fob_value || 0), 0);

      setStats(prev => ({
        ...prev,
        asegurados: insuredPackages.length,
        valorSeguro: totalInsuredValue
      }));

      // Analytics KPIs
      const packagesInTransit = packages.filter(p => p.status === 'en_transito').length;
      const validatedRevenue = consolidations
        .filter(c => c.payment_validated && (c.payment_amount || c.total_cost))
        .reduce((sum, c) => sum + (c.payment_amount || c.total_cost || 0), 0);

      const validatedConsolidations = consolidations.filter(c => 
        c.payment_validated && c.payment_date && c.payment_validation_date
      );
      const avgValidationTime = validatedConsolidations.length > 0
        ? validatedConsolidations.reduce((sum, c) => {
            const paymentTime = new Date(c.payment_date).getTime();
            const validationTime = new Date(c.payment_validation_date).getTime();
            const hours = (validationTime - paymentTime) / (1000 * 60 * 60);
            return sum + Math.max(0, hours);
          }, 0) / validatedConsolidations.length
        : 0;

      setAnalyticsKPIs({
        activeClients,
        packagesInTransit,
        validatedRevenue,
        avgValidationTime
      });

      const totalDuration = performance.now() - dashboardStartTime;
      console.log('🏁 [PERF] ===== DASHBOARD LOAD COMPLETE =====');
      console.log(`⏱️ [PERF] Total dashboard load time: ${totalDuration.toFixed(0)}ms`);
      
      if (totalDuration > 3000) {
        console.warn('⚠️ [PERF] Dashboard load exceeded 3 seconds!');
      }
    } catch (error) {
      console.error('❌ [PERF] Dashboard error:', error);
      console.error('❌ [PERF] Error details:', {
        message: error?.message,
        status: error?.status,
        stack: error?.stack?.split('\n').slice(0, 3)
      });

      // Detect rate limit error
      if (error?.message?.includes('Rate limit') || error?.message?.includes('rate limit') || error?.status === 429) {
        handleRateLimitCooldown();
        toast.error('Límite de solicitudes excedido. Auto-refresh pausado por 10 minutos');
      } else {
        toast.error('Error al cargar dashboard');
      }
    } finally {
      refreshLockRef.current = false;
      setLoading(false);
    }
  };

  // Partial refresh functions (for ChangeDetectionBadge)
  const refreshPackages = async () => {
    setRefreshing(true);
    await loadPackagesData();
    setRefreshing(false);
    toast.success('✅ Paquetes actualizados');
  };

  const refreshConsolidations = async () => {
    setRefreshing(true);
    await loadConsolidationsData();
    setRefreshing(false);
    toast.success('✅ Consolidaciones actualizadas');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Change Detection Badge */}
      <ChangeDetectionBadge 
        onRefresh={handleRefresh}
        onRefreshPackages={refreshPackages}
        onRefreshConsolidations={refreshConsolidations}
      />

      {/* Cooldown Warning Banner */}
      {cooldownActive && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3">
          <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0" />
          <div className="flex-1">
            <p className="font-medium text-red-800">
              ⏸️ Auto-refresh pausado por límites temporales
            </p>
            <p className="text-sm text-red-700">
              Reintentaremos en {cooldownRemaining} min
            </p>
          </div>
        </div>
      )}

      {/* Status Bar */}
      <div className="bg-gradient-to-r from-slate-50 to-slate-100 border border-slate-200 rounded-lg p-4 flex items-center justify-between">
        <div className="text-sm">
          <span className="text-slate-700 font-medium">
            🔄 Auto-refresh: <span className="text-green-600 font-bold">ON</span>
          </span>
          <span className="text-slate-600 ml-4">
            ({isVisible ? '60s activo' : '5m inactivo'})
          </span>
          <span className="text-slate-600 ml-4">
            • Última actualización: <span className="font-mono">{format(new Date(lastRefreshRef.current), 'HH:mm:ss')}</span>
          </span>
        </div>
        <div className="text-sm font-medium text-blue-600">
          ⏱️ Próxima en: {nextRefreshIn}s
        </div>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Panel de Administración</h1>
          <p className="text-slate-500">Bienvenido, {user?.full_name || user?.email}</p>
        </div>
        <Button
          onClick={handleRefresh}
          disabled={refreshing || cooldownActive}
          variant="outline"
          size="lg"
          className="flex items-center gap-2"
        >
          {refreshing ? (
            <><Loader2 className="h-5 w-5 animate-spin" /> Actualizando...</>
          ) : (
            <><TrendingUp className="h-5 w-5" /> Actualizar Dashboard</>
          )}
        </Button>
      </div>

      {/* Analytics KPIs Section */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl p-6 text-white shadow-xl">
        <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
          <TrendingUp className="h-6 w-6" />
          📊 Key Performance Indicators
        </h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-5 hover:bg-white/20 transition-all">
            <div className="flex items-center justify-between mb-2">
              <Users className="h-6 w-6 text-blue-200" />
              <span className="text-xs text-blue-200 font-medium">Clientes</span>
            </div>
            <p className="text-4xl font-bold">{analyticsKPIs.activeClients}</p>
            <p className="text-xs text-blue-200 mt-1">Activos</p>
          </div>

          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-5 hover:bg-white/20 transition-all">
            <div className="flex items-center justify-between mb-2">
              <Truck className="h-6 w-6 text-indigo-200" />
              <span className="text-xs text-indigo-200 font-medium">En Tránsito</span>
            </div>
            <p className="text-4xl font-bold">{analyticsKPIs.packagesInTransit}</p>
            <p className="text-xs text-indigo-200 mt-1">Paquetes</p>
          </div>

          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-5 hover:bg-white/20 transition-all">
            <div className="flex items-center justify-between mb-2">
              <DollarSign className="h-6 w-6 text-emerald-200" />
              <span className="text-xs text-emerald-200 font-medium">Ingresos</span>
            </div>
            <p className="text-4xl font-bold">${analyticsKPIs.validatedRevenue.toFixed(0)}</p>
            <p className="text-xs text-emerald-200 mt-1">Validados</p>
          </div>

          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-5 hover:bg-white/20 transition-all">
            <div className="flex items-center justify-between mb-2">
              <Clock className="h-6 w-6 text-purple-200" />
              <span className="text-xs text-purple-200 font-medium">Tiempo Prom.</span>
            </div>
            <p className="text-4xl font-bold">{analyticsKPIs.avgValidationTime.toFixed(1)}</p>
            <p className="text-xs text-purple-200 mt-1">Horas validación</p>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-0 shadow-md bg-gradient-to-br from-blue-50 to-white">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Total Paquetes</p>
                <p className="text-3xl font-bold text-slate-800">{stats.totalPackages}</p>
              </div>
              <div className="p-3 bg-blue-100 rounded-xl">
                <Package className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md bg-gradient-to-br from-amber-50 to-white">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Pre-alertas</p>
                <p className="text-3xl font-bold text-slate-800">{stats.preAlertas}</p>
              </div>
              <div className="p-3 bg-amber-100 rounded-xl">
                <AlertTriangle className="h-6 w-6 text-amber-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md bg-gradient-to-br from-indigo-50 to-white">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">En Tránsito</p>
                <p className="text-3xl font-bold text-slate-800">{stats.enTransito}</p>
              </div>
              <div className="p-3 bg-indigo-100 rounded-xl">
                <Truck className="h-6 w-6 text-indigo-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md bg-gradient-to-br from-green-50 to-white">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Entregados</p>
                <p className="text-3xl font-bold text-slate-800">{stats.entregados}</p>
              </div>
              <div className="p-3 bg-green-100 rounded-xl">
                <CheckCircle2 className="h-6 w-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md bg-gradient-to-br from-purple-50 to-white">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Recibidos</p>
                <p className="text-3xl font-bold text-slate-800">{stats.recibidos}</p>
              </div>
              <div className="p-3 bg-purple-100 rounded-xl">
                <Layers className="h-6 w-6 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md bg-gradient-to-br from-teal-50 to-white">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Disponibles</p>
                <p className="text-3xl font-bold text-slate-800">{stats.disponibles}</p>
              </div>
              <div className="p-3 bg-teal-100 rounded-xl">
                <MapPin className="h-6 w-6 text-teal-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md bg-gradient-to-br from-emerald-50 to-white">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Clientes</p>
                <p className="text-3xl font-bold text-slate-800">{stats.clientes}</p>
              </div>
              <div className="p-3 bg-emerald-100 rounded-xl">
                <Users className="h-6 w-6 text-emerald-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md bg-gradient-to-br from-orange-50 to-white">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Asegurados</p>
                <p className="text-3xl font-bold text-slate-800">{stats.asegurados}</p>
                <p className="text-xs text-orange-600 mt-1">${stats.valorSeguro.toFixed(0)}</p>
              </div>
              <div className="p-3 bg-orange-100 rounded-xl">
                <Shield className="h-6 w-6 text-orange-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Revenue & Consolidations */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="border-0 shadow-lg bg-gradient-to-r from-emerald-600 to-emerald-700 text-white">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-emerald-100">Ingresos Totales</p>
                <p className="text-4xl font-bold mt-1">${stats.totalIngresos.toFixed(2)}</p>
                <p className="text-emerald-200 text-sm mt-2 flex items-center gap-1">
                  <TrendingUp className="h-4 w-4" />
                  Pagos validados
                </p>
              </div>
              <div className="p-4 bg-white/20 rounded-2xl">
                <DollarSign className="h-10 w-10" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-lg bg-gradient-to-r from-purple-600 to-purple-700 text-white">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-purple-100">Total Consolidaciones</p>
                <p className="text-4xl font-bold mt-1">{stats.consolidaciones}</p>
                <p className="text-purple-200 text-sm mt-2 flex items-center gap-1">
                  <Clock className="h-4 w-4" />
                  {stats.pendientesPago} pendientes de pago
                </p>
              </div>
              <div className="p-4 bg-white/20 rounded-2xl">
                <Layers className="h-10 w-10" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Analytics Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="border-0 shadow-lg">
          <CardHeader>
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-emerald-600" />
              Ingresos Validados (Últimos 7 días)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <AreaChart data={chartData.revenue}>
                <defs>
                  <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="date" stroke="#64748b" />
                <YAxis stroke="#64748b" />
                <Tooltip 
                  formatter={(value) => [`$${value.toFixed(2)}`, 'Ingresos']}
                  contentStyle={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px' }}
                />
                <Area type="monotone" dataKey="revenue" stroke="#10b981" fillOpacity={1} fill="url(#colorRevenue)" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-lg">
          <CardHeader>
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <Clock className="h-5 w-5 text-purple-600" />
              Tiempo de Validación (Últimos 10)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={chartData.validationTimes}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="name" stroke="#64748b" />
                <YAxis stroke="#64748b" />
                <Tooltip 
                  formatter={(value) => [`${value} hrs`, 'Tiempo']}
                  contentStyle={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px' }}
                />
                <Bar dataKey="hours" fill="#8b5cf6" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="border-0 shadow-lg">
          <CardHeader>
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-blue-600" />
              Tendencia de Paquetes (Últimos 7 días)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={chartData.daily}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="date" stroke="#64748b" />
                <YAxis stroke="#64748b" />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px' }}
                />
                <Line type="monotone" dataKey="count" stroke="#3b82f6" strokeWidth={2} dot={{ fill: '#3b82f6', r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-lg">
          <CardHeader>
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <Package className="h-5 w-5 text-purple-600" />
              Distribución por Estado
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={chartData.statusDist}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={(entry) => `${entry.name}: ${entry.value}`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {chartData.statusDist.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={['#f59e0b', '#3b82f6', '#6366f1', '#10b981', '#22c55e'][index % 5]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-lg">
          <CardHeader>
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <Truck className="h-5 w-5 text-indigo-600" />
              Tipo de Envío
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={chartData.shippingType}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="name" stroke="#64748b" />
                <YAxis stroke="#64748b" />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px' }}
                />
                <Bar dataKey="value" fill="#6366f1" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {stats.pendientesPago > 0 && (
          <Card className="border-0 shadow-lg border-l-4 border-l-yellow-500">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg font-semibold flex items-center gap-2">
                <Clock className="h-5 w-5 text-yellow-600" />
                Pagos Pendientes
                <span className="ml-auto bg-yellow-100 text-yellow-800 text-sm px-2 py-0.5 rounded-full">
                  {stats.pendientesPago}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {pendingPayments.map((con) => (
                  <div key={con.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                    <div>
                      <p className="font-medium text-slate-800">{con.consolidation_tracking}</p>
                      <p className="text-sm text-slate-500">${con.total_cost?.toFixed(2)}</p>
                    </div>
                    <StatusBadge status={con.status} size="sm" />
                  </div>
                ))}
              </div>
              <Link to={createPageUrl('AdminPayments')}>
                <Button variant="outline" className="w-full mt-4">
                  Ver Todos <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </Link>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Changes - Real-time */}
        <Card className="border-0 shadow-lg">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-600" />
              Actividad en Tiempo Real
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {recentChanges.length === 0 ? (
                <p className="text-slate-500 text-sm text-center py-8">Sin cambios recientes</p>
              ) : (
                recentChanges.map((change) => (
                  <div key={`${change.type}-${change.id}`} className={`p-3 rounded-lg border-l-4 ${
                    change.action === 'create' ? 'bg-green-50 border-l-green-500' :
                    change.action === 'update' ? 'bg-blue-50 border-l-blue-500' :
                    'bg-red-50 border-l-red-500'
                  }`}>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <p className="font-medium text-slate-800 text-sm">{change.title}</p>
                        <p className="text-xs text-slate-500 mt-1">
                          {change.tracking || change.client || 'Sin datos'}
                        </p>
                      </div>
                      <p className="text-xs text-slate-400">{change.timestamp}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        {/* Recent Packages */}
        <Card className="border-0 shadow-lg">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <Package className="h-5 w-5 text-blue-600" />
              Paquetes Recientes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {recentPackages.map((pkg) => (
                <div key={pkg.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                  <div>
                    <p className="font-medium text-slate-800 font-mono">{pkg.tracking_number}</p>
                    <p className="text-sm text-slate-500">{pkg.shipping_mark}</p>
                  </div>
                  <StatusBadge status={pkg.status} size="sm" />
                </div>
              ))}
            </div>
            <Link to={createPageUrl('AdminPackages')}>
              <Button variant="outline" className="w-full mt-4">
                Ver Todos <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Link to={createPageUrl('AdminPackages')}>
          <Card className="border-0 shadow-md hover:shadow-lg transition-all cursor-pointer group h-full">
            <CardContent className="p-6 flex items-center gap-4">
              <div className="p-4 bg-blue-100 rounded-xl group-hover:bg-blue-200 transition-colors">
                <Package className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <h3 className="font-semibold text-slate-800">Gestionar Paquetes</h3>
                <p className="text-slate-500 text-sm">Recepción y seguimiento</p>
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link to={createPageUrl('AdminConsolidate')}>
          <Card className="border-0 shadow-md hover:shadow-lg transition-all cursor-pointer group h-full">
            <CardContent className="p-6 flex items-center gap-4">
              <div className="p-4 bg-purple-100 rounded-xl group-hover:bg-purple-200 transition-colors">
                <Layers className="h-6 w-6 text-purple-600" />
              </div>
              <div>
                <h3 className="font-semibold text-slate-800">Consolidar Cargas</h3>
                <p className="text-slate-500 text-sm">Agrupar paquetes</p>
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link to={createPageUrl('AdminClients')}>
          <Card className="border-0 shadow-md hover:shadow-lg transition-all cursor-pointer group h-full">
            <CardContent className="p-6 flex items-center gap-4">
              <div className="p-4 bg-emerald-100 rounded-xl group-hover:bg-emerald-200 transition-colors">
                <Users className="h-6 w-6 text-emerald-600" />
              </div>
              <div>
                <h3 className="font-semibold text-slate-800">Clientes</h3>
                <p className="text-slate-500 text-sm">Gestión de usuarios</p>
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>
    </div>
  );
}