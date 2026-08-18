import React, { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/components/api/ApiQueueManager';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FileText, Eye, ExternalLink, Loader2 } from 'lucide-react';
import { format } from 'date-fns';

const STATUS_LABELS = {
  esperando_cliente: 'Esperando datos',
  cliente_completo: 'Enviado',
  completado: 'Completado',
  enviado: 'Enviado'
};

const STATUS_BADGE_CLASS = {
  esperando_cliente: 'bg-amber-100 text-amber-700',
  cliente_completo: 'bg-blue-100 text-blue-700',
  completado: 'bg-green-100 text-green-700',
  enviado: 'bg-violet-100 text-violet-700'
};

export default function ClientQuotesWidget({ userEmail, limit = 5, showHeader = true }) {
  const [quotes, setQuotes] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadQuotes = useCallback(async () => {
    if (!userEmail) return;
    try {
      const rows = await base44.entities.Quote.filter({ client_email: userEmail }, '-updated_date', 50);
      setQuotes(rows || []);
    } catch (error) {
      console.error('Error loading quotes:', error);
    }
    setLoading(false);
  }, [userEmail]);

  useEffect(() => {
    loadQuotes();
  }, [loadQuotes]);

  if (loading) {
    return (
      <Card className="border-border/70 bg-card/95 shadow-card">
        <CardContent className="p-6 flex items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
        </CardContent>
      </Card>
    );
  }

  const displayed = quotes.slice(0, limit);

  return (
    <Card className="border-border/70 bg-card/95 shadow-card">
      {showHeader && (
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-violet-600" />
            Mis Presupuestos
          </CardTitle>
        </CardHeader>
      )}
      <CardContent className="space-y-3">
        {quotes.length === 0 ? (
          <p className="text-sm text-slate-500 text-center py-8">
            No tienes presupuestos asignados todavía.
          </p>
        ) : (
          displayed.map(q => (
            <div key={q.id} className="p-3 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors">
              <div className="flex items-start justify-between mb-2 gap-3">
                <div className="min-w-0">
                  <span className="font-mono text-sm font-medium truncate block">{q.quote_number || q.token?.slice(0, 8)}</span>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {q.updated_date ? format(new Date(q.updated_date), 'dd/MM/yyyy') : ''}
                  </p>
                </div>
                <Badge className={STATUS_BADGE_CLASS[q.status] || 'bg-slate-100 text-slate-700'}>
                  {STATUS_LABELS[q.status] || q.status}
                </Badge>
              </div>
              {q.total_usd ? (
                <p className="text-sm font-semibold text-slate-800">${q.total_usd?.toFixed(2)} USD</p>
              ) : null}
              <div className="mt-2">
                <Button variant="outline" size="sm" asChild>
                  <Link to={`/Quote/${q.token}`}>
                    <ExternalLink className="h-3.5 w-3.5 mr-1" />
                    Ver presupuesto
                  </Link>
                </Button>
              </div>
            </div>
          ))
        )}
        {quotes.length > limit && (
          <p className="text-xs text-slate-400 text-center pt-1">
            Mostrando {limit} de {quotes.length} presupuestos
          </p>
        )}
      </CardContent>
    </Card>
  );
}