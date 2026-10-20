// Genera el archivo Excel del informe de contenedores y bultos.
const HEADERS = ['Shipping mark', 'Nombre', 'Apellido', 'N° de contenedor (factura)', 'Cantidad de bultos', 'Descripción'];

export async function downloadContainersReport(rows = []) {
  const XLSX = await import('xlsx');
  const data = [
    HEADERS,
    ...rows.map((row) => [
      row.shipping_mark || '',
      row.first_name || '',
      row.last_name || '',
      row.container || '',
      Number(row.bultos || 0),
      row.description || '',
    ]),
  ];

  const sheet = XLSX.utils.aoa_to_sheet(data);
  sheet['!cols'] = [{ wch: 18 }, { wch: 20 }, { wch: 20 }, { wch: 26 }, { wch: 18 }, { wch: 55 }];
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, 'Contenedores');
  XLSX.writeFile(book, `informe-contenedores-${new Date().toISOString().slice(0, 10)}.xlsx`);
}