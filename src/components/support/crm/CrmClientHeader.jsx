import React from 'react';
import { ArrowLeft, MessageCircle, Wallet, Inbox } from 'lucide-react';
import { Button } from '@/components/ui/button';
import CrmTagBadges from './CrmTagBadges';
import CrmTagsEditor from './CrmTagsEditor';

const money = (n) => `$${Number(n || 0).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// Cabecera del cliente abierto: quién es, WhatsApp en un clic, saldo, casos y etiquetas.
export default function CrmClientHeader({ client, summary, user, onBack, onTagsSaved }) {
  const name = client.full_name || [client.first_name, client.last_name].filter(Boolean).join(' ') || client.email;
  const wa = String(client.whatsapp || client.phone || '').replace(/\D/g, '');

  return (
    <div className="space-y-3 rounded-xl border border-border bg-card p-3 sm:p-4">
      <div className="flex items-start gap-2">
        <Button size="icon" variant="ghost" className="shrink-0" onClick={onBack} aria-label="Volver a la bandeja">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="min-w-0 flex-1">
          <h2 className="truncate font-display text-lg font-bold text-foreground">{name}</h2>
          <p className="truncate text-xs text-muted-foreground">
            {[client.shipping_mark, client.cedula && `CI ${client.cedula}`, client.email].filter(Boolean).join(' · ')}
          </p>
        </div>
        {wa && (
          <Button asChild size="sm" className="shrink-0 bg-emerald-600 text-white hover:bg-emerald-700">
            <a href={`https://wa.me/${wa}`} target="_blank" rel="noreferrer"><MessageCircle className="h-4 w-4" /> WhatsApp</a>
          </Button>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className={`flex items-center gap-1 rounded-full px-2 py-1 ${summary?.balance > 0 ? 'bg-rose-100 text-rose-700' : 'bg-muted text-muted-foreground'}`}>
          <Wallet className="h-3.5 w-3.5" /> {summary ? (summary.balance > 0 ? `Saldo pendiente ${money(summary.balance)}` : 'Sin saldo pendiente') : '…'}
        </span>
        <span className={`flex items-center gap-1 rounded-full px-2 py-1 ${summary?.open_cases > 0 ? 'bg-blue-100 text-blue-700' : 'bg-muted text-muted-foreground'}`}>
          <Inbox className="h-3.5 w-3.5" /> {summary ? `${summary.open_cases} caso(s) abierto(s)` : '…'}
        </span>
        <CrmTagBadges tags={summary?.tags} catalog={summary?.catalog} />
        {summary && (
          <CrmTagsEditor client={client} manualTags={summary.manual_tags} catalog={summary.catalog} user={user} onSaved={onTagsSaved} />
        )}
      </div>
    </div>
  );
}