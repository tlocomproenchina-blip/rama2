// Búsqueda de clientes para las incidencias de almacén: un solo buscador que
// encuentra al cliente por shipping mark, tracking, email, teléfono, nombre o
// cédula. Las pantallas de incidencias usan esta lógica compartida.
import { fetchAllFilter } from "./paginatedFetch.ts";

const digits = (value: any) => String(value || "").replace(/\D/g, "");

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const project = (user: any, matchedBy: string[]) => ({
  email: user.email || "",
  full_name: user.full_name || "",
  shipping_mark: user.shipping_mark || "",
  cedula: user.cedula || "",
  whatsapp: user.whatsapp || "",
  phone: user.phone || "",
  matched_by: matchedBy,
});

export async function findIncidentClients(base44: any, query: string, limit = 15) {
  const raw = String(query || "").trim();
  if (raw.length < 2) return [];
  const q = raw.toLowerCase();
  const qDigits = digits(raw);

  const users = await fetchAllFilter(base44.asServiceRole.entities.User, {}, "-created_date");
  const found = new Map<string, { user: any; via: string[] }>();

  const add = (user: any, via: string) => {
    if (!user?.email) return;
    const current = found.get(user.email);
    if (current) {
      if (!current.via.includes(via)) current.via.push(via);
      return;
    }
    found.set(user.email, { user, via: [via] });
  };

  for (const user of users) {
    if (String(user.shipping_mark || "").toLowerCase().includes(q)) { add(user, "shipping mark"); continue; }
    if (String(user.email || "").toLowerCase().includes(q)) { add(user, "email"); continue; }
    if (String(user.full_name || "").toLowerCase().includes(q)) { add(user, "nombre"); continue; }
    if (String(user.cedula || "").toLowerCase().includes(q)) { add(user, "cédula"); continue; }
    if (
      qDigits.length >= 4 &&
      (digits(user.whatsapp).includes(qDigits) || digits(user.phone).includes(qDigits))
    ) add(user, "teléfono");
  }

  // Un tracking lleva al paquete y el paquete al cliente dueño de la carga.
  if (raw.length >= 4) {
    const packages = await base44.asServiceRole.entities.Package
      .filter({ tracking_number: { $regex: escapeRegex(raw), $options: "i" } }, "-created_date", 50)
      .catch(() => []);
    const emails = [...new Set((packages || []).map((p: any) => p.client_email).filter(Boolean))] as string[];
    if (emails.length) {
      const owners = await base44.asServiceRole.entities.User
        .filter({ email: { $in: emails.slice(0, 50) } }, "-created_date", 50)
        .catch(() => []);
      for (const owner of owners || []) add(owner, "tracking");
    }
  }

  const matched = [...found.values()];
  matched.sort((a, b) => {
    const exactA = String(a.user.shipping_mark || "").toLowerCase() === q ? 0 : 1;
    const exactB = String(b.user.shipping_mark || "").toLowerCase() === q ? 0 : 1;
    return exactA - exactB;
  });

  return matched.slice(0, limit).map(({ user, via }) => project(user, via));
}