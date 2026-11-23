const text = (example, description) => ({ type: 'string', ...(example === undefined ? {} : { example }), ...(description ? { description } : {}) });
const id = { type: 'integer', minimum: 1, example: 1 };
const instant = { type: 'string', format: 'date-time', example: '2030-01-07T13:00:00.000Z' };
const boolean = { type: 'boolean' };
export const ref = (name) => ({ $ref: `#/components/schemas/${name}` });
export const array = (items) => ({ type: 'array', items });
const object = (properties, required = Object.keys(properties)) => ({ type: 'object', properties, ...(required.length ? { required } : {}) });
const states = ['pending', 'confirmed', 'rejected', 'cancelled', 'completed'];
const profile = {
  id, name: text('Profesional de ejemplo'), bio: { ...text('Presentación profesional.'), nullable: true },
  title: text('Barbero'), specialties: array(text('Corte clásico')), location: text('Ubicación de ejemplo'),
  instagram: text('@perfil_ejemplo'), whatsapp: text('+56900000000'),
};
const profileWrite = {
  name: { ...text('Profesional de ejemplo', 'No vacío; hasta 100 caracteres después de trim.'), pattern: '\\S' },
  bio: text('Presentación profesional.', 'Hasta 2000 caracteres después de trim; cadena vacía permitida, null no permitido.'),
  title: text('Barbero', 'Hasta 100 caracteres después de trim.'),
  specialties: { ...array({ type: 'string', pattern: '\\S', description: 'Hasta 60 caracteres después de trim.' }), maxItems: 8, description: 'Se recortan espacios y se eliminan duplicados.' },
  location: text('Ubicación de ejemplo', 'Hasta 200 caracteres después de trim.'),
  instagram: text('@perfil_ejemplo', 'Vacío o usuario opcionalmente precedido de @; de 1 a 30 letras, números, punto o guion bajo.'),
  whatsapp: text('+56900000000', 'Vacío o 6–30 caracteres: dígitos, espacios, paréntesis, guion y + inicial opcional.'),
};
const service = { id, name: text('Servicio de ejemplo'), duration_minutes: { type: 'integer', minimum: 1, example: 45 }, price: { type: 'integer', minimum: 0, example: 10000 } };
const serviceWrite = {
  name: { ...text('Servicio de ejemplo', 'No vacío; hasta 100 caracteres después de trim; nombre único por profesional sin distinguir mayúsculas y espacios exteriores.'), pattern: '\\S' },
  duration_minutes: { type: 'integer', minimum: 5, maximum: 480, multipleOf: 5, example: 45 },
  price: { type: 'integer', minimum: 0, maximum: 100000000, example: 10000 },
  active: { type: 'boolean', default: true },
};
const booking = {
  id, service_id: id, customer_name: text('Cliente de ejemplo'), customer_phone: text('+56900000000'),
  starts_at: instant, ends_at: { ...instant, example: '2030-01-07T13:45:00.000Z' },
  status: { type: 'string', enum: states }, created_at: instant,
  service_name_snapshot: { ...text('Servicio de ejemplo'), nullable: true },
  service_price_snapshot: { type: 'integer', nullable: true, example: 10000 },
};
const time = { type: 'string', pattern: '^(?:[01]\\d|2[0-3]):[0-5]\\d$|^24:00$', example: '10:00' };
const date = { type: 'string', format: 'date', example: '2030-01-07' };

