import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { Image, Pressable, StyleSheet, Text, View, type ImageSourcePropType } from 'react-native';
import { palettes } from '../theme/tokens';

export const professionalTabs: Record<string, { label: string; icon: ImageSourcePropType }> = {
  index: { label: 'Inicio', icon: require('../../assets/professional/home.png') },
  solicitudes: { label: 'Solicitudes', icon: require('../../assets/professional/requests.png') },
  agenda: { label: 'Agenda', icon: require('../../assets/professional/calendar.png') },
  ajustes: { label: 'Ajustes', icon: require('../../assets/professional/settings.png') },
};

export function ProfessionalTabBar({ state, emitter, navigateToTab, insets, writing }: BottomTabBarProps & { writing: boolean }) {
  const colors = palettes.dark;
  return (
    <View style={[styles.bar, {
      backgroundColor: colors.background,
      borderColor: colors.border,
      paddingBottom: insets.bottom,
      paddingLeft: insets.left,
      paddingRight: insets.right,
    }]}>
      <View role="tablist" accessibilityLabel="Secciones del panel profesional" style={styles.links}>
        {state.routes.map((route, index) => {
          const tab = professionalTabs[route.name];
          if (!tab) return null;
          const selected = state.index === index;
          const tint = selected ? colors.accent : colors.muted;
          function choose() {
            if (writing) return;
            const event = emitter.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
            if (!selected && !event.defaultPrevented) navigateToTab(route.key);
          }
          return (
            <Pressable key={route.key} accessibilityRole="tab" accessibilityLabel={tab.label}
              accessibilityState={{ selected, disabled: writing }} disabled={writing} onPress={choose}
              style={({ pressed }) => [
                styles.tab,
                selected && { backgroundColor: colors.surfaceStrong, borderColor: colors.border },
                pressed && styles.pressed,
              ]}>
              <Image source={tab.icon} aria-hidden style={[styles.icon, { tintColor: tint }]} />
              <Text style={[styles.label, { color: tint }]}>{tab.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { borderTopWidth: StyleSheet.hairlineWidth },
  links: { width: '100%', maxWidth: 640, alignSelf: 'center', flexDirection: 'row', paddingHorizontal: 8, paddingVertical: 6, gap: 4 },
  tab: {
    flex: 1, minWidth: 44, minHeight: 54, alignItems: 'center', justifyContent: 'center', gap: 3,
    borderWidth: 1, borderColor: 'transparent', borderRadius: 10, paddingHorizontal: 2, paddingVertical: 6,
  },
  icon: { width: 22, height: 22 },
  label: { textAlign: 'center', fontSize: 11, fontWeight: '700', maxWidth: '100%' },
  pressed: { opacity: 0.72 },
});
