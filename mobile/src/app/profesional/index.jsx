import { router } from 'expo-router';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { BookingPage, Button, Message, useBookingStyles } from '../../components/BookingPage';
import { useProfessionalSession } from '../../components/ProfessionalSession';
import { useProfessionalRead } from '../../hooks/useProfessionalRead';
import { obtenerSolicitudes } from '../../services/professionalApi';
import { useAppearance } from '../../theme/AppearanceProvider';
import { serif } from '../../theme/tokens';
import { formatBookingDate, formatBookingInstant } from '../../utils/booking';
import { summarizeProfessionalDay } from '../../utils/professionalAgenda';

export default function ProfessionalHome() {
  const { session, onSessionEnd } = useProfessionalSession();
  const { colors } = useAppearance();
  const styles = useBookingStyles();
  const { data, loading, error, refresh } = useProfessionalRead(obtenerSolicitudes, onSessionEnd);
  const summary = data && summarizeProfessionalDay(data);

  return (
    <BookingPage title="Tu jornada" safeBottom={false}>
      <Text style={styles.label}>{session.name}</Text>
      {loading && <ActivityIndicator color={colors.accent} accessibilityLabel="Consultando el resumen" />}
      {!!error && <Message error>{error}</Message>}
      {summary && (
        <>
          <Text style={styles.muted}>{formatBookingDate(summary.today)} · hora de Chile</Text>
          <View style={home.metrics}>
            <View style={[styles.card, home.metric]}>
              <Text style={styles.label}>Solicitudes pendientes</Text>
              <Text style={[home.value, { color: colors.accent }]}>{summary.pending}</Text>
            </View>
            <View style={[styles.card, home.metric]}>
              <Text style={styles.label}>Confirmadas hoy</Text>
              <Text style={[home.value, { color: colors.accent }]}>{summary.confirmedToday}</Text>
            </View>
          </View>
          <View style={styles.card}>
            <Text accessibilityRole="header" style={styles.label}>Próxima atención</Text>
            {summary.next ? (
              <>
                <Text style={[home.next, { color: colors.text }]}>{formatBookingInstant(summary.next.starts_at)}</Text>
                <Text style={styles.muted}>{summary.next.service_name}</Text>
              </>
            ) : <Message>Sin reservas confirmadas próximas.</Message>}
          </View>
        </>
      )}
      {!!error && <Button label="Reintentar" onPress={refresh} />}
      <View style={home.metrics}>
        <View style={home.metric}><Button label="Ver solicitudes" onPress={() => router.navigate('/profesional/solicitudes')} /></View>
        <View style={home.metric}><Button label="Abrir agenda" secondary onPress={() => router.navigate('/profesional/agenda')} /></View>
      </View>
    </BookingPage>
  );
}

const home = StyleSheet.create({
  metrics: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  metric: { flexGrow: 1, flexBasis: 132 },
  value: { fontFamily: serif, fontSize: 32, fontWeight: '700', fontVariant: ['tabular-nums'] },
  next: { fontFamily: serif, fontSize: 21, fontWeight: '700' },
});
