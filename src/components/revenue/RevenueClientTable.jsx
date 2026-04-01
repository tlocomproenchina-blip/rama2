import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Search, ArrowUpDown, ArrowUp, ArrowDown, ChevronLeft, ChevronRight, Download, Users } from 'lucide-react';
import { useState, useMemo } from 'react';

const COLUMNS = [
  { key: 'name', label: 'Cliente', align: 'left', sortable: true },
  { key: 'cbm', label: 'CBM', align: 'right', sortable: true, format: 'cbm' },
  { key: 'paid', label: 'Cobrado', align: 'right', sortable: true, format: 'currency', color: 'text-green-700' },
  { key: 'pending', label: 'Pendiente', align: 'right', sortable: true, format: 'currency', color: 'text-amber-700' },
  { key: 'totalInvoiced', label: 'Total Facturado', align: 'right', sortable: true, format: 'currency', color: 'text-slate-800', bold: true },
  { key: 'invoiceCount', label: 'Facturas', align: 'right', sortable: true },
];

const PAGE_SIZE = 15;

function fmt(value, format) {
  if (format === 'currency') return `$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  if (format === 'cbm') return value.toFixed(2);
  return value;
}

function SortIcon({ column, sortKey, sortDir }) {
  if (sortKey !== column) return <ArrowUpDown className="h-3 w-3 text-slate-300" />;
  return sortDir === 'asc' ? <ArrowUp className="h-3 w-3 text-blue-600" /> : <ArrowDown className="h-3 w-3 text-blue-600" />;
}

export default function RevenueClientTable({ data }) {
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState('totalInvoiced');
  const [sortDir, setSortDir] = useState('desc');
  const [page, setPage] = useState(0);

  const handleSort = (key) => {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
    setPage(0);
  };

  const filtered = useMemo(() => {
    if (!data) return [];
    let list = data;
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(c => c.name.toLowerCase().includes(q) || c.email.toLowerCase().includes(q));
    }
    list = [...list].sort((a, b) => {
      const av = a[sortKey] ?? 0;
      const bv = b[sortKey] ?? 0;
      if (typeof av === 'string') return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
      return sortDir === 'asc' ? av - bv : bv - av;
    });
    return list;
  }, [data, search, sortKey, sortDir]);

  const totals = useMemo(() => {
    return filtered.reduce((acc, c) => ({
      cbm: acc.cbm + (c.cbm || 0),
      paid: acc.paid + (c.paid || 0),
      pending: acc.pending + (c.pending || 0),
      totalInvoiced: acc.totalInvoiced + (c.totalInvoiced || 0),
      invoiceCount: acc.invoiceCount + (c.invoiceCount || 0),
    }), { cbm: 0, paid: 0, pending: 0, totalInvoiced: 0, invoiceCount: 0 });
  }, [filtered]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paged = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const exportCSV = () => {
    const header = 'Cliente,Email,CBM,Cobrado,Pendiente,Total Facturado,Facturas';
    const rows = filtered.map(c =>
      `"${c.name}","${c.email}",${c.cbm.toFixed(2)},${c.paid.toFixed(2)},${c.pending.toFixed(2)},${c.totalInvoiced.toFixed(2)},${c.invoiceCount}`
    );
    const csv = [header, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'desglose_clientes.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!data || data.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center text-slate-500">
          No hay datos de clientes
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <CardTitle className="text-base">Desglose por Cliente</CardTitle>
            <Badge variant="secondary" className="text-[10px] font-mono">
              <Users className="h-3 w-3 mr-1" />
              {filtered.length}
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative w-full sm:w-56">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Buscar cliente..."
                value={search}
                onChange={e => { setSearch(e.target.value); setPage(0); }}
                className="pl-10 h-8 text-xs"
              />
            </div>
            <Button variant="outline" size="sm" onClick={exportCSV} className="gap-1 h-8 text-xs flex-shrink-0">
              <Download className="h-3.5 w-3.5" /> CSV
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-slate-50/80">
                {COLUMNS.map(col => (
                  <th
                    key={col.key}
                    className={`${col.align === 'left' ? 'text-left' : 'text-right'} px-4 py-2.5 font-medium text-slate-600 text-xs ${col.sortable ? 'cursor-pointer select-none hover:text-blue-600 transition-colors' : ''}`}
                    onClick={col.sortable ? () => handleSort(col.key) : undefined}
                  >
                    <span className="inline-flex items-center gap-1">
                      {col.label}
                      {col.sortable && <SortIcon column={col.key} sortKey={sortKey} sortDir={sortDir} />}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {paged.map((c, idx) => (
                <tr key={c.email} className="border-b last:border-0 hover:bg-blue-50/30 transition-colors">
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2.5">
                      <div className="h-7 w-7 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0 text-xs font-bold text-slate-500">
                        {(page * PAGE_SIZE) + idx + 1}
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-slate-800 truncate max-w-[180px] text-xs">{c.name}</p>
                        <p className="text-[10px] text-slate-400 truncate max-w-[180px]">{c.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="text-right px-4 py-2.5 font-mono text-xs text-slate-700">{c.cbm.toFixed(2)}</td>
                  <td className="text-right px-4 py-2.5 font-mono text-xs text-green-700">{fmt(c.paid, 'currency')}</td>
                  <td className="text-right px-4 py-2.5 font-mono text-xs text-amber-700">{fmt(c.pending, 'currency')}</td>
                  <td className="text-right px-4 py-2.5 font-mono text-xs font-semibold text-slate-800">{fmt(c.totalInvoiced, 'currency')}</td>
                  <td className="text-right px-4 py-2.5 text-xs text-slate-600">{c.invoiceCount}</td>
                </tr>
              ))}
              {paged.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-400 text-xs">Sin resultados</td></tr>
              )}
            </tbody>
            {/* Totals footer */}
            {paged.length > 0 && (
              <tfoot>
                <tr className="border-t-2 border-slate-200 bg-slate-50/90 font-semibold">
                  <td className="px-4 py-3 text-xs text-slate-700">
                    Total ({filtered.length} clientes)
                  </td>
                  <td className="text-right px-4 py-3 font-mono text-xs text-slate-800">{totals.cbm.toFixed(2)}</td>
                  <td className="text-right px-4 py-3 font-mono text-xs text-green-700">{fmt(totals.paid, 'currency')}</td>
                  <td className="text-right px-4 py-3 font-mono text-xs text-amber-700">{fmt(totals.pending, 'currency')}</td>
                  <td className="text-right px-4 py-3 font-mono text-xs text-slate-900">{fmt(totals.totalInvoiced, 'currency')}</td>
                  <td className="text-right px-4 py-3 text-xs text-slate-700">{totals.invoiceCount}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t">
            <p className="text-[11px] text-slate-400">
              {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, filtered.length)} de {filtered.length}
            </p>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setPage(p => Math.max(0, p - 1))}
                disabled={page === 0}
                className="h-7 w-7 p-0"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                let pageNum;
                if (totalPages <= 5) {
                  pageNum = i;
                } else if (page < 3) {
                  pageNum = i;
                } else if (page > totalPages - 4) {
                  pageNum = totalPages - 5 + i;
                } else {
                  pageNum = page - 2 + i;
                }
                return (
                  <Button
                    key={pageNum}
                    variant={pageNum === page ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setPage(pageNum)}
                    className="h-7 w-7 p-0 text-xs"
                  >
                    {pageNum + 1}
                  </Button>
                );
              })}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
                className="h-7 w-7 p-0"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}