# Despliegue AWS - SerialCare Cloud

Esta guia prepara el despliegue academico de SerialCare Cloud en AWS con alta disponibilidad basica, Docker y RDS PostgreSQL. Azure Blob Storage se mantiene como servicio externo multicloud para evidencias.

## Arquitectura general

Componentes principales:

- Application Load Balancer publico en HTTP 80.
- Dos instancias EC2 App en subredes publicas distintas.
- Docker Compose de produccion en cada EC2 App.
- Frontend React servido por Nginx.
- Backend Node.js/Express en contenedor interno.
- Amazon RDS PostgreSQL como base de datos centralizada.
- Bastion Host para administracion SSH segura.
- Security Groups separados por responsabilidad.
- Azure Blob Storage externo para evidencias, configurado por variables de entorno.

CloudFormation crea desde cero la VPC, las dos subredes, el Bastion, EC2 App 1, EC2 App 2, el Application Load Balancer, el Target Group y RDS. El Bastion recibe una IP publica temporal apropiada para el laboratorio; en produccion se podria asociar una Elastic IP para mantener una direccion estable.

## Diagrama textual

```text
Internet
  |
  v
AWS Application Load Balancer :80
  |
  +--> EC2 App 1 :80 -> Nginx frontend -> /api -> backend :3000
  |
  +--> EC2 App 2 :80 -> Nginx frontend -> /api -> backend :3000
                 |
                 v
          Amazon RDS PostgreSQL :5432

Admin SSH
  |
  v
Bastion Host :22
  |
  +--> EC2 App 1 :22
  +--> EC2 App 2 :22

Azure Blob Storage externo
  ^
  |
Backend usa AZURE_STORAGE_* para evidencias
```

## Archivos relevantes

- `infrastructure/cloudformation-serialcare.yaml`: infraestructura AWS.
- `docker-compose.prod.yml`: app productiva sin PostgreSQL local.
- `frontend/nginx.conf`: sirve React y proxyea `/api` al backend.
- `backend/.env.example`: variables esperadas.


## Flujo local a nube

1. Desarrollo local:

   - Trabaja primero en tu PC con `npm run dev` para backend y frontend.
   - Usa `docker compose up -d postgres` o `docker compose up -d --build` para pruebas locales con Docker.
   - Prueba login, dashboards, `/api/health` y flujos principales antes de subir cambios.

2. Repositorio GitHub:

   - Guarda cambios con `git add .`.
   - Crea commit con `git commit -m "mensaje"`.
   - Sube el codigo con `git push`.
   - CloudFormation usa `GitHubRepoUrl` para que cada EC2 App clone este repositorio.
   - Si el repositorio es privado, debes hacerlo publico temporalmente o usar un metodo seguro como deploy key/token. No hardcodear tokens ni credenciales en el template.

3. AWS:

   - CloudFormation crea VPC, subredes, Security Groups, EC2 App 1, EC2 App 2, ALB, RDS y Bastion.
   - Cada EC2 App clona el repositorio desde `GitHubRepoUrl`.
   - Cada EC2 App crea `backend/.env` con el endpoint de RDS, SSL de laboratorio y el DNS publico del ALB.
   - Cada EC2 App ejecuta `docker compose -f docker-compose.prod.yml up -d --build`.
   - El Load Balancer entrega una URL publica en el output `LoadBalancerUrl`.
   - RDS entrega un endpoint privado en `RdsEndpointAddress`.
   - Bastion entrega una IP publica en `BastionPublicIp` para administracion SSH.
   - Las EC2 App no deben recibir SSH directo desde internet.

4. Azure:

   - Azure Blob Storage se crea aparte de AWS.
   - El equipo Azure entrega `AZURE_STORAGE_CONNECTION_STRING`, `AZURE_STORAGE_CONTAINER` y `AZURE_STORAGE_PUBLIC_BASE_URL`.
   - Esas variables se pasan al backend en AWS mediante parametros CloudFormation y `backend/.env`.

5. Prueba final:

   - Abre `LoadBalancerUrl` en el navegador.
   - Prueba `HealthCheckUrl` o `LoadBalancerUrl/api/health`.
   - Apaga Docker en una EC2 App.
   - Confirma que el Target Group marca esa instancia como `unhealthy`.
   - Confirma que el Load Balancer sigue respondiendo con la otra EC2 App.

