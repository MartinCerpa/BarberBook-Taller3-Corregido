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

export async function consultarReservaPropia(database, bookingId, token) {
  const { rows: [booking] } = await database.query(
    `SELECT b.id, b.status, b.starts_at AS "startsAt",
            COALESCE(b.service_name_snapshot, s.name) AS "serviceName",
            p.name AS "professionalName"
     FROM booking_tracking_credentials c
     JOIN bookings b ON b.id=c.booking_id
     JOIN services s ON s.id=b.service_id
     JOIN professionals p ON p.id=s.professional_id
     WHERE c.booking_id=$1 AND c.token_hash=$2`,
    [bookingId, hashToken(token)],
  );
  return booking;
}
