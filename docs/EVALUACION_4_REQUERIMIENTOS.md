# SerialCare Cloud - Alcance definitivo de Evaluación 4

## 1. Propósito

Este documento congela el alcance funcional definitivo de SerialCare Cloud para la Evaluación 4 de Arquitectura Multicloud y DevSecOps. Es la referencia obligatoria para las implementaciones posteriores. Describe el producto objetivo; no implica que todas las capacidades ya estén implementadas.

Toda desviación futura debe documentarse antes de modificar código. Las autorizaciones se validan en backend; ocultar controles en frontend no constituye seguridad.

## 2. Alcance general y arquitectura

- El sistema funcionará inicialmente para un solo negocio de servicio técnico.
- No se mostrará ni administrará más de una sucursal.
- Se conservarán `id_sucursal`, las tablas de sucursales y sus relaciones por compatibilidad con el sistema existente.
- Las operaciones usarán una sucursal predeterminada, obtenida desde configuración confiable o desde el usuario autenticado. El frontend no podrá elegir libremente `id_sucursal`.
- No se eliminarán todavía tablas, columnas, claves foráneas ni código heredado relacionado con sucursales.
- La arquitectura continúa siendo multicloud: AWS aloja la infraestructura principal y Azure Blob Storage almacena los documentos PDF.
- PostgreSQL conserva los datos de negocio y los metadatos de documentos.
- No se implementarán POS, caja, carrito, venta directa ni facturación de venta.
- No se implementarán WhatsApp, correo ni mensajería automática.

## 3. Módulos funcionales definitivos

### 3.1. Clientes, máquinas e historial

Responsabilidad: mantener la identidad del cliente, la máquina serializada y su trazabilidad.

Capacidades:

- Buscar clientes por nombre, RUT, teléfono o correo.
- Crear clientes cuando no existan.
- Administrar clientes desde ADMIN.
- Buscar máquinas por número de serie.
- Consultar las máquinas asociadas a un cliente.
- Crear y administrar máquinas serializadas.
- Impedir duplicados de número de serie normalizado.
- Mostrar propietario, contacto, garantía por fecha e historial de atenciones.
- Registrar boleta o factura, fecha de compra e inicio y término de garantía cuando corresponda.
- Conservar la sucursal predeterminada internamente por compatibilidad, sin exponer una operación multisucursal.

### 3.2. Recepción, cotización y entrega

Responsabilidad: gestionar el ingreso, la relación con el cliente, la aprobación y la entrega.

Capacidades:

- Iniciar el ingreso buscando preferentemente la máquina por serie.
- Buscar al cliente y seleccionar una de sus máquinas si la serie no está visible.
- Crear cliente o máquina durante la recepción cuando no existan.
- Crear órdenes de tipo `REPARACION`, `REVISION_GARANTIA`, `MANTENCION` o `PUESTA_EN_MARCHA`.
- Registrar accesorios, falla indicada por el cliente y observaciones.
- Mostrar datos de máquina, propietario, contacto, garantía por fecha, historial y valor de ingreso.
- Consultar estado, cotización y documentos.
- Registrar manualmente la respuesta telefónica o presencial del cliente.
- Registrar solicitud de nueva cotización, rechazo, retiro sin reparar y entrega.
- Generar y consultar versiones cerradas de cotizaciones en PDF.

### 3.3. Diagnóstico, reparación y garantías

Responsabilidad: ejecutar el trabajo técnico desde la toma de la orden hasta su finalización.

Capacidades:

- Mostrar órdenes disponibles.
- Tomar una orden mediante una operación segura frente a concurrencia.
- Registrar diagnóstico, observaciones, repuestos y mano de obra.
- Determinar la cobertura final de garantía.
- Crear y finalizar la cotización técnica cuando corresponda.
- Ejecutar y finalizar la reparación.
- Registrar los consumos reales de repuestos.
- Finalizar el trabajo y dejar la máquina lista para entrega.
- Permitir que ADMIN ejecute las mismas acciones técnicas que TECNICO.

