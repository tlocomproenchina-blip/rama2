import { base44 as base44Client } from '@/api/base44Client';
import { toast } from 'sonner';

/**
 * API Queue Manager - Solución definitiva anti-rate-limit
 * 
 * Features:
 * - Cola global: solo 1 operación a la vez
 * - Backoff exponencial: 60s, 120s, 240s, 480s (máx 5 intentos)
 * - Circuit breaker: 3 errores 429 → bloqueo 20 minutos
 * - Debouncing automático
 * - Cache inteligente
 */

class ApiQueueManager {
  constructor() {
    this.queue = [];
    this.processing = false;
    this.circuitBreakerState = 'CLOSED'; // CLOSED, OPEN, HALF_OPEN
    this.failureCount = 0;
    this.circuitOpenUntil = null;
    this.cache = new Map();
    this.debouncedOperations = new Map();
    this.lastOperationTime = 0;
    this.lastWriteTime = 0;
    this.MAX_CONCURRENT_READS = 3;
    this.MAX_CONCURRENT_WRITES = 1;
    this.activeReads = 0;
    this.activeWrites = 0;
    this.inflight = new Map();
    this.MIN_OPERATION_INTERVAL = 250; // 250ms mínimo entre operaciones (mejor latencia)
  }

  /**
   * Verifica el estado del circuit breaker
   */
  checkCircuitBreaker() {
    if (this.circuitBreakerState === 'OPEN') {
      const now = Date.now();
      if (now >= this.circuitOpenUntil) {
        this.circuitBreakerState = 'HALF_OPEN';
        this.failureCount = 0;
        console.log('[Circuit Breaker] Transitioning to HALF_OPEN');
      } else {
        const remainingMinutes = Math.ceil((this.circuitOpenUntil - now) / 60000);
        throw new Error(`CIRCUIT_BREAKER_OPEN:${remainingMinutes}`);
      }
    }
  }

  /**
   * Registra un 429 y actualiza circuit breaker
   */
  registerRateLimitError() {
    this.failureCount++;
    console.error(`[Rate Limit] Error count: ${this.failureCount}/3`);

    if (this.failureCount >= 3) {
      this.circuitBreakerState = 'OPEN';
      this.circuitOpenUntil = Date.now() + (20 * 60 * 1000); // 20 minutos
      const openUntilTime = new Date(this.circuitOpenUntil).toLocaleTimeString('es-ES');
      
      toast.error(
        `🚨 Sistema en modo de protección hasta ${openUntilTime}. Demasiadas solicitudes simultáneas.`,
        { duration: 10000 }
      );
      
      console.error('[Circuit Breaker] OPEN until', openUntilTime);
    }
  }

  /**
   * Resetea el circuit breaker en operación exitosa
   */
  resetCircuitBreaker() {
    if (this.circuitBreakerState === 'HALF_OPEN') {
      this.circuitBreakerState = 'CLOSED';
      this.failureCount = 0;
      console.log('[Circuit Breaker] Closed - System stable');
    } else if (this.circuitBreakerState === 'CLOSED' && this.failureCount > 0) {
      this.failureCount = Math.max(0, this.failureCount - 1);
    }
  }

  /**
   * Backoff exponencial: 60s, 120s, 240s, 480s
   */
  async exponentialBackoff(attempt) {
    const delays = [5000, 10000, 20000, 40000]; // ms (backoff más rápido)
    const delay = delays[Math.min(attempt, delays.length - 1)];
    const seconds = delay / 1000;
    
    console.warn(`[Backoff] Waiting ${seconds}s before retry (attempt ${attempt + 1}/5)`);
    
    console.warn(`⏳ Esperando ${seconds}s antes de reintentar... (Intento ${attempt + 1}/5)`);

    await new Promise(resolve => setTimeout(resolve, delay));
  }

