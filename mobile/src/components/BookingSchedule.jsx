import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useAppearance } from '../theme/AppearanceProvider';
import { palettes, serif } from '../theme/tokens';
import { formatBookingDate, getSlotStatus } from '../utils/booking';

const weekday = new Intl.DateTimeFormat('es-CL', { weekday: 'short', timeZone: 'UTC' });
const month = new Intl.DateTimeFormat('es-CL', { month: 'short', timeZone: 'UTC' });
const statusLabels = { available: 'Disponible', pending: 'Con solicitudes pendientes', unavailable: 'No disponible' };

export function PendingSlotNotice() {
  const styles = scheduleStyles[useAppearance().mode];
  return (
    <Text accessibilityLiveRegion="polite" style={styles.pendingNotice}>
      Hay otras solicitudes para esta hora. Puedes enviar la tuya. Tu reserva queda sujeta a confirmación del profesional.
    </Text>
  );
}

export function BookingSchedule({ days, dateId, slots, slot, onSelectDate, onSelectSlot }) {
  const styles = scheduleStyles[useAppearance().mode];
  return (
    <View style={styles.schedule}>
      <View style={styles.section}>
        <Text accessibilityRole="header" style={styles.sectionTitle}>Fecha</Text>
        <ScrollView horizontal style={styles.rail} contentContainerStyle={styles.dates}>
          {days.map((day) => {
            const date = new Date(`${day.id}T00:00:00Z`);
            const selected = dateId === day.id;
            return (
              <Pressable
                key={day.id}
                accessibilityRole="button"
                accessibilityLabel={formatBookingDate(day.id)}
                accessibilityState={{ selected }}
                onPress={() => onSelectDate(day.id)}
                style={({ pressed }) => [styles.choice, styles.date, selected && styles.selected, pressed && styles.pressed]}
              >
                <Text style={[styles.dateDetail, selected && styles.activeText]}>{weekday.format(date)}</Text>
                <Text style={[styles.dayNumber, selected && styles.activeText]}>{date.getUTCDate()}</Text>
                <Text style={[styles.dateDetail, selected && styles.activeText]}>{month.format(date)}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>
      <View style={[styles.section, styles.hoursPanel]}>
        <Text accessibilityRole="header" style={styles.sectionTitle}>Hora</Text>
        <Text style={styles.caption}>
          {dateId ? formatBookingDate(dateId) : 'Selecciona una fecha para ver sus horas.'}
        </Text>
        {!!dateId && (
          <>
            <View style={styles.hours}>
              {slots.map((item) => {
                const status = getSlotStatus(item);
                const disabled = !item.isBookable;
                const selected = !disabled && slot?.startsAt === item.startsAt;
                const pending = status === 'pending';
                const filled = selected && !pending;
                return (
                  <Pressable
                    key={item.startsAt}
                    disabled={disabled}
                    accessibilityRole="button"
                    accessibilityLabel={`${item.time}, ${statusLabels[status]}`}
                    accessibilityState={{ selected, disabled }}
                    onPress={() => onSelectSlot(item)}
                    style={({ pressed }) => [
                      styles.choice, styles.hour, styles[status],
                      filled && styles.selected, selected && pending && styles.pendingSelected, pressed && styles.pressed,
                    ]}
                  >
                    <Text style={[styles.hourText, styles[`${status}Text`], filled && styles.activeText]}>{item.time}</Text>
                    {(pending || disabled) && (
                      <Text style={[styles.hourStatus, styles[`${status}Text`]]}>
                        {pending ? 'Pendientes' : statusLabels[status]}
                      </Text>
                    )}
                  </Pressable>
                );
              })}
            </View>
            {getSlotStatus(slot) === 'pending' && <PendingSlotNotice />}
            <View style={styles.legend}>
              {Object.entries(statusLabels).map(([status, label]) => (
                <View key={status} style={styles.legendItem}>
                  <View aria-hidden style={[styles.swatch, styles[status]]} />
                  <Text style={styles.caption}>{label}</Text>
                </View>
              ))}
            </View>
          </>
        )}
      </View>
    </View>
  );
}

const createStyles = (colors) => StyleSheet.create({
  schedule: { gap: 16 },
  section: { gap: 8 },
  sectionTitle: { color: colors.text, fontFamily: serif, fontSize: 22, fontWeight: '700' },
  rail: { flexGrow: 0 },
  dates: { gap: 8, paddingBottom: 8 },
  choice: {
    minHeight: 44, minWidth: 44, alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 9,
    paddingVertical: 7, paddingHorizontal: 8,
  },
  date: { minWidth: 66, minHeight: 76, gap: 1 },
  selected: { backgroundColor: colors.accent, borderColor: colors.accent },
  pressed: { opacity: 0.8 },
  dayNumber: { color: colors.text, fontFamily: serif, fontSize: 24, fontWeight: '700' },
  dateDetail: { color: colors.muted, fontSize: 12, textAlign: 'center' },
  hoursPanel: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 12, gap: 10 },
  hours: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  hour: { minWidth: 76, minHeight: 52, flexBasis: '30%', flexGrow: 1, maxWidth: '48%', gap: 2 },
  hourText: { fontSize: 16, fontWeight: '700', textAlign: 'center', fontVariant: ['tabular-nums'] },
  hourStatus: { fontSize: 11, fontWeight: '600', textAlign: 'center' },
  available: { borderColor: colors.accent },
  pending: { borderColor: colors.warning, backgroundColor: colors.warningSurface },
  pendingSelected: { borderColor: colors.accent, borderWidth: 2 },
  unavailable: { borderColor: colors.border, backgroundColor: colors.surfaceStrong },
  availableText: { color: colors.text },
  pendingText: { color: colors.warning },
  pendingNotice: {
    padding: 12, borderRadius: 8, backgroundColor: colors.warningSurface, color: colors.warning,
    fontSize: 13, lineHeight: 19,
  },
  unavailableText: { color: colors.muted },
  legend: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 12, rowGap: 5, paddingTop: 9, borderTopWidth: 1, borderColor: colors.border },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5, flexShrink: 1 },
  swatch: { width: 12, height: 12, borderWidth: 1, borderRadius: 3, backgroundColor: colors.surface },
  caption: { color: colors.muted, fontSize: 13 },
  activeText: { color: colors.accentText },
});

const scheduleStyles = { light: createStyles(palettes.light), dark: createStyles(palettes.dark) };
