import { Image, StyleSheet, View } from 'react-native';
import { useAppearance } from '../theme/AppearanceProvider';

const icons = {
  requests: require('../../assets/professional/requests.png'),
  agenda: require('../../assets/professional/calendar.png'),
  settings: require('../../assets/professional/settings.png'),
};

export function ProfessionalIcon({ name, tone = 'accent' }) {
  const { colors } = useAppearance();
  const background = tone === 'success' ? colors.successSurface : tone === 'warning' ? colors.warningSurface : colors.surfaceStrong;
  return (
    <View aria-hidden style={[styles.tile, { backgroundColor: background }]}>
      <Image source={icons[name]} style={[styles.image, { tintColor: colors[tone] }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  tile: { width: 38, height: 38, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  image: { width: 21, height: 21 },
});
