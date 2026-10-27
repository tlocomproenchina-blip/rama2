import { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';

// Las fotos de incidencias se guardan en almacenamiento privado: para mostrarlas
// se pide un enlace firmado temporal a partir del file_uri guardado.
export default function useSignedUri(uri) {
  const [url, setUrl] = useState('');

  useEffect(() => {
    let alive = true;
    setUrl('');
    if (!uri) return () => { alive = false; };

    base44.integrations.Core.CreateFileSignedUrl({ file_uri: uri, expires_in: 3600 })
      .then((res) => {
        if (alive) setUrl(res?.signed_url || res?.data?.signed_url || '');
      })
      .catch(() => {});

    return () => { alive = false; };
  }, [uri]);

  return url;
}