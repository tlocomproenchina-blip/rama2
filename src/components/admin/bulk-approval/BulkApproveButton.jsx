import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { CheckCheck } from 'lucide-react';
import BulkApproveDialog from './BulkApproveDialog';

// Botón de aprobación masiva: aprueba en un clic los registros visibles del tipo indicado.
// Se oculta cuando no hay registros visibles que aprobar.
export default function BulkApproveButton({ ids, type, label, amount, amountLabel, onDone, disabled }) {
  const [open, setOpen] = useState(false);
  const count = ids?.length || 0;

  if (count === 0) return null;

  return (
    <>
      <Button
        size="sm"
        onClick={() => setOpen(true)}
        disabled={disabled}
        className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700 text-white"
      >
        <CheckCheck className="h-4 w-4 mr-1" />
        {label} ({count})
      </Button>
      <BulkApproveDialog
        open={open}
        onOpenChange={setOpen}
        ids={ids}
        type={type}
        label={label}
        amount={amount}
        amountLabel={amountLabel}
        onDone={onDone}
      />
    </>
  );
}