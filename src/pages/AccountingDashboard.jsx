import React from 'react';
import { Link } from 'react-router-dom';
import { format, isSameMonth, subMonths } from 'date-fns';
import { es } from 'date-fns/locale';
import { base44 } from '@/components/api/ApiQueueManager';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, TrendingUp, Wallet, AlertTriangle, ArrowRight, FileText, CreditCard } from 'lucide-react';
import AccountingMetricCard from '@/components/accounting/AccountingMetricCard';
import MonthlyRevenueChart from '@/components/accounting/MonthlyRevenueChart';
import ReceivablesOverview from '@/components/accounting/ReceivablesOverview';
import ProviderPaymentsOverview from '@/components/accounting/ProviderPaymentsOverview';
import AccountingExportButtons from '@/components/accounting/AccountingExportButtons';
import PageHero from '@/components/common/PageHero';

function sumAmounts(items, getValue) {
  return (items || []).reduce((total, item) => total + Number(getValue(item) || 0), 0);
}

function buildMonthlySeries(invoices, payables) {
  const months = Array.from({ length: 6 }, (_, index) => subMonths(new Date(), 5 - index));

  const monthlyRevenue = months.map((monthDate) => {
    const amount = sumAmounts(invoices, (invoice) => {
      const sourceDate = invoice.payment_date || invoice.invoice_date || invoice.updated_date || invoice.created_date;
      return sourceDate && invoice.status === 'pagada' && isSameMonth(new Date(sourceDate), monthDate) ? invoice.total : 0;
    });

    return {
      label: format(monthDate, 'MMM', { locale: es }),
      amount,
    };
  });

  const providerPayments = months.map((monthDate) => {
    const amount = sumAmounts(payables, (item) => {
      const sourceDate = item.payment_date || item.updated_date || item.created_date;
      return sourceDate && Number(item.amount_paid || 0) > 0 && isSameMonth(new Date(sourceDate), monthDate) ? item.amount_paid : 0;
    });

    return {
      label: format(monthDate, 'MMM', { locale: es }),
      amount,
    };
  });

  return { monthlyRevenue, providerPayments };
}