## Parametros CloudFormation

Completar al desplegar:

- `KeyName`: nombre del par de llaves EC2 existente.
- `AllowedSSHIp`: IP publica autorizada para SSH hacia Bastion. Usar formato `x.x.x.x/32`. No usar `0.0.0.0/0`.
- `DBName`: por defecto `serialcare_db`.
- `DBUsername`: por defecto `serialcare_user`.
- `DBPassword`: password de RDS. No subirlo a GitHub.
- `InstanceType`: por defecto `t3.micro`.
- `VpcCidr`: por defecto `10.30.0.0/16`.
- `PublicSubnet1Cidr`: por defecto `10.30.1.0/24`.
- `PublicSubnet2Cidr`: por defecto `10.30.2.0/24`.
- `GitHubRepoUrl`: URL HTTPS del repositorio con este codigo.
- `JwtSecret`: secreto JWT largo. No subirlo a GitHub.
- `AzureStorageConnectionString`: entregado por el equipo/companero Azure. No subirlo a GitHub.
- `AzureStorageContainer`: por defecto `evidencias`.
- `AzureStoragePublicBaseUrl`: por ejemplo `https://cuenta.blob.core.windows.net`.

`FRONTEND_URL` no es un parametro manual: CloudFormation lo genera como `http://<DNS del ALB>` dentro de `backend/.env`. La conexion generada a RDS termina en `?sslmode=no-verify`, lo que exige SSL sin validar la cadena del certificado para esta PoC de laboratorio. En produccion se debe instalar/configurar la CA de RDS y validar el certificado.


## Repositorio privado

Las EC2 App clonan el codigo desde `GitHubRepoUrl`. Si el repositorio es privado, la clonacion fallara a menos que configures autenticacion segura. Opciones aceptables:

- Hacer el repositorio publico temporalmente durante la prueba academica.
- Usar una deploy key configurada en GitHub y cargada de forma segura en la instancia.
- Usar un token gestionado fuera del template, por ejemplo mediante AWS Secrets Manager o un mecanismo temporal seguro.

No hardcodear tokens, passwords ni llaves privadas en `cloudformation-serialcare.yaml`, `UserData`, README ni commits.

## Validar plantilla antes de desplegar

```powershell
aws cloudformation validate-template --template-body file://infrastructure/cloudformation-serialcare.yaml
```

## Desplegar stack

Ejemplo con parametros en linea. Para una entrega real, evita dejar secretos en el historial de consola y usa un archivo local no versionado o el asistente de CloudFormation.

```powershell
aws cloudformation deploy `
  --template-file infrastructure/cloudformation-serialcare.yaml `
  --stack-name serialcare-cloud `
  --parameter-overrides `
    KeyName=mi-keypair `
    AllowedSSHIp=MI_IP_PUBLICA/32 `
    DBName=serialcare_db `
    DBUsername=serialcare_user `
    DBPassword=CAMBIAR_PASSWORD `
    InstanceType=t3.micro `
    GitHubRepoUrl=https://github.com/USUARIO/serialcare-cloud.git `
    JwtSecret=CAMBIAR_SECRETO_LARGO `
    AzureStorageConnectionString="" `
    AzureStorageContainer=evidencias `
    AzureStoragePublicBaseUrl=""
```

Al terminar, revisar outputs:

```powershell
aws cloudformation describe-stacks --stack-name serialcare-cloud --query "Stacks[0].Outputs"
```

Outputs importantes:

- `LoadBalancerUrl`
- `HealthCheckUrl`
- `BastionPublicIp`
- `App1PrivateIp`
- `App2PrivateIp`
- `RdsEndpointAddress`

## Inicializar RDS una vez

El stack crea RDS, pero no ejecuta `schema.sql` ni `seed.sql` automaticamente para evitar que ambas EC2 ejecuten la carga al mismo tiempo. Inicializa la base una sola vez desde Bastion o desde una EC2 App.

Desde una EC2 App:

