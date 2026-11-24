# BarberBook Mobile | Hito 4

Aplicación móvil de BarberBook desarrollada con React Native y Expo para la asignatura Desarrollo Web y Móvil.

**Estudiante:** Martín Cerpa

## Descripción

BarberBook Mobile permite a los clientes consultar servicios de barbería, solicitar horas de atención, revisar el estado de sus reservas y cancelarlas cuando corresponda.

También incorpora un panel profesional para gestionar solicitudes, consultar la agenda y modificar la configuración del negocio.

La aplicación utiliza la misma API REST y base de datos PostgreSQL de BarberBook Web, desarrolladas durante el Hito 3.

## Tecnologías

- React Native 0.88.1.
- React 19.3.0.
- Expo SDK 58.
- Expo Router.
- Expo SecureStore.
- JavaScript y TypeScript.
- ESLint.

## Funcionalidades

### Cliente

- Consulta del perfil público del profesional.
- Catálogo de servicios, precios y duración.
- Consulta de disponibilidad de horarios.
- Solicitud de reservas.
- Validación de datos de contacto.
- Comprobante de reserva.
- Seguimiento de múltiples reservas.
- Actualización individual y general de estados.
- Cancelación de reservas pendientes o confirmadas.
- Tema claro y oscuro.

### Profesional

- Inicio y cierre de sesión.
- Resumen de la jornada.
- Solicitudes pendientes.
- Confirmación y rechazo de reservas.
- Historial desplegable.
- Agenda de 14 días.
- Edición del perfil público.
- Edición de servicios existentes.
- Configuración de horarios y pausas.
- Aprobación manual o automática.

## Estructura del proyecto

```text
mobile/
├── assets/
├── src/
│   ├── app/
│   │   ├── _layout.tsx
│   │   ├── index.jsx
│   │   ├── mi-reserva.jsx
│   │   ├── reserva/
│   │   │   └── [professionalId].jsx
│   │   └── profesional/
│   │       ├── _layout.jsx
│   │       ├── solicitudes.jsx
│   │       ├── agenda.jsx
│   │       └── (inicio)/
│   │           ├── _layout.jsx
│   │           ├── index.jsx
│   │           └── ajustes.jsx
│   ├── components/
│   ├── hooks/
│   ├── services/
│   ├── theme/
│   └── utils/
├── test/
├── package.json
└── README.md
```

Las pantallas se organizan mediante Expo Router. Los componentes reutilizables se encuentran separados de los servicios HTTP, las funciones auxiliares y la gestión de estados.

## Instalación y ejecución

### 1. Iniciar el backend

Desde la raíz del repositorio, iniciar Docker Desktop y ejecutar:

```bash
docker compose up --build -d
```

Si se trata de una instalación nueva, seguir primero las instrucciones de configuración e inicialización del [README principal](../README.md).

Comprobar el funcionamiento del backend:

```bash
curl http://localhost:3003/api/health
```

Respuesta esperada:

```json
{
  "status": "ok",
  "database": "connected"
}
```

### 2. Configurar la conexión desde el teléfono

El computador y el teléfono deben estar conectados a la misma red local.

En Windows, ejecutar:

```bash
ipconfig
```

Identificar la dirección IPv4 del adaptador de red utilizado.

El archivo `compose.yaml` publicado restringe inicialmente el acceso al backend a:

```yaml
ports:
  - "127.0.0.1:3003:3003"
```

Para realizar una demostración desde un dispositivo físico, modificar localmente esta configuración:

```yaml
ports:
  - "0.0.0.0:3003:3003"
```

También se puede utilizar específicamente la dirección IPv4 del adaptador del computador.

Mantener PostgreSQL restringido a loopback y limitar el acceso al puerto 3003 mediante el firewall a la red privada de pruebas.

Aplicar el cambio:

```bash
docker compose up -d --build backend
```

### 3. Configurar la API

Crear un archivo `.env.local` dentro de `mobile/`:

```dotenv
EXPO_PUBLIC_API_URL=http://IP_DEL_PC:3003/api
```

Reemplazar `IP_DEL_PC` por la dirección IPv4 del computador.

Esta variable debe contener solamente la dirección de la API, sin contraseñas ni credenciales.

Desde el navegador del teléfono, comprobar:

```text
http://IP_DEL_PC:3003/api/health
```

Si no responde, revisar la conexión de red, el firewall y el estado del backend.

### 4. Instalar dependencias

Desde la raíz del repositorio:

```bash
cd mobile
npm ci
```

### 5. Iniciar Expo

```bash
npm start -- --clear
```

Abrir Expo Go en un dispositivo Android compatible y escanear el código QR generado.

La aplicación utiliza el backend definido en `EXPO_PUBLIC_API_URL`.

