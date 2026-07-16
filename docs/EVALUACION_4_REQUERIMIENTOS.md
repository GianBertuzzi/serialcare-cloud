# SerialCare Cloud - Requerimientos funcionales para Evaluación 4

## 1. Propósito y alcance

Este documento define la base funcional objetivo de SerialCare Cloud para la Evaluación 4. Su finalidad es acordar módulos, responsabilidades, roles, flujos, estados y cambios de base de datos antes de modificar la aplicación.

La especificación se construye sobre el repositorio actual, pero no afirma que todas las capacidades descritas ya estén implementadas. Las diferencias entre el estado actual y el estado objetivo se registran en la sección **Contradicciones y brechas detectadas**.

Decisiones de alcance:

- Los cuatro módulos descritos a continuación son los módulos definitivos de la Evaluación 4.
- Los únicos roles operativos considerados en esta etapa son `MARCA`, `ADMIN`, `RECEPCIONISTA` y `TECNICO`.
- La entidad comercial `cliente` se conserva, pero no se considera por ahora una cuenta de acceso ni el rol `CLIENTE`.
- Todas las operaciones de sucursal deben quedar limitadas a la sucursal del usuario, salvo las operaciones globales expresamente asignadas a `MARCA`.
- Los permisos se deben validar en backend. Las restricciones visuales del frontend son complementarias y no constituyen autorización.
- Los cambios aquí definidos se implementarán mediante migraciones incrementales. No se debe reinicializar una base con datos mediante sentencias destructivas.

## 2. Módulos funcionales definitivos

### 2.1. Módulo 1: Clientes, máquinas y trazabilidad

Responsabilidad principal: mantener la identidad comercial del cliente, el registro único de las máquinas serializadas y su trazabilidad entre sucursales, recepciones, intervenciones y garantías.

Capacidades requeridas:

- Crear, consultar y actualizar clientes.
- Buscar clientes por RUT, nombre, teléfono o correo.
- Crear un cliente durante una recepción o puesta en marcha.
- Registrar una máquina con número de serie único.
- Asociar la máquina a su cliente actual y conservar historial de cambios de propietario cuando corresponda.
- Registrar marca, modelo, familia, tipo de máquina y datos documentales de adquisición.
- Registrar boleta o factura, número de documento y fecha de compra.
- Registrar inicio y término de garantía.
- Consultar trazabilidad por número de serie.
- Mostrar recepciones, órdenes, inspecciones, reparaciones, mantenciones, puestas en marcha y garantías relacionadas con la máquina.
- Mantener alerta de propiedad o bloqueo documental.
- Impedir números de serie duplicados.

Datos de los que es responsable:

- Clientes.
- Máquinas serializadas.
- Documentos de compra.
- Períodos de garantía comercial.
- Historial de propiedad y trazabilidad.

Relaciones con otros módulos:

- Entrega cliente y máquina al módulo de recepción.
- Entrega antecedentes y vigencia de garantía al módulo técnico.
- Recibe referencias de órdenes, garantías y puestas en marcha para construir la trazabilidad.

### 2.2. Módulo 2: Reparaciones, inspección y garantías

Responsabilidad principal: ejecutar el trabajo técnico de una orden desde que un técnico la toma hasta que finaliza la intervención técnica.

Capacidades requeridas:

- Mostrar al técnico las órdenes de su sucursal que puede tomar y las que ya tiene asignadas.
- Permitir que un técnico tome una orden disponible mediante una operación atómica.
- Registrar inspección inicial, condición de ingreso y evidencias.
- Registrar diagnóstico técnico.
- Determinar si corresponde solicitar revisión por garantía.
- Crear y mantener una solicitud de garantía.
- Registrar decisión de garantía, motivo, responsable y fecha.
- Preparar una cotización borrador con mano de obra y repuestos propuestos.
- Ejecutar una reparación autorizada o cubierta por garantía.
- Registrar repuestos efectivamente consumidos.
- Devolver repuestos reservados o consumidos por error mediante un movimiento compensatorio.
- Registrar informe técnico y pruebas finales.
- Finalizar técnicamente la orden y dejarla disponible para entrega.

Datos de los que es responsable:

- Asignación/toma técnica.
- Inspecciones.
- Diagnósticos e informes técnicos.
- Solicitudes y decisiones de garantía.
- Trabajo de reparación o mantención.
- Repuestos propuestos y consumidos en la intervención.

