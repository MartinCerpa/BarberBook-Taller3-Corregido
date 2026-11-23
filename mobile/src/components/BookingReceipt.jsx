import { StyleSheet, Text, View } from 'react-native';
import { useAppearance } from '../theme/AppearanceProvider';
import { palettes, serif } from '../theme/tokens';
import { formatBookingDate, formatBookingInstant, formatPrice } from '../utils/booking';

const bookingStates = {
  pending: { title: 'Solicitud pendiente', message: 'El profesional aún debe confirmar tu solicitud.', tone: 'warning' },
  confirmed: { title: 'Reserva confirmada', message: 'Tu hora quedó confirmada.', tone: 'success' },
  rejected: { title: 'Solicitud rechazada', message: 'El profesional rechazó esta solicitud.', tone: 'error' },
  cancelled: { title: 'Reserva cancelada', message: 'Esta hora ya no está reservada.', tone: 'muted' },
  completed: { title: 'Reserva completada', message: 'Esta atención figura como completada.', tone: 'success' },
};

function Detail({ label, children, styles }) {
  return (
    <View style={styles.detail}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{children}</Text>
    </View>
  );
}

export function BookingReview({ professionalName, service, dateId, time, name, phone }) {
  const styles = receiptStyles[useAppearance().mode];
  return (
    <View style={styles.paper}>
      <View style={styles.serviceBanner}>
        <Text style={styles.bannerLabel}>Servicio</Text>
        <View style={styles.serviceRow}>
          <View style={styles.serviceIdentity}>
            <Text style={styles.serviceName}>{service.name}</Text>
            <Text style={styles.bannerLabel}>{service.duration_minutes} min</Text>
          </View>
          <Text style={styles.price}>{formatPrice(service.price)}</Text>
        </View>
      </View>
      <View style={styles.group}>
        <View style={styles.details}>
          <Detail label="Profesional" styles={styles}>{professionalName}</Detail>
        </View>
        <View style={styles.details}>
          <Detail label="Fecha" styles={styles}>{formatBookingDate(dateId)}</Detail>
          <Detail label="Hora de Chile" styles={styles}>{time}</Detail>
        </View>
      </View>
      <View style={[styles.group, styles.separator]}>
        <Text accessibilityRole="header" style={styles.groupTitle}>Datos de contacto</Text>
        <View style={styles.details}>
          <Detail label="Nombre" styles={styles}>{name}</Detail>
          <Detail label="Celular" styles={styles}>{phone}</Detail>
        </View>
      </View>
    </View>
  );
}

export function BookingResult({ result, professionalName, service, dateId, time, startsAt }) {
  const { mode, colors } = useAppearance();
  const styles = receiptStyles[mode];
  const status = bookingStates[result.status];
  const tone = colors[status.tone];
  const iconBackground = {
    warning: colors.warningSurface, success: colors.successSurface, error: colors.surface, muted: colors.surface,
  }[status.tone];

  return (
    <View style={styles.paper}>
      <View style={styles.resultHero}>
        <View aria-hidden style={[styles.statusIcon, { backgroundColor: iconBackground }]}>
          {status.tone === 'success' && <View style={[styles.check, { borderColor: tone }]} />}
          {result.status === 'pending' && (
            <View style={[styles.clock, { borderColor: tone }]}>
              <View style={[styles.clockHands, { borderColor: tone }]} />
            </View>
          )}
          {(result.status === 'rejected' || result.status === 'cancelled') && (
            <View style={[styles.inactiveMark, { borderColor: tone }]} />
          )}
        </View>
        <Text style={[styles.reference, { color: tone }]}>Reserva #{result.id}</Text>
        <Text accessibilityRole="header" accessibilityLiveRegion="polite" style={styles.resultTitle}>{status.title}</Text>
        <Text style={styles.resultMessage}>{status.message}</Text>
      </View>
      <View style={[styles.group, styles.separator]}>
        <View style={styles.details}>
          <Detail label="Profesional" styles={styles}>{professionalName}</Detail>
          <Detail label="Servicio" styles={styles}>{service.name}</Detail>
        </View>
        <View style={styles.details}>
          <Detail label="Fecha y hora de Chile" styles={styles}>
            {startsAt ? formatBookingInstant(startsAt) : `${formatBookingDate(dateId)} · ${time}`}
          </Detail>
        </View>
      </View>
    </View>
  );
}

const createStyles = (colors) => StyleSheet.create({
  paper: {
    borderWidth: 1, borderColor: colors.border, borderRadius: 14,
    backgroundColor: colors.surface, overflow: 'hidden',
  },
  serviceBanner: { padding: 16, backgroundColor: colors.cover, gap: 6 },
  bannerLabel: { color: '#E8ECE9', fontSize: 13 },
  serviceRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: 12, rowGap: 6 },
  serviceIdentity: { flexGrow: 1, flexShrink: 1, flexBasis: 140, gap: 3 },
  serviceName: { color: '#FCFCFA', fontFamily: serif, fontWeight: '700', fontSize: 23 },
  price: { color: '#FCFCFA', fontSize: 18, fontWeight: '700', fontVariant: ['tabular-nums'], flexShrink: 1 },
  group: { padding: 16, gap: 12 },
  groupTitle: { fontFamily: serif, color: colors.text, fontSize: 19, fontWeight: '700' },
  details: { gap: 12, flexDirection: 'row', flexWrap: 'wrap' },
  detail: { flexGrow: 1, flexShrink: 1, flexBasis: 120, gap: 4 },
  detailLabel: { color: colors.muted, fontSize: 13, fontWeight: '600' },
  detailValue: { color: colors.text, fontSize: 16, fontWeight: '600' },
  separator: { borderTopWidth: 1, borderColor: colors.border },
  resultHero: { alignItems: 'center', justifyContent: 'center', minHeight: 235, gap: 10, paddingVertical: 26, paddingHorizontal: 18, backgroundColor: colors.surfaceStrong },
  statusIcon: { width: 60, height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center', marginBottom: 2 },
  clock: { width: 25, height: 25, borderRadius: 13, borderWidth: 2 },
  clockHands: { position: 'absolute', top: 4, left: 9, width: 6, height: 7, borderLeftWidth: 2, borderBottomWidth: 2 },
  check: { width: 10, height: 19, borderRightWidth: 3, borderBottomWidth: 3, transform: [{ rotate: '45deg' }], marginTop: -4 },
  inactiveMark: { width: 20, borderBottomWidth: 2 },
  reference: { fontSize: 14, fontWeight: '700', textAlign: 'center' },
  resultTitle: { color: colors.text, fontFamily: serif, fontSize: 29, fontWeight: '700', textAlign: 'center' },
  resultMessage: { color: colors.muted, fontSize: 15, lineHeight: 22, textAlign: 'center', maxWidth: 320 },
});

const receiptStyles = { light: createStyles(palettes.light), dark: createStyles(palettes.dark) };
