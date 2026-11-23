export const weekDays = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

export function prepararPerfil(draft) {
  const payload = {};
  for (const [field, label, max] of [
    ['name', 'Nombre', 100], ['title', 'Título profesional', 100], ['bio', 'Descripción', 2000],
    ['location', 'Ubicación', 200], ['instagram', 'Instagram', 31], ['whatsapp', 'WhatsApp', 30],
  ]) {
    const value = draft[field]?.trim() ?? '';
    if (field === 'name' && !value) return { error: 'Ingresa tu nombre profesional.' };
    if (value.length > max) return { error: `${label} admite hasta ${max} caracteres.` };
    payload[field] = value;
  }
  if (payload.instagram && !/^@?[A-Za-z0-9_.]{1,30}$/.test(payload.instagram)) {
    return { error: 'Ingresa un usuario de Instagram válido.' };
  }
  if (payload.whatsapp && !/^\+?[0-9 ()-]{6,30}$/.test(payload.whatsapp)) {
    return { error: 'Ingresa un número de WhatsApp válido.' };
  }
  const specialties = draft.specialties.map((item) => item.trim());
  if (specialties.length > 8 || specialties.some((item) => !item || item.length > 60)) {
    return { error: 'Agrega hasta ocho especialidades de 1 a 60 caracteres o elimina las vacías.' };
  }
  return { payload: { ...payload, specialties: [...new Set(specialties)] } };
}

export function prepararServicio(draft) {
  const name = draft.name.trim();
  if (!name || name.length > 100) return { error: 'Ingresa un nombre de servicio de hasta 100 caracteres.' };
  const duration = Number(draft.duration_minutes);
  if (!/^\d+$/.test(draft.duration_minutes) || duration < 5 || duration > 480 || duration % 5 !== 0) {
    return { error: 'Ingresa una duración de 5 a 480 minutos, en múltiplos de 5.' };
  }
  const price = Number(draft.price);
  if (!/^\d+$/.test(draft.price) || price > 100000000) {
    return { error: 'Ingresa un precio entero entre $0 y $100.000.000.' };
  }
  return { payload: { name, duration_minutes: duration, price, active: draft.active } };
}

const clockMinutes = (value) => /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value)
  ? Number(value.slice(0, 2)) * 60 + Number(value.slice(3))
  : value === '24:00' ? 1440 : NaN;

export function prepararJornada(days) {
  const payload = [];
  for (const day of days) {
    const { day: id, enabled } = day;
    const intervals = enabled ? day.intervals.map(({ start, end }) => ({ start: start.trim(), end: end.trim() })) : [];
    if (enabled && (intervals.length < 1 || intervals.length > 4)) {
      return { error: `${weekDays[id]} necesita entre uno y cuatro intervalos.` };
    }
    const sorted = intervals.map(({ start, end }) => ({ start: clockMinutes(start), end: clockMinutes(end) }))
      .sort((a, b) => a.start - b.start);
    if (sorted.some(({ start, end }) => !(start < end))) {
      return { error: `${weekDays[id]} necesita horas válidas en formato HH:MM y un cierre posterior a la apertura.` };
    }
    if (sorted.some(({ start }, index) => index > 0 && start < sorted[index - 1].end)) {
      return { error: `Los intervalos de ${weekDays[id].toLowerCase()} se superponen.` };
    }
    payload.push({ day: id, enabled, intervals });
  }
  return { payload: { days: payload } };
}