Reglas principales:

- Un técnico solo puede tomar órdenes activas de su sucursal.
- Dos técnicos no pueden tomar la misma orden simultáneamente.
- La finalización técnica no equivale a entrega al cliente.
- Una garantía rechazada puede continuar como reparación pagada si se genera una cotización y esta es aprobada.
- Una reparación no debe consumir inventario sin registrar el movimiento asociado.

### 2.3. Módulo 3: Recepción, seguimiento, cotización y entrega

Responsabilidad principal: gestionar la relación operativa con el cliente desde el ingreso de la máquina hasta la entrega o retiro sin reparar.

Capacidades requeridas:

- Registrar una recepción para cliente y máquina existentes.
- Crear cliente y/o máquina durante la recepción cuando no existan.
- Seleccionar el tipo de atención.
- Registrar accesorios, condición física, motivo de ingreso y observaciones.
- Generar la orden de atención y dejarla disponible para asignación técnica.
- Consultar el seguimiento de todas las órdenes de la sucursal.
- Revisar una cotización técnica.
- Permitir que el administrador ajuste precios autorizados y descuentos antes de contactar al cliente.
- Registrar el envío o comunicación de la cotización.
- Registrar la respuesta del cliente por teléfono o presencialmente.
- Registrar quién informó, quién respondió, fecha, canal y observaciones.
- Marcar la cotización como aprobada o rechazada.
- Coordinar retiro sin reparar cuando una cotización sea rechazada o el cliente desista.
- Registrar aviso de máquina lista.
- Registrar entrega, receptor, fecha y observaciones.
- Ejecutar el flujo especial de puesta en marcha sin tratarlo como reparación.

Datos de los que es responsable:

- Recepciones.
- Órdenes como expediente operativo.
- Historial de estados.
- Cotizaciones y sus revisiones comerciales.
- Respuestas del cliente sin cuenta digital.
- Avisos y entregas.
- Expediente de puesta en marcha.

Reglas principales:

- `RECEPCIONISTA` y `ADMIN` pueden registrar la respuesta comunicada por el cliente.
- Solo `ADMIN` puede autorizar cambios de precio o descuento.
- `TECNICO` crea la cotización borrador, pero no registra una aprobación en nombre del cliente.
- La entrega solo procede cuando la orden está lista para entrega o marcada para retiro sin reparar.
- Toda transición debe generar historial con usuario, fecha, estado anterior, estado nuevo y comentario.

### 2.4. Módulo 4: Inventario de repuestos por sucursal

Responsabilidad principal: mantener un catálogo global de repuestos y existencias, precios y movimientos independientes para cada sucursal.

Capacidades requeridas:

- Mantener un repuesto único y compartido en el catálogo general.
- Identificar el repuesto por código único, nombre, marca y descripción.
- Habilitar o deshabilitar el repuesto por sucursal.
- Mantener stock, precio de venta y umbral de stock bajo independientes por sucursal.
- Registrar entradas, ajustes, transferencias, reservas, consumos y devoluciones.
- Asociar cada movimiento con usuario, sucursal, fecha, cantidad, motivo y documento de referencia.
- Asociar consumos y devoluciones a una orden.
- Evitar stock negativo, salvo ajuste administrativo expresamente autorizado y auditado.
- Alertar cuando el stock disponible sea menor o igual al umbral configurado.
- Conservar el precio aplicado en la cotización y en el consumo, aunque el precio vigente del catálogo cambie después.

Datos de los que es responsable:

- Catálogo global de repuestos.
- Configuración por sucursal.
- Existencias por sucursal.
- Movimientos de inventario.
- Reservas, consumos y devoluciones asociados a órdenes.
- Alertas de stock bajo.

Reglas principales:

- `stock_actual` no se edita directamente durante la operación normal; se deriva o actualiza dentro de la misma transacción que crea un movimiento.
- Una salida usa cantidad negativa en el libro de movimientos o un tipo de movimiento que determine su signo de forma inequívoca.
- Una devolución no elimina el consumo original: crea un movimiento compensatorio relacionado.
- Una transferencia genera una salida en la sucursal de origen y una entrada en la sucursal de destino con una misma referencia.

## 3. Roles y alcance

### 3.1. MARCA

Rol de alcance global.

