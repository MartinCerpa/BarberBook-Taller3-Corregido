import { crearReserva } from '../services/bookingService.js';
import { cancelarReservaPropia, consultarReservaPropia } from '../services/bookingTrackingService.js';

export async function registrarReserva(req, res, next) {
  res.set('Cache-Control', 'no-store');
  const { serviceId, customerName, customerPhone, startsAt } = req.body ?? {};

  const fecha = new Date(startsAt);

  if (
    !Number.isInteger(serviceId) ||
    serviceId <= 0 ||
    typeof customerName !== 'string' ||
    !customerName.trim() ||
    typeof customerPhone !== 'string' ||
    !customerPhone.trim() ||
    typeof startsAt !== 'string' ||
    !/([zZ]|[+-]\d{2}:\d{2})$/.test(startsAt) ||
    Number.isNaN(fecha.getTime()) ||
    fecha.getTime() <= Date.now()
  ) {
    return res.status(400).json({
      error: 'Datos de reserva inválidos'
    });
  }

  try {
    const reserva = await crearReserva({
      serviceId,
      customerName: customerName.trim(),
      customerPhone: customerPhone.trim(),
      startsAt
    }, req.app.locals.database);

    res.status(201).json({ data: reserva });

  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({
        error: error.message
      });
    }

    next(error);
  }
}

const responderSeguimiento = (operacion) => async (req, res) => {
  res.set('Cache-Control', 'no-store');
  const id = Number(req.params.id);
  if (!/^[1-9]\d*$/.test(req.params.id) || !Number.isInteger(id) || id > 2147483647) {
    return res.status(400).json({ error: 'Identificador de reserva inválido.' });
  }

  const token = /^Bearer ([0-9a-f]{64})$/i.exec(req.get('Authorization') ?? '')?.[1];
  if (!token) {
    res.set('WWW-Authenticate', 'Bearer realm="booking-tracking"');
    return res.status(401).json({ error: 'Se requiere una credencial de seguimiento válida.' });
  }

  const booking = await operacion(req.app.locals.database, id, token);
  // La misma respuesta cubre una credencial ajena, una reserva antigua y un ID inexistente.
  if (!booking) return res.status(404).json({ error: 'No se encontró una reserva para esta credencial.' });
  return res.json({ data: booking });
};

export const seguirReserva = responderSeguimiento(consultarReservaPropia);
export const cancelarReserva = responderSeguimiento(cancelarReservaPropia);
