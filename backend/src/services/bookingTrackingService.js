import { createHash, randomBytes } from 'node:crypto';

const hashToken = (token) => createHash('sha256').update(token).digest('hex');

export async function emitirCredencialSeguimiento(client, bookingId) {
  const token = randomBytes(32).toString('hex');
  await client.query(
    'INSERT INTO booking_tracking_credentials(booking_id, token_hash) VALUES ($1, $2)',
    [bookingId, hashToken(token)],
  );
  return token;
}

const reservaConCredencial = `FROM booking_tracking_credentials c
  JOIN bookings b ON b.id=c.booking_id
  JOIN services s ON s.id=b.service_id
  JOIN professionals p ON p.id=s.professional_id
  WHERE c.booking_id=$1 AND c.token_hash=$2`;

async function leerSeguimiento(database, acceso, lock = false) {
  const { rows: [booking] } = await database.query(
    `SELECT b.id, b.status, b.starts_at AS "startsAt",
            COALESCE(b.service_name_snapshot, s.name) AS "serviceName",
            p.name AS "professionalName"
     ${reservaConCredencial}${lock ? ' FOR UPDATE OF b' : ''}`, acceso);
  return booking;
}

export function consultarReservaPropia(database, bookingId, token) {
  return leerSeguimiento(database, [bookingId, hashToken(token)]);
}

export async function cancelarReservaPropia(database, bookingId, token) {
  const acceso = [bookingId, hashToken(token)];
  const client = await database.connect();
  try {
    await client.query('BEGIN');
    // Mismo orden que la confirmación profesional: bloquear profesional y luego reserva.
    const { rowCount } = await client.query(`SELECT p.id ${reservaConCredencial} FOR UPDATE OF p`, acceso);
    const booking = rowCount ? await leerSeguimiento(client, acceso, true) : undefined;
    if (booking && booking.status !== 'cancelled') {
      if (!['pending', 'confirmed'].includes(booking.status)) {
        throw Object.assign(new Error('El estado actual no permite cancelar esta reserva.'), { status: 409 });
      }
      const { rows: [updated] } = await client.query(
        "UPDATE bookings SET status='cancelled' WHERE id=$1 RETURNING status", [booking.id]);
      booking.status = updated.status;
    }
    await client.query('COMMIT');
    return booking;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