### 3.4. Repuestos, inventario y documentos

Responsabilidad: mantener catálogo, existencias, precios, movimientos y documentos asociados al servicio.

Capacidades:

- Administrar catálogo, stock, stock mínimo, precio y estado.
- Agregar repuestos a una cotización sin descontar stock inmediatamente.
- Descontar stock al confirmar consumo o finalizar la reparación.
- Registrar entradas, ajustes, consumos y devoluciones.
- Alertar cuando el stock sea menor o igual al stock mínimo.
- Conservar precios históricos aplicados en cotizaciones.
- Generar PDF de cotización inspirado en la orden física.
- Guardar el PDF en Azure Blob Storage.
- Registrar URL, versión, hash y metadatos en PostgreSQL.
- Permitir únicamente ver y descargar el PDF desde el sistema.

## 4. Roles activos y congelados

### 4.1. Roles activos

Los únicos roles funcionales activos son:

- `ADMIN`
- `RECEPCIONISTA`
- `TECNICO`

### 4.2. Roles fuera de alcance

- `MARCA` se retira del alcance funcional. No se crearán nuevas rutas, vistas, permisos ni procesos para este rol.
- `CLIENTE` y su inicio de sesión quedan congelados. No se crearán capacidades nuevas y no se eliminará todavía su código si ello rompe compatibilidad.
- La entidad comercial cliente continúa activa y no equivale a una cuenta de acceso.

## 5. Permisos por rol

### 5.1. ADMIN

- Administrar clientes y máquinas.
- Administrar técnicos y recepcionistas.
- Administrar repuestos, stock, stock mínimo, precios y estado.
- Crear ingresos y órdenes.
- Ejecutar todas las acciones permitidas a TECNICO.
- Aplicar descuentos porcentuales o de monto fijo antes de cerrar una versión de cotización.
- Registrar la respuesta del cliente.
- Registrar retiro sin reparar y entrega.
- Consultar historial, cotizaciones, documentos y movimientos.

### 5.2. RECEPCIONISTA

- Buscar máquinas por número de serie.
- Buscar clientes por nombre, RUT, teléfono o correo.
- Consultar las máquinas asociadas a un cliente.
- Crear clientes y máquinas cuando no existan.
- Crear órdenes.
- Consultar estados, datos de contacto, cotizaciones y documentos.
- Registrar aprobación, solicitud de nueva cotización, rechazo, retiro sin reparar y entrega.
- No editar clientes existentes.
- No diagnosticar.
- No agregar ni modificar trabajo técnico.
- No modificar precios ni aplicar descuentos.
- No decidir la cobertura de garantía.
- No ajustar stock manualmente.

### 5.3. TECNICO

- Ver órdenes disponibles y las que haya tomado.
- Tomar una orden.
- Diagnosticar.
- Decidir si la falla está cubierta por garantía.
- Agregar repuestos, cantidades, mano de obra y observaciones.
- Finalizar la cotización técnica.
- Finalizar la reparación.
- No crear el ingreso inicial.
- No modificar precios generales.
- No aplicar descuentos.
- No ajustar stock manualmente.
- No registrar la respuesta del cliente ni la entrega.

## 6. Matriz de permisos

Leyenda: `G` gestión, `E` ejecución, `C` consulta y `-` sin permiso.

