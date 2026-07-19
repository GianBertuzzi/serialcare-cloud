# Despliegue Ansible de SerialCare Cloud

Esta automatizacion prepara una VM Linux y despliega los cuatro modulos de la
Evaluacion 4 con `docker-compose.eval4.yml`. CloudFormation crea la
infraestructura AWS; Ansible configura una VM alcanzable por un canal
administrativo privado y aplica despliegues repetibles. No modifica firewall,
no elimina volumenes y no copia claves SSH.

## Sistemas soportados

- Ubuntu 22.04 LTS.
- Ubuntu 24.04 LTS.
- Rocky Linux 9.

El playbook valida la distribucion y version mediante Ansible facts antes de
cambiar el host. El controlador requiere Ansible Core 2.16 o superior, acceso
SSH y un usuario con `sudo`.

## Preparacion

1. Copie el inventario y reemplace solamente los placeholders:

   ```bash
   cp inventory.ini.example inventory.ini
   ```

2. Copie las variables y reemplace URL, version, URL publica y secretos:

   ```bash
   cp group_vars/all.example.yml group_vars/all.yml
   ansible-vault encrypt group_vars/all.yml
   ```

   Tambien puede cifrar solo valores concretos con `ansible-vault
   encrypt_string`. No escriba contrasenas en `inventory.ini`.
   `inventory.ini` y `group_vars/all.yml` estan excluidos por el `.gitignore`
   local de esta carpeta.

3. Compruebe conectividad y sintaxis:

   ```bash
   ansible -i inventory.ini serialcare -m ping
   ansible-playbook -i inventory.ini playbook.yml --syntax-check --ask-vault-pass
   ansible-playbook -i inventory.ini playbook.yml --check --diff --ask-vault-pass
   ```

4. Despliegue:

   ```bash
   ansible-playbook -i inventory.ini playbook.yml --ask-become-pass --ask-vault-pass
   ```

La segunda ejecucion usa el mismo checkout, archivo de entorno, imagenes,
contenedores y volumen PostgreSQL. Docker Compose solo recrea servicios cuando
su configuracion o imagen cambia. El playbook nunca ejecuta `down -v`, borra el
directorio de instalacion ni fuerza un checkout Git.

## Variables principales

| Variable | Uso |
|---|---|
| `serialcare_repo_url` | Repositorio Git, preferentemente HTTPS. |
| `serialcare_repo_version` | Rama, tag o commit a desplegar. |
| `serialcare_install_dir` | Checkout del proyecto. |
| `serialcare_config_dir` | Directorio externo y protegido para `.env` y override. |
| `database_name`, `database_user`, `database_password` | Credenciales PostgreSQL protegidas con Vault. |
| `database_host` | Vacio usa PostgreSQL local; en AWS recibe `RdsEndpointAddress`. |
| `database_port`, `database_sslmode` | Puerto y modo SSL de PostgreSQL externo. |
| `bootstrap_admin_name`, `bootstrap_admin_email` | Identidad del ADMIN inicial para una base vacía. |
| `bootstrap_admin_password` | Secreto inicial protegido mediante Ansible Vault y convertido a bcrypt por el migrador. |
| `jwt_secret` | Firma JWT compartida por los cuatro modulos. |
| `azure_storage_connection_string` | Conexion Azure; puede quedar vacia para pruebas locales. |
| `azure_blob_container` | Contenedor PDF; por defecto `serialcare`. |
| `gateway_port` | Unico puerto publicado por el despliegue. |
| `serialcare_frontend_url` | Origen publico permitido por CORS. |
| `serialcare_pull_images` | Ejecuta `compose pull` para imagenes publicadas cuando es `true`. |

El PDF y las evidencias reales requieren `azure_storage_connection_string`.
Con el valor vacio, los modulos y healthchecks funcionan, pero las operaciones
que escriben en Azure responden con el error controlado de almacenamiento no
configurado.

## Integracion con AWS

El flujo recomendado es:

1. CloudFormation crea VPC, ALB, EC2 privada y RDS privado.
2. El servicio `migrate` crea el esquema base seguro si RDS está vacía y luego
   aplica migraciones; nunca ejecuta `schema.sql` ni `seed.sql`.
3. En `group_vars/all.yml`, configure `database_host` con el output
   `RdsEndpointAddress`, `gateway_port` con el puerto esperado por el ALB y
   `serialcare_frontend_url` con `LoadBalancerUrl`.
4. Ejecute el playbook desde un controlador con conectividad privada a la VM.
5. El servicio one-shot `migrate` ejecuta `db:initialize`; en una base nueva
   aplica bootstrap y migraciones, y en una existente solo migraciones pendientes.

El override de Ansible deja PostgreSQL local disponible solo cuando
`database_host` esta vacio. En AWS no publica 5432 ni 3001-3004. CloudFormation
tambien puede realizar el bootstrap inicial; no ejecute simultaneamente
`UserData` y Ansible como dos mecanismos de despliegue competidores.

## Instalacion de Docker

El rol `docker` no usa scripts de conveniencia. En Ubuntu configura la llave y
el repositorio APT oficial de Docker. En Rocky Linux importa la llave GPG y
configura el repositorio RPM oficial compatible con la version 9. En ambos
casos instala Docker Engine, Buildx y el plugin Compose, habilita el servicio y
agrega el usuario de despliegue al grupo `docker`.

La membresia del grupo `docker` equivale a acceso administrativo sobre el
daemon. Debe limitarse al usuario de despliegue y protegerse mediante las
politicas SSH de la VM.

## Flujo de despliegue

1. Falla si el checkout contiene cambios locales o si el directorio destino
   contiene archivos que no pertenecen a Git.
2. Clona o actualiza exactamente `serialcare_repo_version` sin `force`.
3. Genera `/etc/serialcare/.env` con permisos `0600`; la tarea usa `no_log`.
4. Genera un override que elimina los puertos publicados de PostgreSQL y de
   los modulos 3001-3004. Si `database_host` esta definido, desactiva el
   PostgreSQL local y conecta migrador y modulos al RDS externo. Solo publica
   el gateway en `gateway_port`.
5. Valida Compose, ejecuta `pull` si fue habilitado y construye las imagenes.
6. Ejecuta `compose up -d --wait`. En local espera PostgreSQL; con RDS externo
   lo omite. En ambos casos ejecuta una sola vez el servicio `migrate` y solo
   entonces inicia los cuatro modulos y el gateway.
7. Valida `/health` del gateway y, desde la red interna, `/health` y
   `/health/db` de los cuatro modulos.

No se abren puertos con UFW, firewalld o reglas cloud. En AWS, la VM privada
debe aceptar el gateway solo desde el Security Group del ALB; el controlador
Ansible necesita un canal administrativo privado ya autorizado. TLS y el
balanceador se gestionan fuera de este playbook.

## Idempotencia y limites del check mode

Las tareas de paquetes, repositorios, servicio, usuario, Git y templates son
idempotentes. El build se ejecuta en cada despliegue para detectar cambios de
fuente, pero reutiliza cache; `compose up` no recrea contenedores sin cambios.

`--check` permite revisar paquetes, archivos y checkout cuando el host ya es
accesible. Por seguridad omite builds, inicio de contenedores y healthchecks,
por lo que no reemplaza una ejecucion real en una VM desechable antes de pasar
a produccion.
