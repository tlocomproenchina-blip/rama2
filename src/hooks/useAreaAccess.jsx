import { useEffect, useMemo, useState } from 'react';
import { base44 } from '@/components/api/ApiQueueManager';
import { allowedPagesFor, areaCodeOf, canAccessPage, getAreaPreset } from '@/lib/areaAccess';

// Configuración de módulos por área: se pide una sola vez por sesión para que
// cada cambio de página no repita la consulta. La copia en sesión la deja el
// Layout al cargar el usuario, así el primer render ya usa los módulos reales
// del área (sin parpadeo).
const roleConfigCache = new Map();

function readCachedConfig(area) {
  if (!area) return null;
  if (roleConfigCache.has(area)) return roleConfigCache.get(area);
  try {
    const raw = sessionStorage.getItem(`roleConfig:${area}`);
    if (raw) {
      const row = JSON.parse(raw);
      roleConfigCache.set(area, row);
      return row;
    }
  } catch (_) {}
  return null;
}

export default function useAreaAccess(user, page) {
  const area = areaCodeOf(user);
  const [roleConfig, setRoleConfig] = useState(() => readCachedConfig(area));

  useEffect(() => {
    if (!area) {
      setRoleConfig(null);
      return;
    }
    const cached = readCachedConfig(area);
    if (roleConfigCache.has(area)) {
      setRoleConfig(cached);
      return;
    }

    let active = true;
    base44.entities.RoleConfig.filter({ role_code: area, is_active: true }, '-updated_date', 1)
      .then((rows) => {
        const row = rows?.[0] || null;
        roleConfigCache.set(area, row);
        try { if (row) sessionStorage.setItem(`roleConfig:${area}`, JSON.stringify(row)); } catch (_) {}
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