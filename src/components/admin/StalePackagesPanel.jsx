import React, { useState, useEffect, useMemo } from 'react';
import { base44 } from '@/components/api/ApiQueueManager';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2, Clock, ChevronDown, ChevronUp, PackageOpen, Copy, Ticket } from 'lucide-react';
import StaleTicketDialog from './StaleTicketDialog';
import { toast } from 'sonner';

const STALE_DAYS = 7;

function getDaysAgo(dateStr) {
  if (!dateStr) return 0;
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24));
}

function formatDate(dateStr) {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yy = String(d.getFullYear()).slice(-2);
  return `${dd}-${mm}-${yy}`;
}

export default function StalePackagesPanel() {
  const [stalePackages, setStalePackages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState([]);
  const [expanded, setExpanded] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState(new Set());
  const [ticketDialog, setTicketDialog] = useState({ open: false, email: '', trackings: [] });
  const [trackingsWithTickets, setTrackingsWithTickets] = useState(new Set());

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      let all = [];
      let skip = 0;
      while (true) {
        const batch = await base44.entities.Package.filter({ status: 'pre_alerta' }, '-created_date', 200, skip);
        if (!batch || batch.length === 0) break;
        all = all.concat(batch);
        if (batch.length < 200) break;
        skip += 200;
      }
      if (cancelled) return;
      const cutoff = Date.now() - STALE_DAYS * 24 * 60 * 60 * 1000;
      const stale = all.filter(p => p.created_date && new Date(p.created_date).getTime() <= cutoff);
      setStalePackages(stale);
      setLoading(false);
    };
    load();
    return () => { cancelled = true; };
  }, []);

  // Load which trackings already have open tickets
  useEffect(() => {
    if (stalePackages.length === 0) return;
    let cancelled = false;
    const loadTickets = async () => {
      try {
        const [open, inProgress] = await Promise.all([
          base44.entities.SupportTicket.filter({ status: 'abierto' }, '-created_date', 200),
          base44.entities.SupportTicket.filter({ status: 'en_proceso' }, '-created_date', 200),
        ]);
        if (cancelled) return;
        const all = [...open, ...inProgress];
        const trackingSet = new Set();
        all.forEach(t => {
          if (t.related_tracking) {
            t.related_tracking.split(',').forEach(tn => {
              const trimmed = tn.trim();
              if (trimmed) trackingSet.add(trimmed);
            });
          }
        });
        setTrackingsWithTickets(trackingSet);
      } catch (_) {}
    };
    loadTickets();
    return () => { cancelled = true; };
  }, [stalePackages]);

  // Group by client (shipping_mark + email), sort packages oldest first within each group
  const groups = useMemo(() => {
    const map = {};
    stalePackages.forEach(p => {
      const key = `${p.shipping_mark || 'SIN MARK'}|||${p.client_email || ''}`;
      if (!map[key]) map[key] = { mark: p.shipping_mark || 'SIN MARK', email: p.client_email || '', packages: [] };
      map[key].packages.push(p);
    });
    // Sort packages within each group: oldest first (most days)
    Object.values(map).forEach(g => {
      g.packages.sort((a, b) => new Date(a.created_date).getTime() - new Date(b.created_date).getTime());
    });
    // Sort groups: most packages first
    return Object.values(map).sort((a, b) => b.packages.length - a.packages.length);
  }, [stalePackages]);

  const toggleGroupExpand = (groupKey) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(groupKey)) next.delete(groupKey); else next.add(groupKey);
      return next;
    });
  };

  const PACKAGES_PREVIEW = 3;

  if (loading) {
    return (
      <Card className="border-0 shadow-md border-l-4 border-l-amber-400 bg-amber-50/40">
        <CardContent className="p-4 flex items-center gap-2 text-amber-700">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-sm">Cargando paquetes pendientes...</span>
        </CardContent>
      </Card>
    );
  }

  if (stalePackages.length === 0) return null;

  const toggleSelect = (id) => {
    setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const selectAll = (checked) => {
    setSelected(checked ? stalePackages.map(p => p.id) : []);
  };

  const toggleGroup = (groupPkgs) => {
    const ids = groupPkgs.map(p => p.id);
    const allSelected = ids.every(id => selected.includes(id));
    if (allSelected) {
      setSelected(prev => prev.filter(id => !ids.includes(id)));
    } else {
      setSelected(prev => [...new Set([...prev, ...ids])]);
    }
  };

  const handleCopyByMark = () => {
    const selPkgs = stalePackages.filter(p => selected.includes(p.id));
    const byMark = {};
    selPkgs.forEach(p => {
      const mark = p.shipping_mark || 'SIN MARK';
      if (!byMark[mark]) byMark[mark] = [];
      byMark[mark].push(p);
    });
    const header = '*Los siguientes n\u00fameros de tracking tienen 7 d\u00edas o m\u00e1s de notificados*\n\n';
    const body = Object.entries(byMark).map(([mark, pkgs]) => {
      const lines = pkgs.map(p => `  ${p.tracking_number} — ${formatDate(p.created_date)}`).join('\n');
      return `📦 ${mark} (${pkgs.length})\n${lines}`;
    }).join('\n\n');
    const text = header + body;
    navigator.clipboard.writeText(text);
    toast.success(`Copiados ${selPkgs.length} paquete(s) por mark`);
  };

  const displayedGroups = expanded ? groups : groups.slice(0, 3);

  return (
    <Card className="border-0 shadow-md border-l-4 border-l-amber-400 bg-amber-50/40">
      <CardContent className="p-4 space-y-3">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div className="flex items-center gap-2">
            <PackageOpen className="h-5 w-5 text-amber-600" />
            <h3 className="font-semibold text-slate-800">
              Pre-alertas sin recibir hace más de {STALE_DAYS} días
            </h3>
            <Badge variant="outline" className="bg-amber-100 text-amber-800 border-amber-300">
              {stalePackages.length}
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={selected.length === 0}
              onClick={() => {
                const selPkgs = stalePackages.filter(p => selected.includes(p.id));
                if (selPkgs.length === 0) return;
                const emails = [...new Set(selPkgs.map(p => p.client_email).filter(Boolean))];
                if (emails.length !== 1) {
                  toast.error('Selecciona paquetes de un solo cliente para crear ticket');
                  return;
                }
                setTicketDialog({ open: true, email: emails[0], trackings: selPkgs.map(p => p.tracking_number) });
              }}
              className="gap-1"
            >
              <Ticket className="h-4 w-4" />
              Crear Ticket
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={selected.length === 0}
              onClick={handleCopyByMark}
              className="gap-1"
            >
              <Copy className="h-4 w-4" />
              Copiar por Mark ({selected.length})
            </Button>
          </div>
        </div>

        {/* Select all */}
        <div className="flex items-center gap-2">
          <Checkbox
            checked={selected.length === stalePackages.length && stalePackages.length > 0}
            onCheckedChange={selectAll}
          />
          <span className="text-xs text-slate-500">Seleccionar todos</span>
        </div>

        {/* Grouped list */}
        <div className="max-h-96 overflow-y-auto space-y-2">
          {displayedGroups.map(group => {
            const groupIds = group.packages.map(p => p.id);
            const allGroupSelected = groupIds.every(id => selected.includes(id));
            const someGroupSelected = groupIds.some(id => selected.includes(id));

            return (
              <div key={`${group.mark}-${group.email}`} className="rounded-lg border border-amber-200 bg-white overflow-hidden">
                {/* Client header */}
                <div
                  className="flex items-center gap-3 px-3 py-2 bg-amber-50/80 cursor-pointer hover:bg-amber-100/60 transition-colors"
                  onClick={() => toggleGroup(group.packages)}
                >
                  <Checkbox
                    checked={allGroupSelected}
                    className={someGroupSelected && !allGroupSelected ? 'opacity-50' : ''}
                    onCheckedChange={() => toggleGroup(group.packages)}
                    onClick={(e) => e.stopPropagation()}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="outline" className="font-mono text-xs">{group.mark}</Badge>
                      <span className="text-xs text-slate-500 truncate">{group.email}</span>

                    </div>
                  </div>
                  <Badge variant="secondary" className="text-xs">{group.packages.length}</Badge>
                </div>

                {/* Tracking list */}
                {(() => {
                  const groupKey = `${group.mark}-${group.email}`;
                  const isGroupExpanded = expandedGroups.has(groupKey);
                  const visiblePkgs = isGroupExpanded ? group.packages : group.packages.slice(0, PACKAGES_PREVIEW);
                  const hiddenCount = group.packages.length - PACKAGES_PREVIEW;

                  return (
                    <>
                      <div className="divide-y divide-amber-100">
                        {visiblePkgs.map(pkg => (
                          <div key={pkg.id} className="flex items-center gap-3 px-3 py-1.5 pl-10 hover:bg-amber-50/30 transition-colors">
                            <Checkbox
                              checked={selected.includes(pkg.id)}
                              onCheckedChange={() => toggleSelect(pkg.id)}
                            />
                            <span className="font-mono text-sm text-slate-800 flex-1 truncate">{pkg.tracking_number}</span>
                            {trackingsWithTickets.has(pkg.tracking_number) && (
                              <span title="Ticket creado" className="inline-flex items-center justify-center h-5 w-5 rounded-full bg-amber-100 border border-amber-300 text-amber-700 flex-shrink-0">
                                <Ticket className="h-3 w-3" />
                              </span>
                            )}
                            <span className="text-xs text-red-400 font-medium flex-shrink-0">{getDaysAgo(pkg.created_date)}d</span>
                            <span className="text-xs text-slate-400 flex-shrink-0">{formatDate(pkg.created_date)}</span>
                          </div>
                        ))}
                      </div>
                      {hiddenCount > 0 && (
                        <button
                          onClick={() => toggleGroupExpand(groupKey)}
                          className="w-full px-3 py-1.5 text-xs text-amber-700 hover:bg-amber-50 transition-colors flex items-center justify-center gap-1"
                        >
                          {isGroupExpanded ? (
                            <><ChevronUp className="h-3 w-3" /> Mostrar menos</>
                          ) : (
                            <><ChevronDown className="h-3 w-3" /> Ver todos ({hiddenCount} más)</>
                          )}
                        </button>
                      )}
                    </>
                  );
                })()}
              </div>
            );
          })}
        </div>

        {/* Expand toggle */}
        {groups.length > 3 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setExpanded(!expanded)}
            className="w-full text-amber-700 hover:text-amber-900 hover:bg-amber-100 gap-1"
          >
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            {expanded ? 'Mostrar menos' : `Ver todos (${groups.length} clientes)`}
          </Button>
        )}
      </CardContent>

      <StaleTicketDialog
        open={ticketDialog.open}
        onOpenChange={(v) => {
          setTicketDialog(prev => ({ ...prev, open: v }));
          if (!v) {
            // Refresh ticket status after closing dialog
            Promise.all([
              base44.entities.SupportTicket.filter({ status: 'abierto' }, '-created_date', 200),
              base44.entities.SupportTicket.filter({ status: 'en_proceso' }, '-created_date', 200),
            ]).then(([a, b]) => {
              const set = new Set();
              [...a, ...b].forEach(t => {
                if (t.related_tracking) t.related_tracking.split(',').forEach(tn => { const trimmed = tn.trim(); if (trimmed) set.add(trimmed); });
              });
              setTrackingsWithTickets(set);
            }).catch(() => {});
          }
        }}
        clientEmail={ticketDialog.email}
        trackingNumbers={ticketDialog.trackings}
      />
    </Card>
  );
}