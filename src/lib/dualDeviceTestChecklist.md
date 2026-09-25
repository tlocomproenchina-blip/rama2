# Checklist de Pruebas Dual-Device — Integridad Multi-Dispositivo Bodega

Protocolo de pruebas end-to-end para validar la integridad de sincronización
entre dos dispositivos de bodega simultáneos.

**Requisitos previos:**
- Dos dispositivos (navegadores o tablets) con cuentas de admin de bodega
- Ambos dispositivos conectados al mismo almacén
- Al menos 2 paquetes pre-alertados de un mismo cliente disponibles para escanear
- Conexión a internet activa en ambos dispositivos

---

## Escenario A: Cierre de bulto vs. escaneo simultáneo

**Objetivo:** Validar que un paquete escaneado en el Dispositivo B no duplica
un bulto que el Dispositivo A ya cerró.

1. [ ] **Dispositivo A:** Escanear paquete #1 del cliente X → se abre bulto activo
2. [ ] **Dispositivo B:** Escanear paquete #2 del mismo cliente X → se abre bulto activo (distinto o el mismo si sincronizó)
3. [ ] **Dispositivo A:** Cerrar el bulto (botón "Cerrar bulto") → bulto pasa a `cerrado`, etiqueta encola en print_queue local
4. [ ] Esperar 30+ segundos para que `refreshIfStale` dispare en el Dispositivo B
5. [ ] **Dispositivo B:** Escanear paquete #3 del mismo cliente X
6. [ ] **Resultado esperado:** El Dispositivo B crea un bulto NUEVO (no reabre el cerrado por A). El bulto cerrado por A no aparece como activo en B.
7. [ ] Verificar en AdminBultoAudit: el bulto de A tiene `status: cerrado`

---

## Escenario B: Despacho duplicado entre dispositivos

**Objetivo:** Validar que el backend rechaza el despacho duplicado de un
mismo bulto/paquete por dos dispositivos.

1. [ ] **Dispositivo A:** En WarehouseDispatch, escanear el bulto del cliente X → despachar
2. [ ] **Dispositivo B:** En WarehouseDispatch, escanear el mismo bulto (mismo label_code)
3. [ ] **Resultado esperado:** El Dispositivo B recibe un toast informativo: "Bulto ya despachado por otro dispositivo" (no error). El item se remueve de la cola de sincronización de B.
4. [ ] Verificar en WarehouseDispatchScanHistory: solo aparece 1 registro de despacho (de A), no 2.

---

## Escenario C: Recepción duplicada de paquete

**Objetivo:** Validar que el backend rechaza la recepción duplicada de un
mismo paquete por dos dispositivos.

1. [ ] **Dispositivo A:** En WarehouseReceive, escanear paquete con tracking Y → asignar a ubicación Z
2. [ ] **Dispositivo B:** En WarehouseReceive, escanear el mismo tracking Y → intentar asignar a otra ubicación
3. [ ] **Resultado esperado:** El Dispositivo B recibe toast: "Paquete ya recibido en otro dispositivo" y/o "Ubicación llena" si la ubicación está saturada. El item se remueve de la cola.
4. [ ] Verificar que el paquete Y tiene `warehouse_location_code` = Z (la de A, no la de B).

---

## Escenario D: Auditoría de impresión entre dispositivos

**Objetivo:** Validar que la impresión de etiquetas se registra en
BultoPrintLog y es visible desde cualquier dispositivo.

1. [ ] **Dispositivo A:** Cerrar un bulto en WarehouseScanPack → imprimir etiqueta desde PrintQueueCard
2. [ ] **Dispositivo B:** Abrir WarehousePrintAudit
3. [ ] **Resultado esperado:** El Dispositivo B ve el BultoPrintLog creado por A (con `printed_by` = email de A, `print_type` = primera)
4. [ ] Verificar que la cola de impresión del Dispositivo B NO contiene el bulto de A (la cola es local, no sincronizada)

---

## Escenario E: Backfill de bultos cerrados

**Objetivo:** Validar que el backfill migra bultos legacy `activo` a
`cerrado` y ambos dispositivos reflejan el cambio tras sincronizar.

1. [ ] Identificar bultos legacy con `status: activo` que no tienen paquetes activos (consultar en AdminBultoAudit)
2. [ ] Abrir AdminBultoAudit → clic en "Backfill bultos cerrados" → confirmar
3. [ ] **Resultado esperado:** Toast muestra "Backfill completado: N bulto(s) migrado(s) a 'cerrado'"
4. [ ] **Dispositivo A:** Abrir WarehouseScanPack → esperar 30s (refreshIfStale) → los bultos legacy ya no aparecen como abiertos
5. [ ] **Dispositivo B:** Mismo comportamiento tras sincronizar
6. [ ] Verificar en AdminBultoAudit que los bultos migrados ahora muestran `status: cerrado`

---

## Escenario F: Consolidación automática con solicitud ya procesada

**Objetivo:** Validar que autoConsolidateExpired no duplica una consolidación
ya aprobada/consolidada.

1. [ ] Crear una ConsolidationRequest con período expirado (o esperar a que venza)
2. [ ] Ejecutar el workflow de Consolidación Automática por Período Expirado
3. [ ] Ejecutarlo de nuevo inmediatamente (segunda vez)
4. [ ] **Resultado esperado:** La segunda ejecución saltea la solicitud con `already_consolidated` y no crea una consolidación duplicada.

---

## Escenario G: Detección de seguros en AdminInsured

**Objetivo:** Validar que AdminInsured muestra seguros de paquetes recibidos
y posteriores (no solo consolidados).

1. [ ] Tener un paquete con `has_insurance: true` y `status: recibido` (no consolidado)
2. [ ] Abrir AdminInsured
3. [ ] **Resultado esperado:** El paquete aparece en la lista (antes no aparecía porque solo se detectaban consolidados)
4. [ ] Verificar que paquetes en `pre_alerta` con seguro NO aparecen (aún no llegaron al almacén)
5. [ ] Verificar que paquetes en `recibido`, `consolidado`, `en_transito`, `disponible` SÍ aparecen

---

## Resultado Final

- [ ] Todos los escenarios (A–G) pasaron sin errores
- [ ] No se observaron bultos fantasma (activos que deberían estar cerrados)
- [ ] No se observaron despachos duplicados en el historial
- [ ] No se observaron impresiones duplicadas en BultoPrintLog
- [ ] Los toasts informativos (no de error) aparecen para conflictos multi-dispositivo

**Fecha de ejecución:** ___ / ___ / ___
**Ejecutado por:** __________________
**Dispositivos usados:** _________________ y _________________