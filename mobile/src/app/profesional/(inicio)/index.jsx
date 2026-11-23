import { router } from 'expo-router';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { BookingPage, Button, Message, useBookingStyles } from '../../../components/BookingPage';
import { ProfessionalIcon } from '../../../components/ProfessionalIcon';
import { useProfessionalSession } from '../../../components/ProfessionalSession';
import { useProfessionalRead } from '../../../hooks/useProfessionalRead';
import { obtenerSolicitudes } from '../../../services/professionalApi';
import { useAppearance } from '../../../theme/AppearanceProvider';
import { serif } from '../../../theme/tokens';
import { formatBookingDate, formatBookingInstant } from '../../../utils/booking';
import { summarizeProfessionalDay } from '../../../utils/professionalAgenda';

function Metric({ title, value, icon, tone }) {
  const { colors } = useAppearance();
  const styles = useBookingStyles();
  return (
    <View style={[styles.card, home.metric]}>
      <ProfessionalIcon name={icon} tone={tone} />
      <Text style={[home.value, { color: colors[tone] }]}>{value}</Text>
      <Text style={styles.label}>{title}</Text>
    </View>
  );
}

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
            <Metric title="Solicitudes pendientes" value={summary.pending} icon="requests" tone="warning" />
            <Metric title="Confirmadas hoy" value={summary.confirmedToday} icon="agenda" tone="success" />
          </View>
          <View style={[styles.card, home.row, { backgroundColor: colors.surfaceStrong }]}>
            <ProfessionalIcon name="agenda" />
            <View style={home.copy}>
              <Text accessibilityRole="header" style={styles.label}>Próxima atención</Text>
              {summary.next ? (
                <>
                  <Text style={[home.next, { color: colors.text }]}>{summary.next.service_name}</Text>
                  <Text style={styles.muted}>{formatBookingInstant(summary.next.starts_at)}</Text>
                </>
              ) : <Message>Sin reservas confirmadas próximas.</Message>}
            </View>
          </View>
        </>
      )}
      {!!error && <Button label="Reintentar" onPress={refresh} />}
      <View style={home.metrics}>
        <View style={home.metric}><Button label="Ver solicitudes" onPress={() => router.navigate('/profesional/solicitudes')} /></View>
        <View style={home.metric}><Button label="Abrir agenda" secondary onPress={() => router.navigate('/profesional/agenda')} /></View>
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel="Ajustes profesionales"
        onPress={() => router.push('/profesional/ajustes')}
        style={({ pressed }) => [styles.card, home.row, pressed && styles.pressed]}>
        <ProfessionalIcon name="settings" />
        <View style={home.copy}>
          <Text style={styles.label}>Ajustes</Text>
          <Text style={styles.muted}>Perfil, servicios, horario y aprobación de reservas</Text>
        </View>
        <Text aria-hidden style={[home.next, { color: colors.accent }]}>›</Text>
      </Pressable>
    </BookingPage>
  );
}

const home = StyleSheet.create({
  metrics: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  metric: { flexGrow: 1, flexBasis: 132 },
  value: { fontFamily: serif, fontSize: 32, fontWeight: '700', fontVariant: ['tabular-nums'] },
  next: { fontFamily: serif, fontSize: 21, fontWeight: '700' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 60 },
  copy: { flex: 1, gap: 4 },
});
