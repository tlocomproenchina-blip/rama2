import React from 'react';
import { LogOut } from 'lucide-react';

/**
 * Fila de "Cerrar Sesión" dentro de la lista del menú lateral,
 * con el mismo estilo que los ítems de navegación.
 */
export default function SidebarLogoutButton({ onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group relative mt-2 flex w-full min-h-[58px] items-center gap-3 rounded-2xl border border-transparent bg-white/60 px-4 py-3 text-left text-slate-600 transition-all duration-200 touch-manipulation hover:-translate-y-0.5 hover:border-border/70 hover:bg-white hover:text-foreground hover:shadow-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:ring-offset-2"
    >
      <div className="relative flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-500 transition-all duration-200 group-hover:bg-accent group-hover:text-foreground">
        <LogOut className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <span className="block truncate text-[14px] font-semibold tracking-[-0.01em]">Cerrar Sesión</span>
      </div>
    </button>
  );
}