import { useEffect, useState } from 'react';
import { router } from 'expo-router';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Brand } from '../components/Brand';
import { ThemeIcon } from '../components/ThemeIcon';
import { obtenerProfesionales, obtenerServicios } from '../services/api';
import { useAppearance } from '../theme/AppearanceProvider';
import { palettes, serif } from '../theme/tokens';
import { formatPrice } from '../utils/booking';

const coverLines = [0, 1, 2, 3, 4, 5, 6, 7, 8];

function Header({ styles, colors, mode, toggle }) {
  const nextIsLight = mode === 'dark';
  return (
    <View style={styles.header}>
      <View style={[styles.frame, styles.headerContent]}>
        <Brand />
        <View style={styles.headerActions}>
          <View accessible accessibilityRole="button" accessibilityState={{ disabled: true }}
            accessibilityLabel="Panel profesional, próximamente" style={styles.panel}>
            <Text style={styles.panelLabel}>Panel profesional</Text>
            <Text style={styles.panelStatus}>Próximamente</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={nextIsLight ? 'Activar tema claro' : 'Activar tema oscuro'}
            onPress={toggle}
            style={({ pressed }) => [styles.themeToggle, pressed && styles.pressed]}
          >
            <ThemeIcon nextIsLight={nextIsLight} color={colors.accent} background={colors.surfaceStrong} />
          </Pressable>
        </View>
      </View>
    </View>
  );
}

function Profile({ professional, styles }) {
  const initial = professional.name.trim().charAt(0).toLocaleUpperCase('es-CL');
  return (
    <View>
      <View aria-hidden style={styles.cover}>
        <View style={styles.coverPattern}>
          {coverLines.map((line) => <View key={line} style={styles.coverLine} />)}
        </View>
        <View style={styles.coverFrame} />
        <Text allowFontScaling={false} style={styles.coverInitial}>{initial}</Text>
      </View>
      <View style={[styles.card, styles.profileCard]}>
        <View aria-hidden style={styles.avatar}>
          <Text allowFontScaling={false} style={styles.avatarInitial}>{initial}</Text>
        </View>
        <Text style={styles.profileLabel}>Perfil profesional</Text>
        <Text accessibilityRole="header" style={styles.name}>{professional.name}</Text>
        {!!professional.title && <Text style={styles.profileTitle}>{professional.title}</Text>}
        {!!professional.bio && <Text style={styles.body}>{professional.bio}</Text>}
        {!!professional.specialties?.length && (
          <View style={styles.specialties}>
            {professional.specialties.map((specialty, index) => (
              <Text key={`${specialty}-${index}`} style={styles.specialty}>{specialty}</Text>
            ))}
          </View>
        )}
        {!!professional.location && (
          <View style={styles.location}>
            <Text style={styles.locationLabel}>Ubicación</Text>
            <Text style={styles.body}>{professional.location}</Text>
          </View>
        )}
      </View>
    </View>
  );
}

