import { useCallback, useEffect, useRef, useState } from 'react';
import { cacheManager } from '@/components/CacheManager';

function serialize(value) {
  try {
    return JSON.stringify(value);
  } catch {
    return '';
  }
}

export default function useAdminSWR({
  cacheKey,
  fetcher,
  deps = [],
  initialData = null,
  ttl = 120000,
  subscribeEntities = [],
}) {
  const [data, setData] = useState(() => cacheManager.get(cacheKey) ?? initialData);
  const [loading, setLoading] = useState(() => cacheManager.get(cacheKey) == null);
  const [refreshing, setRefreshing] = useState(false);
  const signatureRef = useRef(serialize(cacheManager.get(cacheKey) ?? initialData));

  const revalidate = useCallback(async (silent = false) => {
    if (!silent) setRefreshing(true);
    try {
      const nextData = await fetcher();
      const nextSignature = serialize(nextData);

      if (nextSignature !== signatureRef.current) {
        signatureRef.current = nextSignature;
        setData(nextData);
      }

      cacheManager.set(cacheKey, nextData, ttl);
    } finally {
      setLoading(false);
      if (!silent) setRefreshing(false);
    }
  }, [cacheKey, ttl, ...deps]);

  useEffect(() => {
    const cached = cacheManager.get(cacheKey);
    if (cached != null) {
      const cachedSignature = serialize(cached);
      signatureRef.current = cachedSignature;
      setData(cached);
      setLoading(false);
      revalidate(true);
      return;
    }

    revalidate(false);
  }, [cacheKey, revalidate]);

  useEffect(() => {
    if (!subscribeEntities.length) return;

    const handler = (event) => {
      const entity = event?.detail?.entity;
      if (entity && subscribeEntities.includes(entity)) {
        revalidate(true);
      }
    };

    window.addEventListener('entity:event', handler);
    return () => window.removeEventListener('entity:event', handler);
  }, [revalidate, subscribeEntities]);

  return {
    data,
    loading,
    refreshing,
    refresh: revalidate,
  };
}