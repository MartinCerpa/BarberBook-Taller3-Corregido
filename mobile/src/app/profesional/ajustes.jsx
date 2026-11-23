import { Text, View } from 'react-native';
import { BookingPage, Message, useBookingStyles } from '../../components/BookingPage';

const sections = [
  { title: 'Mi perfil', description: 'Edita tu identidad y la información pública de tu perfil.' },
  { title: 'Servicios', description: 'Gestiona los servicios que ofreces, precios y duración.' },
  { title: 'Horarios de atención', description: 'Organiza tu semana de trabajo y sus pausas.' },
  { title: 'Reservas y aprobación', description: 'Configura la modalidad de aprobación manual o automática.' },
];

export default function ProfessionalSettings() {
  const styles = useBookingStyles();
  return (
    <BookingPage title="Ajustes" safeBottom={false}>
      <Message>Gestiona estas opciones desde el panel profesional de BarberBook Web.</Message>
      {sections.map(({ title, description }) => (
        <View key={title} style={styles.card}>
          <Text accessibilityRole="header" style={styles.label}>{title}</Text>
          <Text style={styles.muted}>{description}</Text>
        </View>
      ))}
    </BookingPage>
  );
}
