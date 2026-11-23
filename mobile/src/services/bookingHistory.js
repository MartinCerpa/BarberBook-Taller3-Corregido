import { cancelarSeguimiento, consultarSeguimiento } from './api';

const keyReserva = ({ apiUrl, id }) => `${apiUrl}#${id}`;

export const puedeCancelarReserva = (status) => status === 'pending' || status === 'confirmed';

export function ordenarReservas(entries, now = Date.now()) {
  return Array.from(entries).sort((a, b) => {
    if (!a.booking || !b.booking) {
      return Number(!!b.booking) - Number(!!a.booking) || a.id - b.id;
    }
    const startA = Date.parse(a.booking.startsAt);
    const startB = Date.parse(b.booking.startsAt);
    const futureA = startA >= now;
    const futureB = startB >= now;
    if (futureA !== futureB) return futureA ? -1 : 1;
    return (futureA ? startA - startB : startB - startA) || a.id - b.id;
  });
}

export function crearColaSeguimiento(consultar, limite = 3) {
  const tareas = [];
  const enCurso = new Map();
  let activas = 0;

  function iniciarSiguiente() {
    if (activas >= limite || tareas.length === 0) return;
    const { credencial, key, resolve } = tareas.shift();
    activas += 1;

    async function consultarEstado() {
      let result;
      try {
        result = { booking: await consultar(credencial.id, credencial.token), error: null };
      } catch (error) {
        result = {
          error: [401, 404].includes(error?.status)
            ? 'El acceso guardado no permite consultar esta reserva.'
            : 'No pudimos actualizar esta reserva. Vuelve a intentar.',
        };
      }
      enCurso.delete(key);
      activas -= 1;
      resolve({ ...result, loading: false });
      iniciarSiguiente();
    }

    void consultarEstado();
  }

  function consultarReserva(credencial, lecturaNueva = false) {
    const key = keyReserva(credencial);
    const pendiente = enCurso.get(key);
    if (pendiente) return lecturaNueva ? pendiente.then(() => consultarReserva(credencial)) : pendiente;
    const promise = new Promise((resolve) => tareas.push({ credencial, key, resolve }));
    enCurso.set(key, promise);
    iniciarSiguiente();
    return promise;
  }
  return consultarReserva;
}

const consultarEnCola = crearColaSeguimiento(consultarSeguimiento);
const cancelaciones = new Map();
const verificacionesPendientes = new Set();
const verificacionRequerida = {
  cancelError: 'No pudimos verificar el estado. Compruébalo antes de intentar cancelar de nuevo.',
  verificationRequired: true,
};

export async function consultarReservaGuardada(credencial) {
  const key = keyReserva(credencial);
  const cancelacion = cancelaciones.get(key);
  if (cancelacion) await cancelacion;
  const result = await consultarEnCola(credencial);
  if (!result.booking) return result;
  verificacionesPendientes.delete(key);
  return { ...result, cancelError: null, verificationRequired: false };
}

async function cancelarYVerificar(credencial) {
  try {
    const booking = await cancelarSeguimiento(credencial.id, credencial.token);
    return { booking, error: null, cancelError: null, verificationRequired: false };
  } catch (error) {
    if (error?.uncertain || [408, 409].includes(error?.status)) {
      const { booking } = await consultarEnCola(credencial, true);
      if (!booking) return verificacionRequerida;
      const cancelError = booking.status === 'cancelled' ? null : puedeCancelarReserva(booking.status)
        ? 'La reserva sigue activa. Puedes volver a intentar cancelarla.'
        : 'El estado actual de la reserva no permite cancelarla.';
      return { booking, error: null, cancelError, verificationRequired: false };
    }
    return { cancelError: [401, 404].includes(error?.status)
      ? 'El servidor no permitió cancelar con este acceso.'
      : 'No pudimos cancelar la reserva. Vuelve a intentar.' };
  }
}

export function cancelarReservaGuardada(credencial) {
  const key = keyReserva(credencial);
  if (cancelaciones.has(key)) return cancelaciones.get(key);
  if (verificacionesPendientes.has(key)) return Promise.resolve(verificacionRequerida);
  const cancelacion = cancelarYVerificar(credencial).then((result) => {
    if (result.verificationRequired) verificacionesPendientes.add(key);
    return result;
  }).finally(() => cancelaciones.delete(key));
  cancelaciones.set(key, cancelacion);
  return cancelacion;
}

export function aplicarEstadoReserva(entries, id, patch) {
  const next = new Map(entries);
  if (patch.booking?.status === 'cancelled') next.delete(id);
  else next.set(id, { ...entries.get(id), ...patch, id });
  return next;
}
