import React, { useEffect, useMemo, useState } from 'react';
import { MessageSquareHeart, Star } from 'lucide-react';
import { base44 } from '@/components/api/ApiQueueManager';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export default function DesignFeedbackPanel() {
  const [items, setItems] = useState([]);

  useEffect(() => {
    const load = async () => {
      const rows = await base44.entities.DesignFeedback.list('-created_date', 20);
      setItems(rows);
    };

    load();
    const unsubscribe = base44.entities.DesignFeedback.subscribe(load);
    return unsubscribe;
  }, []);

  const averageScore = useMemo(() => {
    if (!items.length) return 0;
    return (items.reduce((sum, item) => sum + Number(item.score || 0), 0) / items.length).toFixed(1);
  }, [items]);

  const newCount = useMemo(() => items.filter((item) => item.status === 'new').length, [items]);

  return (
    <Card className="border-border/70 bg-card/95 shadow-card">
      <CardHeader>
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <CardTitle className="flex items-center gap-2">
            <MessageSquareHeart className="h-5 w-5 text-primary" />
            Monitoreo de percepción visual
          </CardTitle>
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline">Promedio: {averageScore || '0.0'} / 5</Badge>
            <Badge variant="outline">Nuevos: {newCount}</Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aún no hay feedback visual enviado.</p>
        ) : (
          <div className="space-y-3">
            {items.slice(0, 5).map((item) => (
              <div key={item.id} className="rounded-2xl border border-border/70 bg-background/70 p-4">
                <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge>{item.page_name}</Badge>
                    <Badge variant="outline" className="gap-1"><Star className="h-3 w-3" /> {item.score}/5</Badge>
                    <Badge variant="outline">{item.user_role || 'guest'}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">{new Date(item.created_date).toLocaleString()}</p>
                </div>
                <p className="mt-2 text-sm text-foreground">{item.comment || 'Sin comentario adicional.'}</p>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}