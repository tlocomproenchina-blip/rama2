import { useEffect } from 'react';

/**
 * Gestor de caché para reducir re-fetches excesivos
 * - SessionStorage para datos de sesión
 * - TTL configurable
 */
class CacheManager {
  constructor(prefix = 'tlec_cache_') {
    this.prefix = prefix;
    this.defaultTTL = 3600000; // 1 hora en ms
  }

  set(key, value, ttl = this.defaultTTL) {
    try {
      const data = {
        value,
        timestamp: Date.now(),
        ttl
      };
      sessionStorage.setItem(
        `${this.prefix}${key}`,
        JSON.stringify(data)
      );
    } catch (e) {
      console.warn('SessionStorage full:', e);
    }
  }

  get(key) {
    try {
      const item = sessionStorage.getItem(`${this.prefix}${key}`);
      if (!item) return null;

      const data = JSON.parse(item);
      const isExpired = Date.now() - data.timestamp > data.ttl;

      if (isExpired) {
        this.remove(key);
        return null;
      }

      return data.value;
    } catch (e) {
      return null;
    }
  }

  remove(key) {
    try {
      sessionStorage.removeItem(`${this.prefix}${key}`);
    } catch (e) {
      console.warn('Error removing cache:', e);
    }
  }

  clear() {
    try {
      const keys = Object.keys(sessionStorage);
      keys.forEach(key => {
        if (key.startsWith(this.prefix)) {
          sessionStorage.removeItem(key);
        }
      });
    } catch (e) {
      console.warn('Error clearing cache:', e);
    }
  }

  // Limpieza automática de caché expirado
  cleanup() {
    try {
      const keys = Object.keys(sessionStorage);
      keys.forEach(key => {
        if (key.startsWith(this.prefix)) {
          const item = sessionStorage.getItem(key);
          if (item) {
            const data = JSON.parse(item);
            const isExpired = Date.now() - data.timestamp > data.ttl;
            if (isExpired) {
              sessionStorage.removeItem(key);
            }
          }
        }
      });
    } catch (e) {
      console.warn('Error during cache cleanup:', e);
    }
  }
}

// Instancia global
export const cacheManager = new CacheManager();

// Hook para usar el cache manager
export function useCacheManager() {
  useEffect(() => {
    // Limpiar caché expirado cada 5 minutos
    const interval = setInterval(() => {
      cacheManager.cleanup();
    }, 300000);

    return () => clearInterval(interval);
  }, []);

  return cacheManager;
}