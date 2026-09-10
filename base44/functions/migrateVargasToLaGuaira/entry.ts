import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

// Mapeo state_code -> código externo del archivo de automatización (N1–N7)
const STATE_EXTERNAL_CODES = {
  carabobo: 'N1', cojedes: 'N1', falcon: 'N1',
  caracas: 'N2', miranda: 'N2', la_guaira: 'N2', nueva_esparta: 'N2',
  lara: 'N3', portuguesa: 'N3', yaracuy: 'N3', barinas: 'N3', tachira: 'N3',
  zulia: 'N4', trujillo: 'N4', merida: 'N4',
  anzoategui: 'N5', sucre: 'N5',
  monagas: 'N6', bolivar: 'N6',
  delta_amacuro: 'N7', apure: 'N7', amazonas: 'N7', aragua: 'N7'
};

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const results = { states_renamed: 0, users_updated: 0, codes_populated: 0 };

    // 1. Renombrar StateConfig: state_code "vargas" -> "la_guaira"
    const vargasStates = await base44.asServiceRole.entities.StateConfig.filter({ state_code: 'vargas' });
    for (const s of vargasStates) {
      await base44.asServiceRole.entities.StateConfig.update(s.id, {
        state_code: 'la_guaira',
        state_name: 'La Guaira'
      });
      results.states_renamed++;
    }

    // 2. Pre-poblar state_code_external en todos los estados que no lo tengan
    const allStates = await base44.asServiceRole.entities.StateConfig.list();
    for (const s of allStates) {
      const ext = STATE_EXTERNAL_CODES[s.state_code];
      if (ext && !s.state_code_external) {
        await base44.asServiceRole.entities.StateConfig.update(s.id, { state_code_external: ext });
        results.codes_populated++;
      }
    }

    // 3. Actualizar usuarios con state "vargas" o "Vargas"
    for (const oldVal of ['vargas', 'Vargas']) {
      const newVal = oldVal === 'vargas' ? 'la_guaira' : 'La Guaira';
      try {
        const matches = await base44.asServiceRole.entities.User.filter({ state: oldVal });
        for (const u of matches) {
          try {
            await base44.asServiceRole.entities.User.update(u.id, { state: newVal });
            results.users_updated++;
          } catch (e) {
            // User update puede fallar por restricciones; continuar con el resto
          }
        }
      } catch (e) {
        // Filtro de User por state puede no ser soportado; continuar
      }
    }

    return Response.json({ status: 'ok', ...results });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}