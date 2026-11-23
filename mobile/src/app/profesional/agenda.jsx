import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { BookingPage, Button, Message, useBookingStyles } from '../../components/BookingPage';
import { ProfessionalIcon } from '../../components/ProfessionalIcon';
import { useProfessionalSession } from '../../components/ProfessionalSession';
import { useProfessionalRead } from '../../hooks/useProfessionalRead';
import { obtenerAgendaProfesional } from '../../services/professionalApi';
import { useAppearance } from '../../theme/AppearanceProvider';
import { serif } from '../../theme/tokens';
import { formatBookingDate, formatTrackingDate } from '../../utils/booking';
import { formatScheduleTime, summarizeAgendaDate } from '../../utils/professionalAgenda';

function Appointment({ booking, featured, upcoming }) {
  const { colors } = useAppearance();
  const styles = useBookingStyles();
  return (
    <View style={[styles.card, featured && { backgroundColor: colors.surfaceStrong, borderColor: colors.accent }]}>
      <View style={agenda.appointment}>
        {featured ? <ProfessionalIcon name="agenda" tone="success" /> : null}
        <Text style={[agenda.status, { color: colors.success, backgroundColor: colors.successSurface }]}>Confirmada</Text>
      </View>
      {featured && <Text style={[agenda.context, { color: colors.accent }]}>{upcoming ? 'Próxima atención' : 'Atención del día'}</Text>}
      <Text accessibilityRole="header" style={[styles.label, featured && agenda.featured, { color: colors.text }]}>
        {booking.service_name}
      </Text>
      <Text style={[agenda.time, { color: colors.accent }]}>
        {formatScheduleTime(booking.starts_at)}–{formatScheduleTime(booking.ends_at)}
      </Text>
    </View>
  );
}

export default function ProfessionalAgenda() {
  const { onSessionEnd } = useProfessionalSession();
  const { colors } = useAppearance();
  const styles = useBookingStyles();
  const [chosen, setChosen] = useState(null);
  const { data, loading, error, refresh } = useProfessionalRead(obtenerAgendaProfesional, onSessionEnd);
  const day = data?.find(({ id }) => id === chosen) ?? data?.[0];
  const { confirmed, featured, upcoming } = summarizeAgendaDate(day?.bookings ?? []);

  return (
    <BookingPage title="Agenda" safeBottom={false} footer={
      <Button label={loading ? 'Actualizando…' : error ? 'Reintentar' : 'Actualizar agenda'} disabled={loading} onPress={refresh} />
    }>
      <Text style={styles.muted}>Hora de Chile · próximos 14 días</Text>
      {loading && <ActivityIndicator color={colors.accent} accessibilityLabel="Consultando la agenda" />}
      {!!error && <Message error>{error}</Message>}
      {day && (
        <>
          <ScrollView horizontal style={agenda.rail} contentContainerStyle={agenda.dates} showsHorizontalScrollIndicator={false}>
            {data.map(({ id }) => {
              const selected = day.id === id;
              return (
                <Pressable key={id} accessibilityRole="button" accessibilityState={{ selected }}
                  onPress={() => setChosen(id)}
                  style={[agenda.date, { borderColor: selected ? colors.accent : colors.border, backgroundColor: selected ? colors.accent : colors.surface }]}>
                  <Text style={[agenda.dateLabel, { color: selected ? colors.accentText : colors.text }]}>{formatBookingDate(id)}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
          <View style={[styles.card, agenda.appointment]}>
            <View style={agenda.dateCopy}>
              <Text accessibilityRole="header" style={[agenda.heading, { color: colors.text }]}>
                {formatTrackingDate(`${day.id}T12:00:00Z`)}
              </Text>
              <Text style={styles.muted}>{confirmed.length} {confirmed.length === 1 ? 'atención confirmada' : 'atenciones confirmadas'}</Text>
            </View>
            <ProfessionalIcon name="agenda" />
          </View>
          {confirmed.length === 0 ? (
            <View style={[styles.card, agenda.empty]}>
              <ProfessionalIcon name="agenda" />
              <Text accessibilityRole="header" style={styles.label}>Sin atenciones confirmadas</Text>
              <Message>Elige otra fecha para consultar su agenda.</Message>
            </View>
          ) : (
            <>
              {featured && <Appointment booking={featured} featured upcoming={upcoming} />}
              {confirmed.filter(({ id }) => id !== featured?.id).map((booking) => <Appointment key={booking.id} booking={booking} />)}
            </>
          )}
        </>
      )}
      {data?.length === 0 && <Message>No hay fechas publicadas en la agenda.</Message>}
    </BookingPage>
  );
}

const agenda = StyleSheet.create({
  rail: { flexGrow: 0 },
  dates: { gap: 8, paddingBottom: 6 },
  date: { minHeight: 44, justifyContent: 'center', borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  dateLabel: { fontSize: 14, fontWeight: '600' },
  appointment: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 6 },
  time: { fontSize: 18, fontWeight: '700', fontVariant: ['tabular-nums'] },
  status: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4, fontSize: 13, fontWeight: '700' },
  dateCopy: { flexGrow: 1, flexShrink: 1, gap: 4 },
  heading: { fontFamily: serif, fontWeight: '700', fontSize: 23 },
  featured: { fontFamily: serif, fontSize: 24, fontWeight: '700' },
  context: { fontWeight: '700', fontSize: 14 },
  empty: { minHeight: 150, justifyContent: 'center' },
});
