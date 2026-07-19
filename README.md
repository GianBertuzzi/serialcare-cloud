# SerialCare Cloud

SerialCare Cloud es una PoC academica para trazabilidad, garantia y servicio tecnico de productos serializados en una arquitectura preparada para despliegue multicloud.

## Stack

- Frontend: React + Vite servido por Nginx en Docker.
- Backend: cuatro aplicaciones Node.js + Express (clientes-maquinas, recepcion-cotizaciones, diagnostico-garantias e inventario-documentos).
- Base de datos: PostgreSQL.
- Contenedores: Docker Compose con migrador centralizado y gateway Nginx.
- Nube objetivo: gateway en una EC2 privada detras de AWS Application Load Balancer y Amazon RDS PostgreSQL privado.
- Evidencias: Azure Blob Storage para archivos adjuntos de ordenes.

No se usa XAMPP. El proyecto usa Docker, Node, React y PostgreSQL.

## Variables locales

Backend local (`backend/.env`):

```env
PORT=3000
NODE_ENV=development
DATABASE_URL=postgresql://serialcare_user:serialcare_pass@localhost:5433/serialcare_db
JWT_SECRET=cambiar_este_secreto
BOOTSTRAP_ADMIN_NAME=Administrador SerialCare
BOOTSTRAP_ADMIN_EMAIL=admin@serialcare.cl
BOOTSTRAP_ADMIN_PASSWORD=definir_solo_en_env_local
BOOTSTRAP_ADMIN_PASSWORD_HASH=
FRONTEND_URL=http://localhost:5173
AZURE_STORAGE_CONNECTION_STRING=
AZURE_STORAGE_CONTAINER=evidencias
AZURE_STORAGE_PUBLIC_BASE_URL=
```

Frontend local (`frontend/.env`):

```env
VITE_API_URL=http://localhost:3000/api
```

`backend/.env` no debe subirse al repositorio. Usa `backend/.env.example` como plantilla.

## Desarrollo Local

Levantar solo PostgreSQL con Docker:

```powershell
docker compose up -d postgres
```

Backend en modo desarrollo:

```powershell
cd backend
npm install
npm run dev
```

Frontend en modo desarrollo:

```powershell
cd frontend
npm install
npm run dev
```

URLs de desarrollo:

- Frontend Vite: http://localhost:5173
- Backend health: http://localhost:3000/api/health
- PostgreSQL local: localhost:5433

## Docker modular de Evaluacion 4

Construir y levantar PostgreSQL local, migrador, cuatro modulos y gateway:

```powershell
docker compose -f docker-compose.eval4.yml up -d --build
```

Servicios locales:

- Gateway y frontend: http://localhost:8080
- Clientes y maquinas: http://localhost:3001
- Recepcion y cotizaciones: http://localhost:3002
- Diagnostico y garantias: http://localhost:3003
- Inventario y documentos: http://localhost:3004
- PostgreSQL local: localhost:5433

El servicio one-shot `migrate` ejecuta `npm run db:initialize`, crea de forma
segura el esquema base cuando PostgreSQL está vacío y después registra las
migraciones aplicadas. Los puertos 3001-3004 se publican solo para pruebas
locales; el override AWS/Ansible los retira y deja unicamente el gateway.

`docker-compose.yml` se conserva como entorno monolitico local heredado de
Evaluacion 3. `docker-compose.prod.yml` es una referencia obsoleta y no debe
usarse para el despliegue actual.

## Health checks

El gateway publico responde:

```text
GET /health
```

Cada modulo expone internamente `GET /health` y `GET /health/db`. El gateway
solo queda saludable cuando los cuatro modulos han iniciado; `/health/db`
comprueba la conexion compartida a PostgreSQL.

## Azure Blob Storage

Las evidencias de orden permiten dos modos:

- Referencia manual: registra una URL, nombre o nota sin requerir Azure.
- Archivo real: sube el archivo a Azure Blob Storage usando `POST /api/ordenes/:id/evidencias` con `multipart/form-data`.

Variables requeridas para carga real de archivos:

```env
AZURE_STORAGE_CONNECTION_STRING=DefaultEndpointsProtocol=...
AZURE_STORAGE_CONTAINER=evidencias
AZURE_STORAGE_PUBLIC_BASE_URL=https://cuenta.blob.core.windows.net
```

Si `AZURE_STORAGE_CONNECTION_STRING` no esta configurada, el backend sigue iniciando normalmente y la evidencia manual funciona. Solo la subida de archivos devuelve un error claro indicando que Azure Blob Storage no esta configurado.

Limites de archivos:

- Tamano maximo: 10 MB.
- Tipos permitidos: JPG, PNG, WEBP, PDF, TXT, DOC y DOCX.

## Arquitectura y despliegue actual

La Evaluacion 4 utiliza cuatro imagenes backend independientes, un gateway
Nginx, PostgreSQL compartido y el servicio `migrate` como unico ejecutor de
migraciones. En AWS, el ALB es la unica entrada publica; la EC2, los modulos y
RDS permanecen privados. Los puertos 3001-3004 no se publican en el despliegue.

CloudFormation crea la infraestructura y realiza el bootstrap inicial con
`docker-compose.eval4.yml` y un override para RDS. Ansible es la opcion
recomendada para configurar una VM Linux y aplicar actualizaciones repetibles.
`bootstrap.sql` y `bootstrap-seed.sql` inicializan de forma no destructiva una
base vacía; `schema.sql` y `seed.sql` quedan fuera del despliegue actual.

Documentacion:

- [Despliegue AWS](docs/AWS_DEPLOYMENT.md)
- [Pipeline DevSecOps](docs/DEVSECOPS_PIPELINE.md)
- [Automatizacion Ansible](ansible/README.md)

Azure Blob Storage puede quedar sin credenciales para healthchecks locales,
pero PDF y evidencias reales requieren una cadena de conexion valida.

## Validacion manual

1. Ejecutar `docker compose -f docker-compose.eval4.yml up -d --build`.
2. Confirmar que `migrate` termina con codigo 0 y los cinco servicios quedan saludables.
3. Abrir `http://localhost:8080/health`.
4. Iniciar sesion desde `http://localhost:8080`.
5. Validar clientes, ordenes, garantias y repuestos a traves de la unica base `/api`.
6. Ejecutar `docker compose -f docker-compose.eval4.yml down` sin `-v` para conservar datos.
