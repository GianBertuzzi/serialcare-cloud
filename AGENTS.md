# SerialCare Cloud - Instrucciones para Codex

## Contexto del proyecto

SerialCare Cloud se encuentra en la Evaluación 4 de Arquitectura Multicloud y DevSecOps. Es una aplicación web para trazabilidad, garantía y servicio técnico de máquinas serializadas.

Los cuatro módulos funcionales definitivos son:

1. Clientes, máquinas e historial.
2. Recepción, cotización y entrega.
3. Diagnóstico, reparación y garantías.
4. Repuestos, inventario y documentos.

La especificación funcional de referencia está en docs/EVALUACION_4_REQUERIMIENTOS.md. Antes de implementar cambios funcionales, revisar ese documento y contrastarlo con el código existente.

## Tecnologías y arquitectura vigentes

- Frontend: React + Vite.
- Backend: Node.js + Express.
- Base de datos: PostgreSQL.
- Contenedores: Docker.
- Arquitectura multicloud: infraestructura principal en AWS y almacenamiento documental en Azure Blob Storage.
- Sesión con JWT y contraseñas con bcrypt.
- Mantener frontend y backend separados.
- El backend debe validar autenticación, rol, sucursal y propiedad de los recursos. Ocultar controles en el frontend no constituye autorización.
- El producto se implementa inicialmente para un solo negocio de servicio técnico y no expone administración multisucursal.
- Mantener `id_sucursal` y sus relaciones internas por compatibilidad, utilizando una sucursal predeterminada hasta una migración futura explícita.
- No usar imágenes Docker con etiqueta latest.
- Conservar tags específicos: node:20-alpine, nginx:1.27-alpine y postgres:16-alpine.
- No versionar archivos .env reales. Mantener .env.example sin secretos reales.

## Roles activos

Los roles activos para Evaluación 4 son ADMIN, RECEPCIONISTA y TECNICO.

El rol MARCA queda fuera del alcance funcional. No crear nuevas capacidades, rutas ni vistas para MARCA.

La cuenta CLIENTE y su inicio de sesión quedan congelados en esta etapa.

- No crear nuevas funciones, rutas, permisos, componentes ni vistas para CLIENTE.
- No eliminar todavía código existente de CLIENTE si hacerlo puede romper funcionalidades actuales.
- La entidad comercial cliente continúa existiendo y no implica una cuenta de acceso.
- Cualquier retiro gradual del rol CLIENTE debe ser explícito, compatible y verificado.

## Reglas funcionales principales

- ADMIN y RECEPCIONISTA pueden registrar el ingreso inicial de una máquina.
- TECNICO no crea el ingreso inicial.
- TECNICO selecciona o toma una orden pendiente mediante una operación segura frente a concurrencia.
- RECEPCIONISTA consulta estados, cotizaciones, documentos y entregas.
- RECEPCIONISTA no modifica diagnósticos, repuestos, precios ni descuentos.
- ADMIN puede revisar precios y autorizar descuentos, dejando trazabilidad.
- ADMIN puede ejecutar las mismas acciones técnicas que TECNICO, además de sus facultades administrativas.
- RECEPCIONISTA puede crear clientes y máquinas cuando no existan, pero no editar clientes existentes.
- Los usuarios no seleccionan libremente el estado de una orden; las acciones autorizadas ejecutan transiciones automáticas.
- La sucursal predeterminada se obtiene del usuario autenticado o de configuración confiable del backend, nunca de un valor libre enviado por el frontend.
- No mostrar ni administrar múltiples sucursales en esta etapa.
- No implementar POS, caja, carrito, venta directa ni facturación de venta en esta evaluación.
- No inventar estados, permisos o transiciones fuera de docs/EVALUACION_4_REQUERIMIENTOS.md sin documentar primero el cambio de alcance.

## Reglas visuales

- Usar Bootstrap 5.3.3, que ya está instalado e importado globalmente.
- Reutilizar componentes y clases Bootstrap existentes antes de escribir CSS personalizado.
- Mantener una interfaz limpia, moderna, ordenada, accesible y responsive.
- Usar cards, tables, badges, alerts, modals, navbars y formularios Bootstrap.
- Mantener el mismo lenguaje visual, espaciado, jerarquía, estados y patrones de interacción en ADMIN, TECNICO y RECEPCIONISTA.
- Reutilizar los componentes visuales existentes antes de crear uno nuevo.
- No instalar Material UI, Tailwind CSS ni otro framework visual.
- No crear hojas CSS grandes para reemplazar funciones disponibles en Bootstrap.
- Evitar estilos inline.
- Limitar el CSS personalizado a ajustes realmente necesarios.
- No duplicar estilos con nombres diferentes para producir el mismo resultado.
- Antes de añadir una clase personalizada, buscar una equivalente en frontend/src/styles.css o Bootstrap.

