import { StyleSheet, Text, View } from 'react-native';
import { useAppearance } from '../theme/AppearanceProvider';
import { serif } from '../theme/tokens';

export function Brand() {
  const { colors } = useAppearance();
  return (
    <View style={styles.brand}>
      <View aria-hidden style={[styles.mark, { borderColor: colors.accent }]}>
        <Text allowFontScaling={false} style={[styles.initials, { color: colors.accent }]}>BB</Text>
      </View>
      <Text style={[styles.name, { color: colors.text }]}>BarberBook</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  brand: { flexDirection: 'row', flexShrink: 1, alignItems: 'center', gap: 8 },
  mark: { width: 36, height: 36, borderWidth: 1.5, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  initials: { fontFamily: serif, fontSize: 13, fontWeight: '700' },
  name: { fontFamily: serif, fontSize: 21, fontWeight: '700', flexShrink: 1 },
});
