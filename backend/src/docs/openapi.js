import { schemas, ref } from './schemas.js';
import { publicPaths, professionalPaths } from './operations.js';

export const openapi = {
  openapi: '3.0.3',
  info: {
    title: 'BarberBook Taller 3 · API REST', version: '1.0.0',
    description: 'Contrato de la API Express y PostgreSQL existente. Los ejemplos son ilustrativos, no contienen credenciales reales ni se ejecutan automáticamente. Para pruebas sin alterar datos, usar GET y el formulario de sesión. Las escrituras modifican la base conectada. Zona de negocio: America/Santiago.',
  },
  servers: [{ url: '/api', description: 'Mismo origen: Nginx en localhost:5173 o Express directo en localhost:3003.' }],
  tags: ['Salud de la API', 'Catálogo público', 'Disponibilidad', 'Reservas', 'Autenticación', 'Solicitudes profesionales', 'Agenda', 'Perfil', 'Administración de servicios', 'Jornadas laborales', 'Configuración de aprobación'].map((name) => ({ name })),
  paths: {
    '/health': { get: {
      operationId: 'getHealth', tags: ['Salud de la API'], summary: 'Comprobar API y conexión SQL', security: [],
      responses: {
        200: { description: 'PostgreSQL responde.', content: { 'application/json': { schema: ref('Health'), example: { status: 'ok', database: 'connected' } } } },
        503: { description: 'No se pudo consultar PostgreSQL.', content: { 'application/json': { schema: ref('Health'), example: { status: 'error', database: 'unavailable' } } } },
      },
    } },
    ...publicPaths, ...professionalPaths,
    '/openapi.json': { get: {
      operationId: 'getOpenApiDocument', tags: ['Salud de la API'], summary: 'Obtener este documento OpenAPI', security: [],
      responses: { 200: { description: 'Especificación OpenAPI 3.0.3 pública, sin datos de sesión.', content: { 'application/json': { schema: { type: 'object', required: ['openapi', 'info', 'paths'], additionalProperties: true } } } } },
    } },
  },
  components: {
    schemas,
    securitySchemes: {
      bookingTracking: { type: 'http', scheme: 'bearer', bearerFormat: 'token opaco', description: 'Credencial específica de una reserva. Usar HTTPS fuera de la demostración local.' },
      cookieSession: { type: 'apiKey', in: 'cookie', name: 'barberbook_t3_session', description: 'Cookie HttpOnly/SameSite Strict/path=/api, gestionada por el navegador. No pegar el token en Authorize. Usar el formulario de sesión superior o iniciar sesión en BarberBook con el mismo host.' },
      csrfToken: { type: 'apiKey', in: 'header', name: 'X-CSRF-Token', description: 'Obligatorio en escrituras privadas. La página de documentación lo obtiene de la sesión y lo añade automáticamente desde memoria. No es una alternativa a la cookie: se requieren ambos.' },
    },
  },
};

openapi.paths['/auth/login'].post.responses[200].headers = {
  'Set-Cookie': { description: 'barberbook_t3_session; HttpOnly; SameSite=Strict; Path=/api; ocho horas. Secure depende de HTTPS/COOKIE_SECURE. El navegador la guarda sin exponer su valor a JavaScript.', schema: { type: 'string' } },
};
