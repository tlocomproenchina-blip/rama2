import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Copy, Share2 } from 'lucide-react';
import { toast } from 'sonner';
import { publicAppUrl } from '@/lib/publicLinks';

export default function ReferralCodeCard({ code }) {
  const link = publicAppUrl(`/?ref=${encodeURIComponent(code)}`);
  const copy = async (t) => { await navigator.clipboard.writeText(t); toast.success('Copiado'); };
  const share = () => window.open(`https://wa.me/?text=${encodeURIComponent(`Envía tu carga desde China con TLEC CARGO. Usa mi código ${code} al registrar tu primera guía: ${link}`)}`, '_blank');
  return (
    <Card className="border-border/70 shadow-card">
      <CardContent className="flex flex-col gap-4 p-6 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">Tu código</p>
          <p className="mt-1 font-display text-3xl font-bold tracking-tight">{code}</p>
          <p className="mt-1 truncate text-sm text-muted-foreground">{link}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => copy(code)}><Copy /> Código</Button>
          <Button variant="outline" onClick={() => copy(link)}><Copy /> Enlace</Button>
          <Button onClick={share}><Share2 /> WhatsApp</Button>
        </div>
      </CardContent>
    </Card>
  );
}