## Reglas contra código duplicado y código basura

- Inspeccionar los archivos existentes antes de crear uno nuevo.
- Reutilizar componentes, hooks, funciones, middlewares, validadores y servicios existentes.
- Antes de duplicar lógica, evaluar si corresponde ampliar de forma segura una pieza existente.
- No crear copias como ComponenteNuevo, ComponenteFinal, ComponenteV2, Copia, Backup, Old o similares.
- No dejar código comentado que ya no se utilice. El historial pertenece a Git.
- No dejar imports, variables, funciones, componentes, estilos, endpoints ni rutas sin uso.
- No agregar datos mock, credenciales demo nuevas ni valores temporales al código productivo.
- No agregar un TODO sin explicar por qué es necesario, qué falta y cuándo puede resolverse.
- No crear abstracciones innecesarias para funciones utilizadas una sola vez.
- No fragmentar componentes pequeños sin una razón de reutilización, legibilidad o prueba.
- No reescribir archivos completos cuando basta un cambio pequeño.
- No eliminar código sin buscar sus importaciones, rutas, llamadas y dependencias.
- No mezclar una limpieza general con una implementación funcional.
- Cada tarea debe modificar solamente los archivos necesarios.
- Conservar compatibilidad con el sistema existente durante las migraciones.
- No cambiar contratos de API, campos, estados o permisos de forma silenciosa.
- Verificar antes de consolidar lógica aparentemente duplicada con reglas distintas por rol o sucursal.
- No añadir dependencias si las existentes ya resuelven la necesidad.

## Procedimiento obligatorio para cada tarea de Codex

### Antes de modificar

- Leer las instrucciones y los archivos directamente relacionados.
- Explicar brevemente qué archivos se modificarán y por qué.
- Buscar código existente que pueda reutilizarse.
- Revisar git status --short y preservar cambios del usuario no relacionados.
- Identificar contratos, rutas, componentes y pruebas que puedan verse afectados.
- Informar antes de implementar una decisión que cambie el alcance documentado.

### Durante la modificación

- Mantener el cambio acotado al objetivo.
- Preferir cambios incrementales y revisables.
- No hacer limpiezas no solicitadas.
- Mantener autorización del backend y aislamiento por sucursal.
- Usar transacciones cuando varias escrituras deban conservar consistencia.

### Después de modificar

- Ejecutar las validaciones disponibles y proporcionales al cambio.
- Ejecutar npm run build en frontend cuando cambie React, JavaScript del frontend, estilos o configuración de Vite.
- Ejecutar npm test en backend cuando cambie código backend.
- Comprobar que no existan imports, variables, funciones, estilos o rutas sin utilizar.
- Revisar el diff y confirmar que solo contenga cambios necesarios.
- Mostrar un resumen de archivos modificados.
- Indicar qué código fue eliminado y por qué; si no se eliminó, indicarlo.
- Informar cualquier funcionalidad anterior que pueda verse afectada.
- Informar las validaciones no ejecutadas y el motivo.
- No realizar commit, push ni abrir pull request salvo solicitud expresa.

## Base de datos y migraciones

- No utilizar DROP TABLE para nuevas modificaciones.
- No usar el esquema destructivo inicial como sustituto de una migración.
- Crear migraciones SQL incrementales, ordenadas e idempotentes cuando sea razonable.
- No borrar ni sobrescribir datos existentes.
- Mantener compatibilidad con los datos y contratos actuales durante la transición.
- Usar transacciones para operaciones relacionadas con órdenes, cotizaciones, stock y movimientos.
- Mantener claves foráneas, índices, restricciones y auditoría consistentes.
- No permitir stock negativo sin una regla explícita, autorización y movimiento auditable.
- No guardar una decisión de negocio en varias tablas como fuentes de verdad independientes.
- Antes de renombrar o eliminar una columna, buscar todos sus consumidores.
- Seguir el plan de docs/EVALUACION_4_REQUERIMIENTOS.md o documentar cualquier desviación.

## Seguridad y DevSecOps

- No introducir secretos, tokens, contraseñas reales ni cadenas de conexión en archivos versionados.
- Mantener dependencias bloqueadas mediante los archivos lock.
- No desactivar SAST, SCA, Secret Scanning o IaC Scanning para hacer pasar un pipeline.
- Corregir hallazgos en la causa raíz o documentar una excepción acotada.
- Validar entradas en backend y usar consultas parametrizadas.
- Aplicar mínimo privilegio por rol y sucursal.
- No confiar en rol, precio, descuento, stock o sucursal enviados por el frontend sin validarlos en backend.

## Criterio general

El código debe ser simple, funcional, consistente y defendible en una evaluación académica. La prioridad es extender el sistema existente con cambios pequeños, trazables y verificables, evitando duplicación, deuda accidental y diseños visuales o funcionales incompatibles.