| Capacidad | ADMIN | RECEPCIONISTA | TECNICO |
|---|:---:|:---:|:---:|
| Administrar técnicos y recepcionistas | G | - | - |
| Buscar clientes y máquinas | G | C | C vinculada a orden |
| Crear cliente | G | E | - |
| Editar cliente existente | G | - | - |
| Crear/editar máquina | G | E al crear | - |
| Consultar historial | C | C | C vinculada a orden |
| Crear ingreso y orden | E | E | - |
| Tomar orden | E | - | E |
| Diagnosticar | E | - | E |
| Decidir cobertura de garantía | E | - | E |
| Agregar repuestos y mano de obra | E | - | E |
| Finalizar cotización técnica | E | - | E |
| Aplicar descuentos | G | - | - |
| Generar/cerrar versión PDF | G | - | - |
| Ver y descargar PDF | C | C | C |
| Registrar respuesta del cliente | E | E | - |
| Solicitar nueva cotización | E | E | - |
| Ejecutar/finalizar reparación | E | - | E |
| Registrar retiro o entrega | E | E | - |
| Administrar catálogo y precios | G | C | C |
| Registrar entradas y ajustes de stock | G | - | - |
| Confirmar consumo/devolución por orden | E | - | E |
| Consultar movimientos y alertas | C | C | C |

## 7. Tipos de orden

Los tipos permitidos son:

- `REPARACION`
- `REVISION_GARANTIA`
- `MANTENCION`
- `PUESTA_EN_MARCHA`

No se aceptarán variantes como `GARANTIA` o `MANTENIMIENTO` en el contrato objetivo. Los valores heredados deberán migrarse de manera incremental.

## 8. Flujo de nueva orden

1. Buscar preferentemente la máquina por número de serie.
2. Si la serie no es visible, buscar al cliente por nombre, RUT, teléfono o correo.
3. Mostrar las máquinas asociadas al cliente y seleccionar la correcta.
4. Si el cliente o la máquina no existen, ADMIN o RECEPCIONISTA pueden crearlos.
5. Mostrar automáticamente:
   - datos de la máquina;
   - propietario;
   - teléfono y correo;
   - elegibilidad inicial de garantía por fecha;
   - historial de atenciones;
   - valor de ingreso según el tipo de máquina.
6. Registrar accesorios entregados, falla indicada por el cliente, observaciones y tipo de orden.
7. Crear la orden en `INGRESADA` usando internamente la sucursal predeterminada.
8. La orden queda disponible para que un TECNICO o ADMIN la tome.

## 9. Garantía

- Las fechas de inicio y término determinan la elegibilidad inicial.
- TECNICO o ADMIN decide la cobertura final después del diagnóstico.
- Una fecha vigente no garantiza por sí sola la cobertura de la falla.

### Garantía aprobada

- El cliente paga `$0`.
- No requiere aprobación de cotización.
- Los repuestos y cantidades se registran.
- El stock se descuenta al confirmar el consumo o finalizar la reparación.
- La reparación avanza directamente a `EN_REPARACION`.

### Garantía rechazada

- Se crea una cotización pagada.
- No se agrega retroactivamente el costo de ingreso al taller.
- La reparación solo avanza después de una respuesta aprobada.

## 10. Cotizaciones, descuentos y versiones

- Solo `REPARACION` y una garantía rechazada requieren cotización normal.
- `MANTENCION` y `PUESTA_EN_MARCHA` no requieren cotización normal en este alcance.
- TECNICO o ADMIN agrega repuestos, cantidades, mano de obra y observaciones.
- ADMIN puede aplicar antes del PDF:
  - descuento porcentual o de monto fijo;
  - motivo obligatorio;
  - usuario responsable;
  - fecha y hora;
  - total anterior y total resultante.
- Una vez generado el PDF, la versión queda cerrada y no puede sobrescribirse.
- Si el cliente solicita otro precio, se crea una nueva versión.
- Las versiones anteriores permanecen consultables.
- La respuesta debe identificar la versión exacta aceptada o rechazada.

## 11. PDF y Azure Blob Storage

