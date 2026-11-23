const timeZone = 'America/Santiago';
const civilDate = new Intl.DateTimeFormat('en-CA', {
  timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
});
const scheduleTime = new Intl.DateTimeFormat('es-CL', {
  timeZone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
});

function dateInChile(date) {
  const parts = Object.fromEntries(civilDate.formatToParts(new Date(date)).map(({ type, value }) => [type, value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export const formatScheduleTime = (instant) => scheduleTime.format(new Date(instant));

export function confirmedInOrder(bookings) {
  return bookings.filter((booking) => booking.status === 'confirmed')
    .sort((a, b) => Date.parse(a.starts_at) - Date.parse(b.starts_at));
}

export function splitProfessionalRequests(bookings) {
  const byStart = (a, b) => Date.parse(a.starts_at) - Date.parse(b.starts_at);
  return {
    // El orden estable en empates conserva la prioridad de recepción que entrega la API.
    pending: bookings.filter((booking) => booking.status === 'pending').sort(byStart),
    history: bookings.filter((booking) => booking.status !== 'pending').sort((a, b) => byStart(b, a)),
  };
}

export function summarizeAgendaDate(bookings, now = new Date()) {
  const confirmed = confirmedInOrder(bookings);
  const upcoming = confirmed.find((booking) => Date.parse(booking.starts_at) >= now.getTime());
  const featured = upcoming ?? (confirmed.length === 1 ? confirmed[0] : undefined);
  return { confirmed, featured, upcoming: Boolean(upcoming) };
}

export function summarizeProfessionalDay(bookings, now = new Date()) {
  const today = dateInChile(now);
  const confirmed = confirmedInOrder(bookings);
  return {
    today,
    pending: bookings.filter((booking) => booking.status === 'pending').length,
    confirmedToday: confirmed.filter((booking) => dateInChile(booking.starts_at) === today).length,
    next: confirmed.find((booking) => Date.parse(booking.starts_at) >= now.getTime()),
  };
}
