import { useState } from 'react';
import { router, usePreventRemove } from 'expo-router';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { BookingPage, Button, Message, useBookingStyles } from '../../../components/BookingPage';
import { ProfessionalIcon } from '../../../components/ProfessionalIcon';
import { useProfessionalSession } from '../../../components/ProfessionalSession';
import {
  ApprovalSettingsForm, HoursSettingsForm, ProfileSettingsForm, ServiceSettingsForm,
} from '../../../components/ProfessionalSettingsForms';
import { useProfessionalRead } from '../../../hooks/useProfessionalRead';
import {
  obtenerAprobacionProfesional, obtenerJornadaProfesional, obtenerPerfilProfesional, obtenerServiciosProfesionales,
} from '../../../services/professionalApi';
import { useAppearance } from '../../../theme/AppearanceProvider';

const sections = [
  { title: 'Mi perfil', description: 'Nombre, presentación y contacto público', icon: 'settings', load: obtenerPerfilProfesional, Form: ProfileSettingsForm },
  { title: 'Servicios', description: 'Precios, duración y visibilidad en el catálogo', icon: 'requests', load: obtenerServiciosProfesionales, Form: ServiceSettingsForm },
  { title: 'Horarios de atención', description: 'Jornada semanal e intervalos de atención', icon: 'agenda', load: obtenerJornadaProfesional, Form: HoursSettingsForm },
  { title: 'Reservas y aprobación', description: 'Modalidad manual o automática', icon: 'settings', load: obtenerAprobacionProfesional, Form: ApprovalSettingsForm },
];

function SettingsEditor({ section: { title, description, load, Form }, onBack }) {
  const { onSessionEnd, writing } = useProfessionalSession();
  const { colors } = useAppearance();
  const { data, loading, error, refresh } = useProfessionalRead(load, onSessionEnd);

  return (
    <BookingPage title={title} safeBottom={false}>
      <Button label="Volver a Ajustes" secondary disabled={writing} onPress={onBack} />
      <Message>{description}</Message>
      {loading && <ActivityIndicator color={colors.accent} accessibilityLabel="Consultando ajustes" />}
      {!!error && <><Message error>{error}</Message><Button label="Reintentar" onPress={refresh} /></>}
      {data && <Form initial={data} />}
    </BookingPage>
  );
}

export default function ProfessionalSettings() {
  const [section, setSection] = useState(null);
  const { writing } = useProfessionalSession();
  usePreventRemove(writing, () => {});
  const styles = useBookingStyles();
  const { colors } = useAppearance();

  if (section) return <SettingsEditor section={section} onBack={() => setSection(null)} />;
  return (
    <BookingPage title="Ajustes" safeBottom={false}>
      {sections.map((option) => (
        <Pressable key={option.title} accessibilityRole="button" accessibilityLabel={option.title}
          onPress={() => setSection(option)} style={({ pressed }) => [styles.card, menu.option, pressed && styles.pressed]}>
          <ProfessionalIcon name={option.icon} />
          <View style={menu.label}>
            <Text style={styles.label}>{option.title}</Text>
            <Text style={styles.muted}>{option.description}</Text>
          </View>
          <Text aria-hidden style={[menu.arrow, { color: colors.accent }]}>›</Text>
        </Pressable>
      ))}
      <Button label="Volver a Inicio" secondary onPress={() => router.dismissTo('/profesional')} />
    </BookingPage>
  );
}

const menu = StyleSheet.create({
  option: { flexDirection: 'row', alignItems: 'center', minHeight: 64, gap: 12 },
  label: { flex: 1, gap: 4 },
  arrow: { fontSize: 22 },
});
