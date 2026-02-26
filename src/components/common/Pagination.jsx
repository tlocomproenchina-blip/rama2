import React from "react";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";

export default function Pagination({ page, onPrev, onNext, hasNext }) {
  return (
    <div className="flex items-center justify-end gap-2 mt-4">
      <Button
        variant="outline"
        size="sm"
        onClick={onPrev}
        disabled={page === 0}
        className="min-w-20"
      >
        <ChevronLeft className="w-4 h-4 mr-1" /> Anterior
      </Button>
      <span className="text-sm text-slate-600 px-2">Página {page + 1}</span>
      <Button
        variant="outline"
        size="sm"
        onClick={onNext}
        disabled={!hasNext}
        className="min-w-20"
      >
        Siguiente <ChevronRight className="w-4 h-4 ml-1" />
      </Button>
    </div>
  );
}