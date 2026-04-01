# Sistema Anti-Rate-Limit - Documentación

## 🎯 Objetivo
Eliminar completamente los errores 429 (Rate Limit Exceeded) mediante una arquitectura centralizada de gestión de llamadas API.

---

## 📦 Componentes

### 1. ApiQueueManager.js
**Cola global + Circuit Breaker + Retry + Cache**

#### Features implementadas:
- ✅ Cola FIFO: Solo 1 operación a la vez
- ✅ Backoff exponencial: 60s → 120s → 240s → 480s (máx 5 intentos)
- ✅ Circuit breaker: 3 errores 429 → bloqueo 20 minutos
- ✅ Debouncing automático: agrupa cambios rápidos
- ✅ Cache inteligente con TTL: 30s (datos), 1h (schemas/config)
- ✅ Prioridades: HIGH (writes) > NORMAL (reads)
- ✅ Intervalo mínimo: 1s entre operaciones

#### Estados del Circuit Breaker:
- `CLOSED`: Normal, sistema funcional
- `OPEN`: Bloqueado por 20 min tras 3 errores 429
- `HALF_OPEN`: Probando si sistema se recuperó

---

### 2. ApiStatusIndicator.js
**Indicador visual del estado del sistema**

Muestra automáticamente cuando:
- Circuit breaker está OPEN
- Hay más de 5 operaciones en cola
- Se detectaron errores de rate limit

---

## 🔧 Uso

### Migración Simple
Reemplaza todas las importaciones:

**ANTES:**
```javascript
import { base44 } from '@/api/base44Client';
```

**DESPUÉS:**
```javascript
import { base44 } from '@/components/api/ApiQueueManager';
```

¡Eso es todo! El API es 100% compatible.

---

## 🎮 Operaciones Soportadas

### Entities (con cache automático)
```javascript
import { base44 } from '@/components/api/ApiQueueManager';

// Lecturas (cacheadas 30s)
const packages = await base44.entities.Package.list();
const filtered = await base44.entities.Package.filter({ status: 'active' });
const single = await base44.entities.Package.get('id');

// Escrituras (prioridad HIGH, invalidan cache)
await base44.entities.Package.create({ ... });
await base44.entities.Package.update('id', { ... });
await base44.entities.Package.delete('id');
await base44.entities.Package.bulkCreate([...]);
```

### Auth (cache 1 minuto)
```javascript
const user = await base44.auth.me();
await base44.auth.updateMe({ ... });
```

### Functions
```javascript
await base44.functions.invoke('functionName', params);
```

### Debouncing Manual
Para operaciones que cambian rápidamente (ej: autosave):
```javascript
import { base44 } from '@/components/api/ApiQueueManager';

// Se ejecuta solo 1 vez después de 5s sin cambios
await base44.debounced(
  'unique-key',
  async () => base44.entities.Document.update(id, data),
  5000 // delay ms
);
```

---

## 📊 Monitoreo

### Ver estado del sistema
```javascript
import { getApiStatus } from '@/components/api/ApiQueueManager';

const status = getApiStatus();
console.log(status);
// {
//   circuitBreakerState: 'CLOSED',
//   queueLength: 0,
//   failureCount: 0,
//   cacheSize: 15,
//   circuitOpenUntil: null
// }
```

---

## 🚀 Eventos Conectados a la Cola

### Automático (todas las operaciones)
- ✅ Todas las llamadas a `base44.entities.*`
- ✅ Todas las llamadas a `base44.auth.*`
- ✅ Todas las llamadas a `base44.functions.*`

### Manual (debouncing)
- 🔧 Autosave en formularios
- 🔧 Búsqueda con filtros en tiempo real
- 🔧 Actualizaciones de estado frecuentes

---

## ⚠️ Mensajes UX

### Circuit Breaker OPEN
```
🚨 Sistema en modo de protección hasta [HORA]
Demasiadas solicitudes simultáneas.
```
Duración: 10 segundos, toast rojo

### Retry en progreso
```
⏳ Esperando [SEGUNDOS]s antes de reintentar... 
(Intento X/5)
```
Duración: 5 segundos, toast amarillo

### Sistema bajo carga
Panel flotante inferior derecha mostrando:
- Operaciones en cola
- Errores detectados
- Estado del circuit breaker

---

## ✅ Checklist de Validación

### Prueba 1: Rate Limit Pasivo
- [ ] Navegar 10 páginas consecutivas → Sin errores
- [ ] Actualizar dashboard 5 veces → Solo 1 cada 60s
- [ ] Cache funciona (ver console "Cache HIT")

### Prueba 2: Rate Limit Activo (forzar errores)
- [ ] Hacer 50 operaciones rápidas → Cola las maneja
- [ ] Ver toast de "Esperando Xs antes de reintentar"
- [ ] Circuit breaker se abre tras 3 errores
- [ ] Mensaje de "Sistema en protección" aparece

### Prueba 3: Recuperación
- [ ] Esperar 20 minutos → Circuit breaker cierra
- [ ] Sistema vuelve a operar normalmente
- [ ] Contador de errores resetea

### Prueba 4: Concurrencia (10 usuarios)
- [ ] 10 pestañas abiertas simultáneas
- [ ] Todas operan sin 429
- [ ] Cola procesa ordenadamente

### Prueba 5: Debouncing
- [ ] Escribir rápido en formulario con autosave
- [ ] Solo 1 llamada tras 5s sin cambios

---

## 📋 Pasos de Implementación

### Fase 1: Infraestructura ✅
- [x] ApiQueueManager.js creado
- [x] ApiStatusIndicator.js creado
- [x] README.md documentado

### Fase 2: Migración (PRÓXIMO)
1. Layout.js
2. Dashboard.js
3. AdminDashboard.js
4. MyConsolidations.js
5. Resto de componentes

### Fase 3: Validación
1. Pausar automations (manual)
2. Probar con 1 usuario
3. Probar con 10 usuarios
4. Monitorear logs 24h

---

## 🎯 Resultado Esperado

**ANTES:**
- 30-90 llamadas/minuto
- Errores 429 frecuentes
- Real-time subscriptions sin control

**DESPUÉS:**
- Máx 60 llamadas/minuto (1 por segundo)
- 0 errores 429
- Sistema auto-regulado
- Cache reduce llamadas 40-60%

---

## 🔍 Debugging

Ver logs del queue manager:
```javascript
// Chrome DevTools Console
localStorage.setItem('debug_queue', 'true');
```

Logs disponibles:
- `[Queue] Processing: X items`
- `[Cache] HIT: entity:method`
- `[Backoff] Waiting Xs...`
- `[Circuit Breaker] State change