- Administra sucursales y sus administradores iniciales.
- Consulta indicadores consolidados de todas las sucursales.
- Mantiene catálogos globales de marcas, modelos y repuestos.
- Consulta trazabilidad global y estadísticas de garantía.
- No ejecuta diagnósticos, consumos, respuestas de clientes ni entregas operativas.

### 3.2. ADMIN

Rol administrador de una sucursal.

- Administra usuarios `RECEPCIONISTA` y `TECNICO` de su sucursal.
- Accede a todos los expedientes operativos de su sucursal.
- Reasigna órdenes y resuelve excepciones.
- Decide garantías cuando corresponda a la sucursal.
- Revisa precios, aplica descuentos y aprueba la versión comercial de una cotización.
- Registra respuestas y entregas si es necesario.
- Administra stock, precios, umbrales y ajustes de inventario de su sucursal.
- No puede operar datos de otra sucursal.

### 3.3. RECEPCIONISTA

Rol operativo de atención de una sucursal.

- Crea y actualiza clientes y máquinas necesarios para la atención.
- Registra recepciones y puestas en marcha.
- Consulta el seguimiento de las órdenes de su sucursal.
- Consulta la cotización revisada.
- Registra respuesta telefónica o presencial del cliente.
- Registra aviso, retiro sin reparar y entrega.
- Consulta disponibilidad y precio de repuestos, sin ajustar stock o precio.
- No realiza diagnóstico, decisión de garantía, descuento ni consumo técnico.

### 3.4. TECNICO

Rol técnico de una sucursal.

- Consulta órdenes técnicas de su sucursal.
- Toma una orden disponible.
- Registra inspección, diagnóstico, evidencias e informe técnico.
- Solicita revisión de garantía.
- Prepara cotización borrador.
- Registra reparación, consumo y devolución de repuestos asociados a su orden.
- Finaliza técnicamente la intervención.
- No ajusta precios comerciales, no aplica descuentos, no aprueba en nombre del cliente y no registra la entrega.

## 4. Flujo de recepción

### 4.1. Datos mínimos comunes

1. Identificar la sucursal desde el usuario autenticado.
2. Buscar o crear al cliente.
3. Buscar la máquina por número de serie o registrarla.
4. Registrar tipo de atención, motivo, condición de ingreso, accesorios, evidencias y observaciones.
5. Registrar al usuario receptor y la fecha/hora.
6. Crear la orden o expediente correspondiente.
7. Dejar la orden en estado `RECIBIDA`.

### 4.2. Tipos de atención permitidos

#### Revisión por garantía (`REVISION_GARANTIA`)

- Se revisa documento de compra y período de cobertura.
- La recepción no aprueba automáticamente la garantía.
- La orden pasa a inspección técnica y, si existen antecedentes suficientes, a evaluación de garantía.
- Una garantía rechazada puede transformarse en reparación pagada sin perder la trazabilidad original.

#### Reparación (`REPARACION`)

- Se registra una falla reportada.
- Requiere diagnóstico técnico.
- Si tiene costo para el cliente, requiere cotización aprobada antes de reparar.

#### Mantención (`MANTENCION`)

- Se registra el servicio preventivo solicitado.
- Puede requerir cotización según precios y repuestos.
- Conserva diagnóstico o pauta técnica, trabajo ejecutado y pruebas finales.

#### Puesta en marcha (`PUESTA_EN_MARCHA`)

- Se registra como atención técnica/documental distinta de una reparación.
- Debe seguir el flujo especial definido en la sección 8.
- No debe generar automáticamente diagnóstico de falla, cotización de reparación o consumo de repuestos.

## 5. Flujo técnico

1. **Lista de órdenes de la sucursal:** el técnico visualiza órdenes activas disponibles y propias. No ve órdenes de otras sucursales.
2. **Tomar orden:** una orden sin técnico se asigna al usuario autenticado mediante control de concurrencia. Pasa de `RECIBIDA` a `ASIGNADA`.
3. **Inspección:** se registra condición, accesorios verificados, evidencias y resultado inicial. Pasa a `EN_INSPECCION`.
4. **Diagnóstico:** se registra falla encontrada, causa probable, trabajo recomendado y mano de obra estimada. Pasa a `EN_DIAGNOSTICO`.
5. **Garantía:** si corresponde, se crea la solicitud y la orden queda `ESPERANDO_GARANTIA`. Si se aprueba, puede avanzar a reparación cubierta. Si se rechaza y el cliente debe pagar, avanza a cotización.
6. **Cotización:** el técnico selecciona repuestos propuestos, cantidades y mano de obra, y crea una cotización `BORRADOR`.
7. **Reparación:** solo comienza con garantía aprobada o cotización aprobada. La orden pasa a `EN_REPARACION`; los consumos afectan inventario mediante movimientos.
8. **Finalización:** el técnico registra informe, pruebas, resultado y evidencias. La orden pasa a `FINALIZADA_TECNICO` y luego recepción la deja `LISTA_PARA_ENTREGA` cuando corresponda.

