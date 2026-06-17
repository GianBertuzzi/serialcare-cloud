\# SerialCare Cloud - Instrucciones para Codex



Este proyecto es una PoC para la Evaluación 03 de Arquitectura Multicloud.



\## Objetivo



Construir una aplicación web funcional llamada SerialCare Cloud, orientada a trazabilidad, garantía y servicio técnico de productos serializados.



La PoC debe demostrar:

\- Frontend funcional.

\- Backend/API funcional.

\- Login con roles.

\- Vistas protegidas.

\- Base de datos PostgreSQL.

\- Contenedores Docker.

\- Infraestructura automatizada.

\- Alta disponibilidad o prueba de caída de nodo.



\## Alcance funcional mínimo



La aplicación debe incluir:



\- Login con correo y contraseña.

\- Roles: ADMIN, TECNICO, CLIENTE, MARCA.

\- Vista administrador.

\- Vista técnico.

\- Vista cliente.

\- Vista marca.

\- Consulta pública por número de serie.

\- Productos serializados básicos.

\- Órdenes de servicio básicas.

\- Garantías básicas con aprobar/rechazar.



\## Tecnologías



\- Frontend: React + Vite.

\- Backend: Node.js + Express.

\- Base de datos: PostgreSQL.

\- Contenedores: Docker.

\- Infraestructura: CloudFormation o Terraform.

\- Nube principal: AWS.

\- Región AWS propuesta: us-east-1.

\- Availability Zones propuestas: us-east-1a y us-east-1b.

\- Plan B de balanceo: Nginx Load Balancer local si AWS Academy restringe Application Load Balancer.



\## Reglas importantes



\- No usar imágenes Docker con etiqueta latest.

\- Usar tags específicos:

&#x20; - node:20-alpine

&#x20; - nginx:1.27-alpine

&#x20; - postgres:16-alpine

\- No subir archivo .env real al repositorio.

\- Crear archivo .env.example.

\- Mantener frontend y backend separados.

\- El backend debe validar permisos por rol.

\- No confiar solo en ocultar botones desde el frontend.

\- Usar JWT para sesión.

\- Usar bcrypt para contraseñas.

\- Crear código simple, funcional y defendible para una evaluación académica.

\- Mantener README actualizado.

