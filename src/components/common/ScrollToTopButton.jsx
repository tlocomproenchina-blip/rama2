import React, { useEffect, useState } from 'react';
import { ArrowUp } from 'lucide-react';

/**
 * Botón "subir" con estilo pill (mismo lenguaje visual que la barra de búsqueda).
 * - Móvil: fijo abajo a la derecha.
 * - Desktop / tablet: fijo abajo a la izquierda.
 * Aparece solo cuando el usuario ha scrolleado hacia abajo.
 */
export default function ScrollToTopButton() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY || document.documentElement.scrollTop;
      // También considera scroll dentro del contenedor principal del Layout
      const main = document.getElementById('main-content');
      const mainY = main ? main.scrollTop : 0;
      setVisible(y > 400 || mainY > 400);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    const main = document.getElementById('main-content');
    if (main) main.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => {
      window.removeEventListener('scroll', onScroll);
      if (main) main.removeEventListener('scroll', onScroll);
    };
  }, []);

  const handleClick = () => {
    const main = document.getElementById('main-content');
    if (main && main.scrollTop > 0) {
      main.scrollTo({ top: 0, behavior: 'smooth' });
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (!visible) return null;

  return (
    <button
      onClick={handleClick}
      aria-label="Subir arriba"
      className="fixed z-40 bottom-5 right-4 lg:left-5 lg:right-auto lg:bottom-6 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-card transition-all hover:bg-slate-50 hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98] touch-manipulation select-none"
    >
      <ArrowUp className="h-4 w-4 text-slate-700" />
      <span className="hidden sm:inline">Subir</span>
    </button>
  );
}