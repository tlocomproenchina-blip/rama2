// Facturas que esperan que el cliente elija cómo recibir su carga
// (retiro en almacén Valencia o puerta a puerta). El monto final se fija al elegir.
export const isDeliveryChoicePending = (invoice) => invoice?.delivery_choice_status === 'pendiente';

export const DELIVERY_OPTION_LABELS = {
  retiro_almacen: 'Retiro en almacén Valencia',
  puerta_a_puerta: 'Entrega puerta a puerta',
};

// Campos con los que se crea la factura: el puerta a puerta queda calculado
// (tarifa por CBM × CBM facturado) pero no se suma hasta que el cliente lo elija.
export function deliveryChoiceFields(cbm, ratePerCbm) {
  const c = Math.max(0, Number(cbm) || 0);
  const rate = Math.max(0, Number(ratePerCbm) || 0);
  return {
    delivery_choice_status: 'pendiente',
    door_to_door_quote: { rate_per_cbm: rate, cbm: c, amount: Math.round(c * rate * 100) / 100 },
  };
}