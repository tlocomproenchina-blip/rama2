// Código de operador (OP 01, OP 02...) para el personal del área de almacén.
// Se asigna una sola vez, de forma consecutiva, y se conserva en la cuenta.

const fmt = (n: number) => String(n).padStart(2, '0');

export const isWarehouseOperator = (user: any) =>
  user?.role === 'admin' && String(user?.custom_role || '').trim().toLowerCase() === 'almacen';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Devuelve el código del usuario (asignándolo si es operador de almacén y aún no lo tiene).
// Para no duplicar códigos cuando varios operadores se activan a la vez: cada uno escribe
// su candidato y lo verifica; si otro lo tomó al mismo tiempo, lo suelta y reintenta.
export async function ensureOperatorCode(svc: any, user: any): Promise<string> {
  if (!isWarehouseOperator(user)) return '';
  if (user.operator_code) return String(user.operator_code);

  for (let attempt = 0; attempt < 6; attempt += 1) {
    const fresh = await svc.User.get(user.id);
    if (fresh?.operator_code) return String(fresh.operator_code);

    const withCode = await svc.User.filter({ operator_code: { $exists: true } }, '-created_date', 500);
    const max = withCode.reduce((m: number, u: any) => {
      const n = parseInt(String(u.operator_code || ''), 10);
      return Number.isFinite(n) && n > m ? n : m;
    }, 0);
    const candidate = fmt(max + 1);

    await svc.User.update(user.id, { operator_code: candidate });
    await sleep(150 + Math.floor(Math.random() * 250));

    const holders = await svc.User.filter({ operator_code: candidate }, '-created_date', 10);
    if (holders.length <= 1) return candidate;

    await svc.User.update(user.id, { operator_code: '' });
    await sleep(100 + Math.floor(Math.random() * 400));
  }
  throw new Error('No se pudo asignar el código de operador');
}