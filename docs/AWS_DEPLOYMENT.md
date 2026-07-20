# Despliegue AWS - SerialCare Cloud Evaluación 4

Esta guía describe la arquitectura modular vigente. La infraestructura se define en `infrastructure/cloudformation-serialcare.yaml`; la aplicación se ejecuta con `docker-compose.eval4.yml` y un override que conecta los contenedores a Amazon RDS sin publicar PostgreSQL ni los puertos internos.

## Arquitectura

```text
Internet
  |
  v
Application Load Balancer público :80
  |
  v
EC2 privada :80
  |
  v
frontend-gateway Nginx :8080
  |--------------------|----------------------|---------------------|
  v                    v                      v                     v
clientes-maquinas   recepcion-cotizaciones diagnostico-garantias inventario-documentos
      :3001                :3002                  :3003                 :3004
  |-------------------- PostgreSQL compartido -------------------------|
                               |
                               v
                      Amazon RDS privado :5432

inventario-documentos ---> Azure Blob Storage
```

El ALB es el único punto público. La EC2 no recibe IP pública; los cuatro módulos, el migrador y RDS permanecen en red privada. No existe Bastion ni acceso SSH público en esta plantilla.

La implementación académica usa un solo host de aplicación para que exista un único propietario del ciclo de migración. Esto evita que dos hosts ejecuten el servicio one-shot simultáneamente. No proporciona alta disponibilidad de cómputo; esa mejora requiere imágenes publicadas y una estrategia de despliegue coordinada antes de escalar horizontalmente.

## Responsabilidades

- CloudFormation crea VPC, subredes, NAT Gateway, Security Groups, ALB, EC2 privada y RDS.
- `UserData` realiza el bootstrap inicial del host, verifica Docker Compose, obtiene la rama configurada y levanta el stack modular. La EC2 tiene una `CreationPolicy` y solo envía `SUCCESS` mediante `cfn-signal` cuando las migraciones y el gateway están saludables.
- Ansible es la vía recomendada para actualizaciones repetibles sobre una VM Linux accesible por un canal administrativo privado.
- `docker-compose.eval4.yml` define el gateway, los cuatro módulos, PostgreSQL local y el servicio `migrate`.
- El override AWS desactiva PostgreSQL local, elimina los puertos 3001-3004 y conecta `migrate` y los módulos al RDS compartido.
- Solo el servicio `migrate` ejecuta `npm run db:initialize`: aplica el bootstrap únicamente sobre una base vacía y después las migraciones pendientes. Los cuatro módulos esperan que termine correctamente.
- Azure Blob Storage permanece externo a AWS y se configura por variables de entorno.

CloudFormation y Ansible son alternativas de bootstrap, no dos procesos que deban ejecutarse al mismo tiempo. Tras crear la infraestructura, use Ansible para actualizaciones controladas cuando disponga de conectividad administrativa hacia la VM.

## Puertos y exposición

| Componente | Puerto interno | Exposición AWS |
|---|---:|---|
| ALB | 80 | Público |
| frontend-gateway | 8080, publicado como 80 en EC2 | Solo desde el Security Group del ALB |
| clientes-maquinas | 3001 | Solo red Docker |
| recepcion-cotizaciones | 3002 | Solo red Docker |
| diagnostico-garantias | 3003 | Solo red Docker |
| inventario-documentos | 3004 | Solo red Docker |
| RDS PostgreSQL | 5432 | Solo desde el Security Group de la EC2 |

Los puertos locales 5433 y 3001-3004 del Compose base se eliminan mediante el override de AWS/Ansible.

## Parámetros reales de CloudFormation

| Parámetro | Descripción |
|---|---|
| `DBName` | Nombre de la base, por defecto `serialcare_db`. |
| `DBUsername` | Usuario administrador de PostgreSQL. |
| `DBPassword` | Contraseña RDS, marcada `NoEcho`. |
| `InstanceType` | Tipo de EC2 privada. |
| `VpcCidr` | CIDR de la VPC. |
| `PublicSubnet1Cidr`, `PublicSubnet2Cidr` | CIDR de subredes del ALB y NAT. |
| `PrivateSubnet1Cidr`, `PrivateSubnet2Cidr` | CIDR de aplicación y RDS. |
| `GitHubRepoUrl` | URL HTTPS del repositorio. |
| `RepositoryRef` | Rama a desplegar; por defecto `evaluacion-4-devsecops`. |
| `BootstrapAdminName` | Nombre del ADMIN inicial creado solamente en una base vacía. |
| `BootstrapAdminEmail` | Correo del ADMIN inicial. |
| `BootstrapAdminPassword` | Contraseña inicial, marcada `NoEcho` y convertida a bcrypt por el migrador. |
| `JwtSecret` | Secreto JWT compartido, marcado `NoEcho`. |
| `AzureStorageConnectionString` | Conexión Azure, marcada `NoEcho`; puede quedar vacía para validación sin documentos reales. |
| `AzureStorageContainer` | Contenedor Azure. |
| `AzureStoragePublicBaseUrl` | URL base pública de Blob Storage cuando corresponda. |
| `LatestAmiId` | AMI Amazon Linux 2023 obtenida desde SSM. |

