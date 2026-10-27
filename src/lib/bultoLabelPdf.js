import { realPackageCount } from '@/lib/bultoCounts';
import { labelSymbolImage } from '@/lib/labelSymbol';

// Etiqueta de bulto en PDF para impresión térmica de 100 × 100 mm.
// Todo el contenido se ajusta al área imprimible: los textos largos reducen su
// tamaño de letra hasta entrar en el ancho y, si el conjunto no cabe a lo alto,
// la etiqueta completa se escala para no recortar nada.
const PAGE_SIZE = 100;
const MARGIN = 4;
const CONTENT_W = PAGE_SIZE - MARGIN * 2;
const PRINTABLE_H = PAGE_SIZE - MARGIN * 2;

const QR_SIZE = 38;

function setFont(doc, size, style = 'bold', family = 'helvetica') {
  doc.setFont(family, style);
  doc.setFontSize(size);
}

// Mayor tamaño de letra con el que el texto completo entra en el ancho dado.
function fitSize(doc, text, maxWidth, maxSize, minSize, style = 'bold', family = 'helvetica') {
  setFont(doc, maxSize, style, family);
  let size = maxSize;
  while (size > minSize && doc.getTextWidth(text) > maxWidth) {
    size = Math.max(minSize, size - 0.25);
    doc.setFontSize(size);
  }
  return size;
}

async function drawLabel(doc, bulto) {
  const cs = bulto.client_snapshot || {};
  const pkgCount = realPackageCount(bulto);
  const estado = String(cs.state || 'SIN ESTADO').toUpperCase();
  const orderNumbers = Array.isArray(bulto.cbm_order_numbers)
    ? bulto.cbm_order_numbers.filter(Boolean).join(', ')
    : '';
  const nameCedula = [cs.full_name, cs.cedula ? `C.I. ${cs.cedula}` : ''].filter(Boolean).join(' - ');
  const cityState = [cs.city, cs.state].filter(Boolean).join(', ');
  const bultoLine = `BULTO ${bulto.bulto_number}/${bulto.total_bultos} - ${pkgCount} PAQUETES`;

  let symbol = null;
  try {
    symbol = await labelSymbolImage(bulto.label_code);
  } catch (_) {}

  // La dirección se divide en líneas con la letra de referencia (8pt) y se
  // dibuja siempre a un tamaño igual o menor, así nunca se sale del ancho.
  setFont(doc, 8);
  const addressLines = cs.address
    ? doc.splitTextToSize(String(cs.address), CONTENT_W).slice(0, 2)
    : [];

  // Medidas a escala 1 (mm) de cada bloque.
  const symbolH = symbol ? QR_SIZE : 0;
  const codeH = symbol ? 5 : 0;
  const SEP_H = 2.6;
  const stateH = 10.5;
  const bultoH = 7;
  const nameH = nameCedula ? 5 : 0;
  const phoneH = cs.whatsapp ? 4.4 : 0;
  const addrH = addressLines.length * 3.8;
  const cityH = cityState ? 4 : 0;

  const fixedBase = symbolH + codeH + SEP_H + stateH + SEP_H + bultoH + SEP_H
    + nameH + phoneH + addrH + cityH;

  // Si el conjunto no cabe a lo alto, se encoge la etiqueta completa.
  const scale = fixedBase > PRINTABLE_H
    ? Math.max(0.6, PRINTABLE_H / fixedBase)
    : 1;
  const mm = (v) => v * scale;

  const fixedH = mm(fixedBase);
  const totalH = Math.min(PRINTABLE_H, fixedH);
  let y = MARGIN + (PRINTABLE_H - totalH) / 2;

  doc.setTextColor(0);
  const separator = () => {
    doc.setDrawColor(0);
    doc.setLineWidth(0.3);
    doc.line(MARGIN, y + mm(SEP_H) / 2, PAGE_SIZE - MARGIN, y + mm(SEP_H) / 2);
    y += mm(SEP_H);
  };

  // 1. Código QR + el código escrito debajo
  if (symbol) {
    const side = QR_SIZE * scale;
    doc.addImage(symbol.data, 'PNG', (PAGE_SIZE - side) / 2, y, side, mm(symbolH));
    y += mm(symbolH);
    const size = fitSize(doc, bulto.label_code, CONTENT_W, mm(11), 5.5);
    doc.setFontSize(size);
    doc.text(bulto.label_code, PAGE_SIZE / 2, y + mm(codeH) - 1.2, { align: 'center' });
    y += mm(codeH);
  }

  // 2. Estado + N° de contenedor (mismo tamaño, reducido si no entran)
  separator();
  const gap = Math.max(1.5, mm(4));
  let numSize = Math.max(7, mm(19));
  setFont(doc, numSize);
  let wState = doc.getTextWidth(estado);
  let wOrder = orderNumbers ? doc.getTextWidth(orderNumbers) : 0;
  let totalW = wState + (orderNumbers ? gap + wOrder : 0);
  if (totalW > CONTENT_W) {
    numSize = Math.max(6.5, numSize * (CONTENT_W / totalW));
    setFont(doc, numSize);
    wState = doc.getTextWidth(estado);
    wOrder = orderNumbers ? doc.getTextWidth(orderNumbers) : 0;
    totalW = wState + (orderNumbers ? gap + wOrder : 0);
  }
  const x0 = Math.max(MARGIN, (PAGE_SIZE - totalW) / 2);
  const baseline = y + mm(stateH) / 2 + numSize * 0.24;
  doc.text(estado, x0, baseline);
  if (orderNumbers) doc.text(orderNumbers, x0 + wState + gap, baseline);
  y += mm(stateH);

  // 3. Bulto X/Y + cantidad de paquetes
  separator();
  const bultoSize = fitSize(doc, bultoLine, CONTENT_W, mm(15), 6.5);
  setFont(doc, bultoSize);
  doc.text(bultoLine, PAGE_SIZE / 2, y + mm(bultoH) / 2 + bultoSize * 0.3, { align: 'center' });
  y += mm(bultoH);

  // 4. Datos del cliente
  separator();
  if (nameCedula) {
    const size = fitSize(doc, nameCedula, CONTENT_W, mm(11), 6);
    setFont(doc, size);
    doc.text(nameCedula, MARGIN, y + mm(nameH) * 0.75);
    y += mm(nameH);
  }
  if (cs.whatsapp) {
    const phone = `Tel: ${cs.whatsapp}`;
    const size = fitSize(doc, phone, CONTENT_W, mm(10), 6);
    setFont(doc, size);
    doc.text(phone, MARGIN, y + mm(phoneH) * 0.75);
    y += mm(phoneH);
  }
  if (addressLines.length) {
    setFont(doc, Math.max(6, mm(8)));
    addressLines.forEach((line, i) => doc.text(line, MARGIN, y + (i + 0.75) * mm(3.8)));
    y += mm(addrH);
  }
  if (cityState) {
    setFont(doc, Math.max(6, mm(8)));
    doc.text(cityState, MARGIN, y + mm(cityH) * 0.75);
    y += mm(cityH);
  }
}

// Genera y descarga una etiqueta de 100 × 100 mm por cada bulto.
export async function downloadBultoLabelsPdf(bultos = []) {
  if (!bultos.length) return;
  const { default: jsPDF } = await import('jspdf');
  for (const bulto of bultos) {
    const doc = new jsPDF({ unit: 'mm', format: [PAGE_SIZE, PAGE_SIZE] });
    await drawLabel(doc, bulto);
    doc.save(`etiqueta-${bulto.label_code}.pdf`);
  }
}