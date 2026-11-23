import { useEffect, useState } from 'react';
import { router } from 'expo-router';
import { ActivityIndicator } from 'react-native';
import { BookingPage, Button, Message } from '../components/BookingPage';
import { BookingResult } from '../components/BookingReceipt';
import { consultarSeguimiento } from '../services/api';
import { obtenerSeguimientoGuardado } from '../services/bookingTracking';
import { useAppearance } from '../theme/AppearanceProvider';

export default function MiReserva() {
  const { colors } = useAppearance();
  const [revision, setRevision] = useState(0);
  const [state, setState] = useState({ loading: true });

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const access = await obtenerSeguimientoGuardado();
        if (!active) return;
        const booking = access ? await consultarSeguimiento(access.id, access.token) : null;
        if (active) setState({ booking });
      } catch (error) {
        if (active) setState({
          error: [401, 404].includes(error.status)
            ? 'El acceso guardado no permite consultar esta reserva.'
            : 'No pudimos consultar el estado. Revisa tu conexión y vuelve a intentar.',
        });
      }
    }
    load();
    return () => { active = false; };
  }, [revision]);

  function refresh() {
    setState((current) => ({ booking: current.booking, loading: true }));
    setRevision((current) => current + 1);
  }

  const { booking, error, loading } = state;
  return (
    <BookingPage title="Mi reserva" footer={
      <>
        {(booking || error) && (
          <Button label={loading ? 'Consultando…' : error ? 'Reintentar' : 'Actualizar estado'} disabled={loading} onPress={refresh} />
        )}
        <Button label="Volver al catálogo" secondary={!!(booking || error)} onPress={() => router.dismissTo('/')} />
      </>
    }>
      {loading && (
        <>
          <ActivityIndicator color={colors.accent} />
          <Message>Consultando el estado de la reserva…</Message>
        </>
      )}
      {!!error && <Message error>{error}</Message>}
      {booking && (
        <BookingResult result={booking} professionalName={booking.professionalName}
          service={{ name: booking.serviceName }} startsAt={booking.startsAt} />
      )}
      {!loading && !error && !booking && (
        <Message>Las reservas nuevas que hagas desde este dispositivo aparecen aquí. Las reservas antiguas se consultan con el profesional.</Message>
      )}
    </BookingPage>
  );
}