## 6. Flujo de aprobación de cotización

1. El técnico crea una cotización en estado `BORRADOR`.
2. La envía a revisión y queda `EN_REVISION_ADMIN`.
3. El administrador valida repuestos, mano de obra, precios, impuestos y descuentos.
4. Si requiere corrección técnica, queda `OBSERVADA` y vuelve al técnico.
5. Cuando la versión comercial queda aprobada, pasa a `PENDIENTE_RESPUESTA`.
6. El recepcionista o administrador contacta al cliente por teléfono o lo atiende presencialmente.
7. Se registra obligatoriamente:
   - Canal `TELEFONO` o `PRESENCIAL`.
   - Nombre de la persona que responde.
   - Usuario que registró la respuesta.
   - Fecha y hora.
   - Observación.
   - Versión y total de la cotización aceptada o rechazada.
8. Si la respuesta es positiva, la cotización queda `APROBADA` y la orden `AUTORIZADA`.
9. Si la respuesta es negativa, la cotización queda `RECHAZADA` y la orden `RECHAZADA_POR_CLIENTE`.
10. Cuando no se reparará, recepción coordina el retiro y la orden termina en `RETIRO_SIN_REPARAR` después de registrar la entrega física.

Reglas de precio y descuento:

- La cotización debe conservar precio unitario, subtotal y total de la versión respondida.
- El descuento puede ser porcentual o de monto fijo, pero no ambos en la misma línea o total sin una regla explícita.
- Todo descuento requiere usuario `ADMIN`, motivo, fecha y valor anterior/nuevo.
- Una cotización respondida no se sobrescribe. Un cambio posterior crea una nueva versión y requiere nueva respuesta.

## 7. Flujo de inventario

1. `MARCA` crea o mantiene el repuesto en el catálogo global.
2. `ADMIN` habilita el repuesto para su sucursal y define precio, stock mínimo y estado.
3. El stock inicial o una compra se registra como movimiento `ENTRADA`.
4. Un ajuste autorizado se registra como `AJUSTE_POSITIVO` o `AJUSTE_NEGATIVO` con motivo.
5. Cuando una cotización se aprueba, opcionalmente se crea una `RESERVA` para la orden.
6. Al usar el repuesto en una reparación se registra `CONSUMO_REPARACION` y se reduce stock disponible.
7. Si un repuesto reservado no se utiliza, se registra `LIBERACION_RESERVA`.
8. Si un repuesto consumido retorna en condición reutilizable, se registra `DEVOLUCION_REPARACION`, vinculada al consumo original.
9. Una transferencia registra `TRANSFERENCIA_SALIDA` y `TRANSFERENCIA_ENTRADA` con una referencia compartida.
10. Después de cada movimiento se evalúa el umbral. Si `stock_disponible <= stock_minimo`, se genera o actualiza una alerta de stock bajo.

Tipos mínimos de movimiento:

- `ENTRADA`
- `AJUSTE_POSITIVO`
- `AJUSTE_NEGATIVO`
- `RESERVA`
- `LIBERACION_RESERVA`
- `CONSUMO_REPARACION`
- `DEVOLUCION_REPARACION`
- `TRANSFERENCIA_SALIDA`
- `TRANSFERENCIA_ENTRADA`

## 8. Puesta en marcha

La puesta en marcha acredita la entrega inicial, configuración, prueba y activación de garantía de una máquina. No corresponde a una reparación.

Flujo requerido:

1. Seleccionar un cliente existente o crear uno nuevo.
2. Buscar la máquina serializada o registrarla con número de serie único.
3. Registrar marca, modelo, tipo y sucursal.
4. Registrar documento `BOLETA` o `FACTURA`, número, fecha y, cuando corresponda, emisor.
5. Registrar fecha de puesta en marcha.
6. Calcular o registrar inicio y término de garantía.
7. Registrar lista de comprobaciones, configuración inicial, resultado y evidencias.
8. Registrar técnico responsable y conformidad del receptor.
9. Finalizar la atención sin diagnóstico de falla ni cotización de reparación.

