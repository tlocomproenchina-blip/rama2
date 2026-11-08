// Grupos de trackings que explican la diferencia entre registros y escaneos.
export function buildIssueGroups(data) {
  const m = data.match;
  const i = data.issues;
  return [
    { key: 'scanned_without_record', label: 'Sin registro', total: m.scanned_without_record, items: i.scanned_without_record, hint: 'Se escanearon en bodega pero no existe ningún paquete con ese tracking o etiqueta.' },
    { key: 'scanned_not_received', label: 'Sin recepción', total: m.scanned_not_received, items: i.scanned_not_received, hint: 'Tienen registro, pero el paquete sigue sin fecha de recepción aunque se escaneó.' },
    { key: 'duplicate_records', label: 'Registros duplicados', total: m.duplicate_records, items: i.duplicate_records, hint: 'Un mismo tracking escaneado tiene más de un paquete recibido en el período.' },
    { key: 'same_package_codes', label: 'Mismo paquete', total: m.same_package_codes, items: i.same_package_codes, hint: 'Dos códigos distintos (tracking y etiqueta) llevaron al mismo paquete: es una sola carga.' },
    { key: 'received_before', label: 'Recibidos antes', total: m.received_before, items: i.received_before, hint: 'Se volvieron a escanear en el período, pero su recepción es anterior.' },
  ];
}