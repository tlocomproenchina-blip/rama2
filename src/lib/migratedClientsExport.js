import * as XLSX from 'xlsx';

const yesNo = (v) => (v === true || v === 'true' ? 'Sí' : 'No');
const fmtDate = (v) => (v ? String(v).slice(0, 10) : '');

export function buildMigratedClientRows(records) {
  return records
    .filter((r) => r.status === 'migrado')
    .map((r, i) => {
      const p = r.profile || {};
      return {
        '#': i + 1,
        'Nombre': p.first_name || '',
        'Apellido': p.last_name || '',
        'Nombre completo': r.client_name || [p.first_name, p.last_name].filter(Boolean).join(' '),
        'Cédula': p.cedula || '',
        'Correo': r.client_email || '',
        'Teléfono / WhatsApp': p.whatsapp || '',
        'Dirección': p.address || '',
        'Ciudad': p.city || '',
        'Estado': p.state || '',
        'Shipping Mark anterior (serie 50000)': r.old_mark || '',
        'Shipping Mark actual (serie 5000)': r.new_mark || '',
        'Fecha de migración': fmtDate(r.migrated_date),
        'Fecha de registro': fmtDate(p.created_date),
        'Código de referido': p.referral_code || '',
        'Contrato aceptado': yesNo(p.contract_accepted),
        'Perfil completado': yesNo(p.profile_completed),
        'Cuenta activa': p.is_active === false ? 'No' : 'Sí',
      };
    });
}

export function buildMigratedClientsSheet(records) {
  const rows = buildMigratedClientRows(records);
  const sheet = XLSX.utils.json_to_sheet(rows);
  sheet['!cols'] = [5, 16, 16, 28, 14, 34, 20, 48, 20, 18, 30, 30, 16, 16, 18, 16, 16, 14].map((wch) => ({ wch }));
  return { sheet, count: rows.length };
}

// Excel con los clientes migrados de la serie 50000 a la serie 5000 y su perfil completo.
export function exportMigratedClients(records) {
  const { sheet, count } = buildMigratedClientsSheet(records);
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, 'Clientes migrados');
  const date = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(book, `clientes-migrados-serie-5000-${date}.xlsx`);
  return count;
}