Reglas:

- El tipo de atención es `PUESTA_EN_MARCHA`.
- Puede utilizar el expediente de orden para seguimiento, pero debe tener un subtipo y datos propios.
- No debe crear automáticamente cotización.
- No debe figurar en indicadores de máquinas reparadas.
- Si durante la puesta en marcha se detecta una falla, se cierra o suspende el expediente y se crea una orden separada de `REVISION_GARANTIA` o `REPARACION`, vinculada a la puesta en marcha.

## 9. Matriz de permisos por rol

Leyenda: `G` gestión, `E` ejecución/registro, `C` consulta, `-` sin permiso. Todo permiso de `ADMIN`, `RECEPCIONISTA` y `TECNICO` está limitado a su sucursal.

| Capacidad | MARCA | ADMIN | RECEPCIONISTA | TECNICO |
|---|:---:|:---:|:---:|:---:|
| Gestionar sucursales | G | C | - | - |
| Gestionar usuarios de sucursal | C | G | - | - |
| Consultar clientes y máquinas | C global | G | G | C |
| Crear/actualizar cliente | - | G | G | - |
| Registrar/actualizar máquina | C | G | G | C |
| Consultar trazabilidad | C global | C | C | C |
| Registrar recepción | - | E | E | - |
| Registrar puesta en marcha | C | E | E | E técnica |
| Consultar órdenes de sucursal | C global resumida | C | C | C |
| Asignar/reasignar técnico | - | G | - | E: tomar propia |
| Inspección y diagnóstico | - | C/G excepción | C | E |
| Solicitar garantía | C | E | C | E |
| Aprobar/rechazar garantía | C | G | C | C |
| Crear cotización borrador | - | E | C | E |
| Revisar precios/descuentos | - | G | C | - |
| Registrar respuesta del cliente | - | E | E | - |
| Ejecutar reparación/mantención | - | C/G excepción | C | E |
| Finalizar trabajo técnico | - | G excepción | C | E |
| Registrar aviso y entrega | - | E | E | - |
| Gestionar catálogo global de repuestos | G | C | C | C |
| Gestionar precio/umbral de sucursal | C | G | C | C |
| Registrar entradas y ajustes | C | G | - | - |
| Reservar/consumir/devolver por orden | C | G | C | E |
| Consultar movimientos y alertas | C global | C | C | C |

Notas:

- Las acciones excepcionales de `ADMIN` deben dejar auditoría y motivo.
- `MARCA` posee consulta global, pero no debe alterar el trabajo operativo de una sucursal salvo administración de catálogos y sucursales.
- `RECEPCIONISTA` puede editar datos de contacto y recepción, pero no antecedentes técnicos cerrados.

## 10. Estados permitidos

### 10.1. Estados de orden

| Estado | Significado | Transiciones habituales |
|---|---|---|
| `RECIBIDA` | Expediente creado por recepción | `ASIGNADA`, `CANCELADA` |
| `ASIGNADA` | Técnico asignado o la tomó | `EN_INSPECCION`, `CANCELADA` |
| `EN_INSPECCION` | Inspección inicial en curso | `EN_DIAGNOSTICO`, `EN_PUESTA_EN_MARCHA`, `CANCELADA` |
| `EN_DIAGNOSTICO` | Diagnóstico técnico en curso | `ESPERANDO_GARANTIA`, `ESPERANDO_COTIZACION`, `EN_REPARACION` |
| `ESPERANDO_GARANTIA` | Solicitud de garantía pendiente | `EN_REPARACION`, `ESPERANDO_COTIZACION`, `CANCELADA` |
| `ESPERANDO_COTIZACION` | Cotización técnica/comercial en preparación | `ESPERANDO_APROBACION`, `CANCELADA` |
| `ESPERANDO_APROBACION` | Espera respuesta del cliente | `AUTORIZADA`, `RECHAZADA_POR_CLIENTE`, `CANCELADA` |
| `AUTORIZADA` | Cliente aprobó la versión vigente | `EN_REPARACION`, `CANCELADA` |
| `EN_REPARACION` | Reparación o mantención en ejecución | `FINALIZADA_TECNICO`, `ESPERANDO_COTIZACION` |
| `EN_PUESTA_EN_MARCHA` | Puesta en marcha en ejecución | `FINALIZADA_TECNICO`, `CANCELADA` |
| `FINALIZADA_TECNICO` | Trabajo técnico y pruebas terminados | `LISTA_PARA_ENTREGA` |
| `LISTA_PARA_ENTREGA` | Recepción puede entregar | `ENTREGADA` |
| `RECHAZADA_POR_CLIENTE` | Cliente rechazó la cotización | `RETIRO_SIN_REPARAR`, `ESPERANDO_COTIZACION` |
| `RETIRO_SIN_REPARAR` | Máquina devuelta sin reparación | Estado terminal |
| `ENTREGADA` | Máquina entregada después del servicio | Estado terminal |
| `CANCELADA` | Expediente anulado con motivo | Estado terminal |