export default function AccountingDashboard({ user }) {
  const [loading, setLoading] = React.useState(true);
  const [report, setReport] = React.useState({
    metrics: {
      monthRevenue: 0,
      receivablesAmount: 0,
      overdueCount: 0,
      overdueAmount: 0,
      providerPaymentsMonth: 0,
    },
    monthlyRevenue: [],
    receivables: [],
    providerPayments: [],
    recentProviderPayments: [],
  });

  React.useEffect(() => {
    let active = true;

    const loadDashboard = async () => {
      setLoading(true);

      const [invoices, payables] = await Promise.all([
        base44.entities.Invoice.list('-updated_date', 300),
        base44.entities.AccountsPayable.list('-updated_date', 300),
      ]);

      const now = new Date();
      const receivableStatuses = ['pendiente', 'revision', 'vencida'];
      const receivableInvoices = (invoices || []).filter((invoice) => receivableStatuses.includes(invoice.status));
      const overdueInvoices = (invoices || []).filter((invoice) => invoice.status === 'vencida');
      const paidThisMonth = (invoices || []).filter((invoice) => {
        const sourceDate = invoice.payment_date || invoice.invoice_date || invoice.updated_date || invoice.created_date;
        return sourceDate && invoice.status === 'pagada' && isSameMonth(new Date(sourceDate), now);
      });
      const providerPaidThisMonth = (payables || []).filter((item) => {
        const sourceDate = item.payment_date || item.updated_date || item.created_date;
        return sourceDate && Number(item.amount_paid || 0) > 0 && isSameMonth(new Date(sourceDate), now);
      });

      const receivables = [
        { label: 'Pendientes', count: (invoices || []).filter((invoice) => invoice.status === 'pendiente').length, amount: sumAmounts(invoices, (invoice) => invoice.status === 'pendiente' ? invoice.total : 0) },
        { label: 'En revisión', count: (invoices || []).filter((invoice) => invoice.status === 'revision').length, amount: sumAmounts(invoices, (invoice) => invoice.status === 'revision' ? invoice.total : 0) },
        { label: 'Vencidas', count: overdueInvoices.length, amount: sumAmounts(overdueInvoices, (invoice) => invoice.total) },
      ];

      const { monthlyRevenue, providerPayments } = buildMonthlySeries(invoices || [], payables || []);

      const recentProviderPayments = (payables || [])
        .filter((item) => Number(item.amount_paid || 0) > 0)
        .sort((a, b) => new Date(b.payment_date || b.updated_date || b.created_date || 0) - new Date(a.payment_date || a.updated_date || a.created_date || 0))
        .slice(0, 5)
        .map((item) => ({
          id: item.id,
          provider_name: item.vendor_name,
          payment_date: item.payment_date || item.updated_date || item.created_date,
          method: item.payment_reference || item.status || 'Pago registrado',
          total_amount: item.amount_paid,
        }));

      if (active) {
        setReport({
          metrics: {
            monthRevenue: sumAmounts(paidThisMonth, (invoice) => invoice.total),
            receivablesAmount: sumAmounts(receivableInvoices, (invoice) => invoice.total),
            overdueCount: overdueInvoices.length,
            overdueAmount: sumAmounts(overdueInvoices, (invoice) => invoice.total),
            providerPaymentsMonth: sumAmounts(providerPaidThisMonth, (item) => item.amount_paid),
          },
          monthlyRevenue,
          receivables,
          providerPayments,
          recentProviderPayments,
        });
        setLoading(false);
      }
    };

    loadDashboard();
    return () => {
      active = false;
    };
  }, []);

  if (user?.role !== 'admin') {
    return (
      <Card className="border-0 shadow-lg">
        <CardContent className="p-8 text-center text-slate-600">
          No tienes acceso a este panel.
        </CardContent>
      </Card>
    );
  }

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-8">
      <PageHero
        icon={Wallet}
        badge="Centro financiero"
        title="Dashboard Contabilidad"
        description="Resumen rápido de ingresos, cuentas por cobrar y pagos a proveedores."
        actions={<AccountingExportButtons report={report} />}
      />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <AccountingMetricCard title="Ingresos del mes" value={`$${report.metrics.monthRevenue.toFixed(2)}`} subtitle="Facturas pagadas este mes" icon={TrendingUp} accent="bg-emerald-100 text-emerald-700" />
        <AccountingMetricCard title="Por cobrar" value={`$${report.metrics.receivablesAmount.toFixed(2)}`} subtitle="Facturas pendientes y en revisión" icon={Wallet} accent="bg-blue-100 text-blue-700" />
        <AccountingMetricCard title="Facturas vencidas" value={String(report.metrics.overdueCount)} subtitle={`$${report.metrics.overdueAmount.toFixed(2)} en riesgo`} icon={AlertTriangle} accent="bg-amber-100 text-amber-700" />
        <AccountingMetricCard title="Pagos a proveedores" value={`$${report.metrics.providerPaymentsMonth.toFixed(2)}`} subtitle="Abonos registrados este mes" icon={CreditCard} accent="bg-teal-100 text-teal-700" />
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.2fr,0.8fr]">
        <MonthlyRevenueChart data={report.monthlyRevenue} />
        <ReceivablesOverview data={report.receivables} totalAmount={report.metrics.receivablesAmount} />
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.2fr,0.8fr]">
        <ProviderPaymentsOverview chartData={report.providerPayments} recentPayments={report.recentProviderPayments} />
        <Card className="border-0 shadow-lg">
          <CardHeader>
            <CardTitle>Accesos rápidos</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Link to="/AdminInvoices" className="block">
              <Button variant="outline" className="w-full justify-between">
                <span className="flex items-center gap-2"><FileText className="h-4 w-4" /> Facturas</span>
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link to="/AdminPayments" className="block">
              <Button variant="outline" className="w-full justify-between">
                <span className="flex items-center gap-2"><CreditCard className="h-4 w-4" /> Validar pagos</span>
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link to="/AdminAccountsPayable" className="block">
              <Button variant="outline" className="w-full justify-between">
                <span className="flex items-center gap-2"><Wallet className="h-4 w-4" /> Cuentas por pagar</span>
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link to="/AdminProviderPayments" className="block">
              <Button variant="outline" className="w-full justify-between">
                <span className="flex items-center gap-2"><TrendingUp className="h-4 w-4" /> Pagos proveedores</span>
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}