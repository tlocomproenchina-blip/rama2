import React from 'react';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';

/**
 * Controles de paginación reutilizables para listas admin.
 * Muestra página actual, total estimado y botones siguiente/anterior/primera/última.
 */
export default function AdminPagination({ page, totalPages, totalEstimated, hasNext, hasPrev, onPageChange, loading }) {
  const currentPage = page + 1;
  const canFirst = page > 0 && !loading;
  const canPrev = hasPrev && !loading;
  const canNext = hasNext && !loading;
  const canLast = hasNext && !loading;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/60 px-1 py-3">
      <div className="text-xs text-muted-foreground">
        {loading ? 'Cargando…' : (
          <>
            Página <span className="font-semibold text-foreground">{currentPage}</span>
            {totalEstimated > 0 && <> · ~{totalEstimated.toLocaleString('es-VE')} registros</>}
          </>
        )}
      </div>
      <div className="flex items-center gap-1">
        <Button variant="outline" size="icon" className="h-8 w-8" disabled={!canFirst} onClick={() => onPageChange(0)} aria-label="Primera página">
          <ChevronsLeft className="h-4 w-4" />
        </Button>
        <Button variant="outline" size="icon" className="h-8 w-8" disabled={!canPrev} onClick={() => onPageChange(page - 1)} aria-label="Página anterior">
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="px-2 text-xs font-medium text-muted-foreground tabular-nums">
          {currentPage} / {Math.max(1, totalPages)}
        </span>
        <Button variant="outline" size="icon" className="h-8 w-8" disabled={!canNext} onClick={() => onPageChange(page + 1)} aria-label="Página siguiente">
          <ChevronRight className="h-4 w-4" />
        </Button>
        <Button variant="outline" size="icon" className="h-8 w-8" disabled={!canLast} onClick={() => onPageChange(totalPages - 1)} aria-label="Última página">
          <ChevronsRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}