- El PDF se inspira en la orden física e identifica orden, cliente, máquina, diagnóstico, ítems, mano de obra, descuentos, total y versión.
- El archivo se almacena en Azure Blob Storage.
- PostgreSQL registra al menos orden, cotización, versión, URL o identificador del blob, hash, tamaño, tipo MIME, usuario y fecha de generación.
- Una versión generada es inmutable.
- La aplicación solo permite ver y descargar el PDF.
- No envía el documento por WhatsApp, correo ni mensajería automática.
- La comunicación con el cliente ocurre fuera del sistema.
- RECEPCIONISTA o ADMIN registra manualmente la respuesta telefónica o presencial.

## 12. Flujo de aprobación

1. TECNICO o ADMIN completa la cotización técnica.
2. ADMIN revisa precios y aplica un descuento opcional.
3. ADMIN genera el PDF y cierra la versión.
4. La orden pasa automáticamente a `ESPERANDO_APROBACION`.
5. RECEPCIONISTA o ADMIN registra una de estas respuestas:
   - aprobación;
   - solicitud de nueva cotización;
   - rechazo con retiro sin reparar.
6. Una aprobación cambia la orden a `EN_REPARACION`.
7. Una solicitud de nuevo precio cambia la orden a `REQUIERE_NUEVA_COTIZACION` y exige una nueva versión.
8. Un rechazo cambia la orden a `RETIRO_SIN_REPARAR`.
9. Ningún usuario selecciona manualmente el estado; la acción autorizada ejecuta la transición.

## 13. Inventario

- ADMIN administra catálogo, stock, stock mínimo, precio y estado.
- TECNICO y ADMIN pueden agregar repuestos a una orden.
- Agregar un repuesto a la cotización no descuenta stock.
- El stock se descuenta al confirmar consumo o finalizar la reparación.
- Cada cambio de stock crea un movimiento auditable dentro de la misma transacción.
- No se permite stock negativo sin una regla administrativa explícita y auditada.
- Una devolución no elimina el consumo: crea un movimiento compensatorio.

Tipos permitidos de movimiento:

- `ENTRADA`
- `AJUSTE_POSITIVO`
- `AJUSTE_NEGATIVO`
- `CONSUMO_REPARACION`
- `DEVOLUCION_REPARACION`

Cada movimiento registra repuesto, cantidad, stock anterior y nuevo, usuario, fecha, motivo y orden cuando corresponda. Aunque `id_sucursal` se conserva, todos los movimientos operan inicialmente sobre la sucursal predeterminada y no existe una interfaz de transferencias entre sucursales.

## 14. Estados automáticos de orden

| Estado | Significado |
|---|---|
| `INGRESADA` | Ingreso registrado y disponible para toma |
| `EN_REVISION` | Orden tomada y diagnóstico en curso |
| `ESPERANDO_APROBACION` | Versión de cotización cerrada esperando respuesta |
| `REQUIERE_NUEVA_COTIZACION` | Cliente solicitó una versión con otro precio |
| `EN_REPARACION` | Reparación autorizada o cubierta por garantía |
| `LISTA_PARA_ENTREGA` | Trabajo finalizado y máquina disponible |
| `RETIRO_SIN_REPARAR` | Cliente rechazó y debe retirar sin reparación |
| `ENTREGADA` | Entrega física registrada |
| `CERRADA` | Expediente finalizado |

Reglas:

- Los usuarios no eligen libremente el estado.
- Cada acción de negocio valida el estado actual y aplica la transición permitida.
- Toda transición registra estado anterior, estado nuevo, usuario, fecha y motivo u observación.
- `CERRADA` es terminal.
- La reapertura requiere una operación administrativa futura explícita o una orden nueva; no forma parte de este alcance.

## 15. Estados de cotización

| Estado | Significado |
|---|---|
| `BORRADOR` | Ítems y mano de obra editables |
| `PENDIENTE_GENERACION` | Revisión comercial terminada, falta generar PDF |
| `ESPERANDO_APROBACION` | Versión PDF cerrada esperando respuesta |
| `APROBADA` | Cliente aceptó la versión |
| `REQUIERE_NUEVA_COTIZACION` | Cliente solicitó otro precio |
| `RECHAZADA` | Cliente rechazó la versión |
| `ANULADA` | Versión invalidada antes de recibir respuesta, con motivo |