Reglas:

- No se aceptan estados arbitrarios.
- Las transiciones deben validarse en backend mediante una tabla o mapa explícito.
- Toda transición genera historial.
- `RETIRO_SIN_REPARAR`, `ENTREGADA` y `CANCELADA` son terminales; su reapertura requiere una operación administrativa auditada o una orden nueva.
- El estado de garantía y el estado de cotización se mantienen en sus propias entidades; la orden solo refleja la etapa operativa.

### 10.2. Estados de cotización

| Estado | Responsable principal | Descripción |
|---|---|---|
| `BORRADOR` | TECNICO | Propuesta editable de repuestos y mano de obra |
| `EN_REVISION_ADMIN` | ADMIN | Espera validación comercial |
| `OBSERVADA` | ADMIN/TECNICO | Requiere corrección antes de contactar al cliente |
| `PENDIENTE_RESPUESTA` | RECEPCIONISTA/ADMIN | Versión cerrada comunicada al cliente |
| `APROBADA` | RECEPCIONISTA/ADMIN registra | Cliente autorizó la versión vigente |
| `RECHAZADA` | RECEPCIONISTA/ADMIN registra | Cliente rechazó la versión vigente |
| `ANULADA` | ADMIN | Versión invalidada con motivo |
| `VENCIDA` | Sistema/ADMIN | Plazo de vigencia superado sin respuesta |

Transiciones principales:

- `BORRADOR -> EN_REVISION_ADMIN`
- `EN_REVISION_ADMIN -> OBSERVADA`
- `OBSERVADA -> BORRADOR`
- `EN_REVISION_ADMIN -> PENDIENTE_RESPUESTA`
- `PENDIENTE_RESPUESTA -> APROBADA`
- `PENDIENTE_RESPUESTA -> RECHAZADA`
- `PENDIENTE_RESPUESTA -> VENCIDA`
- Cualquier estado no terminal puede pasar a `ANULADA` por un `ADMIN`, con motivo.

Estados mínimos de garantía, aunque no sustituyen al estado de orden:

- `PENDIENTE`
- `EN_REVISION`
- `APROBADA`
- `RECHAZADA`
- `ANULADA`

## 11. Migraciones SQL necesarias

Las migraciones propuestas son incrementales y deben ejecutarse en orden. Los nombres son referenciales.

### `001_roles_evaluacion4.sql`

- Insertar el rol `RECEPCIONISTA` de forma idempotente.
- Mantener temporalmente `CLIENTE` para compatibilidad, pero excluirlo de los nuevos permisos y flujos.
- Añadir restricciones o catálogo de roles válido si no se adopta una tabla como fuente única.

### `002_usuarios_auditoria.sql`

- Añadir campos de actualización, último acceso y usuario que crea/modifica cuando sean necesarios.
- Crear índices por rol, sucursal y estado.
- Garantizar que `ADMIN`, `RECEPCIONISTA` y `TECNICO` tengan sucursal asignada.

### `003_maquinas_documentos_garantia.sql`

- Ampliar `productos` o renombrarlo gradualmente a `maquinas` mediante vista de compatibilidad.
- Añadir tipo y número de documento, fecha de compra, inicio y término de garantía.
- Añadir validaciones de fechas y documento.
- Conservar unicidad case-insensitive del número de serie.

### `004_historial_propiedad_trazabilidad.sql`

- Crear historial de propiedad de máquina.
- Registrar cliente anterior/nuevo, fecha, motivo y usuario.
- Crear vista o consulta de trazabilidad consolidada.

### `005_recepciones_ordenes.sql`