```bash
cd /opt/serialcare-cloud
set -a
source backend/.env
set +a
docker run --rm -i postgres:16-alpine psql "$DATABASE_URL" < database/schema.sql
docker run --rm -i postgres:16-alpine psql "$DATABASE_URL" < database/seed.sql
```

Solo repite estos comandos si vas a reiniciar la base de datos o si sabes que los scripts son compatibles con volver a ejecutarse.

## Ingresar por Bastion

En tu equipo local:

```bash
chmod 400 mi-keypair.pem
ssh-add mi-keypair.pem
ssh -A ec2-user@BASTION_PUBLIC_IP
```

Si usas Windows PowerShell con OpenSSH:

```powershell
ssh-add .\mi-keypair.pem
ssh -A ec2-user@BASTION_PUBLIC_IP
```

## Entrar a EC2 App desde Bastion

Una vez dentro del Bastion:

```bash
ssh ec2-user@APP1_PRIVATE_IP
ssh ec2-user@APP2_PRIVATE_IP
```

No se abre SSH directo desde internet hacia las EC2 App. Solo se permite desde el Security Group del Bastion.

## Verificar Docker en cada EC2 App

```bash
cd /opt/serialcare-cloud
docker compose -f docker-compose.prod.yml ps
docker ps
docker compose -f docker-compose.prod.yml logs --tail=80 backend
docker compose -f docker-compose.prod.yml logs --tail=80 frontend
```

## Probar Load Balancer

Abre en el navegador el valor del output `LoadBalancerUrl`:

```text
http://LOAD_BALANCER_DNS
```

Probar health check:

```text
http://LOAD_BALANCER_DNS/api/health
```

Respuesta esperada:

```json
{
  "status": "ok",
  "service": "serialcare-backend",
  "database": "ok"
}
```

## Probar caida de una instancia

1. Entra a una de las EC2 App desde Bastion.
2. Deten Docker en esa instancia:

```bash
sudo systemctl stop docker
```

3. En AWS, revisa el Target Group del ALB. Esa instancia deberia quedar `unhealthy`.
4. Abre el sitio por el ALB. Debe seguir respondiendo desde la otra instancia.
5. Recupera la instancia:

```bash
sudo systemctl start docker
cd /opt/serialcare-cloud
docker compose -f docker-compose.prod.yml up -d
```

## Azure Blob Storage

El companero/equipo Azure debe entregar:

```env
AZURE_STORAGE_CONNECTION_STRING=...
AZURE_STORAGE_CONTAINER=evidencias
AZURE_STORAGE_PUBLIC_BASE_URL=https://cuenta.blob.core.windows.net
```

Estas variables se pasan a `backend/.env` desde CloudFormation UserData. No deben subirse a GitHub.

Si `AZURE_STORAGE_CONNECTION_STRING` queda vacia:

- La app inicia normalmente.
- Las evidencias manuales funcionan.
- La subida real de archivos devuelve un error claro indicando que Azure Blob no esta configurado.

## Seguridad aplicada

- ALB permite HTTP 80 desde internet.
- EC2 App permite HTTP 80 solo desde el Security Group del ALB.
- Bastion permite SSH 22 solo desde `AllowedSSHIp`.
- `AllowedSSHIp` debe identificar una unica IP publica con mascara `/32`.
- EC2 App permite SSH 22 solo desde el Security Group del Bastion.
- RDS permite PostgreSQL 5432 solo desde el Security Group de EC2 App.
- RDS usa SSL con `sslmode=no-verify` para el laboratorio.
- RDS no queda abierto a internet.
- No se incluyen credenciales reales en el repositorio.

## Notas y pendientes manuales

- Configurar un `KeyName` existente antes de desplegar.
- Usar `AllowedSSHIp` con `/32`. No usar `0.0.0.0/0`.
- Configurar valores reales de Azure Blob cuando existan.
- Inicializar RDS manualmente con `schema.sql` y `seed.sql` una vez creado el stack.
- Para un despliegue nuevo, crea el stack con esta version de la plantilla y usa `LoadBalancerUrl`; no es necesario corregir el `.env` dentro de las EC2.
- En un stack ya existente, actualizar solo el `UserData` no garantiza que cloud-init vuelva a ejecutarlo. Para aplicar estas correcciones de arranque, recrea el stack o reemplaza ambas EC2 App de forma controlada.