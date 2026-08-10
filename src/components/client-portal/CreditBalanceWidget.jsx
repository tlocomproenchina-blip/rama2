import React, { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/components/api/ApiQueueManager';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Wallet, Loader2, ArrowUpCircle, ArrowDownCircle, ChevronDown, ChevronUp } from 'lucide-react';
import { format } from 'date-fns';

const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);

export default function CreditBalanceWidget({ user }) {
  const [credits, setCredits] = useState([]);
  const [balance, setBalance] = useState(0);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  const loadCredits = useCallback(async () => {
    try {
      const records = await base44.entities.ClientCredit.filter({ client_email: user.email }, '-created_date');
      const bal = records.reduce((sum, c) => sum + num(c.amount), 0);
      setCredits(records);
      setBalance(bal);
    } catch {
      setCredits([]);
      setBalance(0);
    }
    setLoading(false);
  }, [user.email]);

  useEffect(() => {
    loadCredits();
  }, [loadCredits]);

  if (loading) {
    return (
      <Card className="border-border/70 bg-card/95 shadow-card">
        <CardContent className="flex items-center justify-center py-6">
          <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={`border-emerald-200 bg-gradient-to-br from-emerald-50 to-white shadow-card ${balance > 0 ? 'ring-1 ring-emerald-200' : ''}`}>
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-100">
              <Wallet className="h-6 w-6 text-emerald-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-emerald-700">Saldo a favor</p>
              <p className="text-2xl font-bold text-slate-800">${balance.toFixed(2)}</p>
            </div>
          </div>
          {credits.length > 0 && (
            <Button variant="ghost" size="sm" onClick={() => setExpanded(!expanded)}>
              {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              {credits.length} mov.
            </Button>
          )}
        </div>

        {balance > 0 && (
          <p className="text-xs text-slate-500 mt-3 bg-emerald-50/50 rounded-lg px-3 py-2">
            💡 Este saldo se aplicará automáticamente a tu próxima factura pendiente.
          </p>
        )}

        {expanded && credits.length > 0 && (
          <div className="mt-4 pt-4 border-t border-emerald-200 space-y-2 max-h-64 overflow-y-auto">
            {credits.map((c) => {
              const isCredit = num(c.amount) > 0;
              return (
                <div key={c.id} className="flex items-start gap-2 text-sm">
                  {isCredit ? <ArrowUpCircle className="h-4 w-4 text-emerald-600 mt-0.5 shrink-0" /> : <ArrowDownCircle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`font-semibold ${isCredit ? 'text-emerald-700' : 'text-amber-700'}`}>
                        {isCredit ? '+' : ''}${num(c.amount).toFixed(2)}
                      </span>
                      {c.related_invoice_number && (
                        <Badge variant="outline" className="text-xs">Factura {c.related_invoice_number}</Badge>
                      )}
                    </div>
                    {c.description && <p className="text-xs text-slate-500 break-words">{c.description}</p>}
                    <p className="text-xs text-slate-400">{format(new Date(c.created_date), 'dd/MM/yyyy HH:mm')}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}