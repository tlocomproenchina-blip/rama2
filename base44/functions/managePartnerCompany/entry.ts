import { createClientFromRequest } from 'npm:@base44/sdk@0.8.49';
import {
  configKeyForCompany,
  ensureCompanyConfig,
  findCompanyByCode,
  generateServiceKey,
  getCompanyConfig,
  normalizeCompanyCode,
  partnerConfigKey,
  PLATFORM_COMPANY_CODE,
  serviceKeyPrefix,
  syncCompanyBrandToConfig,
} from '../../shared/companyContext.ts';
import { runChannelAction } from '../../shared/serviceChannel.ts';

// Alta, edición, llave y estado de las empresas socias (solo administradores de TLEC).
// Acciones: create, update, rotate_key, set_status, probe.

const COMPANY_FIELDS = [
  'name', 'legal_name', 'contact_name', 'contact_email', 'contact_phone', 'notes',
  'app_name', 'app_tagline', 'app_logo_url', 'favicon_url', 'brand_color',
  'app_public_url', 'custom_domain',
  'invoice_company_name', 'invoice_company_address', 'invoice_company_city_zip',
  'invoice_company_country', 'invoice_company_phone', 'invoice_company_email',
  'invoice_logo_url',
];

const VALID_STATUS = ['activa', 'suspendida', 'desactivada'];

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Solo administradores' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const action = body?.action;

    if (action === 'create') {
      const input = body?.company || {};
      const code = normalizeCompanyCode(input.company_code);
      if (!code || code.length < 2) return Response.json({ error: 'El código de empresa es obligatorio (mínimo 2 caracteres)' }, { status: 400 });
      if (code === PLATFORM_COMPANY_CODE) return Response.json({ error: 'TLEC es un código reservado' }, { status: 400 });
      if (!String(input.name || '').trim()) return Response.json({ error: 'El nombre de la empresa es obligatorio' }, { status: 400 });

      const existing = await findCompanyByCode(base44, code);
      if (existing) return Response.json({ error: `Ya existe una empresa con el código ${code}` }, { status: 409 });

      const serviceKey = generateServiceKey();
      const now = new Date().toISOString();
      const payload: any = {
        company_code: code,
        name: String(input.name).trim(),
        status: 'activa',
        is_platform_owner: false,
        config_key: partnerConfigKey(code),
        service_key: serviceKey,
        service_key_prefix: serviceKeyPrefix(serviceKey),
        service_key_created_date: now,
        activated_date: now,
        created_by: user.email || '',
      };
      COMPANY_FIELDS.forEach((field) => {
        if (input[field] !== undefined) payload[field] = input[field];
      });

      const company = await base44.asServiceRole.entities.Company.create(payload);
      await ensureCompanyConfig(base44, company);

      return Response.json({ ok: true, company, service_key: serviceKey });
    }

    const companyId = String(body?.company_id || '');
    if (!companyId) return Response.json({ error: 'Falta company_id' }, { status: 400 });
    const current = await base44.asServiceRole.entities.Company.get(companyId).catch(() => null);
    if (!current) return Response.json({ error: 'Empresa no encontrada' }, { status: 404 });

    if (action === 'update') {
      const input = body?.company || {};
      const patch: any = {};
      COMPANY_FIELDS.forEach((field) => {
        if (input[field] !== undefined) patch[field] = input[field];
      });
      if (!Object.keys(patch).length) return Response.json({ error: 'No hay cambios que guardar' }, { status: 400 });

      const updated = await base44.asServiceRole.entities.Company.update(companyId, patch);
      // La marca de la socia vive en su configuración: su app la reaplica sin rehacerse.
      await syncCompanyBrandToConfig(base44, updated);
      return Response.json({ ok: true, company: updated });
    }

    if (action === 'rotate_key') {
      const serviceKey = generateServiceKey();
      const updated = await base44.asServiceRole.entities.Company.update(companyId, {
        service_key: serviceKey,
        service_key_prefix: serviceKeyPrefix(serviceKey),
        service_key_rotated_date: new Date().toISOString(),
      });
      return Response.json({ ok: true, company: updated, service_key: serviceKey });
    }

    if (action === 'set_status') {
      const status = String(body?.status || '');
      if (!VALID_STATUS.includes(status)) return Response.json({ error: 'Estado inválido' }, { status: 400 });
      const patch: any = { status };
      if (status === 'activa') patch.disabled_date = null;
      else patch.disabled_date = new Date().toISOString();
      const updated = await base44.asServiceRole.entities.Company.update(companyId, patch);
      return Response.json({ ok: true, company: updated });
    }

    if (action === 'probe') {
      if (!current.service_key) return Response.json({ error: 'La empresa no tiene llave de servicio' }, { status: 400 });
      const probes: any[] = [];

      const health = await runChannelAction(base44, { key: current.service_key, action: 'health' });
      probes.push({
        label: 'Identificación de la llave',
        ok: health.status < 400,
        detail: health.body?.company_code || '',
        error: health.body?.error || '',
      });

      const config = await runChannelAction(base44, { key: current.service_key, action: 'config' });
      probes.push({
        label: 'Configuración propia',
        ok: config.status < 400 && !!config.body?.brand,
        detail: config.body?.brand?.app_name || '',
        error: config.body?.error || 'No se encontró la configuración de esta empresa',
      });

      const read = await runChannelAction(base44, {
        key: current.service_key,
        action: 'entities',
        params: { op: 'filter', entity: 'AppConfig', query: { config_key: 'main' }, limit: 1 },
      });
      probes.push({
        label: 'Lectura de datos',
        ok: read.status < 400,
        detail: `${read.body?.count ?? 0} registro(s)`,
        error: read.body?.error || '',
      });

      return Response.json({ ok: true, probes, config_key: configKeyForCompany(current) });
    }

    return Response.json({ error: 'Acción no soportada' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}