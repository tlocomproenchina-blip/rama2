import React from "react";
import { Button } from "@/components/ui/button";
import { base44 } from "@/api/base44Client";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { AlertCircle, CheckCircle2, CreditCard, FileText, HelpCircle, QrCode, Link2 } from "lucide-react";

export default function AdminActionCenter() {
  const [counts, setCounts] = React.useState({
    assisted_pending: 0,
    assisted_invoiced: 0,
    cons_requests: 0,
    pay_validations: 0,
    tickets_open: 0,
    invoices_pending: 0,
    invoices_overdue: 0,
  });
  const [loading, setLoading] = React.useState(true);
  const navigate = useNavigate();

  const load = React.useCallback(async () => {
    try {
      const [aprPend, aprProc, consReq, consForPayVal, tOpen, tProc, invPend, invOver] = await Promise.all([
        base44.entities.AssistedPaymentRequest.filter({ status: "pendiente" }, "-created_date", 100),
        base44.entities.AssistedPaymentRequest.filter({ status: "en_proceso" }, "-created_date", 100),
        base44.entities.ConsolidationRequest.filter({ status: "pendiente" }, "-created_date", 100),
        base44.entities.Consolidation.filter({ payment_validated: false }, "-created_date", 200),
        base44.entities.SupportTicket.filter({ status: "abierto" }, "-created_date", 200),
        base44.entities.SupportTicket.filter({ status: "en_proceso" }, "-created_date", 200),
        base44.entities.Invoice.filter({ status: "pendiente" }, "-created_date", 200),
        base44.entities.Invoice.filter({ status: "vencida" }, "-created_date", 200),
      ]);

      const payValidations = (consForPayVal || []).filter((c) => !!c.payment_proof_url && c.payment_validated === false);

      setCounts({
        assisted_pending: aprPend?.length || 0,
        assisted_invoiced: aprProc?.length || 0,
        cons_requests: consReq?.length || 0,
        pay_validations: payValidations.length,
        tickets_open: (tOpen?.length || 0) + (tProc?.length || 0),
        invoices_pending: invPend?.length || 0,
        invoices_overdue: invOver?.length || 0,
      });
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    load();

    const unsubs = [
      base44.entities.AssistedPaymentRequest.subscribe(() => load()),
      base44.entities.ConsolidationRequest.subscribe(() => load()),
      base44.entities.Consolidation.subscribe(() => load()),
      base44.entities.SupportTicket.subscribe(() => load()),
      base44.entities.Invoice.subscribe(() => load()),
    ];
    return () => { unsubs.forEach((u) => { try { u(); } catch (_) {} }); };
  }, [load]);

  const items = [
    {
      key: "assisted_pending",
      label: "Pagos asistidos (pendientes)",
      count: counts.assisted_pending,
      color: "bg-amber-100 text-amber-800 border-amber-200",
      icon: Link2,
      go: () => navigate(createPageUrl("AdminAssistedPayments")),
    },
    {
      key: "assisted_invoiced",
      label: "Pagos asistidos (factura enviada)",
      count: counts.assisted_invoiced,
      color: "bg-blue-100 text-blue-800 border-blue-200",
      icon: QrCode,
      go: () => navigate(createPageUrl("AdminAssistedPayments")),
    },
    {
      key: "cons_requests",
      label: "Solicitudes de consolidación",
      count: counts.cons_requests,
      color: "bg-indigo-100 text-indigo-800 border-indigo-200",
      icon: CheckCircle2,
      go: () => navigate(createPageUrl("AdminShipmentApprovals")),
    },
    {
      key: "pay_validations",
      label: "Validaciones de pago",
      count: counts.pay_validations,
      color: "bg-emerald-100 text-emerald-800 border-emerald-200",
      icon: CreditCard,
      go: () => navigate(createPageUrl("AdminPayments")),
    },
    {
      key: "tickets_open",
      label: "Tickets de soporte",
      count: counts.tickets_open,
      color: "bg-purple-100 text-purple-800 border-purple-200",
      icon: HelpCircle,
      go: () => navigate(createPageUrl("AdminSupportTickets")),
    },
    {
      key: "invoices_pending",
      label: "Facturas pendientes",
      count: counts.invoices_pending,
      color: "bg-slate-100 text-slate-800 border-slate-200",
      icon: FileText,
      go: () => navigate(createPageUrl("AdminInvoices")),
    },
    {
      key: "invoices_overdue",
      label: "Facturas vencidas",
      count: counts.invoices_overdue,
      color: "bg-rose-100 text-rose-800 border-rose-200",
      icon: AlertCircle,
      go: () => navigate(createPageUrl("AdminInvoices")),
    },
  ];

  const visible = items.filter((i) => i.count > 0);
  if (loading) return null;
  if (visible.length === 0) return null;

  return (
    <div className="mb-4">
      <div className="rounded-xl border bg-white p-3 shadow-sm">
        <div className="flex items-stretch gap-3 overflow-x-auto pb-1 -mb-1">
          {visible.map((i) => {
            const Icon = i.icon;
            return (
              <Button key={i.key} variant="outline" onClick={i.go}
                className={`min-w-[220px] justify-start border ${i.color} hover:opacity-90`}
                title={i.label}
              >
                <span className="relative inline-flex items-center gap-2">
                  <Icon className="h-4 w-4" />
                  <span className="text-sm font-medium">{i.label}</span>
                  <span className="ml-2 inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-black/80 text-white px-2 text-xs font-semibold">
                    {i.count}
                  </span>
                </span>
              </Button>
            );
          })}
        </div>
      </div>
    </div>
  );
}