La plantilla no define `KeyName`, `AllowedSSHIp` ni recursos Bastion.

## Outputs reales

- `LoadBalancerDnsName`
- `LoadBalancerUrl`
- `HealthCheckUrl`
- `AppPrivateIp`
- `AppInstanceId`
- `RdsEndpointAddress`
- `RdsEndpointPort`
- `VpcId`
- `LoadBalancerSecurityGroupId`
- `AppSecurityGroupId`
- `RdsSecurityGroupId`

## Validación y despliegue

Validar localmente:

```powershell
cfn-lint infrastructure/cloudformation-serialcare.yaml
aws cloudformation validate-template --template-body file://infrastructure/cloudformation-serialcare.yaml
```

Desplegar desde la consola de CloudFormation o mediante CLI. Evite incluir `DBPassword`, `JwtSecret` o la cadena Azure en el historial del shell; use un archivo local no versionado o el formulario seguro de la consola.

Ejemplo sin secretos:

```powershell
aws cloudformation deploy `
  --template-file infrastructure/cloudformation-serialcare.yaml `
  --stack-name serialcare-cloud `
  --parameter-overrides `
    GitHubRepoUrl=https://github.com/ORGANIZACION/serialcare-cloud.git `
    RepositoryRef=evaluacion-4-devsecops `
    DBName=serialcare_db `
    DBUsername=serialcare_user
```

El comando es deliberadamente incompleto: `DBPassword`, `BootstrapAdminPassword`, `JwtSecret` y la conexión de Azure deben ingresarse mediante un canal seguro.

### Crear una pila nueva desde cero

1. Confirme que `RepositoryRef` exista en el repositorio remoto y que contenga `database/bootstrap.sql`, `database/bootstrap-seed.sql` y las migraciones 001-010.
2. En CloudFormation, cree una pila estándar usando `infrastructure/cloudformation-serialcare.yaml`.
3. Ingrese obligatoriamente `GitHubRepoUrl`, `DBPassword`, `BootstrapAdminPassword` y `JwtSecret`.
4. Revise `DBName`, `DBUsername`, `BootstrapAdminName`, `BootstrapAdminEmail`, `RepositoryRef`, `InstanceType`, `VpcCidr` y los cuatro CIDR de subred. Los valores predeterminados son válidos solo si no se superponen con redes del laboratorio.
5. Ingrese `AzureStorageConnectionString`, `AzureStorageContainer` y `AzureStoragePublicBaseUrl` cuando se probarán PDF o evidencias reales. La cadena puede quedar vacía únicamente para healthchecks y flujos sin archivos.
6. Mantenga `LatestAmiId` con el parámetro SSM de Amazon Linux 2023, salvo que el laboratorio exija otro AMI compatible.
7. Cree la pila y espere la señal de `AppInstance`. No considere el despliegue exitoso hasta que la pila quede `CREATE_COMPLETE` y `HealthCheckUrl` responda 200.
8. Si `AppInstance` emite `CREATE_FAILED`, revise el evento de señalización y `/var/log/serialcare-bootstrap.log` mediante el mecanismo privado autorizado por el laboratorio. Para conservar recursos durante diagnóstico, deshabilite el rollback solo de forma temporal al crear la pila.

No ejecute `schema.sql`, `seed.sql` ni comandos `psql` manuales. En una RDS vacía, el único flujo admitido es `bootstrap.sql` → `bootstrap-seed.sql` → migraciones 001-010 → módulos.

Consultar outputs:

```powershell
aws cloudformation describe-stacks `
  --stack-name serialcare-cloud `
  --query "Stacks[0].Outputs"
