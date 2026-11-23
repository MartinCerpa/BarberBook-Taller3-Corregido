import { useEffect, useRef, useState } from 'react';
import { usePreventRemove } from 'expo-router';
import { ActivityIndicator, Alert, StyleSheet, Text, View } from 'react-native';
import { BookingPage, Button, Message } from './BookingPage';
import {
  cambiarEstadoSolicitud, estadosSolicitud,
  obtenerSesionProfesional, obtenerSolicitudes,
} from '../services/professionalApi';
import { useAppearance } from '../theme/AppearanceProvider';
import { palettes, serif } from '../theme/tokens';
import { formatBookingInstant } from '../utils/booking';

const expired = 'Tu sesión terminó. Vuelve a iniciar sesión.';

function RequestCard({ request, overlaps, busy, onChange, styles }) {
  const pending = request.status === 'pending';
  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <Text style={styles.id}>Solicitud #{request.id}</Text>
        <Text style={[styles.status, styles[request.status]]}>{estadosSolicitud[request.status]}</Text>
      </View>
      <Text accessibilityRole="header" style={styles.service}>{request.service_name}</Text>
      <Text style={styles.body}>{formatBookingInstant(request.starts_at)} · hora de Chile</Text>
      <View style={styles.contact}>
        <Text style={styles.body}>{request.customer_name}</Text>
        <Text style={styles.muted}>{request.customer_phone}</Text>
      </View>
      {overlaps > 0 && (
        <Text style={styles.competition}>
          {overlaps === 1 ? 'Coincide con otra solicitud pendiente.' : `Coincide con otras ${overlaps} solicitudes pendientes.`}
        </Text>
      )}
      {pending && (
        <View style={styles.actions}>
          <View style={styles.action}><Button label="Confirmar" disabled={busy} onPress={() => onChange(request, 'confirmed')} /></View>
          <View style={styles.action}><Button label="Rechazar" secondary disabled={busy} onPress={() => onChange(request, 'rejected')} /></View>
        </View>
      )}
    </View>
  );
}