- Crear tabla `recepciones` o añadir a la orden un identificador de recepción.
- Añadir receptor, condición de ingreso, accesorios, evidencias y observaciones.
- Normalizar tipos de atención a `REVISION_GARANTIA`, `REPARACION`, `MANTENCION` y `PUESTA_EN_MARCHA`.
- Migrar `GARANTIA` actual a `REVISION_GARANTIA` y `MANTENIMIENTO` a `MANTENCION`.

### `006_estados_historial_orden.sql`

- Crear catálogo o restricción `CHECK` para estados de orden.
- Migrar estados históricos actuales a los estados canónicos.
- Crear `historial_estados_orden` con estado anterior/nuevo, usuario, fecha y comentario.
- Añadir versión o mecanismo de concurrencia optimista.

### `007_asignacion_inspeccion_tecnica.sql`

- Añadir fecha de asignación, fecha en que el técnico toma la orden y técnico responsable.
- Crear `inspecciones_orden` para condición, resultado y evidencia.
- Añadir restricción que impida toma simultánea de una misma orden.

### `008_garantias_normalizadas.sql`

- Normalizar estados de garantía.
- Añadir tipo de cobertura, motivo, decisor, fecha de decisión y antecedentes.
- Eliminar gradualmente la duplicación entre `ordenes_servicio.garantia_aprobada_por_admin` y `garantias.estado`, conservando una sola fuente de verdad.
- Mantener trazabilidad de decisiones anteriores.

### `009_cotizaciones_versiones_descuentos.sql`

- Añadir número de versión y vigencia.
- Añadir subtotal, impuesto si corresponde, tipo/valor de descuento, total anterior y total final.
- Añadir revisor administrador, fecha de revisión y motivo de observación/descuento.
- Normalizar estados de cotización.
- Evitar sobrescribir una versión que ya fue comunicada o respondida.

### `010_respuestas_cotizacion.sql`

- Crear `respuestas_cotizacion`.
- Registrar cotización/versión, respuesta, canal `TELEFONO` o `PRESENCIAL`, persona que responde, usuario que registra, fecha y observación.
- Restringir una respuesta vigente por versión o mantener historial con una marca de vigencia.

### `011_entregas_retiros.sql`

- Crear `entregas_orden`.
- Registrar tipo `ENTREGA_REPARADA` o `RETIRO_SIN_REPARAR`, receptor, documento opcional, usuario, fecha y observación.
- Impedir entrega en estados no habilitados.

### `012_repuestos_catalogo_global.sql`

- Separar el catálogo global de la configuración por sucursal.
- Crear `repuestos_catalogo` con código único, nombre, marca, descripción y estado global.
- Crear `repuestos_sucursal` con repuesto, sucursal, precio, stock actual, stock reservado, stock mínimo y estado.
- Migrar y deduplicar los registros actuales de `repuestos` por código.

### `013_movimientos_inventario.sql`

- Crear `movimientos_inventario` con tipo, sucursal, repuesto, cantidad, stock anterior/nuevo, usuario, motivo, orden y referencia de transferencia.
- Añadir restricciones de cantidad y tipos permitidos.
- Crear índices por sucursal, repuesto, orden y fecha.
- Implementar actualización transaccional de existencias.

### `014_consumos_devoluciones_orden.sql`

- Adaptar `repuestos_usados` para referenciar `repuestos_sucursal` o el catálogo y la sucursal.
- Añadir movimiento de consumo, movimiento de devolución y consumo original.
- Conservar precio unitario histórico y cobertura por garantía.
- Migrar consumos existentes sin alterar sus totales históricos.

### `015_alertas_stock.sql`

- Crear `alertas_stock` o una vista materializada/consulta equivalente.
- Registrar apertura, última detección, resolución y usuario que resuelve.
- Evitar alertas activas duplicadas para el mismo repuesto y sucursal.

### `016_puestas_en_marcha.sql`

- Crear `puestas_en_marcha` asociada a orden, cliente y máquina.
- Añadir documento de compra, fechas de garantía, técnico, pauta de comprobación, resultado, conformidad y evidencias.
- Añadir vínculo opcional a una orden posterior de garantía o reparación.
- Asegurar que no cree una cotización automáticamente.

### `017_integridad_indices_auditoria.sql`

