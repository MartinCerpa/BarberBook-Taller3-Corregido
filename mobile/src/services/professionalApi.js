import { consultarApi } from './api';

export const estadosSolicitud = {
  pending: 'Pendiente',
  confirmed: 'Confirmada',
  rejected: 'Rechazada',
  cancelled: 'Cancelada',
  completed: 'Completada',
};

export async function obtenerSesionProfesional() {
  try {
    const data = await consultarApi('/auth/session', { session: true });
    if (!Number.isSafeInteger(data?.id) || data.id <= 0 || typeof data.name !== 'string'
      || typeof data.automatic_approval !== 'boolean'
      || typeof data.csrfToken !== 'string' || !/^[0-9a-f]{64}$/.test(data.csrfToken)) {
      throw new Error('No pudimos leer la sesión profesional.');
    }
    return { id: data.id, name: data.name, automatic_approval: data.automatic_approval, csrfToken: data.csrfToken };
  } catch (error) {
    if (error.status === 401) return null;
    throw error;
  }
}

export async function iniciarSesionProfesional(email, password) {
  const login = await consultarApi('/auth/login', { method: 'POST', body: { email, password }, session: true });
  // El JSON del login no prueba que el cliente reenviará la cookie HttpOnly.
  const session = await obtenerSesionProfesional();
  if (!session || session.id !== login?.id || session.csrfToken !== login.csrfToken) {
    throw new Error('El servidor aceptó el acceso, pero no pudimos verificar la nueva cookie de sesión. Comprueba el mismo host y el uso de HTTPS.');
  }
  return session;
}

export async function obtenerSolicitudes() {
  const data = await consultarApi('/professional/bookings', { session: true });
  if (!Array.isArray(data) || !data.every(esSolicitud)) {
    throw new Error('El servidor devolvió un listado de solicitudes inválido.');
  }
  return data;
}

function esSolicitud(item) {
  return Number.isSafeInteger(item?.id) && item.id > 0
    && Object.hasOwn(estadosSolicitud, item.status) && typeof item.customer_name === 'string'
    && typeof item.customer_phone === 'string' && typeof item.service_name === 'string'
    && typeof item.starts_at === 'string' && typeof item.ends_at === 'string'
    && Date.parse(item.starts_at) < Date.parse(item.ends_at);
}

export async function obtenerAgendaProfesional() {
  const data = await consultarApi('/professional/agenda', { session: true });
  if (data?.timeZone !== 'America/Santiago' || !Array.isArray(data.days) || !data.days.every((day) => (
    typeof day?.id === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(day.id)
    && Number.isFinite(Date.parse(day.id)) && Array.isArray(day.bookings) && day.bookings.every(esSolicitud)
  ))) {
    throw new Error('El servidor devolvió una agenda inválida.');
  }
  return data.days;
}

export async function cambiarEstadoSolicitud(id, status, csrfToken) {
  const uncertainMessage = 'No pudimos comprobar el cambio. Actualiza la lista antes de volver a intentarlo.';
  const data = await consultarApi(`/professional/bookings/${id}/status`, {
    method: 'PATCH', body: { status }, session: true, csrfToken, uncertainMessage,
  });
  if (data?.id !== id || data.status !== status) throw new Error(uncertainMessage);
  return data.status;
}

export async function cerrarSesionProfesional(csrfToken) {
  try {
    const data = await consultarApi('/auth/logout', {
      method: 'POST', session: true, csrfToken,
      uncertainMessage: 'No pudimos comprobar el cierre de sesión. Vuelve a intentarlo.',
    });
    if (data?.loggedOut !== true) {
      throw new Error('No pudimos comprobar el cierre de sesión. Vuelve a intentarlo.');
    }
  } catch (error) {
    if (error.status !== 401) throw error;
  }
}

const configPath = '/professional';
const profilePath = configPath + '/profile';
const servicesPath = configPath + '/services';
const hoursPath = configPath + '/working-hours';
const approvalPath = configPath + '/settings';

async function leerAjuste(path, validate) {
  const data = await consultarApi(path, { session: true });
  if (!validate(data)) throw new Error('El servidor devolvió una configuración inválida.');
  return data;
}

async function guardarAjuste(path, method, body, csrfToken, validate) {
  const uncertainMessage = 'No pudimos comprobar el guardado. Consulta los datos antes de volver a guardar.';
  const data = await consultarApi(path, { session: true, method, csrfToken, body, uncertainMessage });
  if (!validate(data)) throw Object.assign(new Error(uncertainMessage), { uncertain: true });
  return data;
}

const positiveId = (id) => Number.isSafeInteger(id) && id > 0;
const esPerfil = (value) => positiveId(value?.id)
  && ['name', 'title', 'location', 'instagram', 'whatsapp'].every((field) => typeof value[field] === 'string')
  && (value.bio === null || typeof value.bio === 'string')
  && Array.isArray(value.specialties) && value.specialties.every((item) => typeof item === 'string');
const esServicio = (value) => positiveId(value?.id) && typeof value.name === 'string'
  && Number.isInteger(value.duration_minutes) && Number.isInteger(value.price) && typeof value.active === 'boolean';
const esJornada = (value) => Array.isArray(value?.days) && value.days.length === 7
  && new Set(value.days.map((day) => day?.day)).size === 7
  && value.days.every((day) => Number.isInteger(day?.day) && day.day >= 0 && day.day <= 6
    && typeof day.enabled === 'boolean' && Array.isArray(day.intervals)
    && day.intervals.every((item) => typeof item?.start === 'string' && typeof item.end === 'string'));

export const obtenerPerfilProfesional = () => leerAjuste(profilePath, esPerfil);
export const guardarPerfilProfesional = (profile, csrf) => guardarAjuste(profilePath, 'PATCH', profile, csrf, esPerfil);
export const obtenerServiciosProfesionales = () => leerAjuste(servicesPath, (data) => Array.isArray(data) && data.every(esServicio));
export function guardarServicioProfesional(id, service, csrf) {
  if (!positiveId(id) || id > 2147483647) throw new Error('Identificador de servicio inválido.');
  return guardarAjuste(`${servicesPath}/${id}`, 'PATCH', service, csrf, (data) => esServicio(data) && data.id === id);
}
export const obtenerJornadaProfesional = () => leerAjuste(hoursPath, esJornada);
export const guardarJornadaProfesional = (week, csrf) => guardarAjuste(hoursPath, 'PUT', week, csrf, esJornada);

export async function obtenerAprobacionProfesional() {
  const session = await obtenerSesionProfesional();
  if (!session) throw Object.assign(new Error('La sesión profesional terminó.'), { status: 401 });
  return session;
}

export const guardarAprobacionProfesional = (automatic_approval, csrf) => guardarAjuste(
  approvalPath, 'PATCH', { automatic_approval }, csrf,
  (data) => positiveId(data?.id) && typeof data.name === 'string' && data.automatic_approval === automatic_approval,
);
