# serialcare-cloud

eva3_Multicloud

## PostgreSQL local con Docker Compose

La conexion local esperada del backend usa estos valores:

```env
POSTGRES_DB=serialcare_db
POSTGRES_USER=serialcare_user
POSTGRES_PASSWORD=serialcare_pass
DATABASE_URL=postgresql://serialcare_user:serialcare_pass@localhost:5433/serialcare_db
```

Docker Compose publica PostgreSQL en el puerto local `5433` para evitar conflicto con PostgreSQL instalado en Windows. Dentro del contenedor PostgreSQL sigue usando `5432`:

```yaml
ports:
  - "5433:5432"
```

Si aparece `password authentication failed for user "serialcare_user"`, normalmente existe un volumen local de PostgreSQL creado con una contraseña anterior.

Reinicia PostgreSQL local desde cero con:

```powershell
docker compose down -v
docker compose up -d
docker ps
```

Luego valida la conexion en:

```text
GET http://localhost:3000/api/db-test
```
