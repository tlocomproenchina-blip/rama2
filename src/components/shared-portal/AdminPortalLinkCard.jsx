import React, { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CalendarRange, History, KeyRound, RefreshCw, ShieldOff, ShieldCheck, Pencil, Trash2, Activity, Eye } from 'lucide-react';
import AdminPortalActivityList from '@/components/shared-portal/AdminPortalActivityList';
import PortalLinkReveal from '@/components/shared-portal/PortalLinkReveal';
import { portalDateTimeText, portalLinkStatus, portalLinkUrl, portalScopeText } from '@/lib/sharedPortalFormat';

function statusBadge(status) {
  if (status === 'revocado') return { text: 'Revocado', className: 'border-destructive/30 bg-destructive/10 text-destructive' };
  if (status === 'vencido') return { text: 'Vencido', className: 'border-amber-200 bg-amber-50 text-amber-700' };
  return { text: 'Activo', className: 'border-emerald-200 bg-emerald-50 text-emerald-700' };
}

export default function AdminPortalLinkCard({ link, token, activity, activityLoading, onEdit, onAction, onCopy, onToggleActivity }) {
  const [showLink, setShowLink] = useState(false);
  const status = portalLinkStatus(link);
  const badge = statusBadge(status);
  const showActivity = activity !== null && activity !== undefined;
  const expiryText = link.expires_at ? ` · vence ${portalDateTimeText(link.expires_at)}` : ' · sin vencimiento';

  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-display text-base font-bold text-foreground">{link.label}</p>
            <Badge variant="outline" className={badge.className}>{badge.text}</Badge>
            {link.access_code_set ? (
              <Badge variant="outline" className="border-border bg-secondary text-foreground">
                <KeyRound className="mr-1 h-3 w-3" /> Con código
              </Badge>
            ) : null}
          </div>
          <p className="text-xs text-muted-foreground">{portalScopeText(link)}</p>
          {token ? (
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">
                Enlace del portal{expiryText}
              </p>
              <PortalLinkReveal url={portalLinkUrl(token)} onCopy={() => onCopy(token)} />
            </div>
          ) : (
            <div className="space-y-1.5">
              <p className="text-xs text-muted-foreground">
                Enlace terminado en <span className="font-semibold text-foreground">{link.token_hint || '—'}</span>
                {expiryText}
              </p>
              <button
                type="button"
                onClick={() => setShowLink((value) => !value)}
                className="inline-flex items-center gap-1 text-xs font-semibold text-primary underline-offset-4 hover:underline"
              >
                <Eye className="h-3.5 w-3.5" /> {showLink ? 'Ocultar enlace' : 'Ver enlace'}
              </button>
              {showLink ? <PortalLinkReveal url="" onRegenerate={() => onAction('regenerate', link)} /> : null}
            </div>
          )}
          {link.notes ? <p className="text-xs text-muted-foreground">Nota: {link.notes}</p> : null}
        </div>

        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" variant="outline" onClick={() => onEdit(link)}>
            <Pencil className="mr-1 h-3.5 w-3.5" /> Editar
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={() => onAction('regenerate', link)}>
            <RefreshCw className="mr-1 h-3.5 w-3.5" /> Regenerar
          </Button>
          {status === 'revocado' ? (
            <Button type="button" size="sm" variant="outline" onClick={() => onAction('reactivate', link)}>
              <ShieldCheck className="mr-1 h-3.5 w-3.5" /> Reactivar
            </Button>
          ) : (
            <Button type="button" size="sm" variant="outline" onClick={() => onAction('revoke', link)}>
              <ShieldOff className="mr-1 h-3.5 w-3.5" /> Revocar
            </Button>
          )}
          <Button type="button" size="sm" variant="ghost" onClick={() => onAction('delete', link)}>
            <Trash2 className="mr-1 h-3.5 w-3.5" /> Eliminar
          </Button>
        </div>
      </div>

      <div className="mt-3 grid gap-2 text-xs text-muted-foreground sm:grid-cols-2 lg:grid-cols-4">
        <p className="flex items-center gap-1.5">
          <Activity className="h-3.5 w-3.5" /> {Number(link.access_count || 0)} consulta(s)
        </p>
        <p className="flex items-center gap-1.5">
          <CalendarRange className="h-3.5 w-3.5" /> Última consulta: {portalDateTimeText(link.last_access_date)}
        </p>
        <p className="flex items-center gap-1.5">
          <History className="h-3.5 w-3.5" /> {Number(link.export_count || 0)} exportación(es)
        </p>
        <p className="flex items-center gap-1.5">
          <History className="h-3.5 w-3.5" /> Última: {portalDateTimeText(link.last_export_date)}
          {link.last_export_rows ? ` (${link.last_export_rows} reg.)` : ''}
        </p>
      </div>

      <div className="mt-3 border-t border-border/70 pt-3">
        <button
          type="button"
          onClick={() => onToggleActivity(link)}
          className="text-xs font-semibold text-primary underline-offset-4 hover:underline"
        >
          {showActivity ? 'Ocultar actividad' : 'Ver actividad de este enlace'}
        </button>
        {showActivity ? (
          <div className="mt-2">
            {activityLoading ? (
              <p className="text-sm text-muted-foreground">Cargando actividad…</p>
            ) : (
              <AdminPortalActivityList logs={activity} />
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}