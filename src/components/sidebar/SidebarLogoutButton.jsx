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
      className="flex h-10 w-full items-center gap-3 rounded-lg px-3 text-left text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
    >
      <LogOut className="h-4 w-4 shrink-0" />
      <span className="flex-1 truncate">Cerrar Sesión</span>
    </button>
  );
}