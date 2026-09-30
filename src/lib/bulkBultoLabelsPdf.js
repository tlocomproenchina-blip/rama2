// PDF combinado de etiquetas de bulto (100×100 mm, una página por etiqueta).
// Se usa al crear bultos en lote para imprimir todas las etiquetas del lote en un
// solo archivo, con la misma información que la etiqueta térmica: código de barras,
// estado del cliente, N° de orden y datos de entrega.
export async function downloadCombinedBultoLabelsPdf({ bultos = [], nameHint = 'bultos' }) {
  if (!bultos.length) return 0;

  const { default: jsPDF } = await import('jspdf');
  const JsBarcode = (await import('jsbarcode')).default;

  const doc = new jsPDF({ unit: 'mm', format: [100, 100] });

  bultos.forEach((bulto, idx) => {
    if (idx > 0) doc.addPage();
    const cs = bulto.client_snapshot || {};
    const pkgCount = ((bulto.package_ids?.length || 0) + (bulto.unregistered_codes?.length || 0))
      || (bulto.package_trackings?.length || 0);
    let y = 5;

    try {
      const canvas = document.createElement('canvas');
      JsBarcode(canvas, bulto.label_code, { format: 'CODE128', width: 4, height: 80, displayValue: true, fontSize: 18, margin: 0 });
      const imgData = canvas.toDataURL('image/png');
      const imgWidth = 85;
      const imgHeight = (canvas.height / canvas.width) * imgWidth;
      doc.addImage(imgData, 'PNG', (100 - imgWidth) / 2, y, imgWidth, imgHeight);
      y += imgHeight + 3;
    } catch (_) {}

    doc.setLineWidth(0.3);
    doc.line(5, y, 95, y);
    y += 4;

    doc.setFontSize(28);
    doc.setTextColor(0);
    doc.setFont(undefined, 'bold');
    doc.text((cs.state || 'SIN ESTADO').toUpperCase(), 50, y + 5, { align: 'center' });
    y += 12;

    doc.setLineWidth(0.3);
    doc.line(5, y, 95, y);
    y += 5;

    // Orden (CbmIngreso)
    const orderNumbers = Array.isArray(bulto.cbm_order_numbers) ? bulto.cbm_order_numbers.filter(Boolean) : [];
    if (orderNumbers.length > 0) {
      doc.setFontSize(12);
      doc.setFont(undefined, 'bold');
      doc.text(`ORDEN: ${orderNumbers.join(', ')}`, 50, y, { align: 'center' });
      y += 5;
      doc.setLineWidth(0.3);
      doc.line(5, y, 95, y);
      y += 5;
    }

    doc.setFontSize(18);
    doc.setFont(undefined, 'bold');
    doc.text(`BULTO ${bulto.bulto_number}/${bulto.total_bultos} - ${pkgCount} PAQUETES`, 50, y, { align: 'center' });
    y += 7;

    doc.setLineWidth(0.3);
    doc.line(5, y, 95, y);
    y += 5;

    doc.setFontSize(13);
    const nameCedula = [cs.full_name, cs.cedula ? `C.I. ${cs.cedula}` : ''].filter(Boolean).join(' - ');
    if (nameCedula) { doc.text(nameCedula, 5, y); y += 6; }
    doc.setFontSize(11);
    if (cs.whatsapp) { doc.text(`Tel: ${cs.whatsapp}`, 5, y); y += 5; }
    doc.setFontSize(10);
    if (cs.address) {
      const addrLines = doc.splitTextToSize(cs.address, 90);
      doc.text(addrLines.slice(0, 2), 5, y);
      y += addrLines.slice(0, 2).length * 4.5;
    }
    const cityState = [cs.city, cs.state].filter(Boolean).join(', ');
    if (cityState) { doc.text(cityState, 5, y); }
  });

  const safeName = String(nameHint || 'bultos').replace(/[^a-zA-Z0-9]/g, '');
  doc.save(`etiquetas-${safeName}-${bultos.length}.pdf`);
  return bultos.length;
}