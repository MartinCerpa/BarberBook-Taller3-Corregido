# Backend · BarberBook Taller 3

## Descripción

El backend de BarberBook está desarrollado con **Node.js y Express**. Se encarga de procesar las reservas, validar los horarios disponibles y gestionar las funciones del panel profesional.

Utiliza **PostgreSQL** para almacenar la información de manera permanente.

## Funcionalidades principales

- Consultar profesionales y servicios disponibles.
- Obtener horarios disponibles para realizar reservas.
- Crear reservas y evitar conflictos de horario.
- Permitir al profesional iniciar y cerrar sesión.
- Confirmar o rechazar solicitudes de reserva.
- Consultar la agenda profesional.
- Modificar el perfil, los servicios y los horarios de trabajo.
- Configurar la aprobación manual o automática de reservas.

## Organización del backend

El código está organizado en carpetas según su responsabilidad:

| Carpeta | Función |
|---|---|
| `routes/` | Define las rutas de la API. |
| `controllers/` | Recibe las peticiones y entrega respuestas. |
| `services/` | Contiene las reglas de negocio. |
| `database/` | Gestiona la conexión y las tablas de PostgreSQL. |
| `docs/` | Contiene la documentación Swagger/OpenAPI. |
| `test/` | Contiene las pruebas automatizadas. |

Esta separación permite mantener el código ordenado y facilita su mantenimiento.

## Base de datos

Se utiliza PostgreSQL con cinco tablas principales:

- `professionals`: información y configuración de los profesionales.
- `services`: servicios ofrecidos por cada profesional.
- `bookings`: reservas y sus estados.
- `working_hours`: jornadas y horarios de atención.
- `professional_sessions`: sesiones de acceso al panel.

Los datos se conservan aunque se detenga o reinicie la aplicación.

## Reservas y FIFO

El backend comprueba la disponibilidad considerando la jornada laboral, la duración del servicio y las reservas existentes.

Las solicitudes pueden estar pendientes, confirmadas, rechazadas, canceladas o completadas.

**FIFO (First In, First Out)** significa que, cuando dos solicitudes compiten por el mismo horario, tiene prioridad la que se registró primero.

El sistema compara la fecha de creación y el identificador de cada solicitud. Antes de confirmar, vuelve a verificar que la reserva sea válida y que no exista un conflicto.

Las reservas de horarios independientes no interfieren entre sí.

## API REST

El backend se comunica con React mediante peticiones HTTP y respuestas JSON.

Algunas rutas principales son:

| Método | Ruta | Función |
|---|---|---|
| GET | `/api/professionals` | Consultar profesionales |
| GET | `/api/services` | Consultar servicios |
| GET | `/api/availability` | Consultar disponibilidad |
| POST | `/api/bookings` | Crear una reserva |
| POST | `/api/auth/login` | Iniciar sesión |
| GET | `/api/professional/bookings` | Consultar solicitudes |
| GET | `/api/professional/agenda` | Consultar agenda |
| GET | `/api/health` | Comprobar el servidor y la base de datos |

El resto de los endpoints se puede consultar en Swagger.

**Swagger UI:** http://localhost:5173/api/docs

## Seguridad

El panel profesional requiere autenticación.

Las contraseñas se almacenan mediante hashes y las sesiones se guardan en PostgreSQL. Las operaciones privadas requieren una sesión válida y protección CSRF para realizar modificaciones.

Cada profesional puede administrar únicamente sus propios datos.

## Ejecución

La forma recomendada de ejecutar BarberBook es mediante Docker Compose, desde la raíz del proyecto:

`docker compose up --build -d`

Esto inicia frontend, backend y PostgreSQL como servicios independientes.

También se puede ejecutar el backend localmente, manteniendo PostgreSQL funcionando:

`npm run dev --prefix backend`

**Servidor:** http://localhost:3003

**Verificación:** http://localhost:3003/api/health

Para una instalación nueva es necesario preparar la base de datos y las credenciales iniciales. El procedimiento está explicado en el [README principal](../README.md). No es necesario repetirlo al iniciar una instalación que ya contiene datos.

## Pruebas

El proyecto cuenta con pruebas automatizadas para comprobar:

- Reservas y disponibilidad.
- Conflictos de horarios y FIFO.
- Inicio de sesión y permisos.
- Configuración profesional.
- Persistencia de datos.
- Documentación de la API.

Para ejecutarlas desde la raíz del proyecto:

`npm test --prefix backend`

En la verificación registrada el 15 de noviembre de 2026 se aprobaron **51 pruebas del backend**.

## Tecnologías utilizadas

- Node.js 24
- Express 5
- PostgreSQL 17
- Swagger / OpenAPI 3.0.3
- Docker Compose

El backend forma parte de BarberBook Taller 3, proyecto académico de Desarrollo Web y Móvil.