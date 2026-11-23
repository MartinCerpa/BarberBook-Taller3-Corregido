const apiUrl = process.env.EXPO_PUBLIC_API_URL?.trim().replace(/\/+$/, '');

async function consultarApi(ruta) {
  if (!apiUrl || !/^https?:\/\/[^/]+\/api$/i.test(apiUrl)) {
    throw new Error('Configura EXPO_PUBLIC_API_URL con la dirección del backend terminada en /api.');
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);

  try {
    let respuesta;
    try {
      respuesta = await fetch(`${apiUrl}${ruta}`, {
        headers: { Accept: 'application/json' },
        signal: controller.signal,
      });
    } catch {
      throw new Error('No pudimos conectar con BarberBook. Revisa tu conexión y la dirección de la API.');
    }

    if (!respuesta.ok) {
      throw new Error(`BarberBook respondió con un error HTTP ${respuesta.status}.`);
    }

    try {
      return (await respuesta.json())?.data;
    } catch {
      throw new Error('BarberBook no devolvió una respuesta JSON válida.');
    }
  } finally {
    clearTimeout(timeout);
  }
}

const esId = (valor) => Number.isInteger(valor) && valor > 0;
const esNombre = (valor) => typeof valor === 'string' && valor.trim().length > 0;
const esTextoOpcional = (valor) => valor == null || typeof valor === 'string';

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
