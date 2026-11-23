const currency = new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' });
const calendarDate = new Intl.DateTimeFormat('es-CL', {
  timeZone: 'UTC',
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

export const formatPrice = (price) => currency.format(price);

// El identificador es una fecha civil de Chile. UTC conserva ese día al formatearlo.
export const formatBookingDate = (dateId) => calendarDate.format(new Date(`${dateId}T00:00:00Z`));

const bookingDateTime = new Intl.DateTimeFormat('es-CL', {
  timeZone: 'America/Santiago',
  dateStyle: 'medium',
  timeStyle: 'short',
  hourCycle: 'h23',
});

export const formatBookingInstant = (startsAt) => bookingDateTime.format(new Date(startsAt));

const trackingDate = new Intl.DateTimeFormat('es-CL', { timeZone: 'America/Santiago', dateStyle: 'long' });
const trackingTime = new Intl.DateTimeFormat('es-CL', { timeZone: 'America/Santiago', timeStyle: 'short', hourCycle: 'h23' });
export const formatTrackingDate = (startsAt) => trackingDate.format(new Date(startsAt));
export const formatTrackingTime = (startsAt) => trackingTime.format(new Date(startsAt));

export function getSlotStatus(slot) {
  if (!slot?.isBookable) return 'unavailable';
  return slot.bookingStatus === 'pending' ? 'pending' : 'available';
}

export function validateCustomer(name, phone) {
  const customerName = name.trim();
  const customerPhone = phone.replace(/[\s()-]/g, '');
  if (customerName.length < 2 || customerName.length > 100) {
    return { error: 'Ingresa un nombre de entre 2 y 100 caracteres.' };
  }
  if (!/^\+569\d{8}$/.test(customerPhone)) {
    return { error: 'Ingresa un celular chileno con +56 9 y ocho dígitos.' };
  }
  return { customerName, customerPhone };
}
