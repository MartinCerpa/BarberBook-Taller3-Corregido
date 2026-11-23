import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Brand } from '../components/Brand';
import { AppearanceProvider, useAppearance } from '../theme/AppearanceProvider';
import { serif } from '../theme/tokens';

export default function Layout() {
  return <AppearanceProvider><Navigation /></AppearanceProvider>;
}

function Navigation() {
  const { colors, mode } = useAppearance();
  const base = mode === 'dark' ? DarkTheme : DefaultTheme;
  return (
    <ThemeProvider value={{
      ...base,
      colors: { ...base.colors, background: colors.background, card: colors.surface, text: colors.text, border: colors.border, primary: colors.accent },
    }}>
      <StatusBar style={mode === 'dark' ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          contentStyle: { backgroundColor: colors.background },
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.text,
          headerTitleStyle: { fontFamily: serif },
          headerBackButtonDisplayMode: 'minimal',
        }}
      >
        <Stack.Screen name="index" options={{ title: 'BarberBook', headerShown: false }} />
        <Stack.Screen name="reserva/[professionalId]" options={{ title: 'Reservar una hora', headerTitle: () => <Brand /> }} />
        <Stack.Screen name="mi-reserva" options={{ title: 'Mi reserva', headerTitle: () => <Brand /> }} />
      </Stack>
    </ThemeProvider>
  );
}
