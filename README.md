# SerialCare Cloud

SerialCare Cloud es una PoC academica para trazabilidad, garantia y servicio tecnico de productos serializados en una arquitectura preparada para despliegue multicloud.

## Stack

- Frontend: React + Vite servido por Nginx en Docker.
- Backend: Node.js + Express.
- Base de datos: PostgreSQL.
- Contenedores: Docker Compose.
- Nube objetivo: EC2 detras de AWS Application Load Balancer, Amazon RDS PostgreSQL y Bastion Host para administracion SSH segura.
- Evidencias futuras: Azure Blob Storage.

No se usa XAMPP. El proyecto usa Docker, Node, React y PostgreSQL.

## Variables locales

Backend local (`backend/.env`):

```env
PORT=3000
NODE_ENV=development
DATABASE_URL=postgresql://serialcare_user:serialcare_pass@localhost:5433/serialcare_db
JWT_SECRET=cambiar_este_secreto
FRONTEND_URL=http://localhost:5173
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

## Docker Completo Local

Construir y levantar PostgreSQL, backend y frontend:

```powershell
docker compose up -d --build
```

URLs Docker:

- Frontend Docker: http://localhost:8080
- Backend health: http://localhost:3000/api/health
- PostgreSQL: localhost:5433

Para reiniciar la base desde cero cuando cambian `schema.sql` o `seed.sql`:

```powershell
docker compose down -v
docker compose up -d --build
docker ps
```

## Health Check

El balanceador debe consultar:

```text
GET /api/health
```

Respuesta esperada cuando backend y PostgreSQL estan operativos:

```json
{
  "status": "ok",
  "service": "serialcare-backend",
  "timestamp": "2026-06-25T00:00:00.000Z",
  "database": "ok"
}
```

Si PostgreSQL falla, responde `503` y `database: "error"`.

## Preparacion Para Nube

Arquitectura objetivo:

- AWS Application Load Balancer recibe trafico HTTP/HTTPS.
- EC2 App 1 y EC2 App 2 ejecutan Docker con backend/frontend.
- Amazon RDS PostgreSQL reemplaza al contenedor `postgres` en produccion.
- Security Groups limitan trafico: ALB hacia EC2, EC2 hacia RDS, SSH solo desde Bastion.
- Bastion Host / Jump Server se usa para administracion SSH segura.
- Azure Blob Storage se integrara despues para evidencias.

Variables esperadas en EC2/backend:

```env
PORT=3000
NODE_ENV=production
DATABASE_URL=postgresql://usuario:password@rds-endpoint:5432/serialcare_db
JWT_SECRET=secreto_largo_y_unico
FRONTEND_URL=https://dominio-o-alb
```

## Validacion Manual

1. Ejecutar `docker compose up -d --build`.
2. Abrir `http://localhost:3000/api/health` y confirmar `database: "ok"`.
3. Abrir `http://localhost:8080`.
4. Iniciar sesion con `admin.temuco@serialcare.cl / Admin123`.
5. Confirmar que el frontend puede consumir el backend.
6. Confirmar que el backend puede consultar PostgreSQL.