import React from 'react';
import { Link } from 'react-router-dom';
import { Lock, ShieldAlert } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import useAreaAccess from '@/hooks/useAreaAccess';
import { getAreaPreset, pickLandingPage } from '@/lib/areaAccess';
import { adminMenuItems } from '@/components/sidebar/sidebarConfig';

// Deja pasar solo los módulos asignados al área del empleado. Los
// administradores y las páginas que no son del panel pasan siempre.
export default function AreaAccessGate({ page, children, user: userProp, refreshUser }) {
  const { user: authUser } = useAuth();
  const user = userProp || authUser;
  const { isEmployee, allowedPages, canAccess } = useAreaAccess(user, page);

  if (!isEmployee || canAccess) {
    return React.cloneElement(children, { user, refreshUser });
  }

  const areaName = getAreaPreset(user?.custom_role)?.role_name || 'tu área';
  const landing = pickLandingPage(allowedPages);
  const landingItem = adminMenuItems.find((item) => item.page === landing);
  const shortcuts = (allowedPages || [])
    .map((allowed) => adminMenuItems.find((item) => item.page === allowed))
    .filter((item) => item && item.page !== landing)
    .slice(0, 6);

  return (
    <div className="mx-auto flex max-w-xl flex-col items-center gap-5 px-4 py-10 text-center">
      <div className="rounded-3xl bg-amber-100 p-4 text-amber-700">
        <Lock className="h-7 w-7" />
      </div>

      <div className="space-y-2">
        <h2 className="font-display text-xl font-bold text-foreground sm:text-2xl">Este módulo no está en tu área</h2>
        <p className="text-sm text-muted-foreground">
          Tu cuenta pertenece al área <strong>{areaName}</strong>, así que solo puedes abrir los módulos que tiene habilitados.
          Si necesitas este módulo, pídele a un administrador que lo agregue en Roles y permisos.
        </p>
      </div>

      {landingItem && (
        <Link
          to={`/${landingItem.page}`}
          className="inline-flex items-center justify-center rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition hover:opacity-90"
        >
          Ir a {landingItem.name}
        </Link>
      )}

      {shortcuts.length > 0 && (
        <div className="w-full space-y-3">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Módulos de tu área</p>
          <div className="flex flex-wrap justify-center gap-2">
            {shortcuts.map((item) => (
              <Link
                key={item.page}
                to={`/${item.page}`}
                className="rounded-full border border-border bg-card px-4 py-2 text-sm font-medium text-foreground shadow-sm transition hover:bg-accent"
              >
                {item.name}
              </Link>
            ))}
          </div>
        </div>
      )}

      <p className="flex items-center gap-2 text-xs text-muted-foreground">
        <ShieldAlert className="h-3.5 w-3.5" /> Acceso restringido por rol de área
      </p>
    </div>
  );
}