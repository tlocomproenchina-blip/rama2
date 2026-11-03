import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FileText, Loader2 } from 'lucide-react';
import DispatchGuideMiniCard from '@/components/admin/clients/DispatchGuideMiniCard';

// Guías de despacho emitidas para un cliente (vista de administrador).
export default function ClientGuidesPanel({ client }) {
  const [loading, setLoading] = useState(true);
  const [guides, setGuides] = useState([]);

  useEffect(() => {
    if (client?.email) loadGuides();
     
  }, [client?.email, client?.shipping_mark]);

  const loadGuides = async () => {
    setLoading(true);
    const email = client.email;
    const mark = (client.shipping_mark || '').trim();
    const query = mark ? { $or: [{ client_emails: email }, { shipping_marks: mark }] } : { client_emails: email };

    const page = await base44.entities.DispatchGuide.filter(query, { sort: '-emitted_date', limit: 100 });
    setGuides(page.items || []);
    setLoading(false);
  };

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <FileText className="h-4 w-4 text-slate-500" />
          Guías de despacho
          <span className="text-xs font-normal text-slate-500">({guides.length})</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
          </div>
        ) : guides.length === 0 ? (
          <p className="text-sm text-slate-400 bg-slate-50 rounded-lg px-4 py-3">Este cliente no tiene guías de despacho.</p>
        ) : (
          guides.map((guide) => <DispatchGuideMiniCard key={guide.id} guide={guide} />)
        )}
      </CardContent>
    </Card>
  );
}