import { useEffect, useMemo, useState } from 'react';
import { base44 } from '@/components/api/ApiQueueManager';
import { allowedPagesFor, areaCodeOf, canAccessPage, getAreaPreset } from '@/lib/areaAccess';

// Configuración de módulos por área: se guarda un rato corto para no repetir la
// consulta en cada cambio de página, pero se vuelve a pedir sola para que un
// cambio de permisos no quede pegado en la sesión del empleado.
const CACHE_TTL = 60000;
const roleConfigCache = new Map(); // area -> { row, at }
const cacheKey = (area) => `roleConfig:${area}`;

// Copia de la sesión: sirve para el primer render sin parpadeo (la escribe el
// propio Layout al cargar el usuario).
function readSessionConfig(area) {
  try {
    const raw = sessionStorage.getItem(cacheKey(area));
    return raw ? JSON.parse(raw) : null;
  } catch (_) {
    return null;
  }
}

function writeConfig(area, row) {
  roleConfigCache.set(area, { row, at: Date.now() });
  if (row) {
    try { sessionStorage.setItem(cacheKey(area), JSON.stringify(row)); } catch (_) {}
  }
}

function readCachedConfig(area) {
  if (!area) return null;
  const entry = roleConfigCache.get(area);
  if (entry) return entry.row;
  return readSessionConfig(area);
}

// Al guardar los permisos de un área se limpia su copia para que el cambio se vea
// de inmediato, sin esperar a que expire.
export function clearRoleConfigCache(area) {
  const code = String(area || '').trim().toLowerCase();
  if (!code) return;
  roleConfigCache.delete(code);
  try { sessionStorage.removeItem(cacheKey(code)); } catch (_) {}
}

export default function useAreaAccess(user, page) {
  const area = areaCodeOf(user);
  const [roleConfig, setRoleConfig] = useState(() => readCachedConfig(area));

  useEffect(() => {
    if (!area) {
      setRoleConfig(null);
      return undefined;
    }

    setRoleConfig(readCachedConfig(area));

    const entry = roleConfigCache.get(area);
    const isFresh = entry && Date.now() - entry.at < CACHE_TTL;
    if (isFresh) return undefined;

    let active = true;
    base44.entities.RoleConfig.filter({ role_code: area, is_active: true }, '-updated_date', 1)
      .then((rows) => {
        const row = rows?.[0] || null;
        writeConfig(area, row);
        // Sin configuración guardada para el área: aplican los módulos
        // predeterminados de su preset.
        if (active) setRoleConfig(row);
      })
      .catch(() => {});

    return () => { active = false; };
  }, [area]);

  const allowedPages = useMemo(() => allowedPagesFor(user, roleConfig), [user, roleConfig]);
  const canAccess = useMemo(() => canAccessPage(user, roleConfig, page), [user, roleConfig, page]);

  return {
    isEmployee: !!area,
    areaName: getAreaPreset(area)?.role_name || user?.custom_role || '',
    roleConfig,
    allowedPages,
    canAccess,
  };
}