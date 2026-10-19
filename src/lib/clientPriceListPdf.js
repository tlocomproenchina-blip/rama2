import jsPDF from 'jspdf';

const rateFor = (state, pricing, type) => {
  const override = type === 'regular' ? state.final_rate_regular : state.final_rate_high;
  if (Number(override) > 0) return Number(override);
  const base = type === 'regular' ? Number(pricing.base_rate_regular || 0) : Number(pricing.base_rate_high_risk || 0);
  return (base * (1 + Number(pricing.profit_percentage || 0) / 100))
    + Number(state.shipping_rate || 0)
    + Number(pricing.door_to_door_cost || 0);
};

const money = (v) => `$${Number(v || 0).toFixed(2)}`;

// PDF de tarifas por estado para entregar a clientes
export async function generateClientPriceListPdf({ states = [], pricing = {}, appConfig = {} }) {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const company = appConfig.app_name || 'TLEC CARGO';
  const logoUrl = appConfig.invoice_logo_url || appConfig.app_logo_url;
  let y = 14;

  if (logoUrl) {
    try {
      const res = await fetch(logoUrl);
      const blob = await res.blob();
      const dataUrl = await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.readAsDataURL(blob);
      });
      doc.addImage(dataUrl, 'PNG', 14, 10, 20, 20);
    } catch (_) {}
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text(company, logoUrl ? 40 : 14, 18);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.text('Tarifas de envío China → Venezuela por estado de destino', logoUrl ? 40 : 14, 25);
  doc.setFontSize(9);
  doc.text(`Vigente desde: ${new Date().toLocaleDateString('es-VE')}`, pageWidth - 14, 18, { align: 'right' });
  y = 38;

  const ensure = (needed = 20) => {
    if (y + needed > 283) { doc.addPage(); y = 16; }
  };

  const title = (text) => {
    ensure(16);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(30, 64, 175);
    doc.text(text, 14, y);
    doc.setTextColor(0, 0, 0);
    y += 6;
  };

  const line = (text, indent = 0) => {
    const lines = doc.splitTextToSize(text, pageWidth - 28 - indent);
    ensure(lines.length * 4.6 + 4);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text(lines, 14 + indent, y);
    y += lines.length * 4.6 + 1;
  };

  // Cómo funciona
  title('¿Cómo se calcula tu envío?');
  line('1. Medimos tu carga en CBM (metros cúbicos): largo x ancho x alto en cm, dividido entre 1.000.000.', 3);
  line('2. Tu carga se cobra por su volumen real: el precio por CBM de tu estado de destino, sin mínimo de envío ni tarifa fija por volumen pequeño.', 3);
  line('3. Desde 400 kg inclusive, el precio por CBM se cobra al doble (x2), tanto en carga ordinaria como en carga de alto riesgo.', 3);
  line('4. La entrega es puerta a puerta en la dirección del cliente y va incluida en la tarifa.', 3);
  line(`5. Cargo fijo de $1,00 por recepción de cada paquete en almacén.${appConfig.insurance_percentage ? ` Seguro opcional: ${appConfig.insurance_percentage}% del valor FOB.` : ''}`, 3);
  y += 3;

  // Tabla por estado
  const nameX = 16;
  const cbmX = 92;
  const minX = 145;
  const tableWidth = pageWidth - 28;
  const rowH = 7;

  const drawHeader = (label) => {
    ensure(20);
    doc.setFillColor(30, 64, 175);
    doc.roundedRect(14, y, tableWidth, 8, 2, 2, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text(label, nameX, y + 5.5);
    doc.text('Precio por CBM', cbmX, y + 5.5);
    doc.text('Sobrepeso x2', minX, y + 5.5);
    doc.setTextColor(0, 0, 0);
    y += 9.5;
  };

  const drawStates = (type, label) => {
    title(label);
    drawHeader('Estado de destino');
    states.forEach((state, idx) => {
      const rate = rateFor(state, pricing, type);
      if (y + rowH > 283) {
        doc.addPage();
        y = 16;
        drawHeader('Estado de destino');
      }
      if (idx % 2 === 0) {
        doc.setFillColor(248, 250, 252);
        doc.roundedRect(14, y - 1.2, tableWidth, rowH, 1.5, 1.5, 'F');
      }
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.text(state.state_name, nameX, y + 3);
      doc.text(money(rate), cbmX, y + 3);
      doc.text(money(rate * 2), minX, y + 3);
      y += rowH;
    });
    y += 5;
  };

  drawStates('regular', 'Carga ordinaria (general)');
  doc.addPage();
  y = 16;
  drawStates('high', 'Carga de alto riesgo / sensible');

  // Qué es carga sensible y restricciones
  title('¿Qué se considera carga de alto riesgo / sensible?');
  line('Baterías de litio, alimentos, cosméticos, líquidos y agentes acuosos, polvos, réplicas o imitaciones, marcas chinas y mercancía de alto valor.', 3);

  title('No transportamos');
  line('Medicamentos, armas y municiones, pólvora, gas, motos, chalecos y fundas tácticas, botellas presurizadas, entre otros artículos prohibidos.', 3);

  title('Notas importantes');
  line('Los precios están expresados en dólares estadounidenses (USD) y pueden variar sin previo aviso.', 3);
  line('El tiempo estimado de tránsito marítimo es de aproximadamente 90 días desde la fecha de salida.', 3);
  if (appConfig.whatsapp_number) {
    line(`Consultas: WhatsApp +${appConfig.whatsapp_number}`, 3);
  }

  doc.save(`tarifas-${company.toLowerCase().replace(/\s+/g, '-')}.pdf`);
}