Una cotización cerrada nunca vuelve a `BORRADOR`. Una nueva negociación crea otra versión.

## 16. Flujo de reparación

```text
INGRESADA
→ TECNICO o ADMIN toma la orden
→ EN_REVISION
→ diagnóstico
→ decisión de garantía
→ cotización cuando corresponda
→ descuento opcional de ADMIN
→ PDF en Azure Blob Storage
→ ESPERANDO_APROBACION
→ APROBADA, REQUIERE_NUEVA_COTIZACION o RETIRO_SIN_REPARAR
→ EN_REPARACION
→ LISTA_PARA_ENTREGA
→ ENTREGADA
→ CERRADA
```

Excepciones:

- Una garantía aprobada omite cotización y aprobación, y avanza a `EN_REPARACION`.
- Una garantía rechazada sigue el flujo de cotización pagada.
- Una solicitud de nueva cotización vuelve a la creación de una nueva versión, no sobrescribe la anterior.

## 17. Puesta en marcha

- Puede usar un cliente existente o uno nuevo.
- Requiere una máquina serializada.
- Registra boleta o factura, fecha de compra e inicio y término de garantía.
- No corresponde a una reparación.
- No requiere cotización normal.
- No debe contarse como máquina reparada.
- Puede registrar comprobaciones, configuración, resultado, responsable y conformidad.
- Si se detecta una falla, se crea una orden separada de `REVISION_GARANTIA` o `REPARACION`.

## 18. Migraciones SQL necesarias

Las migraciones futuras deben ser incrementales, no destructivas y compatibles con los datos existentes. La numeración exacta debe continuar desde la última migración real del repositorio.

1. **Normalización de tipos y estados**
   - Migrar variantes heredadas de tipos de orden.
   - Crear restricciones para los cuatro tipos definitivos.
   - Mapear estados existentes a los estados automáticos.

2. **Historial de estados de orden**
   - Crear historial con estado anterior/nuevo, usuario, fecha y observación.
   - Incorporar control de concurrencia para la toma de órdenes.

3. **Datos de recepción y valor de ingreso**
   - Registrar accesorios, falla indicada, observaciones y valor aplicado.
   - Conservar la sucursal predeterminada sin exponer selección multisucursal.

4. **Identidad y garantía de máquinas**
   - Añadir o completar documento, fecha de compra e inicio y término de garantía.
   - Preservar unicidad normalizada del número de serie.

5. **Diagnóstico y decisión de garantía**
   - Registrar diagnóstico, decisión final, motivo, usuario y fecha.
   - Consolidar una sola fuente de verdad para la decisión.

6. **Cotizaciones versionadas**
   - Añadir versión, subtotales, mano de obra, descuentos, total y cierre.
   - Impedir modificar una versión cerrada.

7. **Respuestas de cotización**
   - Registrar versión, respuesta, canal, persona, usuario, fecha y observación.
   - Permitir solicitud de nueva versión sin sobrescribir la anterior.

8. **Documentos en Azure**
   - Crear metadatos de blob, URL o identificador, hash, MIME, tamaño, versión, usuario y fecha.

9. **Entregas y retiros**
   - Registrar tipo, receptor, usuario, fecha y observaciones.
   - Validar el estado habilitado antes de entregar.

10. **Inventario y stock mínimo**
    - Completar catálogo, precio, stock, stock mínimo y estado.
    - Mantener `id_sucursal` con la sucursal predeterminada.

11. **Movimientos de inventario**
    - Incorporar los cinco tipos definitivos de movimiento.
    - Vincular consumo y devolución con la orden.
    - Actualizar stock y movimiento dentro de una transacción.

12. **Integridad y auditoría**
    - Añadir restricciones, índices y campos de auditoría faltantes.
    - Proteger historial mediante estados inactivos y claves foráneas no destructivas.

