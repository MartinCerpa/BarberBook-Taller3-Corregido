import { array, ref } from './schemas.js';

const json = (schema) => ({ 'application/json': { schema } });
const data = (schema) => ({ type: 'object', required: ['data'], properties: { data: schema } });
const messages = {
  400: 'Petición, campos o filtros inválidos.', 401: 'Sesión ausente o vencida; o credenciales incorrectas en login.',
  403: 'CSRF inválido/ausente en escritura privada; u origen no permitido en login.', 404: 'Servicio o reserva inexistente, inactiva cuando corresponda, o ajena al profesional.',
  409: 'Conflicto de horario, FIFO, transición inválida, nombre duplicado o jornada incompatible.',
  413: 'El JSON supera el límite de 32 kb.', 422: 'Hora fuera de jornada, pasada o duración incompatible.',
  429: 'Diez fallos de login por IP en quince minutos; esperar antes de reintentar.', 500: 'Error interno; no se exponen detalles privados.',
};
export function operation(operationId, tag, summary, description, schema, { privateRead = false, write = false, status = 200, errors = [], parameters, body } = {}) {
  return {
    operationId, tags: [tag], summary, description,
    security: privateRead || write ? [{ cookieSession: [], ...(write ? { csrfToken: [] } : {}) }] : [],
    ...(parameters ? { parameters } : {}),
    ...(body ? { requestBody: { required: true, content: json(ref(body)) } } : {}),
    responses: {
      [status]: { description: 'Operación correcta.', content: json(data(schema)) },
      ...Object.fromEntries([...new Set([...(privateRead || write ? [401] : []), ...(write ? [403] : []), ...(body ? [413] : []), ...errors, 500])]
        .map((code) => [code, { description: messages[code], content: json(ref('Error')) }])),
    },
  };
}
const queryId = (name, description) => ({ name, in: 'query', required: true, description, schema: { type: 'integer', minimum: 1 }, example: 1 });
export const resourceId = { name: 'id', in: 'path', required: true, description: 'Identificador positivo, seguro para JavaScript, del recurso propio.', schema: { type: 'integer', minimum: 1, maximum: Number.MAX_SAFE_INTEGER }, example: 1 };

export const publicPaths = {
  '/professionals': { get: operation('listPublicProfessionals', 'Catálogo público', 'Consultar profesionales', 'Perfil público y jornada SQL. No devuelve correo de acceso ni hash de contraseña.', array(ref('PublicProfessional'))) },
  '/services': { get: operation('listPublicServices', 'Catálogo público', 'Consultar servicios activos', 'Catálogo público activo, con precio y duración reales. Obtener aquí los IDs para consultar disponibilidad.', array(ref('PublicService'))) },
  '/availability': { get: operation('getAvailability', 'Disponibilidad', 'Consultar disponibilidad real', 'Calculada en America/Santiago desde working_hours, duración del servicio activo y reservas. Inicios cada 60 minutos desde cada intervalo. Las pendientes pueden competir y no bloquean como una confirmada. Los días cerrados o sin cabida conservan su fecha y slots vacío.', array(ref('AvailabilityDay')), {
    errors: [400, 404, 422], parameters: [queryId('professionalId', 'Profesional propietario del servicio.'), queryId('serviceId', 'Servicio activo de ese profesional.'),
      { name: 'days', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 30, default: 14 } },
      { name: 'startDate', in: 'query', description: 'Fecha civil válida. Omitir para partir de hoy en Chile; fechas pasadas muestran horas no reservables.', schema: { type: 'string', format: 'date' } }],
  }) },
  '/bookings': { post: operation('createBooking', 'Reservas', 'Crear una solicitud de reserva', 'Esta operación escribe datos reales. No ejecutar ejemplos sobre la base de demostración conservada. Usar un startsAt ofrecido por /availability. En modo manual queda pending; en automático puede quedar confirmed si está disponible y no adelanta una pendiente elegible. Nombre, precio y duración quedan conservados históricamente. La respuesta emite una única vez la credencial privada trackingToken.', ref('BookingCreated'), { status: 201, body: 'BookingCreate', errors: [400, 404, 409, 422] }) },
  '/auth/login': { post: operation('loginProfessional', 'Autenticación', 'Iniciar sesión profesional', 'Para no mostrar la contraseña en JSON/cURL, usar el formulario protegido superior. Este endpoint establece la cookie HttpOnly y devuelve identidad y csrfToken. La cookie no está en el JSON. Scrypt, sesión SQL de ocho horas y limitación de intentos; valida Origin si se envía.', ref('Session'), { body: 'Login', errors: [400, 401, 403, 429] }) },
  '/auth/session': { get: operation('getProfessionalSession', 'Autenticación', 'Consultar sesión actual', 'Requiere la cookie del mismo host. Devuelve modalidad actual y CSRF, no el token de sesión HttpOnly. No compartir ni capturar su respuesta con datos privados.', ref('Session'), { privateRead: true }) },
  '/auth/logout': { post: operation('logoutProfessional', 'Autenticación', 'Cerrar sesión', 'Sin cuerpo obligatorio. Cookie y X-CSRF-Token; revoca la sesión SQL y borra la cookie.', ref('Logout'), { write: true }) },
};

const trackingId = { ...resourceId, description: 'Identificador numérico de la reserva. Enviar la credencial solo en Authorization.', schema: { type: 'integer', minimum: 1, maximum: 2147483647 } };
const trackingOperation = (operationId, summary, description, errors = []) => {
  const endpoint = operation(operationId, 'Reservas', summary, description, ref('TrackedBooking'), {
    parameters: [trackingId], errors: [400, 401, 404, ...errors],
  });
  endpoint.security = [{ bookingTracking: [] }];
  endpoint.responses[401].description = 'Credencial de seguimiento ausente o mal formada.';
  endpoint.responses[404].description = 'No existe una reserva asociada a la combinación del identificador y la credencial.';
  return endpoint;
};

