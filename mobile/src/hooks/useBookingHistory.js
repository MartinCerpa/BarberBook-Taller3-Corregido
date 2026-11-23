import { useCallback, useEffect, useRef, useState } from 'react';
import { aplicarEstadoReserva, cancelarReservaGuardada, consultarReservaGuardada, ordenarReservas } from '../services/bookingHistory';
import { eliminarSeguimiento, obtenerSeguimientosGuardados } from '../services/bookingTracking';

export function useBookingHistory() {
  const [entries, setEntries] = useState(() => new Map());
  const [initial, setInitial] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [storage, setStorage] = useState({ incompleto: false, temporal: false, limpiezaPendiente: false });
  const mounted = useRef(false);
  const credentials = useRef(new Map());
  const removed = useRef(new Set());
  const updates = useRef(new Map());
  const batch = useRef(null);

  const applyResult = useCallback(async (id, result) => {
    if (removed.current.has(id)) return;
    const cancelled = result.booking?.status === 'cancelled';
    if (cancelled) {
      removed.current.add(id);
      credentials.current.delete(id);
    }
    if (mounted.current) setEntries((current) => aplicarEstadoReserva(current, id, result));
    if (cancelled) {
      const storageStatus = await eliminarSeguimiento(id);
      if (mounted.current && storageStatus) setStorage(storageStatus);
    }
  }, []);

  const refreshBooking = useCallback((id) => {
    const credential = credentials.current.get(id);
    if (!credential) return;
    if (updates.current.has(id)) return updates.current.get(id);

    setEntries((current) => aplicarEstadoReserva(current, id, { loading: true, error: null }));
    const update = consultarReservaGuardada(credential)
      .then((result) => applyResult(id, result))
      .finally(() => updates.current.delete(id));
    updates.current.set(id, update);
    return update;
  }, [applyResult]);

  const cancelBooking = useCallback((id) => {
    const credential = credentials.current.get(id);
    if (!credential || updates.current.has(id)) return;

    setEntries((current) => aplicarEstadoReserva(current, id, { cancelling: true, cancelError: null }));
    const update = cancelarReservaGuardada(credential)
      .then((result) => applyResult(id, { ...result, cancelling: false }))
      .finally(() => updates.current.delete(id));
    updates.current.set(id, update);
    return update;
  }, [applyResult]);

  const refreshAll = useCallback(() => {
    if (batch.current) return batch.current;
    setRefreshing(true);

    async function load() {
      try {
        const { credenciales, incompleto, temporal, limpiezaPendiente } = await obtenerSeguimientosGuardados();
        if (!mounted.current) return;
        setStorage({ incompleto, temporal, limpiezaPendiente });
        for (const credential of credenciales) {
          if (!removed.current.has(credential.id)) credentials.current.set(credential.id, credential);
        }
        const requests = Array.from(credentials.current.keys(), refreshBooking);
        setInitial(false);
        await Promise.all(requests);
      } catch {
        if (mounted.current) setStorage((current) => ({ ...current, incompleto: true }));
      } finally {
        batch.current = null;
        if (mounted.current) {
          setInitial(false);
          setRefreshing(false);
        }
      }
    }

    batch.current = load();
    return batch.current;
  }, [refreshBooking]);

  useEffect(() => {
    mounted.current = true;
    void refreshAll();
    return () => { mounted.current = false; };
  }, [refreshAll]);

  return { entries: ordenarReservas(entries.values()), initial, refreshing, storage, refreshAll, refreshBooking, cancelBooking };
}
