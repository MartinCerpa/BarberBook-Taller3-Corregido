import { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar as NativeStatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { obtenerProfesionales, obtenerServicios } from './src/services/api';
import { colors, serif } from './src/theme/tokens';

const currency = new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' });

function Header() {
  return (
    <View style={styles.header}>
      <View style={styles.brand}>
        <View accessible={false} aria-hidden style={styles.brandMark}>
          <Text style={styles.brandInitials}>BB</Text>
        </View>
        <Text style={styles.brandName}>BarberBook</Text>
      </View>
      <View>
        <Text style={styles.panelLabel}>Panel profesional</Text>
        <Text style={styles.panelStatus}>Próximamente</Text>
      </View>
    </View>
  );
}

function Profile({ professional }) {
  const initial = professional.name.trim().charAt(0).toLocaleUpperCase('es-CL');
  return (
    <View>
      <View aria-hidden style={styles.cover}>
        <View style={styles.coverRing} />
        <Text style={styles.coverInitial}>{initial}</Text>
      </View>
      <View style={[styles.card, styles.profileCard]}>
        <View aria-hidden style={styles.avatar}>
          <Text style={styles.avatarInitial}>{initial}</Text>
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
            <Text style={styles.muted}>Ubicación</Text>
            <Text style={styles.body}>{professional.location}</Text>
          </View>
        )}
      </View>
    </View>
  );
}

function ServiceList({ services }) {
  return (
    <View style={styles.section}>
      <Text accessibilityRole="header" style={styles.sectionTitle}>Servicios</Text>
      {services.length === 0 && <Text style={styles.body}>Este profesional aún no tiene servicios publicados.</Text>}
      {services.map((service) => (
        <View key={service.id} style={[styles.card, styles.service]}>
          <View style={styles.serviceDetails}>
            <Text style={styles.serviceName}>{service.name}</Text>
            <Text style={styles.muted}>{service.duration_minutes} min</Text>
          </View>
          <Text style={styles.price}>{currency.format(service.price)}</Text>
        </View>
      ))}
      <View style={styles.reservation}>
        <Text style={styles.serviceName}>Reservar una hora</Text>
        <Text style={styles.muted}>Disponible en la siguiente etapa.</Text>
      </View>
    </View>
  );
}

export default function App() {
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

  return (
    <SafeAreaView style={styles.app}>
      <StatusBar style="dark" />
      <Header />
      <ScrollView contentContainerStyle={styles.content}>
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
                        style={[styles.professionalOption, selected && styles.selectedOption]}
                      >
                        <Text style={selected ? styles.retryLabel : styles.body}>{name}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            )}
            <Profile professional={professional} />
            <ServiceList services={catalog.services.filter((service) => service.professional_id === professional.id)} />
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  app: {
    flex: 1,
    backgroundColor: colors.background,
    paddingTop: Platform.OS === 'android' ? NativeStatusBar.currentHeight : 0,
  },
  header: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 12,
    gap: 8,
    borderBottomWidth: 1,
    borderColor: colors.border,
  },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  brandMark: {
    width: 36, height: 36, borderWidth: 1, borderColor: colors.text, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
  },
  brandInitials: { color: colors.text, fontFamily: serif, fontSize: 13, fontWeight: '700' },
  brandName: { color: colors.text, fontFamily: serif, fontSize: 20, fontWeight: '700' },
  panelLabel: { color: colors.muted, fontSize: 13, fontWeight: '600' },
  panelStatus: { color: colors.muted, fontSize: 12 },
  content: { padding: 16, paddingBottom: 48, gap: 20, width: '100%', maxWidth: 640, alignSelf: 'center' },
  card: { padding: 16, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 12 },
  cover: {
    height: 172, backgroundColor: colors.surfaceStrong, borderWidth: 1, borderColor: colors.border,
    borderRadius: 16, overflow: 'hidden', alignItems: 'center', justifyContent: 'center',
  },
  coverRing: { position: 'absolute', width: 226, height: 226, borderWidth: 1, borderColor: colors.border, borderRadius: 113 },
  coverInitial: { color: colors.accent, opacity: 0.28, fontFamily: serif, fontSize: 94 },
  profileCard: { marginHorizontal: 8, marginTop: -22, paddingTop: 44, gap: 8 },
  avatar: {
    position: 'absolute', top: -35, left: 16, width: 70, height: 70, borderRadius: 35,
    borderWidth: 4, borderColor: colors.surface, backgroundColor: colors.accent,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarInitial: { color: colors.accentText, fontFamily: serif, fontSize: 29 },
  profileLabel: { color: colors.accent, fontWeight: '600' },
  name: { color: colors.text, fontFamily: serif, fontSize: 34, fontWeight: '700' },
  profileTitle: { color: colors.text, fontSize: 17, fontWeight: '600' },
  body: { color: colors.text, fontSize: 15, lineHeight: 22 },
  muted: { color: colors.muted, fontSize: 13 },
  specialties: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  specialty: { color: colors.text, backgroundColor: colors.surfaceStrong, borderRadius: 8, paddingHorizontal: 9, paddingVertical: 5 },
  location: { marginTop: 4, paddingTop: 10, borderTopWidth: 1, borderColor: colors.border, gap: 2 },
  section: { gap: 10 },
  sectionTitle: { color: colors.text, fontFamily: serif, fontSize: 25, fontWeight: '700' },
  service: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  serviceDetails: { flex: 1, gap: 4 },
  serviceName: { color: colors.text, fontSize: 16, fontWeight: '600' },
  price: { color: colors.accent, fontSize: 15, fontWeight: '700' },
  reservation: { backgroundColor: colors.surfaceStrong, borderRadius: 8, padding: 14, gap: 4 },
  loading: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  error: { color: colors.error, fontSize: 15, lineHeight: 22 },
  retry: { alignSelf: 'flex-start', backgroundColor: colors.accent, borderRadius: 8, paddingHorizontal: 16, minHeight: 44, justifyContent: 'center' },
  retryLabel: { color: colors.accentText, fontSize: 15, fontWeight: '600' },
  pressed: { opacity: 0.8 },
  professionalOption: { borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: 12, minHeight: 44, justifyContent: 'center' },
  selectedOption: { backgroundColor: colors.accent, borderColor: colors.accent },
});
