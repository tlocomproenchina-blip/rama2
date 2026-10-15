import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Building2 } from 'lucide-react';

// Qué dice el vínculo con el mayorista, según de dónde salió.
const ORIGEN_TITLE = {
  movimiento: 'La app de este mayorista tiene movimientos registrados de esta carga',
  cliente: 'El Shipping Mark de esta carga corresponde a un cliente de este mayorista',
  compartido: 'La app de este mayorista ve esta carga en su lista de cargas sin titular',
};

// Mayorista al que corresponde una carga sin titular: el suyo propio o, si todavía
// no hay vínculo, las conexiones a las que su lista compartida les aparece.
export default function OrphanWholesalerBadge({ link }) {
  if (!link) return null;

  const propios = link.mayorista ? [link.mayorista.name] : [];
  const compartidos = (link.compartido || []).map((row) => row.name);
  const nombres = propios.length > 0 ? propios : compartidos;
  if (nombres.length === 0) return null;

  const compartido = propios.length === 0;

  return (
    <Badge
      variant="outline"
      title={ORIGEN_TITLE[link.origen] || ''}
      className={compartido
        ? 'gap-1 border-indigo-200 bg-indigo-50 text-indigo-700'
        : 'gap-1 border-indigo-300 bg-indigo-100 text-indigo-800'}
    >
      <Building2 className="h-3 w-3" />
      {compartido ? `Compartida con ${nombres.join(', ')}` : `Mayorista: ${nombres.join(', ')}`}
    </Badge>
  );
}