export function ProfessionalRequests({ session, onSession, onSessionEnd, writing, beginWrite, endWrite }) {
  const { mode, colors } = useAppearance();
  const styles = requestStyles[mode];
  const [bookings, setBookings] = useState(null);
  const [busy, setBusy] = useState('loading');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const inFlight = useRef(true);
  const confirming = useRef(false);
  usePreventRemove(busy === 'change', () => {});

  useEffect(() => {
    let active = true;
    obtenerSolicitudes()
      .then((items) => { if (active) setBookings(items); })
      .catch((cause) => {
        if (!active) return;
        if (cause.status === 401) onSessionEnd(expired);
        else setError(cause.message);
      })
      .finally(() => {
        if (active) {
          inFlight.current = false;
          setBusy('');
        }
      });
    return () => { active = false; };
  }, [onSessionEnd]);

  async function run(action, operation) {
    if (inFlight.current || !beginWrite()) return;
    inFlight.current = true;
    setBusy(action);
    setError('');
    setNotice('');
    try {
      await operation();
    } catch (cause) {
      if (cause.status === 401) {
        onSessionEnd(expired);
      } else if (cause.status === 403 && action !== 'refresh') {
        setError('El servidor no autorizó la operación. Actualiza la sesión e inténtalo de nuevo.');
        try {
          const current = await obtenerSesionProfesional();
          if (current?.id === session.id) {
            onSession(current);
            setError('La sesión se actualizó. Revisa la lista antes de repetir la operación.');
          } else {
            onSessionEnd(expired);
          }
        } catch {
          setError('No pudimos actualizar la sesión. Comprueba tu conexión y vuelve a intentarlo.');
        }
      } else {
        setError(cause.message);
      }
    } finally {
      inFlight.current = false;
      setBusy('');
      endWrite();
    }
  }

  function confirmChange(request, status) {
    if (writing || inFlight.current || confirming.current) return;
    confirming.current = true;
    const action = status === 'confirmed' ? 'Confirmar' : 'Rechazar';
    const dismiss = () => { confirming.current = false; };
    Alert.alert(`${action} solicitud #${request.id}`, `¿Quieres ${action.toLowerCase()} esta solicitud?`, [
      { text: 'Volver', style: 'cancel', onPress: dismiss },
      {
        text: action,
        style: status === 'rejected' ? 'destructive' : 'default',
        onPress: () => {
          dismiss();
          run('change', async () => {
            const updated = await cambiarEstadoSolicitud(request.id, status, session.csrfToken);
            setBookings((items) => items.map((item) => item.id === request.id ? { ...item, status: updated } : item));
            setNotice(`Solicitud #${request.id} ${estadosSolicitud[updated].toLowerCase()}.`);
            setBookings(await obtenerSolicitudes());
          });
        },
      },
    ], { cancelable: true, onDismiss: dismiss });
  }

  const pending = bookings?.filter((item) => item.status === 'pending') ?? [];
  const others = bookings?.filter((item) => item.status !== 'pending') ?? [];
  return (
    <BookingPage title="Solicitudes" safeBottom={false} footer={
      <>
        {!!notice && <Message>{notice}</Message>}
        {!!error && <Message error>{error}</Message>}
        <Button label={busy === 'loading' || busy === 'refresh' ? 'Actualizando…' : 'Actualizar'}
          disabled={!!busy || writing} onPress={() => run('refresh', async () => setBookings(await obtenerSolicitudes()))} />
      </>
    }>
      <Text style={styles.professional}>{session.name}</Text>
      {!!busy && <ActivityIndicator color={colors.accent} accessibilityLabel="Consultando el servidor" />}
      {bookings && (
        <>
          <Text accessibilityRole="header" style={styles.heading}>Pendientes</Text>
          {pending.length === 0 && <Message>No hay solicitudes pendientes.</Message>}
          {pending.map((item) => (
            <RequestCard key={item.id} request={item} styles={styles} busy={!!busy || writing} onChange={confirmChange}
              overlaps={pending.filter((other) => other.id !== item.id
                && Date.parse(other.starts_at) < Date.parse(item.ends_at)
                && Date.parse(other.ends_at) > Date.parse(item.starts_at)).length} />
          ))}
          {others.length > 0 && <Text accessibilityRole="header" style={styles.heading}>Resueltas</Text>}
          {others.map((item) => <RequestCard key={item.id} request={item} styles={styles} />)}
        </>
      )}
    </BookingPage>
  );
}

const createStyles = (colors) => StyleSheet.create({
  professional: { color: colors.muted, fontSize: 15 },
  heading: { color: colors.text, fontFamily: serif, fontSize: 23, fontWeight: '700' },
  card: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, padding: 14, gap: 8, borderRadius: 12 },
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 6 },
  id: { color: colors.muted, fontSize: 13, fontWeight: '600' },
  status: { color: colors.text, backgroundColor: colors.surfaceStrong, fontSize: 13, fontWeight: '700', paddingHorizontal: 8, paddingVertical: 5, borderRadius: 6 },
  pending: { color: colors.warning, backgroundColor: colors.warningSurface },
  confirmed: { color: colors.success, backgroundColor: colors.successSurface },
  completed: { color: colors.success, backgroundColor: colors.successSurface },
  rejected: { color: colors.error },
  service: { color: colors.text, fontFamily: serif, fontSize: 20, fontWeight: '700' },
  body: { color: colors.text, fontSize: 15 },
  muted: { color: colors.muted, fontSize: 14 },
  contact: { borderTopWidth: 1, borderColor: colors.border, paddingTop: 8, gap: 3 },
  competition: { color: colors.warning, fontSize: 13, lineHeight: 19 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  action: { flexBasis: 120, flexGrow: 1 },
});

const requestStyles = { light: createStyles(palettes.light), dark: createStyles(palettes.dark) };
