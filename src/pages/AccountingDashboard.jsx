import React, { useEffect, useMemo, useState } from 'react';
import { base44 } from '@/components/api/ApiQueueManager';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { DollarSign, AlertTriangle, Wallet, Landmark, Loader2, FileText, CreditCard } from 'lucide-react';
import AccountingMetricCard from '@/components/accounting/AccountingMetricCard';
import MonthlyRevenueChart from '@/components/accounting/MonthlyRevenueChart';
import ReceivablesOverview from '@/components/accounting/ReceivablesOverview';
import ProviderPaymentsOverview from '@/components/accounting/ProviderPaymentsOverview';
import AccountingExportButtons from '@/components/accounting/AccountingExportButtons';

const money = (value) => `$${Number(value || 0).toFixed(2)}`;

function getLastMonths(count) {
  const now = new Date();
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - (count - 1 - index), 1);
    return {
      key: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`,
      label: date.toLocaleDateString('es-VE', { month: 'short', year: '2-digit' })
    };
  });
}

export default function AccountingDashboard() {
  const [loading, setLoading] = useState(true);
  const [invoices, setInvoices] = useState([]);
  const [accountsPayable, setAccountsPayable] = useState([]);
  const [providerPayments, setProviderPayments] = useState([]);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      const [invoiceList, apList, providerPaymentList] = await Promise.all([
        base44.entities.Invoice.list('-created_date', 1000),
        base44.entities.AccountsPayable.list('-created_date', 1000),
        base44.entities.ProviderPayment.list('-created_date', 1000)
      ]);
      setInvoices(invoiceList || []);
      setAccountsPayable(apList || []);
      setProviderPayments(providerPaymentList || []);
    } finally {
      setLoading(false);
    }
  };

  const report = useMemo(() => {
    const today = new Date();
    const currentMonthKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
    const paidInvoices = invoices.filter((invoice) => invoice.status === 'pagada');
    const receivableInvoices = invoices.filter((invoice) => ['pendiente', 'revision', 'vencida'].includes(invoice.status));
    const overdueInvoices = invoices.filter((invoice) => {
      if (!['pendiente', 'revision', 'vencida'].includes(invoice.status)) return false;
      return invoice.due_date && new Date(invoice.due_date) < today;
    });

    const revenueMap = new Map(getLastMonths(6).map((item) => [item.key, { ...item, amount: 0 }]));
    paidInvoices.forEach((invoice) => {
      const sourceDate = invoice.payment_date || invoice.invoice_date || invoice.created_date;
      const date = new Date(sourceDate);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      if (revenueMap.has(key)) {
        revenueMap.get(key).amount += Number(invoice.total || 0);
      }
    });

    const providerPaymentMap = new Map(getLastMonths(6).map((item) => [item.key, { ...item, amount: 0 }]));
    providerPayments.forEach((payment) => {
      const date = new Date(payment.payment_date || payment.created_date);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      if (providerPaymentMap.has(key)) {
        providerPaymentMap.get(key).amount += Number(payment.total_amount || 0);
      }
    });

    const receivables = [
      { label: 'Pendientes', amount: receivableInvoices.filter((invoice) => invoice.status === 'pendiente').reduce((sum, invoice) => sum + Number(invoice.total || 0), 0), count: receivableInvoices.filter((invoice) => invoice.status === 'pendiente').length },
      { label: 'En revisión', amount: receivableInvoices.filter((invoice) => invoice.status === 'revision').reduce((sum, invoice) => sum + Number(invoice.total || 0), 0), count: receivableInvoices.filter((invoice) => invoice.status === 'revision').length },
      { label: 'Vencidas', amount: overdueInvoices.reduce((sum, invoice) => sum + Number(invoice.total || 0), 0), count: overdueInvoices.length }
    ];

    const monthRevenue = revenueMap.get(currentMonthKey)?.amount || 0;
    const providerPaymentsMonth = providerPaymentMap.get(currentMonthKey)?.amount || 0;
    const receivablesAmount = receivableInvoices.reduce((sum, invoice) => sum + Number(invoice.total || 0), 0);
    const overdueAmount = overdueInvoices.reduce((sum, invoice) => sum + Number(invoice.total || 0), 0);

    return {
      metrics: {
        monthRevenue,
        receivablesAmount,
        overdueCount: overdueInvoices.length,
        overdueAmount,
        providerPaymentsMonth,
        apPending: accountsPayable.filter((item) => item.status !== 'pagado').reduce((sum, item) => sum + Number(item.balance_due || 0), 0)
      },
      monthlyRevenue: Array.from(revenueMap.values()),
      providerPaymentsChart: Array.from(providerPaymentMap.values()),
      receivables,
      recentProviderPayments: providerPayments.slice(0, 5)
    };
  }, [invoices, accountsPayable, providerPayments]);

  if (loading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-blue-600" /></div>;
  }

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-800">Dashboard de Contabilidad</h1>
          <p className="text-slate-500">Visión financiera de ingresos, cobranza y pagos a proveedores.</p>
        </div>
        <AccountingExportButtons report={report} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <AccountingMetricCard title="Ingresos del mes" value={money(report.metrics.monthRevenue)} subtitle="Facturas pagadas" icon={DollarSign} accent="bg-emerald-100 text-emerald-700" />
        <AccountingMetricCard title="Cuentas por cobrar" value={money(report.metrics.receivablesAmount)} subtitle="Facturas pendientes y en revisión" icon={Wallet} accent="bg-blue-100 text-blue-700" />
        <AccountingMetricCard title="Facturas vencidas" value={String(report.metrics.overdueCount)} subtitle={money(report.metrics.overdueAmount)} icon={AlertTriangle} accent="bg-amber-100 text-amber-700" />
        <AccountingMetricCard title="Pagos proveedores" value={money(report.metrics.providerPaymentsMonth)} subtitle={`AP pendiente: ${money(report.metrics.apPending)}`} icon={Landmark} accent="bg-teal-100 text-teal-700" />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <MonthlyRevenueChart data={report.monthlyRevenue} />
        <ReceivablesOverview data={report.receivables} totalAmount={report.metrics.receivablesAmount} />
      </div>

      <ProviderPaymentsOverview chartData={report.providerPaymentsChart} recentPayments={report.recentProviderPayments} />

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <Link to={createPageUrl('AdminInvoices')}>
          <Card className="border-0 shadow-md hover:shadow-lg transition-all cursor-pointer h-full"><CardContent className="p-6 flex items-center gap-4"><div className="p-4 bg-blue-100 rounded-xl"><FileText className="h-6 w-6 text-blue-600" /></div><div><h3 className="font-semibold text-slate-800">Facturas</h3><p className="text-sm text-slate-500">Gestionar cobranzas</p></div></CardContent></Card>
        </Link>
        <Link to={createPageUrl('AdminPayments')}>
          <Card className="border-0 shadow-md hover:shadow-lg transition-all cursor-pointer h-full"><CardContent className="p-6 flex items-center gap-4"><div className="p-4 bg-emerald-100 rounded-xl"><CreditCard className="h-6 w-6 text-emerald-600" /></div><div><h3 className="font-semibold text-slate-800">Validar pagos</h3><p className="text-sm text-slate-500">Comprobantes y revisiones</p></div></CardContent></Card>
        </Link>
        <Link to={createPageUrl('AdminAccountsPayable')}>
          <Card className="border-0 shadow-md hover:shadow-lg transition-all cursor-pointer h-full"><CardContent className="p-6 flex items-center gap-4"><div className="p-4 bg-amber-100 rounded-xl"><Wallet className="h-6 w-6 text-amber-600" /></div><div><h3 className="font-semibold text-slate-800">Cuentas por pagar</h3><p className="text-sm text-slate-500">Deuda y saldos</p></div></CardContent></Card>
        </Link>
        <Link to={createPageUrl('AdminProviderPayments')}>
          <Card className="border-0 shadow-md hover:shadow-lg transition-all cursor-pointer h-full"><CardContent className="p-6 flex items-center gap-4"><div className="p-4 bg-teal-100 rounded-xl"><Landmark className="h-6 w-6 text-teal-700" /></div><div><h3 className="font-semibold text-slate-800">Pagos proveedores</h3><p className="text-sm text-slate-500">Histórico y distribución</p></div></CardContent></Card>
        </Link>
      </div>

      <div className="flex justify-end">
        <Button variant="outline" onClick={loadDashboardData}>Actualizar</Button>
      </div>
    </div>
  );
}