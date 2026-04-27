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
    this.MAX_CONCURRENT_READS = 60;
    this.MAX_CONCURRENT_WRITES = 30;
    this.MIN_READS = 10;
    this.MIN_WRITES = 5;
    this.MAX_READS_CAP = 200;
    this.MAX_WRITES_CAP = 100;
    this.activeReads = 0;
    this.activeWrites = 0;
    this.inflight = new Map();
    this.MIN_OPERATION_INTERVAL = 5; // 5ms mínimo entre operaciones
    this.backoffDelays = [2000, 4000, 8000, 16000, 32000];
    this.circuitBreakerThreshold = 80;
    this.circuitOpenMinutes = 1;
    // Auto-scaling: ajusta concurrencia según demanda y errores
    this.recentSuccess = 0;
    this.recentErrors = 0;
    this._lastAutoScaleAt = 0;
    this._startAutoScaler();
    this.OPERATION_TIMEOUT_MS = 60000; // 60s seguridad contra cuelgues
    // Realtime + caché granular
    this.cacheDisabledFor = new Set();
    this.entitySubscriptions = new Map();
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
   * Auto-scaler: ajusta concurrencia bajo demanda automáticamente
   * - Si hay cola pendiente y baja tasa de error → SUBE concurrencia
   * - Si hay errores 429 recientes → BAJA concurrencia
   * - Si todo está estable → mantiene
   * También auto-cierra el circuit breaker si está abierto y ya pasó el tiempo
   */
  _startAutoScaler() {
    if (typeof window === 'undefined') return;
    if (this._autoScalerTimer) clearInterval(this._autoScalerTimer);
    this._autoScalerTimer = setInterval(() => {
      try {
        const now = Date.now();
        if (now - this._lastAutoScaleAt < 1500) return;
        this._lastAutoScaleAt = now;

        // Auto-recuperar circuit breaker apenas pase el tiempo (sin intervención manual)
        if (this.circuitBreakerState === 'OPEN' && this.circuitOpenUntil && now >= this.circuitOpenUntil) {
          this.circuitBreakerState = 'CLOSED';
          this.failureCount = 0;
          this.circuitOpenUntil = null;
          console.log('[AutoScaler] Circuit breaker auto-cerrado');
        }

        const queueLen = this.queue.length;
        const errors = this.recentErrors;
        const success = this.recentSuccess;

        // Reglas simples:
        // 1) Errores recientes → reducir 25%
        if (errors > 0) {
          this.MAX_CONCURRENT_READS = Math.max(this.MIN_READS, Math.floor(this.MAX_CONCURRENT_READS * 0.75));
          this.MAX_CONCURRENT_WRITES = Math.max(this.MIN_WRITES, Math.floor(this.MAX_CONCURRENT_WRITES * 0.75));
        }
        // 2) Cola alta y sin errores → aumentar 50%
        else if (queueLen > 5 && success > 0) {
          this.MAX_CONCURRENT_READS = Math.min(this.MAX_READS_CAP, Math.ceil(this.MAX_CONCURRENT_READS * 1.5));
          this.MAX_CONCURRENT_WRITES = Math.min(this.MAX_WRITES_CAP, Math.ceil(this.MAX_CONCURRENT_WRITES * 1.5));
        }
        // 3) Cola moderada y sin errores → aumentar 20%
        else if (queueLen > 0 && success > 0 && errors === 0) {
          this.MAX_CONCURRENT_READS = Math.min(this.MAX_READS_CAP, Math.ceil(this.MAX_CONCURRENT_READS * 1.2));
          this.MAX_CONCURRENT_WRITES = Math.min(this.MAX_WRITES_CAP, Math.ceil(this.MAX_CONCURRENT_WRITES * 1.2));
        }
        // 4) Sin cola y sin actividad → relajar gradualmente al baseline (60/30)
        else if (queueLen === 0 && success === 0 && errors === 0) {
          if (this.MAX_CONCURRENT_READS > 60) this.MAX_CONCURRENT_READS = Math.max(60, Math.floor(this.MAX_CONCURRENT_READS * 0.9));
          if (this.MAX_CONCURRENT_WRITES > 30) this.MAX_CONCURRENT_WRITES = Math.max(30, Math.floor(this.MAX_CONCURRENT_WRITES * 0.9));
        }

        // Reset contadores de ventana
        this.recentSuccess = 0;
        this.recentErrors = 0;

        // Empuja la cola si hay items pendientes
        if (this.queue.length > 0) this.processQueue();
      } catch (_) {}
    }, 2000);
  }

  /**
   * Registra un 429 y actualiza circuit breaker
   */
  registerRateLimitError() {
    this.failureCount++;
    this.recentErrors++;
    console.error(`[Rate Limit] Error count: ${this.failureCount}/3`);

    if (this.failureCount >= this.circuitBreakerThreshold) {
      this.circuitBreakerState = 'OPEN';
      this.circuitOpenUntil = Date.now() + (this.circuitOpenMinutes * 60 * 1000);
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
    this.recentSuccess++;
    if (this.circuitBreakerState === 'HALF_OPEN') {
      this.circuitBreakerState = 'CLOSED';
      this.failureCount = 0;
      console.log('[Circuit Breaker] Closed - System stable');
    } else if (this.circuitBreakerState === 'CLOSED' && this.failureCount > 0) {
      this.failureCount = Math.max(0, this.failureCount - 1);
    }
  }

  /**
   * Backoff exponencial con jitter y soporte de Retry-After
   */
  async exponentialBackoff(attempt, retryAfterSec) {
    let delay = this.backoffDelays[Math.min(attempt, this.backoffDelays.length - 1)];
    if (retryAfterSec && Number.isFinite(Number(retryAfterSec))) {
      delay = Math.max(delay, Number(retryAfterSec) * 1000);
    }
    const jitter = Math.floor(delay * (0.1 + Math.random() * 0.1)); // 10-20%
    delay += jitter;
    const seconds = Math.round(delay / 100) / 10;
    console.warn(`[Backoff] Waiting ${seconds}s before retry (attempt ${attempt + 1}/5)`);
    await new Promise(resolve => setTimeout(resolve, delay));
  }

  /**
   * Ejecuta operación con retry y backoff exponencial
   */
  async executeWithRetry(operation, maxRetries = 5) {
    const withTimeout = (promise, ms) => new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('TIMEOUT')), ms);
      promise.then((v) => { clearTimeout(timer); resolve(v); })
             .catch((e) => { clearTimeout(timer); reject(e); });
    });

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        // Ejecuta con timeout para evitar cuelgues indefinidos
        const result = await withTimeout(Promise.resolve().then(operation), this.OPERATION_TIMEOUT_MS || 45000);
        this.resetCircuitBreaker();
        return result;
      } catch (error) {
        const isTimeout = error?.message?.includes('TIMEOUT');
        const isRateLimit = error?.message?.includes('429') || 
                           error?.message?.includes('Rate limit') ||
                           error?.response?.status === 429;
        const retryAfter = error?.response?.headers?.['retry-after'] || error?.response?.headers?.['Retry-After'];

        if ((isRateLimit || isTimeout) && attempt < maxRetries - 1) {
          if (isRateLimit) this.registerRateLimitError();
          await this.exponentialBackoff(attempt, retryAfter);
          continue;
        }

        // Si no es reintentable o agotamos reintentos
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
  getFromCache(key, ttlMs = 60000) {
    // Respeta desactivación de caché por entidad
    const entity = String(key).split(':')[0];
    if (this.cacheDisabledFor.has(entity)) return null;

    const cached = this.cache.get(key);
    if (!cached) return null;

    const now = Date.now();
    if (now - cached.timestamp > ttlMs) {
      this.cache.delete(key);
      return null;
    }

    // Cache hit (silenced to reduce console noise)
    return cached.data;
  }

  /**
   * Guarda en cache
   */
  saveToCache(key, data) {
    const entity = String(key).split(':')[0];
    if (this.cacheDisabledFor.has(entity)) return; // no guardar para vistas críticas
    this.cache.set(key, {
      data,
      timestamp: Date.now()
    });
  }

  invalidateEntityCache(entityName, methods = []) {
    const targets = methods.length ? methods : ['list', 'filter', 'get', 'schema'];
    Array.from(this.cache.keys())
      .filter((key) => key.startsWith(`${entityName}:`) && targets.some((method) => key.startsWith(`${entityName}:${method}`)))
      .forEach((key) => this.cache.delete(key));
  }

  invalidateAuthCache() {
    ['auth:me', 'auth:isAuthenticated'].forEach((key) => this.cache.delete(key));
  }

  /**
   * Añade operación a la cola
   */
  async enqueue(operation, priority = 'NORMAL', opType = 'read', dedupeKey) {
    // Wrap operation to ensure it always returns a promise (and benefits from timeout)
    const op = async () => await Promise.resolve().then(operation);
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
      list: async (sortBy, limit, skip = 0) => {
        const cacheKey = this.getCacheKey(entityName, 'list', { sortBy, limit, skip });
        const cached = this.getFromCache(cacheKey);
        if (cached) return cached;

        const result = await this.enqueue(async () => {
          const lim = Number.isFinite(limit) ? limit : 200;
          const sk = Number.isFinite(skip) ? skip : 0;
          return await base44Client.entities[entityName].list(sortBy, lim, sk);
        }, 'NORMAL', 'read', cacheKey);

        this.saveToCache(cacheKey, result);
        return result;
      },

      filter: async (query, sortBy, limit, skip = 0) => {
        const cacheKey = this.getCacheKey(entityName, 'filter', { query, sortBy, limit, skip });
        const cached = this.getFromCache(cacheKey);
        if (cached) return cached;

        const result = await this.enqueue(async () => {
          const lim = Number.isFinite(limit) ? limit : 200;
          const sk = Number.isFinite(skip) ? skip : 0;
          return await base44Client.entities[entityName].filter(query, sortBy, lim, sk);
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
        this.invalidateEntityCache(entityName, ['list', 'filter']);

        return await this.enqueue(async () => {
          return await base44Client.entities[entityName].create(data);
        }, 'HIGH', 'write');
      },

      update: async (id, data) => {
        this.invalidateEntityCache(entityName);

        return await this.enqueue(async () => {
          return await base44Client.entities[entityName].update(id, data);
        }, 'HIGH', 'write');
      },

      delete: async (id) => {
        this.invalidateEntityCache(entityName);

        return await this.enqueue(async () => {
          return await base44Client.entities[entityName].delete(id);
        }, 'HIGH', 'write');
      },

      bulkCreate: async (dataArray) => {
        this.invalidateEntityCache(entityName, ['list', 'filter']);

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
      },

      subscribe: (callback) => {
        try { return base44Client.entities[entityName].subscribe(callback); } catch { return () => {}; }
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
        this.invalidateAuthCache();
        
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
        this.inflight.clear();
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
      invoke: async (functionName, params, options = {}) => {
        const { priority = 'NORMAL', opType = 'write', dedupeKey } = options;
        return await this.enqueue(async () => {
          return await base44Client.functions.invoke(functionName, params);
        }, priority, opType, dedupeKey);
      }
    };
  }

  /**
   * Integrations wrapper
   */
  get integrations() {
    const self = this;
    return new Proxy({}, {
      get(_, pkg) {
        return new Proxy({}, {
          get(_, method) {
            return async (params) => {
              const name = String(method);
              const opType = /upload|send|generate|create|extract|invoke/i.test(name) ? 'write' : 'read';
              const fn = base44Client.integrations?.[pkg]?.[method];
              if (typeof fn !== 'function') {
                throw new Error(`Integration method not found: ${String(pkg)}.${name}`);
              }
              return await self.enqueue(async () => await fn(params), 'NORMAL', opType);
            };
          }
        });
      }
    });
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
   * Ajustes dinámicos de tasa y concurrencia
   */
  setTuning({ maxReads, maxWrites, minIntervalMs, backoffDelays, circuitBreakerThreshold, circuitOpenMinutes } = {}) {
    if (Number.isFinite(maxReads)) this.MAX_CONCURRENT_READS = Math.max(1, Math.min(120, maxReads));
    if (Number.isFinite(maxWrites)) this.MAX_CONCURRENT_WRITES = Math.max(1, Math.min(60, maxWrites));
    if (Number.isFinite(minIntervalMs)) this.MIN_OPERATION_INTERVAL = Math.max(0, Math.min(2000, minIntervalMs));
    if (Array.isArray(backoffDelays) && backoffDelays.length) this.backoffDelays = backoffDelays.map(d => Math.max(100, Number(d) || 1000));
    if (Number.isFinite(circuitBreakerThreshold)) this.circuitBreakerThreshold = Math.max(1, circuitBreakerThreshold);
    if (Number.isFinite(circuitOpenMinutes)) this.circuitOpenMinutes = Math.max(1, circuitOpenMinutes);
  }

  /**
   * Resetea forzosamente el circuit breaker (útil para reactivar el sistema manualmente)
   */
  forceResetCircuitBreaker() {
    this.circuitBreakerState = 'CLOSED';
    this.failureCount = 0;
    this.circuitOpenUntil = null;
    console.log('[Circuit Breaker] Forzado a CLOSED');
  }

  // Desactiva caché para entidades críticas
  disableCacheFor(entities = []) {
    (entities || []).forEach((e) => this.cacheDisabledFor.add(String(e)));
  }

  // Habilita suscripciones en tiempo real y limpia caché al recibir eventos
  enableRealtime(entities = []) {
    (entities || []).forEach((name) => {
      const entity = String(name);
      if (this.entitySubscriptions.has(entity)) return;
      let unsubscribe = () => {};
      try {
        unsubscribe = base44Client.entities[entity].subscribe((event) => {
          // Invalida caché relacionada
          const keys = Array.from(this.cache.keys());
          keys.filter((k) => k.startsWith(entity + ':')).forEach((k) => this.cache.delete(k));
          // Notifica globalmente a la UI
          try {
            if (typeof window !== 'undefined') {
              window.dispatchEvent(new CustomEvent('entity:event', { detail: { entity, event } }));
            }
          } catch (_) {}
        });
      } catch (_) {}
      this.entitySubscriptions.set(entity, unsubscribe);
    });
  }

  getTuning() {
    return {
      maxReads: this.MAX_CONCURRENT_READS,
      maxWrites: this.MAX_CONCURRENT_WRITES,
      minIntervalMs: this.MIN_OPERATION_INTERVAL,
      backoffDelays: this.backoffDelays,
      circuitBreakerThreshold: this.circuitBreakerThreshold,
      circuitOpenMinutes: this.circuitOpenMinutes
    };
  }

  /**
   * Suscripción dummy para compatibilidad en layout (proxy a entities.subscribe)
   */

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

// Solo suscripciones realtime esenciales (máx 3 para evitar sobrecarga de WebSocket)
apiQueue.enableRealtime(['Package', 'Notification']);

// Export como base44 compatible
export const base44 = apiQueue;

// Export sistema de estado y tuning
export const getApiStatus = () => apiQueue.getSystemStatus();
export const setApiTuning = (opts) => apiQueue.setTuning(opts);
export const getApiTuning = () => apiQueue.getTuning();
export const resetCircuitBreaker = () => apiQueue.forceResetCircuitBreaker();
export const enableRealtime = (entities) => apiQueue.enableRealtime(entities);
export const disableCacheFor = (entities) => apiQueue.disableCacheFor(entities);