  /**
   * Ejecuta operación con retry y backoff exponencial
   */
  async executeWithRetry(operation, maxRetries = 5) {
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const result = await operation();
        this.resetCircuitBreaker();
        return result;
      } catch (error) {
        const isRateLimit = error?.message?.includes('429') || 
                           error?.message?.includes('Rate limit') ||
                           error?.response?.status === 429;

        if (isRateLimit && attempt < maxRetries - 1) {
          this.registerRateLimitError();
          await this.exponentialBackoff(attempt);
          continue;
        }

        // Si no es rate limit o agotamos reintentos
        throw error;
      }
    }
  }

  /**
   * Genera cache key para operación
   */
  getCacheKey(entityName, method, params) {
    return `${entityName}:${method}:${JSON.stringify(params || {})}`;
  }

  /**
   * Obtiene del cache si es válido
   */
  getFromCache(key, ttlMs = 30000) {
    const cached = this.cache.get(key);
    if (!cached) return null;

    const now = Date.now();
    if (now - cached.timestamp > ttlMs) {
      this.cache.delete(key);
      return null;
    }

    console.log('[Cache] HIT:', key);
    return cached.data;
  }

  /**
   * Guarda en cache
   */
  saveToCache(key, data) {
    this.cache.set(key, {
      data,
      timestamp: Date.now()
    });
  }

  /**
   * Añade operación a la cola
   */
  async enqueue(operation, priority = 'NORMAL', opType = 'read', dedupeKey) {
    // Dedupe: si hay una llamada idéntica en vuelo, reusar su promesa
    if (dedupeKey && this.inflight.has(dedupeKey)) {
      return this.inflight.get(dedupeKey);
    }

    const promise = new Promise((resolve, reject) => {
      const queueItem = {
        operation,
        resolve,
        reject,
        priority,
        opType,
        dedupeKey,
        timestamp: Date.now()
      };

      // Prioridades: HIGH primero, luego NORMAL
      if (priority === 'HIGH') {
        this.queue.unshift(queueItem);
      } else {
        this.queue.push(queueItem);
      }

      this.processQueue();
    });

    if (dedupeKey) {
      this.inflight.set(dedupeKey, promise);
    }

    return promise;
  }

  /**
   * Procesa la cola (solo 1 operación a la vez)
   */
  async processQueue() {
    if (this.processing) return;
    this.processing = true;

    const tryStart = () => {
      // Iniciar tantas tareas como permita la concurrencia
      while (true) {
        // Buscar el primer item que pueda ejecutarse según capacidad
        const idx = this.queue.findIndex(q =>
          (q.opType === 'read' && this.activeReads < this.MAX_CONCURRENT_READS) ||
          (q.opType === 'write' && this.activeWrites < this.MAX_CONCURRENT_WRITES)
        );
        if (idx === -1) break;

        const item = this.queue.splice(idx, 1)[0];
        if (item.opType === 'read') this.activeReads++; else this.activeWrites++;

        (async () => {
          try {
            // Circuit breaker check
            this.checkCircuitBreaker();

            // Rate limiting solo para escrituras
            if (item.opType === 'write') {
              const now = Date.now();
              const since = now - this.lastWriteTime;
              if (since < this.MIN_OPERATION_INTERVAL) {
                await new Promise(r => setTimeout(r, this.MIN_OPERATION_INTERVAL - since));
              }
            }

            const result = await this.executeWithRetry(item.operation);
            if (item.dedupeKey) this.inflight.delete(item.dedupeKey);
            item.resolve(result);
          } catch (error) {
            if (item.dedupeKey) this.inflight.delete(item.dedupeKey);
            if (error.message?.startsWith('CIRCUIT_BREAKER_OPEN')) {
              const minutes = error.message.split(':')[1];
              item.reject(new Error(`Sistema en protección. Reintenta en ${minutes} minutos.`));
            } else {
              item.reject(error);
            }
          } finally {
            if (item.opType === 'read') {
              this.activeReads--;
            } else {
              this.activeWrites--;
              this.lastWriteTime = Date.now();
            }
            // Intentar iniciar más tareas pendientes
            tryStart();
          }
        })();
      }

      // Si no quedan tareas activas ni en cola, finalizar procesamiento
      if (this.queue.length === 0 && this.activeReads === 0 && this.activeWrites === 0) {
        this.processing = false;
      }
    };

    tryStart();
  }

  /**
   * Debounced operation - agrupa cambios rápidos
   */
  debounced(key, operation, delayMs = 5000) {
    // Cancela operación anterior pendiente
    if (this.debouncedOperations.has(key)) {
      clearTimeout(this.debouncedOperations.get(key).timeout);
    }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(async () => {
        this.debouncedOperations.delete(key);
        try {
          const result = await this.enqueue(operation);
          resolve(result);
        } catch (error) {
          reject(error);
        }
      }, delayMs);

      this.debouncedOperations.set(key, { timeout, resolve, reject });
    });
  }

  /**
   * API Wrapper - Entities
   */
  createEntityWrapper(entityName) {
    return {
      list: async (sortBy, limit) => {
        const cacheKey = this.getCacheKey(entityName, 'list', { sortBy, limit });
        const cached = this.getFromCache(cacheKey);
        if (cached) return cached;

        const result = await this.enqueue(async () => {
          return await base44Client.entities[entityName].list(sortBy, limit);
        }, 'NORMAL', 'read', cacheKey);

        this.saveToCache(cacheKey, result);
        return result;
      },

      filter: async (query, sortBy, limit) => {
        const cacheKey = this.getCacheKey(entityName, 'filter', { query, sortBy, limit });
        const cached = this.getFromCache(cacheKey);
        if (cached) return cached;

        const result = await this.enqueue(async () => {
          return await base44Client.entities[entityName].filter(query, sortBy, limit);
        }, 'NORMAL', 'read', cacheKey);

        this.saveToCache(cacheKey, result);
        return result;
      },

      get: async (id) => {
        const cacheKey = this.getCacheKey(entityName, 'get', { id });
        const cached = this.getFromCache(cacheKey);
        if (cached) return cached;

        const result = await this.enqueue(async () => {
          return await base44Client.entities[entityName].get(id);
        }, 'NORMAL', 'read', cacheKey);

        this.saveToCache(cacheKey, result);
        return result;
      },

      create: async (data) => {
        // Invalida cache de list/filter
        Array.from(this.cache.keys())
          .filter(key => key.startsWith(`${entityName}:list`) || key.startsWith(`${entityName}:filter`))
          .forEach(key => this.cache.delete(key));

        return await this.enqueue(async () => {
          return await base44Client.entities[entityName].create(data);
        }, 'HIGH', 'write');
      },

      update: async (id, data) => {
        // Invalida cache
        Array.from(this.cache.keys())
          .filter(key => key.includes(entityName))
          .forEach(key => this.cache.delete(key));

        return await this.enqueue(async () => {
          return await base44Client.entities[entityName].update(id, data);
        }, 'HIGH', 'write');
      },

      delete: async (id) => {
        // Invalida cache
        Array.from(this.cache.keys())
          .filter(key => key.includes(entityName))
          .forEach(key => this.cache.delete(key));

        return await this.enqueue(async () => {
          return await base44Client.entities[entityName].delete(id);
        }, 'HIGH', 'write');
      },

      bulkCreate: async (dataArray) => {
        // Invalida cache
        Array.from(this.cache.keys())
          .filter(key => key.startsWith(`${entityName}:list`) || key.startsWith(`${entityName}:filter`))
          .forEach(key => this.cache.delete(key));

        return await this.enqueue(async () => {
          return await base44Client.entities[entityName].bulkCreate(dataArray);
        }, 'HIGH', 'write');
      },

      schema: async () => {
        const cacheKey = this.getCacheKey(entityName, 'schema', {});
        const cached = this.getFromCache(cacheKey, 3600000); // 1 hora
        if (cached) return cached;

        const result = await this.enqueue(async () => {
          return await base44Client.entities[entityName].schema();
        }, 'NORMAL', 'read', cacheKey);

        this.saveToCache(cacheKey, result);
        return result;
      }
    };
  }

  /**
   * Auth wrapper
   */
  get auth() {
    return {
      me: async () => {
        const cacheKey = 'auth:me';
        const cached = this.getFromCache(cacheKey, 60000); // 1 minuto
        if (cached) return cached;

        const result = await this.enqueue(async () => {
          return await base44Client.auth.me();
        }, 'HIGH', 'read', cacheKey);

        this.saveToCache(cacheKey, result);
        return result;
      },

      updateMe: async (data) => {
        this.cache.delete('auth:me');
        
        return await this.enqueue(async () => {
          return await base44Client.auth.updateMe(data);
        }, 'HIGH', 'write');
      },

      isAuthenticated: async () => {
        return await this.enqueue(async () => {
          return await base44Client.auth.isAuthenticated();
        }, 'HIGH', 'read', 'auth:isAuthenticated');
      },

      logout: (redirectUrl) => {
        this.cache.clear();
        return base44Client.auth.logout(redirectUrl);
      },

      redirectToLogin: (nextUrl) => {
        return base44Client.auth.redirectToLogin(nextUrl);
      }
    };
  }

  /**
   * Functions wrapper
   */
  get functions() {
    return {
      invoke: async (functionName, params) => {
        return await this.enqueue(async () => {
          return await base44Client.functions.invoke(functionName, params);
        }, 'NORMAL', 'write');
      }
    };
  }

  /**
   * Integrations wrapper
   */
  get integrations() {
    return base44Client.integrations;
  }

  /**
   * Analytics wrapper
   */
  get analytics() {
    return base44Client.analytics;
  }

  /**
   * Users wrapper
   */
  get users() {
    return {
      inviteUser: async (email, role) => {
        return await this.enqueue(async () => {
          return await base44Client.users.inviteUser(email, role);
        }, 'HIGH', 'write');
      }
    };
  }

  /**
   * Entities proxy - crea wrappers automáticamente
   */
  get entities() {
    const self = this;
    return new Proxy({}, {
      get(target, entityName) {
        if (!target[entityName]) {
          target[entityName] = self.createEntityWrapper(entityName);
        }
        return target[entityName];
      }
    });
  }

  /**
   * Estado del sistema
   */
  getSystemStatus() {
    return {
      circuitBreakerState: this.circuitBreakerState,
      queueLength: this.queue.length,
      activeReads: this.activeReads,
      activeWrites: this.activeWrites,
      maxReads: this.MAX_CONCURRENT_READS,
      maxWrites: this.MAX_CONCURRENT_WRITES,
      failureCount: this.failureCount,
      cacheSize: this.cache.size,
      inflightSize: this.inflight.size,
      circuitOpenUntil: this.circuitOpenUntil ? new Date(this.circuitOpenUntil).toLocaleTimeString('es-ES') : null
    };
  }
}

// Singleton global
const apiQueue = new ApiQueueManager();

// Export como base44 compatible
export const base44 = apiQueue;

// Export sistema de estado
export const getApiStatus = () => apiQueue.getSystemStatus();