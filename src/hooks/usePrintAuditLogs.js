import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';

const PAGE_SIZE = 50;
const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Arma el filtro en el servidor: tipo, estado y búsqueda de texto (etiqueta,
// cliente, usuario, motivo) más los correos de clientes que coinciden por cédula.
export function buildPrintAuditQuery({ search, typeFilter, statusFilter, cedulaEmails }) {
  const query = {};
  if (typeFilter !== 'all') query.print_type = typeFilter;
  if (statusFilter !== 'all') query.approval_status = statusFilter;
  const q = search.trim();
  if (q) {
    const rx = { $regex: escapeRegex(q), $options: 'i' };
    const or = ['label_code', 'client_email', 'printed_by', 'reason', 'reason_detail'].map((f) => ({ [f]: rx }));
    if (cedulaEmails?.size) or.push({ client_email: { $in: [...cedulaEmails] } });
    query.$or = or;
  }
  return query;
}

export default function usePrintAuditLogs(filters) {
  const query = buildPrintAuditQuery(filters);
  const key = ['printAuditLogs', JSON.stringify(query)];

  const list = useInfiniteQuery({
    queryKey: key,
    initialPageParam: null,
    queryFn: ({ pageParam }) => base44.entities.BultoPrintLog.filter(query, {
      sort: '-print_date', limit: PAGE_SIZE, ...(pageParam ? { cursor: pageParam } : {})
    }),
    getNextPageParam: (last) => (last?.has_more ? last.next_cursor : undefined),
  });

  const count = useQuery({
    queryKey: ['printAuditCount', JSON.stringify(query)],
    queryFn: () => base44.entities.BultoPrintLog.count(query),
  });

  return {
    logs: (list.data?.pages || []).flatMap((p) => p?.items || []),
    total: count.data ?? 0,
    loading: list.isLoading,
    loadingMore: list.isFetchingNextPage,
    hasMore: !!list.hasNextPage,
    loadMore: list.fetchNextPage,
  };
}