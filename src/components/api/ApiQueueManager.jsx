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
    this.MAX_CONCURRENT_READS = 100;
    this.MAX_CONCURRENT_WRITES = 50;
    this.MIN_READS = 25;
    this.MIN_WRITES = 12;
    this.MAX_READS_CAP = 300;
    this.MAX_WRITES_CAP = 150;
    this.activeReads = 0;
    this.activeWrites = 0;
    this.inflight = new Map();
    this.MIN_OPERATION_INTERVAL = 5; // 5ms mínimo entre operaciones
    this.backoffDelays = [1000, 2000, 4000, 8000, 16000];
    // El circuit breaker solo se abre tras MUCHOS 429 reales seguidos en una ventana corta
    this.circuitBreakerThreshold = 60;
    this.circuitOpenMinutes = 1;
    // Ventana deslizante: los 429 antiguos "expiran" para no acumular falsos positivos
    this.rateLimitWindowMs = 12000;
    this.rateLimitTimestamps = [];
    this._lastFailureDecayAt = Date.now();
    // Auto-scaling: ajusta concurrencia según demanda y errores
    this.recentSuccess = 0;
    this.recentErrors = 0;
    this._lastAutoScaleAt = 0;
    this._startAutoScaler();
    this.OPERATION_TIMEOUT_MS = 20000; // 20s: falla rápido en vez de colgarse
    // Cuánto tiempo se conserva una copia "stale" para servir si la red falla
    this.STALE_MAX_AGE_MS = 15 * 60 * 1000;
    // Realtime + caché granular
    this.cacheDisabledFor = new Set();
    this.entitySubscriptions = new Map();
    // Recuperación automática al volver la conexión o la pestaña
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        this.forceResetCircuitBreaker();
        if (!this._autoScalerActive) this._startAutoScaler();
        this.processQueue();
      });
      document.addEventListener('visibilitychange', () => {
        if (!document.hidden) {
          if (!this._autoScalerActive) this._startAutoScaler();
          if (this.queue.length > 0) this.processQueue();
        }
      });
    }
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
    this._idleTicks = 0;
    this._autoScalerActive = true;
    this._autoScalerTimer = setInterval(() => {
      // Auto-pause si está completamente inactivo: sin cola, sin actividad y sin errores
      const idle = this.queue.length === 0 && this.activeReads === 0 && this.activeWrites === 0 && this.recentErrors === 0 && this.recentSuccess === 0 && this.circuitBreakerState === 'CLOSED';
      if (idle) {
        this._idleTicks = (this._idleTicks || 0) + 1;
        // Después de ~30s sin actividad, pausar el auto-scaler
        if (this._idleTicks >= 15) {
          clearInterval(this._autoScalerTimer);
          this._autoScalerTimer = null;
          this._autoScalerActive = false;
          return;
        }
      } else {
        this._idleTicks = 0;
      }
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

        // Limpiar 429 viejos de la ventana deslizante para que failureCount no se quede "pegado"
        this.rateLimitTimestamps = this.rateLimitTimestamps.filter(t => now - t < this.rateLimitWindowMs);
        this.failureCount = this.rateLimitTimestamps.length;

        const queueLen = this.queue.length;
        const errors = this.recentErrors;
        const success = this.recentSuccess;

        // Reglas simples:
        // 1) Errores recientes → reducir suavemente (15%) para no colapsar la concurrencia
        if (errors > 0) {
          this.MAX_CONCURRENT_READS = Math.max(this.MIN_READS, Math.floor(this.MAX_CONCURRENT_READS * 0.85));
          this.MAX_CONCURRENT_WRITES = Math.max(this.MIN_WRITES, Math.floor(this.MAX_CONCURRENT_WRITES * 0.85));
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
        // 4) Sin cola y sin actividad → relajar gradualmente al baseline (100/50)
        else if (queueLen === 0 && success === 0 && errors === 0) {
          if (this.MAX_CONCURRENT_READS > 100) this.MAX_CONCURRENT_READS = Math.max(100, Math.floor(this.MAX_CONCURRENT_READS * 0.9));
          if (this.MAX_CONCURRENT_WRITES > 50) this.MAX_CONCURRENT_WRITES = Math.max(50, Math.floor(this.MAX_CONCURRENT_WRITES * 0.9));
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
    const now = Date.now();
    this.recentErrors++;
    // Ventana deslizante: descartar 429 más viejos que rateLimitWindowMs
    this.rateLimitTimestamps.push(now);
    this.rateLimitTimestamps = this.rateLimitTimestamps.filter(t => now - t < this.rateLimitWindowMs);
    this.failureCount = this.rateLimitTimestamps.length;

    // Solo abrir el breaker si hay MUCHOS 429 reales concentrados en la ventana corta.
    // Esto evita falsos positivos con 1 usuario o errores aislados.
    if (this.failureCount >= this.circuitBreakerThreshold) {
      this.circuitBreakerState = 'OPEN';
      this.circuitOpenUntil = now + (this.circuitOpenMinutes * 60 * 1000);
      const openUntilTime = new Date(this.circuitOpenUntil).toLocaleTimeString('es-ES');
      this.rateLimitTimestamps = [];
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

        // Timeouts: solo 1 reintento rápido — nunca esperas largas que congelan la UI
        if (isTimeout) {
          if (attempt < 1) {
            await new Promise(r => setTimeout(r, 1500));
            continue;
          }
          throw new Error('La conexión tardó demasiado. Verifica tu internet.');
        }

        if (isRateLimit && attempt < maxRetries - 1) {
          this.registerRateLimitError();
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
   * TTL por entidad (en ms). Datos estáticos viven más, transaccionales menos.
   */
  getEntityTTL(entity) {
    // Datos casi inmutables: 10 minutos
    const STATIC = ['AppConfig', 'StateConfig', 'PricingConfig', 'PrivacyConfig', 'RoleConfig', 'EmailTemplate', 'FAQ', 'KnowledgeBase', 'BlogPost', 'Warehouse', 'WarehouseLocation'];
    // Datos transaccionales: 15 segundos (consistencia más alta)
    const TRANSACTIONAL = ['Package', 'Consolidation', 'ConsolidationRequest', 'Invoice', 'SupportTicket', 'Notification', 'AssistedPaymentRequest'];
    if (STATIC.includes(entity)) return 600000;
    if (TRANSACTIONAL.includes(entity)) return 15000;
    return 60000; // default 1 min
  }

  /**
   * Obtiene del cache si es válido
   */
  getFromCache(key, ttlMs) {
    // Respeta desactivación de caché por entidad
    const entity = String(key).split(':')[0];
    if (this.cacheDisabledFor.has(entity)) return null;

    const cached = this.cache.get(key);
    if (!cached) return null;

    const effectiveTtl = Number.isFinite(ttlMs) ? ttlMs : this.getEntityTTL(entity);
    const now = Date.now();
    if (now - cached.timestamp > effectiveTtl) {
      // No borrar: se conserva como copia "stale" de emergencia si la red falla
      if (now - cached.timestamp > this.STALE_MAX_AGE_MS) this.cache.delete(key);
      return null;
    }

    // Cache hit (silenced to reduce console noise)
    return cached.data;
  }

  /**
   * Copia stale de emergencia: se usa cuando la red falla para no dejar la UI colgada
   */
  getStaleFromCache(key) {
    const entity = String(key).split(':')[0];
    if (this.cacheDisabledFor.has(entity)) return null;
    const cached = this.cache.get(key);
    if (!cached) return null;
    if (Date.now() - cached.timestamp > this.STALE_MAX_AGE_MS) return null;
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

      // Reactivar auto-scaler si estaba pausado
      if (!this._autoScalerActive) this._startAutoScaler();

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

        try {
          const result = await this.enqueue(async () => {
            const lim = Number.isFinite(limit) ? limit : 200;
            const sk = Number.isFinite(skip) ? skip : 0;
            return await base44Client.entities[entityName].list(sortBy, lim, sk);
          }, 'NORMAL', 'read', cacheKey);
          this.saveToCache(cacheKey, result);
          return result;
        } catch (error) {
          const stale = this.getStaleFromCache(cacheKey);
          if (stale) return stale;
          throw error;
        }
      },

      filter: async (query, sortBy, limit, skip = 0) => {
        const cacheKey = this.getCacheKey(entityName, 'filter', { query, sortBy, limit, skip });
        const cached = this.getFromCache(cacheKey);
        if (cached) return cached;

        try {
          const result = await this.enqueue(async () => {
            const lim = Number.isFinite(limit) ? limit : 200;
            const sk = Number.isFinite(skip) ? skip : 0;
            return await base44Client.entities[entityName].filter(query, sortBy, lim, sk);
          }, 'NORMAL', 'read', cacheKey);
          this.saveToCache(cacheKey, result);
          return result;
        } catch (error) {
          const stale = this.getStaleFromCache(cacheKey);
          if (stale) return stale;
          throw error;
        }
      },

      get: async (id) => {
        const cacheKey = this.getCacheKey(entityName, 'get', { id });
        const cached = this.getFromCache(cacheKey);
        if (cached) return cached;

        try {
          const result = await this.enqueue(async () => {
            return await base44Client.entities[entityName].get(id);
          }, 'NORMAL', 'read', cacheKey);
          this.saveToCache(cacheKey, result);
          return result;
        } catch (error) {
          const stale = this.getStaleFromCache(cacheKey);
          if (stale) return stale;
          throw error;
        }
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

        try {
          const result = await this.enqueue(async () => {
            return await base44Client.auth.me();
          }, 'HIGH', 'read', cacheKey);
          this.saveToCache(cacheKey, result);
          return result;
        } catch (error) {
          // Si la red falló (no un error de auth real), usar la sesión conocida
          // para no expulsar al usuario ni dejar la app colgada
          const status = error?.response?.status;
          if (status !== 401 && status !== 403) {
            const stale = this.getStaleFromCache(cacheKey);
            if (stale) return stale;
          }
          throw error;
        }
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
   * Registra automáticamente cada invocación en CreditUsageLog (best-effort)
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

              const startedAt = Date.now();
              let status = 'success';
              let errorMessage = '';
              let result;
              try {
                result = await self.enqueue(async () => await fn(params), 'NORMAL', opType);
                return result;
              } catch (err) {
                status = 'error';
                errorMessage = err?.message || 'Unknown error';
                throw err;
              } finally {
                // Log best-effort, never blocks the main flow
                try {
                  const duration = Date.now() - startedAt;
                  const paramsSummary = (() => {
                    try {
                      if (!params || typeof params !== 'object') return '';
                      const keys = Object.keys(params).slice(0, 6);
                      const safe = {};
                      keys.forEach((k) => {
                        const v = params[k];
                        if (v == null) { safe[k] = null; return; }
                        if (typeof v === 'string') safe[k] = v.length > 80 ? v.slice(0, 80) + '…' : v;
                        else if (typeof v === 'number' || typeof v === 'boolean') safe[k] = v;
                        else if (Array.isArray(v)) safe[k] = `[array:${v.length}]`;
                        else if (v instanceof File || v instanceof Blob) safe[k] = `[file:${v.size || '?'}b]`;
                        else safe[k] = `[object]`;
                      });
                      return JSON.stringify(safe).slice(0, 400);
                    } catch { return ''; }
                  })();

                  const page = (typeof window !== 'undefined' && window.location?.pathname) || '';
                  // Fire and forget — DO NOT await
                  base44Client.functions.invoke('logCreditUsage', {
                    integration_name: name,
                    estimated_credits: 1,
                    caller_function: `integrations.${String(pkg)}.${name}`,
                    caller_page: page,
                    caller_source: 'frontend',
                    status,
                    error_message: errorMessage,
                    params_summary: paramsSummary,
                    duration_ms: duration
                  }).catch(() => {});
                } catch (_) {}
              }
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

// NO se habilita realtime global por defecto.
// Cada componente que lo necesite debe llamar a base44.entities.<Entity>.subscribe()
// directamente (ej. NotificationBell, MyPackages, AdminPackages).
// Esto reduce significativamente el consumo de WebSockets.

// Export como base44 compatible
export const base44 = apiQueue;

// Export sistema de estado y tuning
export const getApiStatus = () => apiQueue.getSystemStatus();
export const setApiTuning = (opts) => apiQueue.setTuning(opts);
export const getApiTuning = () => apiQueue.getTuning();
export const resetCircuitBreaker = () => apiQueue.forceResetCircuitBreaker();
export const enableRealtime = (entities) => apiQueue.enableRealtime(entities);
export const disableCacheFor = (entities) => apiQueue.disableCacheFor(entities);