- Añadir claves foráneas, índices y restricciones faltantes.
- Añadir campos `created_at`, `updated_at`, `created_by` y `updated_by` donde aporten trazabilidad.
- Revisar políticas de borrado: preferir estados inactivos y conservar historial operativo.
- Preparar vistas de compatibilidad para que el frontend y backend actuales puedan migrarse gradualmente.

## 12. Contradicciones y brechas detectadas en el código actual

1. **Roles:** la base y el frontend actuales usan `CLIENTE`, pero no existe `RECEPCIONISTA`. Evaluación 4 excluye temporalmente la cuenta `CLIENTE` e incorpora `RECEPCIONISTA`.
2. **Instrucciones heredadas:** `AGENTS.md` corresponde a Evaluación 3 y exige `CLIENTE`; esta especificación de Evaluación 4 cambia el alcance funcional sin recomendar todavía borrar el rol existente.
3. **Tipos de atención:** el backend acepta `GARANTIA`, `REPARACION`, `MANTENCION`, `MANTENIMIENTO` y `PUESTA_EN_MARCHA`. El contrato objetivo usa `REVISION_GARANTIA`, `REPARACION`, `MANTENCION` y `PUESTA_EN_MARCHA`.
4. **Estados de orden:** el endpoint actual acepta cualquier texto no vacío. Los datos de ejemplo mezclan `PENDIENTE`, `EN_DIAGNOSTICO`, `REPARADA` y `CERRADA`; no existe una máquina de estados ni historial de transiciones.
5. **Toma de orden:** actualmente una orden se crea con técnico opcional, pero no existe una operación atómica para que un técnico tome una orden disponible.
6. **Alcance técnico:** `ADMIN` y `TECNICO` pueden listar órdenes de su sucursal, pero no se diferencia claramente entre órdenes disponibles, propias y asignadas a otros técnicos.
7. **Cotización:** los estados actuales son `BORRADOR`, `ENVIADA`, `APROBADA` y `RECHAZADA`. No existen revisión administrativa, observaciones, versiones, vigencia ni estados de espera definidos en esta especificación.
8. **Descuentos y respuesta:** no existen campos para descuentos, revisor, canal telefónico/presencial, persona que responde o usuario que registra la respuesta.
9. **Aprobación:** hoy `ADMIN` o `TECNICO` puede guardar una cotización con estado `APROBADA` o `RECHAZADA`; esto contradice la separación objetivo entre borrador técnico, revisión administrativa y respuesta registrada por recepción/administración.
10. **Garantías duplicadas:** la decisión se guarda tanto en `ordenes_servicio.garantia_aprobada_por_admin` como en `garantias.estado`, con dos rutas de actualización. Debe existir una sola fuente de verdad.
11. **Inventario:** `repuestos` contiene catálogo, sucursal, stock y precio en la misma fila. Por ello el mismo repuesto se duplica entre sucursales en vez de compartir un catálogo global.
12. **Movimientos:** no existe libro de movimientos, reserva, transferencia, devolución ni alerta de stock bajo.
13. **Consumo:** agregar un repuesto usado a una orden no reduce el stock actual ni crea un movimiento de inventario.
14. **Puesta en marcha:** el tipo está permitido, pero usa el mismo alta de orden y la misma creación automática de cotización que una reparación. No existen documento de compra, fechas de garantía, pauta ni cierre especializado.
15. **Máquinas:** `productos` posee `estado_garantia`, pero no boleta/factura ni fechas de inicio y término de garantía.
16. **Entrega:** no hay entidad ni flujo auditable de aviso, entrega o retiro sin reparar.
17. **Arquitectura:** recepción, trabajo técnico, cotización, garantía, evidencias y consumo de repuestos están concentrados principalmente en `ordenes.routes.js`; los cuatro módulos todavía no tienen límites técnicos independientes.

## 13. Criterios de aceptación documental

La implementación futura se considerará alineada con esta base cuando:

- Los cuatro módulos tengan responsabilidades identificables y contratos claros.
- Los cuatro roles estén respaldados por autorización en backend y aislamiento por sucursal.
- No exista dependencia funcional de una cuenta `CLIENTE` para aprobar una cotización.
- Los estados y transiciones estén validados y auditados.
- Las cotizaciones tengan revisión, versión y respuesta trazable.
- El inventario utilice catálogo global, existencias por sucursal y movimientos.
- La puesta en marcha tenga datos y flujo propios y no compute como reparación.
- Las migraciones preserven los datos existentes y permitan transición gradual.