```

## Secuencia de arranque

`UserData`:

1. Instala Docker, Git y `aws-cfn-bootstrap`. Amazon Linux 2023 ya incluye `curl-minimal`: el script verifica el paquete y el comando `curl`, pero no instala el paquete `curl`, evitando el conflicto entre ambos RPM.
2. Descarga Docker Compose v2.29.7 y verifica su SHA-256 con el archivo oficial.
3. Clona el repositorio o hace avance rápido de una copia limpia a `RepositoryRef`; no borra el checkout ni sobrescribe cambios.
4. Crea `/etc/serialcare/serialcare.env` con permisos `0600`.
5. Genera un override que desactiva PostgreSQL local, retira puertos internos y publica únicamente el gateway en el puerto 80 de la EC2.
6. Ejecuta `docker compose config`, construye las imágenes y ejecuta `up -d`.
7. Verifica que el contenedor `migrate` haya terminado realmente con estado `exited` y código 0; luego espera `GET /health` del gateway.
8. Envía `SUCCESS` a CloudFormation mediante `/opt/aws/bin/cfn-signal`. Cualquier error activa un trap que muestra `docker compose ps --all`, los logs de `migrate` y los logs de `frontend-gateway`, y envía `FAILURE`.

Los logs quedan en `/var/log/serialcare-bootstrap.log` y `/var/log/cloud-init-output.log`. La `CreationPolicy` espera una señal durante un máximo de 45 minutos; si el UserData falla o no logra señalizar, `AppInstance` y la pila no alcanzan `CREATE_COMPLETE`.

## Base de datos y migraciones

La plantilla no ejecuta `database/schema.sql`, `database/seed.sql` ni `psql`
manual contra RDS. Tampoco elimina volúmenes o datos. RDS usa cifrado, red
privada, snapshots al eliminar/reemplazar y acceso 5432 únicamente desde la
EC2.

El servicio one-shot `migrate` ejecuta `npm run db:initialize` bajo un bloqueo
asesor de PostgreSQL:

1. Si no existe ninguna tabla de aplicación, ejecuta `database/bootstrap.sql`
   y `database/bootstrap-seed.sql` dentro de una transacción.
2. Crea el ADMIN inicial con correo y contraseña recibidos desde parámetros
   `NoEcho`; la contraseña se convierte a bcrypt y nunca se almacena en SQL.
3. Crea `schema_migrations` y aplica 001–010 en orden, cada una en su propia
   transacción.
4. Si el esquema base ya existe, omite completamente el bootstrap y ejecuta
   solo migraciones pendientes.
5. Si detecta un esquema parcial o cualquier error, termina con código distinto
   de cero; `depends_on: service_completed_successfully` impide iniciar los
   cuatro módulos.

`bootstrap.sql` es idempotente y no contiene `DROP TABLE` ni `TRUNCATE`. El
`seed.sql` histórico continúa disponible solo como conjunto demostrativo y no
participa del despliegue AWS.
## Validación operativa

Comprobar el acceso público:

```text
GET http://<LoadBalancerDnsName>/health
```

Respuesta esperada en texto plano:

```text
ok
```

Comprobar servicios en la VM mediante el canal administrativo privado disponible:

```bash
cd /opt/serialcare-cloud
sudo docker compose \
  --env-file /etc/serialcare/serialcare.env \
  -f docker-compose.eval4.yml \
  -f /etc/serialcare/docker-compose.aws.yml \
  ps --all

sudo docker compose \
  --env-file /etc/serialcare/serialcare.env \
  -f docker-compose.eval4.yml \
  -f /etc/serialcare/docker-compose.aws.yml \
  logs --tail=100 migrate
```

Validar desde el gateway:

- Login por `/api/auth/login`.
- Clientes por `/api/clientes`.
- Órdenes por `/api/ordenes`.
- Garantías por `/api/garantias`.
- Repuestos por `/api/repuestos`.

## Ansible

CloudFormation crea la infraestructura. Cuando exista conectividad privada hacia la VM, Ansible instala Docker y despliega la misma arquitectura modular. Configure:

- `database_host` con el output `RdsEndpointAddress`.
- `gateway_port: 80` cuando el ALB apunte al puerto 80.
- `serialcare_frontend_url` con `LoadBalancerUrl`.
- secretos con Ansible Vault.

Consulte [ansible/README.md](../ansible/README.md).

## Azure Blob Storage

Azure puede quedar vacío para comprobar contenedores y healthchecks. La generación y descarga real de PDF y la subida de evidencias requieren credenciales válidas. Nunca guarde la cadena de conexión en Git, inventarios o parámetros sin `NoEcho`.

## Seguridad y limitaciones académicas

- RDS y EBS están cifrados.
- RDS y EC2 no tienen IP pública.
- IMDSv2 es obligatorio.
- El ALB es la única entrada pública.
- Los secretos CloudFormation usan `NoEcho`; el archivo de entorno usa modo `0600`. La `CreationPolicy` impide declarar exitoso el host antes de que `cfn-signal` confirme migraciones y gateway.
- El egress HTTPS de la EC2 se conserva para repositorios, registro de imágenes y Azure; la excepción IaC es específica y documentada.
- No hay dominio ni certificado ACM en AWS Academy. El listener HTTP y su excepción IaC se mantienen exclusivamente para la demostración académica. En un entorno real, agregue ACM, listener 443 y redirección 80 a 443.
- La arquitectura académica usa una sola EC2 y no ofrece alta disponibilidad del cómputo.
- La plantilla no abre SSH. La administración requiere un canal privado autorizado por el laboratorio; no agregue un Bastion público.
