import { useEffect } from 'react';
import { base44 } from '@/api/base44Client';

// Aplica el favicon configurado en Ajustes a TODAS las páginas,
// incluidos los enlaces públicos que no cargan el diseño principal.
export default function FaviconSync() {
  useEffect(() => {
    base44.entities.AppConfig.filter({ config_key: 'main' }, '-updated_date', 1)
      .then((rows) => {
        const url = rows?.[0]?.favicon_url || rows?.[0]?.app_logo_url;
        if (!url) return;
        document.querySelectorAll("link[rel='icon'], link[rel='apple-touch-icon']").forEach((link) => {
          link.href = url;
          if (link.rel === 'icon') link.removeAttribute('type');
        });
      })
      .catch(() => {});
  }, []);
  return null;
}