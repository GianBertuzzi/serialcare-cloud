# Pipeline DevSecOps de Evaluacion 4

## Objetivo

El workflow `.github/workflows/devsecops.yml` valida los cuatro modulos desplegables de SerialCare Cloud sin publicar imagenes, ejecutar migraciones ni desplegar infraestructura:

1. `clientes-maquinas`.
2. `recepcion-cotizaciones`.
3. `diagnostico-garantias`.
4. `inventario-documentos`.

Se ejecuta en los push hacia `main` y `evaluacion-4-devsecops`, en pull requests cuyo destino sea `main` y manualmente mediante `workflow_dispatch`.

## Fases y herramientas

| Fase | Herramienta | Alcance | Politica de fallo |
|---|---|---|---|
| Calidad por modulo | Node.js 22, `npm ci`, `node --check`, `npm test` | Dependencias backend y server de cada modulo | Cualquier error bloquea |
| Build por modulo | Docker | Dockerfile independiente de cada modulo | Cualquier build fallido bloquea |
| SAST | Semgrep CE 1.164.0, reglas publicas `p/ci` | `backend/src` | Bloquea hallazgos con severidad `ERROR`; `INFO` y `WARNING` quedan en el reporte |
| SCA npm | `npm audit --audit-level=high` | `backend/package-lock.json` y dependencias instaladas | Bloquea vulnerabilidades HIGH o CRITICAL |
| SCA filesystem | Trivy 0.70.0 | Lockfiles y dependencias detectables dentro de `backend` | Bloquea vulnerabilidades HIGH o CRITICAL |
| Secret Scanning | Gitleaks 8.30.1 | Historial Git completo y contenido actual | Cualquier secreto no permitido bloquea |
| IaC Scanning | Trivy `config` | Compose Eval 4, cuatro Dockerfiles backend, Dockerfile frontend y CloudFormation | Bloquea configuraciones HIGH o CRITICAL |
| Imagenes | Trivy `image` | Imagen construida de cada modulo | Bloquea vulnerabilidades HIGH o CRITICAL |

Semgrep usa reglas comunitarias publicas y no necesita token. Trivy se descarga desde su release oficial, se fija en la version `0.70.0` y el workflow valida el SHA-256 antes de ejecutarlo. Gitleaks usa la imagen oficial `v8.30.1` fijada tambien por digest.

## Matriz de modulos

| Modulo | Dockerfile | Punto de entrada | Imagen CI |
|---|---|---|---|
| clientes-maquinas | `backend/services/clientes-maquinas/Dockerfile` | `backend/src/apps/clientesMaquinas.server.js` | `serialcare-eval4-clientes-maquinas` |
| recepcion-cotizaciones | `backend/services/recepcion-cotizaciones/Dockerfile` | `backend/src/apps/recepcionCotizaciones.server.js` | `serialcare-eval4-recepcion-cotizaciones` |
| diagnostico-garantias | `backend/services/diagnostico-garantias/Dockerfile` | `backend/src/apps/diagnosticoGarantias.server.js` | `serialcare-eval4-diagnostico-garantias` |
| inventario-documentos | `backend/services/inventario-documentos/Dockerfile` | `backend/src/apps/inventarioDocumentos.server.js` | `serialcare-eval4-inventario-documentos` |

La estrategia tiene `fail-fast: false`: si un modulo falla, las otras tres ejecuciones terminan y conservan sus propios resultados. El job `summary` recopila los cuatro estados y falla cuando cualquier control obligatorio no termina correctamente.

## Artefactos

Los reportes se conservan durante siete dias:

- `sast-report`: salida JSON completa de Semgrep.
- `sca-report`: JSON de `npm audit` y Trivy filesystem.
- `secret-scan-report`: SARIF del historial y del contenido actual generado por Gitleaks.
- `iac-report`: JSON de Trivy config.
- `image-scan-clientes-maquinas`.
- `image-scan-recepcion-cotizaciones`.
- `image-scan-diagnostico-garantias`.
- `image-scan-inventario-documentos`.

Los reportes se suben antes de aplicar la politica de bloqueo. Por ello siguen disponibles cuando un escaneo encuentra una vulnerabilidad real.

## Valores locales de ejemplo

