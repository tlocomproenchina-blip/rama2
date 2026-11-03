import { base44 as base44Client } from '@/api/base44Client';

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
    // Las funciones de servidor (pagos, despachos, lotes) pueden tardar más que
    // una lectura: cortarlas a los 20s hacía que el usuario repitiera una
    // operación que en realidad seguía corriendo.
    this.FUNCTION_TIMEOUT_MS = 90000;
    // Tope de entradas en caché para que la memoria no crezca sin límite
    this.MAX_CACHE_ENTRIES = 800;
    // Medición por página (Etapa 0): se envía periódicamente a RuntimeMetrics
    this.metricsByPage = new Map();
    this.metricsWindowStart = Date.now();
    // Registro de consumo de integraciones agrupado (un envío cada pocos segundos)
    this.creditLogBuffer = [];
    this.creditLogTimer = null;
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
   * Métricas de la página actual (se crean al primer uso)
   */
  _pageMetrics() {
    const page = (typeof window !== 'undefined' && window.location?.pathname) || 'unknown';
    let m = this.metricsByPage.get(page);
    if (!m) {
      m = { calls: 0, reads: 0, writes: 0, functions: 0, rateLimited: 0, retries: 0, timeouts: 0, errors: 0, latencies: [], maxLatency: 0, peakQueue: 0, peakConcurrency: 0, ops: new Map() };
      this.metricsByPage.set(page, m);
    }
    return m;
  }

  _recordOp(item, ms, ok) {
    try {
      const m = this._pageMetrics();
      m.calls++;
      if (item.opType === 'read') m.reads++; else m.writes++;
      if (String(item.label || '').startsWith('fn:')) m.functions++;
      if (!ok) m.errors++;
      if (m.latencies.length < 500) m.latencies.push(ms);
      if (ms > m.maxLatency) m.maxLatency = ms;
      const label = item.label || 'otro';
      const op = m.ops.get(label) || { count: 0, totalMs: 0, errors: 0 };
      op.count++; op.totalMs += ms; if (!ok) op.errors++;
      m.ops.set(label, op);
    } catch (_) {}
  }

  /**
   * Devuelve las métricas acumuladas por página y reinicia la ventana
   */
  takeMetrics() {
    const now = Date.now();
    const windowSeconds = Math.round((now - this.metricsWindowStart) / 1000);
    const rows = [];
    this.metricsByPage.forEach((m, page) => {
      if (!m.calls && !m.rateLimited && !m.timeouts) return;
      const sorted = [...m.latencies].sort((a, b) => a - b);
      const avg = sorted.length ? sorted.reduce((s, v) => s + v, 0) / sorted.length : 0;
      const p95 = sorted.length ? sorted[Math.floor(0.95 * (sorted.length - 1))] : 0;
      const topOps = Array.from(m.ops.entries())
        .sort((a, b) => b[1].count - a[1].count)
        .slice(0, 10)
        .map(([label, o]) => ({ label, count: o.count, avg_ms: Math.round(o.totalMs / o.count), errors: o.errors }));
      rows.push({
        page_name: page,
        window_seconds: windowSeconds,
        total_calls: m.calls,
        read_calls: m.reads,
        write_calls: m.writes,
        function_calls: m.functions,
        rate_limit_hits: m.rateLimited,
        retries: m.retries,
        timeouts: m.timeouts,
        error_count: m.errors,
        latency_ms_avg: Math.round(avg),
        latency_ms_p95: Math.round(p95),
        latency_ms_max: Math.round(m.maxLatency),
        peak_queue: m.peakQueue,
        peak_concurrency: m.peakConcurrency,
        top_operations: topOps,
      });
    });
    this.metricsByPage = new Map();
    this.metricsWindowStart = now;
    return rows;
  }

  /**
   * Ejecuta operación con retry y backoff exponencial.
   * Los 429 se reintentan siempre (el servidor rechazó la llamada, no la ejecutó).
   * Un timeout solo se reintenta en lecturas: una escritura que tardó puede
   * haberse completado y repetirla duplicaría pagos, despachos o registros.
   */
  async executeWithRetry(operation, maxRetries = 5, item = {}) {
    const withTimeout = (promise, ms) => new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('TIMEOUT')), ms);
      promise.then((v) => { clearTimeout(timer); resolve(v); })
             .catch((e) => { clearTimeout(timer); reject(e); });
    });
    const metrics = this._pageMetrics();
    const timeoutMs = item.timeoutMs || this.OPERATION_TIMEOUT_MS || 45000;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        // Ejecuta con timeout para evitar cuelgues indefinidos
        const result = await withTimeout(Promise.resolve().then(operation), timeoutMs);
        this.resetCircuitBreaker();
        return result;
      } catch (error) {
        const isTimeout = error?.message?.includes('TIMEOUT');
        const isRateLimit = error?.message?.includes('429') || 
                           error?.message?.includes('Rate limit') ||
                           error?.response?.status === 429;
        const retryAfter = error?.response?.headers?.['retry-after'] || error?.response?.headers?.['Retry-After'];

        if (isTimeout) {
          metrics.timeouts++;
          if (item.opType === 'write') {
            throw new Error('La operación está tardando más de lo normal. Revisa si ya se completó antes de repetirla.');
          }
          // Lecturas: solo 1 reintento rápido — nunca esperas largas que congelan la UI
          if (attempt < 1) {
            metrics.retries++;
            await new Promise(r => setTimeout(r, 1500));
            continue;
          }
          throw new Error('La conexión tardó demasiado. Verifica tu internet.');
        }

        if (isRateLimit) metrics.rateLimited++;
        if (isRateLimit && attempt < maxRetries - 1) {
          metrics.retries++;
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
    // Datos transaccionales críticos (cambian segundo a segundo): 15 segundos
    const TRANSACTIONAL = ['Package', 'Consolidation', 'ConsolidationRequest', 'Invoice', 'SupportTicket', 'Notification', 'AssistedPaymentRequest', 'InvoicePayment'];
    // Semi-estáticos: cambian con baja frecuencia (minutos/horas), cache más largo reduce re-descargas
    const SEMI_STATIC = [
      'User', 'Quote', 'DispatchOrder', 'CbmIngreso', 'WarehouseDispatchHistory',
      'ProviderCredit', 'ClientCredit', 'CreditUsageLog', 'RateHistory',
      'ShippingMarkCode', 'ShippingProvider', 'MarketingCampaign', 'Promotion',
      'EmployeeAuditLog', 'ActivityAuditLog', 'EmployeePerformanceMetric',
      'Ruta', 'Vehiculo', 'Chofer', 'CargaRuta', 'SeguimientoRuta',
      'InternalConversation', 'InternalMessage', 'ClientNote', 'ClientExportHistory',
      'BrevoDailyLog', 'EmailLog', 'EmailQueue', 'ReferralSettings', 'ReferralCbmReward',
    ];
    if (STATIC.includes(entity)) return 600000;
    if (SEMI_STATIC.includes(entity)) return 120000; // 2 minutos
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
    // Reinsertar para que la entrada quede como la más reciente
    this.cache.delete(key);
    this.cache.set(key, {
      data,
      timestamp: Date.now()
    });
    // Tope de memoria: descarta el 10% más antiguo al superar el límite
    if (this.cache.size > this.MAX_CACHE_ENTRIES) {
      const drop = Math.ceil(this.MAX_CACHE_ENTRIES * 0.1);
      const keys = this.cache.keys();
      for (let i = 0; i < drop; i++) {
        const k = keys.next().value;
        if (k === undefined) break;
        this.cache.delete(k);
      }
    }
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
  async enqueue(operation, priority = 'NORMAL', opType = 'read', dedupeKey, meta = {}) {
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
        label: meta.label || (dedupeKey ? String(dedupeKey).split(':').slice(0, 2).join('.') : ''),
        timeoutMs: meta.timeoutMs,
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
        try {
          const pm = this._pageMetrics();
          const active = this.activeReads + this.activeWrites;
          if (active > pm.peakConcurrency) pm.peakConcurrency = active;
          if (this.queue.length > pm.peakQueue) pm.peakQueue = this.queue.length;
        } catch (_) {}

        (async () => {
          const startedAt = Date.now();
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

            const result = await this.executeWithRetry(item.operation, 5, item);
            this._recordOp(item, Date.now() - startedAt, true);
            if (item.dedupeKey) this.inflight.delete(item.dedupeKey);
            item.resolve(result);
          } catch (error) {
            this._recordOp(item, Date.now() - startedAt, false);
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
        }, 'HIGH', 'write', undefined, { label: `${entityName}.create` });
      },

      update: async (id, data) => {
        this.invalidateEntityCache(entityName);

        return await this.enqueue(async () => {
          return await base44Client.entities[entityName].update(id, data);
        }, 'HIGH', 'write', undefined, { label: `${entityName}.update` });
      },

      delete: async (id) => {
        this.invalidateEntityCache(entityName);

        return await this.enqueue(async () => {
          return await base44Client.entities[entityName].delete(id);
        }, 'HIGH', 'write', undefined, { label: `${entityName}.delete` });
      },

      bulkCreate: async (dataArray) => {
        this.invalidateEntityCache(entityName, ['list', 'filter']);

        return await this.enqueue(async () => {
          return await base44Client.entities[entityName].bulkCreate(dataArray);
        }, 'HIGH', 'write', undefined, { label: `${entityName}.bulkCreate` });
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
        try {
          return base44Client.entities[entityName].subscribe((event) => {
            // Invalidar caché de esta entidad para que la próxima lectura traiga datos frescos
            this.invalidateEntityCache(entityName);
            callback(event);
          });
        } catch { return () => {}; }
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
        }, priority, opType, dedupeKey, { label: `fn:${functionName}`, timeoutMs: this.FUNCTION_TIMEOUT_MS });
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
                result = await self.enqueue(async () => await fn(params), 'NORMAL', opType, undefined, { label: `int:${String(pkg)}.${name}`, timeoutMs: self.FUNCTION_TIMEOUT_MS });
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
                  // Se agrupa: un solo envío cada pocos segundos en vez de una llamada por uso
                  self.queueCreditLog({
                    integration_name: name,
                    estimated_credits: 1,
                    caller_function: `integrations.${String(pkg)}.${name}`,
                    caller_page: page,
                    caller_source: 'frontend',
                    status,
                    error_message: errorMessage,
                    params_summary: paramsSummary,
                    duration_ms: duration
                  });
                } catch (_) {}
              }
            };
          }
        });
      }
    });
  }

  /**
   * Acumula registros de consumo de integraciones y los envía juntos
   */
  queueCreditLog(entry) {
    this.creditLogBuffer.push(entry);
    if (this.creditLogBuffer.length >= 20) { this.flushCreditLogs(); return; }
    if (!this.creditLogTimer) this.creditLogTimer = setTimeout(() => this.flushCreditLogs(), 10000);
  }

  flushCreditLogs() {
    if (this.creditLogTimer) { clearTimeout(this.creditLogTimer); this.creditLogTimer = null; }
    if (!this.creditLogBuffer.length) return;
    const entries = this.creditLogBuffer.splice(0, 50);
    base44Client.functions.invoke('logCreditUsage', { entries }).catch(() => {});
    if (this.creditLogBuffer.length) this.creditLogTimer = setTimeout(() => this.flushCreditLogs(), 1000);
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
export const takeApiMetrics = () => apiQueue.takeMetrics();
export const flushCreditLogs = () => apiQueue.flushCreditLogs();