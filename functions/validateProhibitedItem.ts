import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

// validateProhibitedItem
// Input: { item_name: string, details?: string }
// Output: { is_prohibited: boolean, reasons: string[], needs_clarification: boolean, question?: string, normalized_item: string }

function normalize(text = '') {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}+/gu, '')
    .replace(/[^a-z0-9\s_-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const itemRaw = String(body?.item_name || '');
    const detailsRaw = String(body?.details || '');

    if (!itemRaw) {
      return Response.json({ error: 'Falta item_name' }, { status: 400 });
    }

    const item = normalize(itemRaw + ' ' + detailsRaw);

    const prohibited = [
      // armas
      'arma', 'pistola', 'revolver', 'rifle', 'escopeta', 'municion', 'bala', 'cargador', 'taser', 'gas pimienta', 'spray pimienta',
      // liquidos/aerosoles/perfumes
      'liquido', 'aerosol', 'spray', 'perfume', 'colonia', 'fragancia',
      // alimentos/medicinas
      'alimento', 'comida', 'bebida', 'medicamento', 'medicina', 'vitamina', 'suplemento',
      // baterias sueltas / peligrosas
      'bateria suelta', 'baterias sueltas', 'bateria', 'baterias', 'lipo', 'li-ion', 'litio',
      // replicas/marcas
      'replica', 'marca replica', 'falsificacion', 'counterfeit',
      // sustancias ilegales/explosivos
      'droga', 'ilegal', 'explosivo', 'polvora'
    ];

    const safeHints = [
      'ropa', 'zapato', 'zapatilla', 'camisa', 'pantalon', 'chaqueta', 'accesorio', 'gorro', 'bufanda', 'funda', 'cable', 'teclado', 'mouse', 'audifono', 'libro', 'juguete', 'luz led', 'led strip'
    ];

    const reasons = [];

    // Chequeo directo de prohibidos
    for (const kw of prohibited) {
      if (item.includes(kw)) {
        reasons.push(`Contiene termino prohibido: ${kw}`);
      }
    }

    let is_prohibited = reasons.length > 0;

    // Si no es claramente prohibido y tampoco claramente seguro, pedir aclaracion rapida
    const clearlySafe = safeHints.some(h => item.includes(h));

    let needs_clarification = false;
    let question = undefined;

    if (!is_prohibited && !clearlySafe) {
      const maybeRisk = ['liquido', 'aerosol', 'medicamento', 'bateria'];
      const hints = maybeRisk.filter(h => item.includes(h));
      if (hints.length > 0) {
        needs_clarification = true;
      }
      // Pregunta estandar
      question = '¿Es líquido, aerosol, medicamento o contiene batería suelta?';
    }

    return Response.json({
      is_prohibited,
      reasons,
      needs_clarification,
      question,
      normalized_item: item
    });
  } catch (error) {
    return Response.json({ error: error?.message || 'Server error' }, { status: 500 });
  }
});