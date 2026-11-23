import { Platform, KeyboardAvoidingView, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAppearance } from '../theme/AppearanceProvider';
import { palettes, serif } from '../theme/tokens';

export function BookingPage({ title, step, footer, centered, safeBottom = true, children }) {
  const styles = useBookingStyles();
  return (
    <SafeAreaView edges={safeBottom ? ['left', 'right', 'bottom'] : ['left', 'right']} style={styles.screen}>
      <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView key={title} style={styles.screen} keyboardShouldPersistTaps="handled"
          contentContainerStyle={[styles.frame, styles.content, centered && styles.centered]}>
          {!!title && (
            <View style={styles.heading}>
              {!!step && (
                <View style={styles.progress}>
                  <Text style={styles.step}>Paso {step} de 4</Text>
                  <View aria-hidden style={styles.progressTrack}>
                    {[1, 2, 3, 4].map((number) => (
                      <View key={number} style={[styles.progressSegment, number <= step && styles.progressFilled]} />
                    ))}
                  </View>
                </View>
              )}
              <Text accessibilityRole="header" style={styles.title}>{title}</Text>
            </View>
          )}
          {children}
        </ScrollView>
        {!!footer && <View style={styles.footer}><View style={[styles.frame, styles.footerContent]}>{footer}</View></View>}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

export function Button({ label, onPress, secondary = false, disabled = false, destructive = false }) {
  const styles = useBookingStyles();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button, (secondary || destructive) && styles.secondary, destructive && styles.destructive,
        pressed && !disabled && styles.pressed, disabled && styles.disabled,
      ]}
    >
      <Text style={[styles.buttonText, secondary && styles.secondaryText, destructive && styles.destructiveText, disabled && styles.muted]}>{label}</Text>
    </Pressable>
  );
}

export function Option({ label, detail, selected, onPress }) {
  const styles = useBookingStyles();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [styles.card, styles.option, selected && styles.selected, pressed && styles.pressed]}
    >
      <Text style={styles.label}>{label}</Text>
      {!!detail && <Text style={styles.muted}>{detail}</Text>}
    </Pressable>
  );
}

export function Message({ children, error }) {
  const styles = useBookingStyles();
  return (
    <Text accessibilityRole={error ? 'alert' : undefined} accessibilityLiveRegion="polite" style={error ? styles.error : styles.muted}>
      {children}
    </Text>
  );
}

const createStyles = (colors) => StyleSheet.create({
  screen: { flex: 1 },
  frame: { width: '100%', maxWidth: 640, alignSelf: 'center', paddingHorizontal: 16 },
  content: { paddingTop: 16, paddingBottom: 20, gap: 14 },
  centered: { flexGrow: 1, justifyContent: 'center' },
  heading: { gap: 8 },
  progress: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 },
  progressTrack: { flexDirection: 'row', gap: 4 },
  progressSegment: { width: 16, height: 3, backgroundColor: colors.border, borderRadius: 2 },
  progressFilled: { backgroundColor: colors.accent },
  step: { color: colors.accent, fontSize: 13, fontWeight: '700' },
  title: { color: colors.text, fontSize: 30, fontFamily: serif, fontWeight: '700' },
  label: { color: colors.text, fontSize: 16, fontWeight: '600' },
  muted: { color: colors.muted, fontSize: 14 },
  scheduleContext: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  contextCopy: { flexGrow: 1, flexShrink: 1, flexBasis: 120, gap: 3 },
  footer: { backgroundColor: colors.surface, borderTopWidth: 1, borderColor: colors.border },
  footerContent: { paddingVertical: 10, gap: 8 },
  card: { padding: 14, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 12, gap: 8 },
  option: { minHeight: 48, justifyContent: 'center' },
  selected: { borderColor: colors.accent, backgroundColor: colors.surfaceStrong },
  input: { minHeight: 48, borderWidth: 1, borderColor: colors.border, borderRadius: 8, padding: 10, color: colors.text, backgroundColor: colors.surface, fontSize: 16 },
  button: { minHeight: 48, padding: 12, justifyContent: 'center', alignItems: 'center', borderRadius: 8, backgroundColor: colors.accent },
  secondary: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  destructive: { borderColor: colors.error },
  buttonText: { color: colors.accentText, fontSize: 16, fontWeight: '700', textAlign: 'center' },
  secondaryText: { color: colors.accent },
  destructiveText: { color: colors.error },
  pressed: { opacity: 0.8 },
  disabled: { backgroundColor: colors.surfaceStrong },
  error: { color: colors.error, fontSize: 15, lineHeight: 21 },
});

const bookingStyles = { light: createStyles(palettes.light), dark: createStyles(palettes.dark) };

export function useBookingStyles() {
  return bookingStyles[useAppearance().mode];
}