export const schemas = {
  Error: object({ error: text('Mensaje de error del servidor.') }),
  Health: object({ status: { type: 'string', enum: ['ok', 'error'] }, database: { type: 'string', enum: ['connected', 'unavailable'] } }),
  Profile: object(profile),
  ProfileUpdate: { ...object(profileWrite, []), minProperties: 1, additionalProperties: false },
  PublicProfessional: object({ ...profile, automatic_approval: boolean, working_hours: array(ref('WorkingInterval')) }),
  WorkingInterval: object({ weekday: { type: 'integer', minimum: 0, maximum: 6, description: 'Domingo=0, lunes=1.' }, startMinute: { type: 'integer', minimum: 0 }, endMinute: { type: 'integer', maximum: 1440 } }),
  PublicService: object({ id, professional_id: id, name: service.name, duration_minutes: service.duration_minutes, price: service.price }),
  ManagedService: object({ ...service, active: boolean }),
  ServiceCreate: { ...object(serviceWrite, ['name', 'duration_minutes', 'price']), additionalProperties: false },
  ServiceUpdate: { ...object(serviceWrite, []), minProperties: 1, additionalProperties: false },
  BookingCreate: {
    ...object({ serviceId: id, customerName: { type: 'string', pattern: '\\S', maxLength: 100, example: 'Cliente de ejemplo' },
      customerPhone: { type: 'string', pattern: '\\S', maxLength: 30, example: '+56900000000', description: 'El backend exige texto no vacío; no impone el formato chileno del formulario React.' },
      startsAt: { ...instant, description: 'Instante futuro con Z u offset explícito. Usar startsAt recibido de /availability; debe pertenecer a la jornada y admitir la duración completa.' } }),
    description: 'Los campos adicionales se ignoran. Los límites de nombre/teléfono corresponden al esquema SQL; sobrepasarlos puede producir un error interno en el backend actual.',
  },
  Booking: object(booking),
  BookingCreated: { allOf: [ref('Booking'), object({
    trackingToken: { type: 'string', pattern: '^[a-f0-9]{64}$', description: 'Credencial privada emitida una sola vez. Guardar de forma segura.' },
  })] },
  TrackedBooking: object({
    id, status: { type: 'string', enum: states }, startsAt: instant,
    professionalName: profile.name, serviceName: service.name,
  }),
  ProfessionalBooking: { allOf: [ref('Booking'), object({ professional_id: id, service_name: text('Servicio de ejemplo', 'Nombre histórico, con respaldo del catálogo si todavía no hay copia.') })] },
  BookingStatusUpdate: { ...object({ status: { type: 'string', enum: ['confirmed', 'rejected'], example: 'confirmed' } }), additionalProperties: false },
  Login: { ...object({ email: { type: 'string', format: 'email', maxLength: 254, example: 'profesional@example.invalid' }, password: { type: 'string', format: 'password', writeOnly: true, minLength: 1, maxLength: 128, description: 'Clave privada. Usar preferentemente el formulario protegido superior, no pegarla en ejemplos o capturas.' } }), additionalProperties: false },
  Session: object({ id, name: text('Profesional de ejemplo'), email: { type: 'string', format: 'email', example: 'profesional@example.invalid' }, automatic_approval: boolean,
    csrfToken: { type: 'string', readOnly: true, pattern: '^[a-f0-9]{64}$', description: 'Token CSRF privado de esta sesión; no es el token HttpOnly. La documentación lo mantiene únicamente en memoria.' } }),
  Logout: object({ loggedOut: { type: 'boolean', enum: [true] } }),
  ApprovalUpdate: { ...object({ automatic_approval: { type: 'boolean', example: false } }), additionalProperties: false },
  Approval: object({ id, name: profile.name, automatic_approval: boolean }),
  AvailableSlot: object({ time: { type: 'string', example: '10:00' }, startsAt: instant, endsAt: instant, isBookable: boolean,
    bookingStatus: { type: 'string', enum: ['available', 'pending', 'confirmed', 'unavailable'] } }),
  AvailabilityDay: object({ id: date, available: boolean, slots: array(ref('AvailableSlot')) }),
  CivilInterval: { ...object({ start: time, end: { ...time, example: '13:00' } }), additionalProperties: false, description: 'Inicio menor que término; inicio 24:00 no puede formar un intervalo válido. Intervalos del mismo día sin superposición.' },
  WorkingDay: { ...object({ day: { type: 'integer', minimum: 0, maximum: 6 }, enabled: boolean,
    intervals: { ...array(ref('CivilInterval')), maxItems: 4 } }), additionalProperties: false,
    description: 'Día activo: 1–4 intervalos. Día cerrado: cero intervalos. No se pueden repetir días dentro de la semana.' },
  WorkingWeek: { ...object({ days: { ...array(ref('WorkingDay')), minItems: 7, maxItems: 7 } }), additionalProperties: false,
    example: { days: [1, 2, 3, 4, 5, 6, 0].map((day) => ({ day, enabled: day !== 0, intervals: day === 0 ? [] : [{ start: '10:00', end: '13:00' }] })) } },
  AgendaServiceOffer: object({ id, name: service.name, duration: service.duration_minutes, endsAt: instant, isBookable: boolean,
    status: { type: 'string', enum: ['available', 'pending', 'confirmed', 'unavailable'] } }),
  AgendaSlot: object({ time: { type: 'string', example: '10:00' }, startsAt: instant, services: array(ref('AgendaServiceOffer')) }),
  AgendaDay: object({ id: date, intervals: array(object({ startMinute: { type: 'integer' }, endMinute: { type: 'integer' } })), working: boolean,
    slots: array(ref('AgendaSlot')), bookings: array(ref('ProfessionalBooking')) }),
  Agenda: object({ timeZone: { type: 'string', enum: ['America/Santiago'] }, days: { ...array(ref('AgendaDay')), minItems: 14, maxItems: 14 } }),
};