No es necesario publicar la aplicación en una tienda para realizar la demostración académica.

## Navegación

La aplicación utiliza Expo Router para gestionar la navegación basada en archivos.

| Ruta | Funcionalidad |
|---|---|
| `/` | Perfil público y catálogo. |
| `/reserva/[professionalId]` | Flujo de solicitud de reservas. |
| `/mi-reserva` | Seguimiento y cancelación de reservas. |
| `/profesional` | Acceso y resumen profesional. |
| `/profesional/solicitudes` | Gestión de solicitudes. |
| `/profesional/agenda` | Agenda profesional. |
| `/profesional/ajustes` | Configuración profesional. |

El panel profesional utiliza una barra inferior con tres pestañas: Inicio, Solicitudes y Agenda.

Ajustes se encuentra dentro de la sección Inicio.

## Flujo de reserva

El proceso de reserva se divide en cuatro etapas:

1. Selección del servicio.
2. Selección de fecha y hora.
3. Ingreso de datos de contacto.
4. Revisión y envío de la solicitud.

La disponibilidad se obtiene directamente desde el backend, considerando los horarios de atención, la duración del servicio y las reservas existentes.

Antes de registrar una reserva, el backend vuelve a comprobar la disponibilidad.

En caso de éxito, la aplicación muestra un comprobante con el número y estado de la reserva.

## Reservas competitivas

Varios clientes pueden solicitar un mismo horario mientras sus reservas se encuentren pendientes.

El backend aplica una política FIFO entre solicitudes elegibles que se solapan.

Las reservas confirmadas impiden confirmar otras atenciones que ocupen intervalos incompatibles.

Las reglas de disponibilidad y confirmación se mantienen en Express y PostgreSQL.

## Mis reservas

La aplicación permite conservar y consultar varias reservas desde una misma instalación.

Cada reserva utiliza una credencial individual de seguimiento, generada por el backend y almacenada mediante Expo SecureStore.

Las credenciales se organizan por dirección de API y se conservan entre sesiones de la aplicación.

Las próximas reservas se muestran cronológicamente y pueden consultarse mediante un carrusel horizontal.

El usuario puede actualizar una reserva individualmente o consultar nuevamente todas las reservas.

Ante errores de comunicación, se conservan las credenciales existentes y se permite reintentar la consulta.

## Cancelación de reservas

El cliente puede cancelar reservas pendientes o confirmadas utilizando su credencial de seguimiento.

La aplicación solicita una confirmación antes de ejecutar la operación.

Cuando el backend confirma la cancelación:

- La reserva cambia al estado `cancelled`.
- La tarjeta desaparece de Mis reservas.
- Se elimina su credencial local.
- Las demás reservas permanecen disponibles.
- El registro se conserva en PostgreSQL.
- El profesional puede consultar la cancelación en su historial.

Si se pierde la conexión durante la operación, la aplicación consulta nuevamente el estado antes de considerar que la cancelación fue exitosa.

## Panel profesional

### Inicio

Muestra un resumen de la jornada mediante tarjetas con:

- Solicitudes pendientes.
- Reservas confirmadas del día.
- Próxima atención.

También permite acceder a Solicitudes, Agenda y Ajustes.

### Solicitudes

Las solicitudes pendientes se muestran primero, ordenadas por fecha y hora de atención.

El profesional puede confirmar o rechazar solicitudes.

El historial de solicitudes resueltas permanece contraído inicialmente y puede desplegarse cuando sea necesario.

Las decisiones sobre disponibilidad y prioridad FIFO corresponden al backend.

### Agenda

Permite consultar las atenciones confirmadas durante los próximos 14 días.

Incluye un selector de fechas, el resumen de la jornada, la próxima atención y estados vacíos cuando no existen reservas.

### Ajustes

Permite modificar:

- Perfil público.
- Nombre, precio, duración y visibilidad de servicios existentes.
- Jornada semanal y pausas.
- Modalidad de aprobación manual o automática.

Después de guardar una configuración, la aplicación vuelve a consultar la API para obtener los datos actualizados.

## Endpoints utilizados

La aplicación utiliza 19 combinaciones de método y ruta de la API REST compartida.

