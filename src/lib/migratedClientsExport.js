import * as XLSX from 'xlsx';

// Excel con los clientes migrados de la serie 50000 a la serie 5000.
export function exportMigratedClients(records) {
  const rows = records
    .filter((r) => r.status === 'migrado')
    .map((r, i) => ({
      '#': i + 1,
      Cliente: r.client_name || '',
      Correo: r.client_email || '',
      'Shipping Mark anterior (serie 50000)': r.old_mark || '',
      'Shipping Mark actual (serie 5000)': r.new_mark || '',
    }));
  const sheet = XLSX.utils.json_to_sheet(rows);
  sheet['!cols'] = [{ wch: 5 }, { wch: 32 }, { wch: 36 }, { wch: 34 }, { wch: 32 }];
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, 'Clientes migrados');
  const date = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(book, `clientes-migrados-serie-5000-${date}.xlsx`);
  return rows.length;
}