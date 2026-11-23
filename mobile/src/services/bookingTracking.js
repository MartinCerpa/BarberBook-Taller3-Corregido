import * as SecureStore from 'expo-secure-store';
import { apiUrl, esCredencialSeguimiento } from './api';

const legacyKey = 'barberbook.booking-tracking';
// La URL completa se codifica sin colisiones con caracteres admitidos por SecureStore.
const namespace = apiUrl?.split('').map((char) => char.charCodeAt(0).toString(16).padStart(4, '0')).join('');
const entryKey = (index) => `${legacyKey}.v2.${namespace}.${index}`;
const options = { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY };
const entradaEliminada = '{"eliminada":true}';
const temporales = new Map();
const eliminaciones = new Set();
let cola = Promise.resolve();

function enCola(operation) {
  const result = cola.then(operation);
  cola = result.catch(() => {});
  return result;
}

function leerRegistro(value) {
  try {
    const record = JSON.parse(value);
    if (esIdSeguimiento(record?.id) && esCredencialSeguimiento(record.token)) return record;
  } catch {
    // Conservar la entrada original si no se puede interpretar.
  }
  return null;
}

const esIdSeguimiento = (id) => Number.isInteger(id) && id > 0 && id <= 2147483647;

async function sincronizar() {
  const guardadas = new Map();
  const indicesPorEliminar = new Map(Array.from(eliminaciones, (id) => [id, []]));
  let legado;
  let legadoLeido = false;
  let incompleto = false;
  try {
    if (!namespace || !await SecureStore.isAvailableAsync()) throw new Error();

    try {
      const value = await SecureStore.getItemAsync(legacyKey);
      legadoLeido = true;
      if (value !== null) {
        const record = leerRegistro(value);
        if (record?.apiUrl === apiUrl) legado = record;
        if (typeof record?.apiUrl !== 'string' || !/^https?:\/\/[^/]+\/api$/i.test(record.apiUrl)) incompleto = true;
      }
    } catch {
      incompleto = true;
    }

    // Los marcadores mantienen la secuencia local sin retener el ID ni el token.
    let index = 0;
    let fin = false;
    while (!fin) {
      const lote = await Promise.allSettled(
        Array.from({ length: 8 }, (_, offset) => SecureStore.getItemAsync(entryKey(index + offset))),
      );
      for (const resultado of lote) {
        if (resultado.status === 'rejected') throw resultado.reason;
        if (resultado.value === null) {
          fin = true;
          break;
        }
        const key = entryKey(index);
        index += 1;
        if (resultado.value === entradaEliminada) continue;
        const record = leerRegistro(resultado.value);
        if (!record) incompleto = true;
        else if (indicesPorEliminar.has(record.id)) indicesPorEliminar.get(record.id).push(key);
        else if (!guardadas.has(record.id)) guardadas.set(record.id, record.token);
      }
    }

    for (const [id, keys] of indicesPorEliminar) {
      try {
        for (const key of keys) await SecureStore.setItemAsync(key, entradaEliminada, options);
        if (legado?.id === id) {
          await SecureStore.deleteItemAsync(legacyKey);
          legado = undefined;
        }
        if (legadoLeido) eliminaciones.delete(id);
      } catch {
        incompleto = true;
      }
    }

    async function persistir({ id, token }) {
      if (guardadas.has(id)) return guardadas.get(id) === token;
      const key = entryKey(index);
      await SecureStore.setItemAsync(key, JSON.stringify({ id, token }), options);
      const verificado = leerRegistro(await SecureStore.getItemAsync(key));
      if (verificado?.id !== id || verificado.token !== token) throw new Error();
      guardadas.set(id, token);
      index += 1;
      return true;
    }

    if (legado && !eliminaciones.has(legado.id)) {
      if (await persistir(legado)) {
        try {
          await SecureStore.deleteItemAsync(legacyKey);
        } catch {
          incompleto = true;
        }
      } else {
        incompleto = true;
      }
    }

    for (const [id, token] of temporales) {
      if (await persistir({ id, token })) temporales.delete(id);
      else if (guardadas.has(id)) {
        temporales.delete(id);
        incompleto = true;
      }
    }
  } catch {
    incompleto = true;
  }

  const accesibles = new Map(guardadas);
  if (legado && !eliminaciones.has(legado.id) && !accesibles.has(legado.id)) accesibles.set(legado.id, legado.token);
  for (const [id, token] of temporales) {
    if (!accesibles.has(id)) accesibles.set(id, token);
  }
  return {
    guardadas,
    credenciales: Array.from(accesibles, ([id, token]) => ({ id, token, apiUrl })),
    incompleto,
    temporal: temporales.size > 0,
    limpiezaPendiente: eliminaciones.size > 0,
  };
}

export function guardarSeguimiento(id, token) {
  if (!esIdSeguimiento(id) || !esCredencialSeguimiento(token)) {
    return Promise.resolve(false);
  }
  return enCola(async () => {
    if (eliminaciones.has(id)) return false;
    if (!temporales.has(id)) temporales.set(id, token);
    const { guardadas } = await sincronizar();
    return guardadas.get(id) === token;
  });
}

export function eliminarSeguimiento(id) {
  if (!esIdSeguimiento(id)) return Promise.resolve(null);
  return enCola(async () => {
    temporales.delete(id);
    eliminaciones.add(id);
    const { incompleto, temporal, limpiezaPendiente } = await sincronizar();
    return { incompleto, temporal, limpiezaPendiente };
  });
}

export function obtenerSeguimientosGuardados() {
  return enCola(async () => {
    const { credenciales, incompleto, temporal, limpiezaPendiente } = await sincronizar();
    return { credenciales, incompleto, temporal, limpiezaPendiente };
  });
}