`security/gitleaks.toml` extiende las reglas oficiales y permite exclusivamente valores demostrativos conocidos, como `serialcare_pass`, `cambiar_este_secreto`, `Admin123` y `Tecnico123`. No se excluyen archivos ni directorios completos. Un secreto real con otro valor sigue bloqueando el workflow.

## Ejecucion manual

1. Abrir **Actions** en GitHub.
2. Seleccionar **DevSecOps Evaluacion 4**.
3. Presionar **Run workflow**.
4. Elegir la rama y confirmar.

El workflow no requiere secrets de GitHub y solo tiene permiso `contents: read`.

## Interpretacion de fallos

- **Modulo / nombre**: revisar `npm ci`, `node --check`, pruebas, build o el artefacto `image-scan-*` de ese modulo.
- **SAST / Semgrep**: revisar reglas y ubicaciones en `sast-report`; corregir el patron vulnerable, no desactivar la regla globalmente.
- **SCA**: actualizar o reemplazar la dependencia que aparece en `npm-audit.json` o `trivy-filesystem.json`.
- **Secret Scanning**: revocar el secreto si fuera real, retirarlo del repositorio y sanear el historial cuando corresponda. Una excepcion debe ser exacta y justificable.
- **IaC**: corregir la configuracion insegura en Docker, Compose o CloudFormation. No se mantienen listas amplias de omisiones.
- **Summary**: indica que uno o mas controles anteriores fallaron; no reemplaza el reporte detallado.

Que una vulnerabilidad no tenga correccion disponible no la convierte automaticamente en aceptable. Cualquier excepcion futura debe documentar riesgo, alcance, responsable y plazo.

## Excepciones IaC acotadas para AWS Academy

La plantilla corrige todos los controles HIGH y CRITICAL implementables: RDS y EBS cifrados, IMDSv2 obligatorio, instancias de aplicacion y base de datos sin IP publica, PostgreSQL privado, grupos de seguridad con puertos minimos y contenedores sin privilegios adicionales. No existe una lista global de omisiones. Las unicas supresiones se declaran junto al recurso o propiedad exactos mediante `#trivy:ignore:<ID>`:

| Control | Recurso o propiedad | Justificacion academica | Condicion para retirarla |
|---|---|---|---|
| `AVD-AWS-0053` | `SerialCareLoadBalancer` | El laboratorio requiere un unico punto de entrada accesible para la demostracion y AWS Academy no entrega conectividad privada al equipo del evaluador. Las instancias de aplicacion y RDS permanecen en subredes privadas. | Disponer de acceso privado administrado o de un perimetro publico alternativo aprobado. |
| `AVD-AWS-0054` | `SerialCareHttpListener` | No hay dominio ni certificado ACM configurado. Inventar un ARN produciria un despliegue roto; HTTP se limita a datos demostrativos del laboratorio. | Disponer de dominio y certificado ACM validado; entonces reemplazar el listener por HTTPS y redirigir HTTP. |
| `AVD-AWS-0104` | `AppSecurityGroup.SecurityGroupEgress` TCP 443 | La aplicacion necesita Azure Blob y repositorios de contenedores con destinos dinamicos; AWS Academy no ofrece un punto de egreso administrado reutilizable. PostgreSQL usa una regla separada dirigida exclusivamente al Security Group de RDS. | Incorporar proxy de egreso o endpoints privados y rangos estables para Azure y los registros usados. |

Estas excepciones no cubren cifrado, IMDSv2, ejecucion root, credenciales, acceso publico a PostgreSQL ni egress irrestricto por protocolo. Deben revisarse antes de usar la plantilla fuera del laboratorio.

## Evidencia sugerida para el video

1. Mostrar los disparadores y el permiso minimo del workflow.
2. Abrir la matriz y enseñar las cuatro ejecuciones diferenciadas.
3. Mostrar `npm ci`, `node --check`, `npm test` y el build de un Dockerfile.
4. Mostrar los jobs SAST, SCA, Secret Scanning e IaC.
5. Descargar o abrir un artefacto de cada categoria.
6. Mostrar los cuatro reportes `image-scan-*`.
7. Abrir el resumen final con el estado por modulo.
8. Explicar que no se publican imagenes, no se ejecutan migraciones y no se despliega infraestructura en esta etapa.
