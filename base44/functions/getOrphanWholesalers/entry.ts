// A qué mayorista corresponde cada carga sin titular del panel de huérfanos: se
// resuelve con los vínculos que ya existen (los movimientos registrados de su app
// y los clientes que ese mayorista reportó) y, cuando no hay ninguno, con las
// conexiones a las que su lista compartida les está ofreciendo esa carga.
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { DEFAULT_CONNECTION_KEY, connectionKeyOf, connectionLabel } from '../../shared/wholesalerCore.ts';
import { sharedConnectionsFor } from '../../shared/wholesalerOrphans.ts';

const MAX_PACKAGES = 60;

const clean = (value) => String(value || '').trim();

const asArray = (rows) => (Array.isArray(rows) ? rows : (rows?.items || []));

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    // Mismo alcance que la asignación de huérfanos: admin o almacén/operaciones.
    const allowed = user.role === 'admin' || user.custom_role === 'almacen' || user.custom_role === 'operaciones';
    if (!allowed) return Response.json({ error: 'Forbidden' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const ids = Array.from(new Set(asArray(body?.package_ids).map(clean).filter(Boolean))).slice(0, MAX_PACKAGES);
    if (ids.length === 0) return Response.json({ ok: true, connections: [], links: {} });

    const [packageRows, connectionRows] = await Promise.all([
      base44.asServiceRole.entities.Package.filter({ id: { $in: ids } }, '-created_date', MAX_PACKAGES),
      base44.asServiceRole.entities.WholesalerSync.list('created_date', 50).catch(() => []),
    ]);
    const packages = asArray(packageRows);
    const connections = asArray(connectionRows);

    const uniq = (values) => Array.from(new Set(values.filter(Boolean)));
    const trackings = uniq(packages.map((pkg) => clean(pkg.tracking_number)));
    const marks = uniq(packages.map((pkg) => clean(pkg.shipping_mark)));
    const emails = uniq(packages.map((pkg) => clean(pkg.client_email).toLowerCase()));

    const [logRows, markRows, emailRows] = await Promise.all([
      trackings.length
        ? base44.asServiceRole.entities.WholesalerLog.filter({ tracking_number: { $in: trackings } }, '-event_date', 500).catch(() => [])
        : [],
      marks.length
        ? base44.asServiceRole.entities.WholesalerClient.filter({ shipping_mark: { $in: marks } }, '-fetched_date', 300).catch(() => [])
        : [],
      emails.length
        ? base44.asServiceRole.entities.WholesalerClient.filter({ email: { $in: emails } }, '-fetched_date', 100).catch(() => [])
        : [],
    ]);

    // Un movimiento sin mayorista marcado es anterior a las conexiones: no dice de
    // quién es la carga, así que no se usa (igual que al avisar una recepción).
    const keyPorTracking = new Map();
    for (const log of asArray(logRows)) {
      const tracking = clean(log?.tracking_number);
      const key = clean(log?.wholesaler_key);
      if (!tracking || !key || keyPorTracking.has(tracking)) continue;
      keyPorTracking.set(tracking, key);
    }

    const keyPorMarca = new Map();
    for (const client of asArray(markRows)) {
      const mark = clean(client?.shipping_mark);
      if (!mark || keyPorMarca.has(mark)) continue;
      keyPorMarca.set(mark, clean(client?.wholesaler_key) || DEFAULT_CONNECTION_KEY);
    }

    const keyPorCorreo = new Map();
    for (const client of asArray(emailRows)) {
      const email = clean(client?.email).toLowerCase();
      if (!email || keyPorCorreo.has(email)) continue;
      keyPorCorreo.set(email, clean(client?.wholesaler_key) || DEFAULT_CONNECTION_KEY);
    }

    const nombrePorClave = new Map();
    for (const connection of connections) nombrePorClave.set(connectionKeyOf(connection), connectionLabel(connection));
    if (!nombrePorClave.has(DEFAULT_CONNECTION_KEY)) nombrePorClave.set(DEFAULT_CONNECTION_KEY, 'Conexión principal');

    const links = {};
    for (const pkg of packages) {
      const tracking = clean(pkg.tracking_number);
      const email = clean(pkg.client_email).toLowerCase();
      const mark = clean(pkg.shipping_mark);

      let key = tracking ? (keyPorTracking.get(tracking) || '') : '';
      let origen = 'movimiento';
      if (!key && email && keyPorCorreo.has(email)) {
        key = keyPorCorreo.get(email) || '';
        origen = 'cliente';
      }
      if (!key && mark && keyPorMarca.has(mark)) {
        key = keyPorMarca.get(mark) || '';
        origen = 'cliente';
      }

      // Sin vínculo propio: se dicen las conexiones cuya lista compartida ya le
      // está mostrando esta carga al mayorista en su app.
      const compartido = [];
      if (!key) {
        for (const connection of sharedConnectionsFor(connections, pkg)) {
          const sharedKey = connectionKeyOf(connection);
          if (sharedKey && !compartido.some((row) => row.key === sharedKey)) {
            compartido.push({ key: sharedKey, name: connectionLabel(connection) });
          }
        }
      }
      if (!key && compartido.length === 0) continue;

      links[pkg.id] = {
        mayorista: key ? { key, name: nombrePorClave.get(key) || key } : null,
        origen: key ? origen : 'compartido',
        compartido,
      };
    }

    return Response.json({
      ok: true,
      connections: connections.map((connection) => ({ key: connectionKeyOf(connection), name: connectionLabel(connection) })),
      links,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}