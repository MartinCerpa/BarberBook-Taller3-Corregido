import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { BookingPage, Button, Message, useBookingStyles } from '../../components/BookingPage';
import { useProfessionalSession } from '../../components/ProfessionalSession';
import { useProfessionalRead } from '../../hooks/useProfessionalRead';
import { obtenerAgendaProfesional } from '../../services/professionalApi';
import { useAppearance } from '../../theme/AppearanceProvider';
import { formatBookingDate } from '../../utils/booking';
import { confirmedInOrder, formatScheduleTime } from '../../utils/professionalAgenda';

export default function ProfessionalAgenda() {
  const { onSessionEnd } = useProfessionalSession();
  const { colors } = useAppearance();
  const styles = useBookingStyles();
  const [chosen, setChosen] = useState(null);
  const { data, loading, error, refresh } = useProfessionalRead(obtenerAgendaProfesional, onSessionEnd);
  const day = data?.find(({ id }) => id === chosen) ?? data?.[0];
  const confirmed = day ? confirmedInOrder(day.bookings) : [];

  return (
    <BookingPage title="Agenda" safeBottom={false} footer={
      <Button label={loading ? 'Actualizando…' : error ? 'Reintentar' : 'Actualizar agenda'} disabled={loading} onPress={refresh} />
    }>
      <Text style={styles.muted}>Hora de Chile · próximos 14 días</Text>
      {loading && <ActivityIndicator color={colors.accent} accessibilityLabel="Consultando la agenda" />}
      {!!error && <Message error>{error}</Message>}
      {day && (
        <>
          <ScrollView horizontal style={agenda.rail} contentContainerStyle={agenda.dates}>
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
          <Text accessibilityRole="header" style={styles.label}>Atenciones confirmadas</Text>
          {confirmed.length === 0 && <Message>No hay reservas confirmadas en este día.</Message>}
          {confirmed.map((booking) => (
            <View key={booking.id} style={styles.card}>
              <View style={agenda.appointment}>
                <Text style={[agenda.time, { color: colors.accent }]}>
                  {formatScheduleTime(booking.starts_at)}–{formatScheduleTime(booking.ends_at)}
                </Text>
                <Text style={[agenda.status, { color: colors.success, backgroundColor: colors.successSurface }]}>Confirmada</Text>
              </View>
              <Text style={styles.label}>{booking.service_name}</Text>
            </View>
          ))}
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
});