No se planifican migraciones para eliminar sucursales, `MARCA` o `CLIENTE` en esta etapa.

## 19. Contradicciones heredadas eliminadas de la especificación

Esta versión reemplaza las siguientes decisiones anteriores:

- Se elimina el alcance funcional de `MARCA` y la matriz de permisos asociada.
- Se elimina la administración y operación visible de múltiples sucursales.
- Se elimina el catálogo global administrado por MARCA y las transferencias entre sucursales del alcance actual.
- Se reemplaza “Inventario de repuestos por sucursal” por “Repuestos, inventario y documentos”.
- Se congela explícitamente `CLIENTE` y su inicio de sesión.
- RECEPCIONISTA puede crear clientes y máquinas, pero ya no puede editar clientes existentes.
- ADMIN puede ejecutar todas las acciones técnicas; no se limita a excepciones administrativas.
- La decisión final de garantía corresponde a TECNICO o ADMIN, no a RECEPCIONISTA.
- Solo `REPARACION` y garantía rechazada usan cotización normal.
- `MANTENCION` y `PUESTA_EN_MARCHA` no usan el flujo normal de cotización.
- Se eliminan reserva, liberación y transferencia del conjunto mínimo de movimientos.
- Se reemplaza la selección manual de estados por transiciones automáticas derivadas de acciones.
- Se incorpora Azure Blob Storage como destino obligatorio de los PDF y se excluye el envío automático al cliente.

## 20. Brechas y riesgos pendientes

- El código existente todavía puede mostrar `MARCA`, `CLIENTE` o múltiples sucursales; esta tarea no los elimina.
- Mantener `id_sucursal` con una sucursal predeterminada exige una fuente de configuración consistente en backend, despliegue y datos iniciales.
- Debe definirse el mecanismo seguro de configuración o creación de la sucursal predeterminada sin credenciales hardcodeadas.
- Los estados históricos deberán mapearse antes de aplicar restricciones estrictas.
- La decisión de garantía puede estar duplicada actualmente y deberá consolidarse sin perder trazabilidad.
- Las cotizaciones actuales pueden no soportar versiones inmutables ni descuentos auditables.
- El descuento porcentual y el monto fijo requieren reglas de validación, redondeo y límites.
- Azure Blob Storage requiere identidad, permisos mínimos, contenedor privado y mecanismo seguro de descarga.
- Debe definirse el formato final del PDF a partir de la orden física.
- El descuento de stock debe ser transaccional e idempotente para evitar doble consumo.
- La toma concurrente de órdenes requiere una operación atómica.
- Las rutas y vistas heredadas de MARCA y CLIENTE deben congelarse antes de su retiro gradual.
- La separación en cuatro módulos para Dockerfiles y pipelines independientes continúa siendo una exigencia DevSecOps y debe diseñarse sin duplicar lógica de negocio.

## 21. Criterios de aceptación documental

La implementación futura estará alineada cuando:

- Solo ADMIN, RECEPCIONISTA y TECNICO reciban nuevas capacidades.
- La interfaz no muestre administración multisucursal.
- `id_sucursal` se conserve internamente con una sucursal predeterminada confiable.
- Los cuatro módulos tengan límites y artefactos DevSecOps identificables.
- Las órdenes usen tipos y transiciones definidos en este documento.
- RECEPCIONISTA no edite clientes existentes ni realice acciones técnicas o comerciales restringidas.
- ADMIN pueda ejecutar acciones administrativas y técnicas.
- Las cotizaciones sean versionadas, auditables e inmutables después del PDF.
- Los PDF se almacenen de forma privada en Azure Blob Storage.
- El inventario registre movimientos y nunca descuente stock al añadir un ítem al borrador.
- MARCA quede fuera de alcance y CLIENTE permanezca congelado sin romper compatibilidad.
