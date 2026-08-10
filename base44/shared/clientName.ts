// Helper compartido para resolver el nombre completo de un cliente por email.
// Usado por todas las funciones de envío de emails automáticos para personalizar
// el saludo en lugar de usar un "Hola," genérico.

export function formatClientName(user: any): string {
  if (!user) return '';
  const first = String(user.first_name || '').trim();
  const last = String(user.last_name || '').trim();
  if (first && last) return `${first} ${last}`;
  if (first) return first;
  if (last) return last;
  const full = String(user.full_name || '').trim();
  if (full) return full;
  return '';
}

// Resuelve el nombre completo de un cliente por email.
// Devuelve '' si no encuentra el usuario o si no tiene nombre configurado.
export async function getClientNameByEmail(base44: any, email: string): Promise<string> {
  if (!email) return '';
  try {
    const users = await base44.asServiceRole.entities.User.filter({ email }, '-updated_date', 1);
    const name = formatClientName(users?.[0]);
    return name;
  } catch (_) {
    return '';
  }
}

// Resuelve los nombres de varios clientes en paralelo y devuelve un mapa { email: nombre }.
export async function getClientNamesByEmails(base44: any, emails: string[]): Promise<Record<string, string>> {
  const map: Record<string, string> = {};
  const unique = [...new Set((emails || []).filter(Boolean))];
  await Promise.all(unique.map(async (email) => {
    map[email] = await getClientNameByEmail(base44, email);
  }));
  return map;
}