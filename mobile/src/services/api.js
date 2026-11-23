export const apiUrl = process.env.EXPO_PUBLIC_API_URL?.trim().replace(/\/+$/, '');

const estadoDesconocido = 'No pudimos comprobar si la reserva se registró. Consulta al profesional antes de volver a solicitarla.';

export async function consultarApi(ruta, {
  body, token, session = false, csrfToken, method, uncertainMessage,
} = {}) {
  if (!apiUrl || !/^https?:\/\/[^/]+\/api$/i.test(apiUrl)) {
    throw new Error('Configura EXPO_PUBLIC_API_URL con la dirección del backend terminada en /api.');
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);

  try {
    let respuesta;
    try {
      respuesta = await fetch(`${apiUrl}${ruta}`, {
        headers: {
          Accept: 'application/json',
          ...(body && { 'Content-Type': 'application/json' }),
          ...(token && { Authorization: `Bearer ${token}` }),
          ...(csrfToken && { 'X-CSRF-Token': csrfToken }),
        },
        signal: controller.signal,
        ...(session && { credentials: 'include' }),
        ...(method && { method }),
        ...(body && { body: JSON.stringify(body) }),
      });
    } catch {
      if (uncertainMessage) throw Object.assign(new Error(uncertainMessage), { uncertain: true });
      throw new Error('No pudimos conectar con BarberBook. Revisa tu conexión y la dirección de la API.');
    }

    const datos = await respuesta.json().catch(() => null);
    if (!respuesta.ok && uncertainMessage && respuesta.status >= 500) {
      throw Object.assign(new Error(uncertainMessage), { status: respuesta.status, uncertain: true });
    }
    if (!respuesta.ok) {
      const mensaje = typeof datos?.error === 'string' && datos.error.trim();
      throw Object.assign(new Error(mensaje || `BarberBook respondió con un error HTTP ${respuesta.status}.`), {
        status: respuesta.status,
      });
    }
    if (datos === null && !uncertainMessage) {
      throw new Error('BarberBook no devolvió una respuesta JSON válida.');
    }
    return datos?.data;
  } finally {
    clearTimeout(timeout);
  }
}

const esId = (valor) => Number.isInteger(valor) && valor > 0;
const esNombre = (valor) => typeof valor === 'string' && valor.trim().length > 0;
const esTextoOpcional = (valor) => valor == null || typeof valor === 'string';
export const esCredencialSeguimiento = (valor) => typeof valor === 'string' && /^[0-9a-f]{64}$/.test(valor);

export async function obtenerProfesionales() {
  const datos = await consultarApi('/professionals');
  if (!Array.isArray(datos) || !datos.every((item) => (
    esId(item?.id) && esNombre(item.name) && [item.title, item.bio, item.location].every(esTextoOpcional)
    && (item.specialties == null || (Array.isArray(item.specialties) && item.specialties.every(esNombre)))
  ))) {
    throw new Error('La respuesta de profesionales no tiene el formato esperado.');
  }
  return datos;
}

export async function obtenerServicios() {
  const datos = await consultarApi('/services');
  if (!Array.isArray(datos) || !datos.every((item) => (
    esId(item?.id) && esId(item.professional_id) && esNombre(item.name)
    && esId(item.duration_minutes) && Number.isInteger(item.price) && item.price >= 0
  ))) {
    throw new Error('La respuesta de servicios no tiene el formato esperado.');
  }
  return datos;
}

export async function obtenerDisponibilidad(professionalId, serviceId) {
  const query = new URLSearchParams({ professionalId: String(professionalId), serviceId: String(serviceId), days: '14' });
  const dias = await consultarApi(`/availability?${query}`);
  if (!Array.isArray(dias) || !dias.every((dia) => (
    /^\d{4}-\d{2}-\d{2}$/.test(dia?.id) && Number.isFinite(Date.parse(dia.id))
    && Array.isArray(dia.slots) && dia.slots.every((slot) => (
      /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(slot?.time)
      && typeof slot.startsAt === 'string' && /(?:Z|[+-]\d{2}:\d{2})$/i.test(slot.startsAt)
      && Number.isFinite(Date.parse(slot.startsAt)) && typeof slot.isBookable === 'boolean'
      && ['available', 'pending', 'confirmed', 'unavailable'].includes(slot.bookingStatus)
    ))
  ))) {
    throw new Error('La respuesta de disponibilidad no tiene el formato esperado.');
  }
  return dias.filter((dia) => dia.slots.length > 0);
}

export async function crearReserva({ serviceId, customerName, customerPhone, startsAt }) {
  const reserva = await consultarApi('/bookings', {
    method: 'POST', body: { serviceId, customerName, customerPhone, startsAt }, uncertainMessage: estadoDesconocido,
  });
  if (!esId(reserva?.id) || !['pending', 'confirmed'].includes(reserva.status)) {
    throw Object.assign(new Error(estadoDesconocido), { uncertain: true });
  }
  return reserva;
}

export async function consultarSeguimiento(id, token) {
  if (!esId(id) || id > 2147483647 || !esCredencialSeguimiento(token)) {
    throw new Error('La credencial de seguimiento guardada no es válida.');
  }
  const reserva = await consultarApi(`/bookings/${id}/tracking`, { token });
  if (reserva?.id !== id || !['pending', 'confirmed', 'rejected', 'cancelled', 'completed'].includes(reserva.status)
    || !esNombre(reserva.professionalName) || !esNombre(reserva.serviceName)
    || typeof reserva.startsAt !== 'string' || !/(?:Z|[+-]\d{2}:\d{2})$/i.test(reserva.startsAt)
    || !Number.isFinite(Date.parse(reserva.startsAt))) {
    throw new Error('No pudimos leer el estado de la reserva. Vuelve a consultar.');
  }
  const { status, professionalName, serviceName, startsAt } = reserva;
  return { id, status, professionalName, serviceName, startsAt };
}