function ServiceList({ services, styles }) {
  return (
    <View style={styles.section}>
      <Text accessibilityRole="header" style={styles.sectionTitle}>Servicios</Text>
      <View style={styles.serviceList}>
        {services.length === 0 && <Text style={styles.emptyServices}>Este profesional aún no tiene servicios publicados.</Text>}
        {services.map((service) => (
          <View key={service.id} style={styles.service}>
            <View style={styles.serviceDetails}>
              <Text style={styles.serviceName}>{service.name}</Text>
              <View style={styles.durationRow}>
                <View aria-hidden style={styles.durationIcon}><View style={styles.durationHands} /></View>
                <Text style={styles.duration}>{service.duration_minutes} min</Text>
              </View>
            </View>
            <Text style={styles.price}>{formatPrice(service.price)}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function BookingBar({ professionalId, styles }) {
  return (
    <View style={styles.bookingBar}>
      <View style={[styles.frame, styles.bookingBarContent]}>
        <Pressable
          accessibilityRole="button"
          accessibilityHint="Abre la selección de servicio, fecha y hora"
          onPress={() => router.push({ pathname: '/reserva/[professionalId]', params: { professionalId: String(professionalId) } })}
          style={({ pressed }) => [styles.reserve, pressed && styles.primaryPressed]}
        >
          <Text style={styles.reserveLabel}>Reservar hora</Text>
        </Pressable>
      </View>
    </View>
  );
}

export default function App() {
  const { mode, colors, toggle } = useAppearance();
  const styles = profileStyles[mode];
  const [catalog, setCatalog] = useState(null);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  const [selectedId, setSelectedId] = useState(null);

  useEffect(() => {
    let active = true;
    Promise.all([obtenerProfesionales(), obtenerServicios()])
      .then(([professionals, services]) => {
        if (active) setCatalog({ professionals, services });
      })
      .catch((cause) => {
        if (active) setError(cause.message);
      });
    return () => { active = false; };
  }, [revision]);

  function retry() {
    setError('');
    setRevision((value) => value + 1);
  }

  const professional = catalog?.professionals.find(({ id }) => id === selectedId)
    ?? catalog?.professionals[0];
  const services = professional
    ? catalog.services.filter((service) => service.professional_id === professional.id)
    : [];

  return (
    <SafeAreaView edges={['top', 'right', 'bottom', 'left']} style={styles.app}>
      <Header styles={styles} colors={colors} mode={mode} toggle={toggle} />
      <ScrollView style={styles.scroll} contentContainerStyle={[styles.frame, styles.content]}>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push('/mi-reserva')}
          style={({ pressed }) => [styles.trackingLink, pressed && styles.pressed]}
        >
          <Text style={styles.trackingLabel}>Mi reserva</Text>
        </Pressable>
        {!catalog && !error && (
          <View style={[styles.card, styles.loading]} accessibilityLiveRegion="polite">
            <ActivityIndicator color={colors.accent} />
            <Text style={styles.body}>Cargando perfil y servicios…</Text>
          </View>
        )}
        {!!error && (
          <View style={[styles.card, styles.section]} accessibilityLiveRegion="polite">
            <Text accessibilityRole="header" style={styles.sectionTitle}>No pudimos cargar el perfil</Text>
            <Text style={styles.error}>{error}</Text>
            <Pressable
              accessibilityRole="button"
              onPress={retry}
              style={({ pressed }) => [styles.retry, pressed && styles.pressed]}
            >
              <Text style={styles.retryLabel}>Reintentar</Text>
            </Pressable>
          </View>
        )}
        {catalog && !professional && (
          <View style={[styles.card, styles.section]}>
            <Text accessibilityRole="header" style={styles.sectionTitle}>Sin profesionales publicados</Text>
            <Text style={styles.body}>Vuelve más tarde para consultar los servicios.</Text>
          </View>
        )}
        {professional && (
          <>
            {catalog.professionals.length > 1 && (
              <View style={styles.section}>
                <Text accessibilityRole="header" style={styles.sectionTitle}>Profesionales</Text>
                <View style={styles.specialties}>
                  {catalog.professionals.map(({ id, name }) => {
                    const selected = id === professional.id;
                    return (
                      <Pressable
                        key={id}
                        accessibilityRole="button"
                        accessibilityState={{ selected }}
                        onPress={() => setSelectedId(id)}
                        style={({ pressed }) => [styles.professionalOption, selected && styles.selectedOption, pressed && styles.pressed]}
                      >
                        <Text style={selected ? styles.retryLabel : styles.body}>{name}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            )}
            <Profile professional={professional} styles={styles} />
            <ServiceList services={services} styles={styles} />
          </>
        )}
      </ScrollView>
      {services.length > 0 && <BookingBar professionalId={professional.id} styles={styles} />}
    </SafeAreaView>
  );
}

const createStyles = (colors) => StyleSheet.create({
  app: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderColor: colors.border,
  },
  frame: {
    width: '100%',
    maxWidth: 640,
    alignSelf: 'center',
    paddingHorizontal: 16,
  },
  headerContent: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    gap: 12,
  },
  headerActions: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8, maxWidth: '100%' },
  panel: { minHeight: 44, justifyContent: 'center', borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingVertical: 5, paddingHorizontal: 8, flexShrink: 1 },
  panelLabel: { color: colors.text, fontSize: 12, fontWeight: '700' },
  panelStatus: { color: colors.muted, fontSize: 10 },
  themeToggle: {
    width: 44, height: 44, borderWidth: 1, borderColor: colors.accent,
    backgroundColor: colors.surfaceStrong, borderRadius: 22, alignItems: 'center', justifyContent: 'center',
  },
  scroll: { flex: 1 },
  content: { paddingTop: 16, paddingBottom: 24, gap: 24 },
  trackingLink: {
    alignSelf: 'flex-end', minHeight: 44, justifyContent: 'center', paddingHorizontal: 12,
    backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: 8,
  },
  trackingLabel: { color: colors.accent, fontSize: 14, fontWeight: '700' },
  card: { padding: 18, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 14 },
  cover: {
    height: 158,
    backgroundColor: colors.cover,
    borderRadius: 14,
    overflow: 'hidden',
    alignItems: 'flex-end',
    justifyContent: 'center',
    paddingRight: 32,
  },
  coverPattern: {
    position: 'absolute', left: -96, top: -75, bottom: -75,
    justifyContent: 'space-evenly', transform: [{ rotate: '-36deg' }],
  },
  coverLine: { width: 390, height: 1, backgroundColor: 'rgba(252, 252, 250, 0.15)' },
  coverFrame: {
    position: 'absolute', top: 10, right: 10, bottom: 10, left: 10,
    borderWidth: 1, borderRadius: 8, borderColor: 'rgba(252, 252, 250, 0.28)',
  },
  coverInitial: {
    color: 'rgba(252, 252, 250, 0.70)', fontFamily: serif, fontStyle: 'italic', fontSize: 116,
  },
  profileCard: { marginHorizontal: 8, marginTop: -22, paddingTop: 42, gap: 9 },
  avatar: {
    position: 'absolute', top: -32, left: 17, width: 64, height: 64, borderRadius: 32,
    borderWidth: 4, borderColor: colors.surface, backgroundColor: colors.surfaceStrong,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarInitial: { color: colors.accent, fontFamily: serif, fontStyle: 'italic', fontSize: 29 },
  profileLabel: { color: colors.accent, fontSize: 13, fontWeight: '700' },
  name: { color: colors.text, fontFamily: serif, fontSize: 36, fontWeight: '700' },
  profileTitle: { color: colors.text, fontSize: 16, fontWeight: '600' },
  body: { color: colors.muted, fontSize: 15, lineHeight: 23 },
  specialties: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  specialty: { color: colors.accent, backgroundColor: colors.surfaceStrong, borderRadius: 6, paddingHorizontal: 9, paddingVertical: 5, fontWeight: '600', flexShrink: 1 },
  location: { marginTop: 3, paddingTop: 10, borderTopWidth: 1, borderColor: colors.border, gap: 2 },
  locationLabel: { color: colors.text, fontSize: 13, fontWeight: '600' },
  section: { gap: 10 },
  sectionTitle: { color: colors.text, fontFamily: serif, fontSize: 26, fontWeight: '700' },
  serviceList: { gap: 9 },
  emptyServices: { color: colors.muted, fontSize: 15, lineHeight: 23, padding: 16 },
  service: {
    flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between',
    columnGap: 12, rowGap: 4, padding: 15, borderWidth: 1, borderColor: colors.border,
    backgroundColor: colors.surface, borderRadius: 12,
  },
  serviceDetails: { flexGrow: 1, flexShrink: 1, flexBasis: 140, gap: 4 },
  serviceName: { color: colors.text, fontFamily: serif, fontSize: 18, fontWeight: '700' },
  durationRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  durationIcon: { width: 13, height: 13, borderWidth: 1, borderColor: colors.muted, borderRadius: 7 },
  durationHands: { position: 'absolute', top: 2, left: 5, width: 3, height: 4, borderLeftWidth: 1, borderBottomWidth: 1, borderColor: colors.muted },
  duration: { color: colors.muted, fontSize: 13 },
  price: { color: colors.accent, fontSize: 16, fontWeight: '700', fontVariant: ['tabular-nums'], flexShrink: 1 },
  bookingBar: { borderTopWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  bookingBarContent: { paddingVertical: 12 },
  reserve: {
    backgroundColor: colors.accent, borderRadius: 12, minHeight: 56, paddingVertical: 12, paddingHorizontal: 16,
    width: '100%', justifyContent: 'center',
  },
  reserveLabel: { color: colors.accentText, fontSize: 23, fontFamily: serif, fontWeight: '700', textAlign: 'center' },
  loading: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  error: { color: colors.error, fontSize: 15, lineHeight: 22 },
  retry: { alignSelf: 'flex-start', backgroundColor: colors.accent, borderRadius: 8, paddingHorizontal: 16, minHeight: 44, justifyContent: 'center' },
  retryLabel: { color: colors.accentText, fontSize: 15, fontWeight: '600' },
  pressed: { opacity: 0.8 },
  primaryPressed: { backgroundColor: colors.accentPressed },
  professionalOption: { borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: 12, minHeight: 44, minWidth: 44, flexShrink: 1, justifyContent: 'center' },
  selectedOption: { backgroundColor: colors.accent, borderColor: colors.accent },
});

const profileStyles = { light: createStyles(palettes.light), dark: createStyles(palettes.dark) };
