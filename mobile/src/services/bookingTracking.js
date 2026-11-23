import * as SecureStore from 'expo-secure-store';
import { apiUrl, esCredencialSeguimiento } from './api';

const key = 'barberbook.booking-tracking';
let recent;

export async function guardarSeguimiento(id, token) {
  if (!esCredencialSeguimiento(token)) return false;
  recent = { id, token, apiUrl };

  try {
    await SecureStore.setItemAsync(key, JSON.stringify(recent), {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });
    return true;
  } catch {
    // El acceso durante esta sesión se conserva si el dispositivo no puede guardarlo.
    return false;
  }
}

export async function obtenerSeguimientoGuardado() {
  if (recent) return recent;
  if (!await SecureStore.isAvailableAsync()) return null;
  const stored = await SecureStore.getItemAsync(key);
  if (!stored) return null;
  const record = JSON.parse(stored);
  if (record?.apiUrl !== apiUrl || !Number.isSafeInteger(record?.id) || record.id <= 0
    || !esCredencialSeguimiento(record.token)) return null;
  return record;
}
