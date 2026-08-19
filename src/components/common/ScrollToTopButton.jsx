import React, { useEffect, useState } from 'react';
import { ArrowUp } from 'lucide-react';

/**
 * Botón "subir" permanente en desktop; en móvil aparece solo al scrollear.
 */
export default function ScrollToTopButton() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const check = () => {
      const isDesktop = window.matchMedia('(min-width: 1024px)').matches;
      if (isDesktop) {
        setVisible(true);
        return;
      }
      const y = window.scrollY || document.documentElement.scrollTop;
      const mainEl = document.querySelector('main');
      const mainY = mainEl ? mainEl.scrollTop : 0;
      setVisible(y > 300 || mainY > 300);
    };

    document.addEventListener('scroll', check, { capture: true, passive: true });
    window.addEventListener('scroll', check, { passive: true });
    window.addEventListener('resize', check, { passive: true });
    check();
    const interval = setInterval(check, 1000);

    return () => {
      document.removeEventListener('scroll', check, { capture: true });
      window.removeEventListener('scroll', check);
      window.removeEventListener('resize', check);
      clearInterval(interval);
    };
  }, []);

  const handleClick = () => {
    const mainEl = document.querySelector('main');
    if (mainEl && mainEl.scrollTop > 0) {
      mainEl.scrollTo({ top: 0, behavior: 'smooth' });
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (!visible) return null;

  return (
    <button
      onClick={handleClick}
      aria-label="Subir arriba"
      className="fixed z-50 bottom-5 right-4 lg:left-5 lg:right-auto lg:bottom-6 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-card transition-all hover:bg-slate-50 hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98] touch-manipulation select-none"
    >
      <ArrowUp className="h-4 w-4 text-slate-700" />
      <span className="hidden sm:inline">Subir</span>
    </button>
  );
}