const tracking = trackingOperation(
  'trackBooking', 'Consultar el estado de una reserva propia',
  'Usar Authorization: Bearer con la credencial entregada al crear esa reserva. No devuelve datos de contacto ni la credencial. Las reservas anteriores a la migración no tienen acceso de seguimiento.',
);
publicPaths['/bookings/{id}/tracking'] = { get: tracking };

const cancel = trackingOperation(
  'cancelTrackedBooking', 'Cancelar una reserva propia',
  'Usar Authorization: Bearer con la credencial de esa reserva. Sin cuerpo. Cambia pending o confirmed a cancelled sin límite de anticipación. Repetir devuelve el mismo estado. Conserva la reserva y su seguimiento, sin resolver solicitudes competidoras. Usar solo datos de prueba al ejecutar el ejemplo.',
  [409],
);
cancel.responses[409].description = 'La reserva está rechazada o completada y no se puede cancelar.';
publicPaths['/bookings/{id}/cancel'] = { post: cancel };

export const professionalPaths = {
  '/professional/bookings': { get: operation('listProfessionalBookings', 'Solicitudes profesionales', 'Consultar reservas propias', 'Orden por created_at e id ascendente (orden FIFO de recepción SQL). Solo admite el filtro status; no acepta professionalId ni otros parámetros. La identidad proviene de la sesión.', array(ref('ProfessionalBooking')), {
    privateRead: true, errors: [400], parameters: [{ name: 'status', in: 'query', schema: { type: 'string', enum: ['pending', 'confirmed', 'rejected', 'cancelled', 'completed'] } }],
  }) },
  '/professional/bookings/{id}/status': { patch: operation('updateBookingStatus', 'Solicitudes profesionales', 'Confirmar o rechazar una pendiente', 'Solo pending → confirmed/rejected. Repetir el estado objetivo es idempotente. Confirmar revalida jornada, futuro, duración histórica, conflictos y FIFO entre pendientes solapadas elegibles. La petición se serializa por profesional. La respuesta idempotente puede incluir también professional_id.', ref('Booking'), { write: true, body: 'BookingStatusUpdate', parameters: [resourceId], errors: [400, 404, 409, 422] }) },
  '/professional/agenda': { get: operation('getProfessionalAgenda', 'Agenda', 'Consultar agenda de catorce días', 'No admite parámetros. Desde hoy en Chile: jornadas, oferta por servicio activo y reservas pending/confirmed propias. Incluye fechas sin reservas y días cerrados; no simula ocupación.', ref('Agenda'), { privateRead: true, errors: [400] }) },
  '/professional/profile': {
    get: operation('getProfessionalProfile', 'Perfil', 'Consultar perfil propio', 'Solo datos públicos editables del profesional autenticado, sin credenciales.', ref('Profile'), { privateRead: true }),
    patch: operation('updateProfessionalProfile', 'Perfil', 'Editar perfil propio', 'Uno o más campos permitidos; no admite correo, contraseña, professionalId ni imágenes. Se recortan espacios. Los cambios se reflejan en el perfil público.', ref('Profile'), { write: true, body: 'ProfileUpdate', errors: [400] }),
  },
  '/professional/services': {
    get: operation('listManagedServices', 'Administración de servicios', 'Consultar servicios propios', 'Incluye activos e inactivos. No devuelve servicios de otros profesionales.', array(ref('ManagedService')), { privateRead: true }),
    post: operation('createManagedService', 'Administración de servicios', 'Crear servicio propio', 'El profesional se toma de la sesión. El nombre no puede duplicar otro servicio propio, incluso inactivo.', ref('ManagedService'), { write: true, status: 201, body: 'ServiceCreate', errors: [400, 409] }),
  },
  '/professional/services/{id}': { patch: operation('updateManagedService', 'Administración de servicios', 'Editar o desactivar servicio propio', 'PATCH parcial. active=false retira la oferta pública sin borrar reservas ni modificar sus copias históricas. No se implementa DELETE. Cambiar duración afecta nuevas disponibilidades, no las duraciones ya solicitadas.', ref('ManagedService'), { write: true, body: 'ServiceUpdate', parameters: [resourceId], errors: [400, 404, 409] }) },
  '/professional/working-hours': {
    get: operation('getWorkingHours', 'Jornadas laborales', 'Consultar semana laboral propia', 'Siete días ordenados de lunes a domingo; varios intervalos representan descansos.', ref('WorkingWeek'), { privateRead: true }),
    put: operation('replaceWorkingHours', 'Jornadas laborales', 'Guardar semana laboral completa', 'Exactamente siete días distintos. Días activos con 1–4 intervalos válidos no superpuestos; cerrados con lista vacía. Rechaza y revierte la semana completa si deja una confirmada futura o en curso fuera de su intervalo/cadencia. No cancela ni reprograma reservas automáticamente.', ref('WorkingWeek'), { write: true, body: 'WorkingWeek', errors: [400, 409] }),
  },
  '/professional/settings': { patch: operation('updateApproval', 'Configuración de aprobación', 'Configurar aprobación automática', 'Booleano obligatorio. Cambiar modalidad no confirma en lote las pendientes previas. Las nuevas reservas automáticas siguen respetando disponibilidad y FIFO.', ref('Approval'), { write: true, body: 'ApprovalUpdate', errors: [400] }) },
};