| Método | Endpoint | Funcionalidad | Autorización |
|---|---|---|---|
| GET | `/api/professionals` | Perfil público | Pública |
| GET | `/api/services` | Catálogo de servicios | Pública |
| GET | `/api/availability` | Disponibilidad | Pública |
| POST | `/api/bookings` | Crear reserva | Pública |
| GET | `/api/bookings/:id/tracking` | Seguimiento | Bearer |
| POST | `/api/bookings/:id/cancel` | Cancelación | Bearer |
| POST | `/api/auth/login` | Inicio de sesión | Credenciales |
| GET | `/api/auth/session` | Consultar sesión | Cookie |
| POST | `/api/auth/logout` | Cerrar sesión | Cookie + CSRF |
| GET | `/api/professional/bookings` | Consultar solicitudes | Cookie |
| PATCH | `/api/professional/bookings/:id/status` | Confirmar o rechazar | Cookie + CSRF |
| GET | `/api/professional/agenda` | Consultar agenda | Cookie |
| GET | `/api/professional/profile` | Consultar perfil | Cookie |
| PATCH | `/api/professional/profile` | Actualizar perfil | Cookie + CSRF |
| GET | `/api/professional/services` | Consultar servicios | Cookie |
| PATCH | `/api/professional/services/:id` | Editar servicio | Cookie + CSRF |
| GET | `/api/professional/working-hours` | Consultar jornada | Cookie |
| PUT | `/api/professional/working-hours` | Actualizar jornada | Cookie + CSRF |
| PATCH | `/api/professional/settings` | Configurar aprobación | Cookie + CSRF |

La documentación completa de la API está disponible mediante Swagger:

http://localhost:5173/api/docs

## Seguridad

El seguimiento de reservas requiere una credencial individual enviada mediante la cabecera:

```http
Authorization: Bearer <trackingToken>
```

El número de reserva por sí solo no permite acceder a su información.

La autenticación profesional utiliza cookies HttpOnly y protección CSRF para operaciones que modifican información.

La aplicación no almacena contraseñas profesionales ni tokens CSRF de forma persistente.

El entorno HTTP local debe utilizarse exclusivamente con datos ficticios y en una red controlada. Para utilizar datos reales se requiere una configuración HTTPS apropiada.

## Validaciones y estados de interfaz

La aplicación contempla:

- Validación de campos obligatorios.
- Validación del nombre y teléfono del cliente.
- Validación de horarios disponibles.
- Mensajes de error de la API.
- Manejo de conflictos de reservas.
- Estados de carga.
- Estados sin resultados.
- Confirmación de operaciones.
- Reintentos ante errores de conexión.
- Manejo de sesiones vencidas.

## Pruebas automatizadas

Desde `mobile/`, ejecutar:

```bash
npm run test:booking-tracking
npm run test:professional-panel
npm run lint
npm run typecheck
npx expo install --check
```

Resultados de la auditoría final:

| Prueba | Resultado |
|---|---|
| Seguimiento y cancelación | 23 pruebas aprobadas |
| Panel profesional | 7 pruebas aprobadas |
| ESLint | Aprobado |
| TypeScript | Aprobado |

Durante el sprint anterior también se verificó la compatibilidad de las dependencias de Expo y la generación de bundles para Android e iOS.

Las pruebas móviles utilizan mocks y no modifican las reservas almacenadas en PostgreSQL.

Las comprobaciones físicas en Android complementan las pruebas automatizadas.

## Demostración de integración

Para verificar que la aplicación móvil comparte los datos con BarberBook Web:

1. Crear una reserva ficticia desde Android.
2. Registrar el número de reserva.
3. Buscar la misma reserva en el panel web.
4. Confirmar la solicitud desde la web.
5. Actualizar Mis reservas desde Android.
6. Comprobar el nuevo estado.
7. Cancelar la reserva desde el móvil.
8. Verificar la cancelación en el panel profesional.

También se recomienda probar una validación de formulario, los estados sin resultados, la navegación y la actualización de configuraciones profesionales.

## Limitaciones

- El historial de reservas depende de las credenciales conservadas en el dispositivo.
- No existe sincronización del historial entre diferentes teléfonos.
- No se pueden recuperar automáticamente reservas antiguas sin una credencial disponible.
- No se calcula una posición explícita dentro de una fila de turnos.
- La aplicación requiere conexión con el backend.
- No se incluyen todas las operaciones administrativas de la versión web.
- La ejecución en HTTP local está destinada a pruebas académicas.

## Uso de inteligencia artificial

Durante el desarrollo se utilizó ChatGPT como apoyo para analizar requisitos, organizar el trabajo y discutir soluciones.

Codex se utilizó para implementar y revisar funcionalidades, corregir errores, preparar pruebas y auditar el código.

Modern Web Guidance se utilizó como referencia para formularios, accesibilidad y organización de la interfaz, adaptando sus recomendaciones a React Native.

Los resultados se revisaron mediante comprobaciones automatizadas y pruebas de desarrollo en Android.

## Documentación complementaria

- [README principal](../README.md)
- [Documentación del backend](../backend/README.md)
- [Documentación del cliente web](../frontend/README.md)

## Autor

Martín Cerpa.

Desarrollo Web y Móvil, segundo semestre de 2026.