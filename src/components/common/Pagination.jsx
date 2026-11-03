import React from "react";
import { Button } from "@/components/ui/button";

export default function Pagination({ page, onPrev, onNext, hasNext }) {
  return (
    <div className="mt-4">
      {hasNext ? (
        <Button variant="outline" className="w-full" onClick={onNext}>
          Cargar más
        </Button>
      ) : null}
    </div>
  );
}