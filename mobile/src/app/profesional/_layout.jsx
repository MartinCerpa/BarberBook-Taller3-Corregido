import { useCallback, useEffect, useRef, useState } from 'react';
import { router, Stack, Tabs, usePreventRemove, useSegments } from 'expo-router';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text } from 'react-native';
import { BookingPage, Button, Message } from '../../components/BookingPage';
import { Brand } from '../../components/Brand';
import { ProfessionalLogin } from '../../components/ProfessionalLogin';
import { ProfessionalSession } from '../../components/ProfessionalSession';
import { ProfessionalTabBar, professionalTabs } from '../../components/ProfessionalTabBar';
import { sessionExpired } from '../../hooks/useProfessionalRead';
import { cerrarSesionProfesional, obtenerSesionProfesional } from '../../services/professionalApi';
import { useAppearance } from '../../theme/AppearanceProvider';

const returnToCatalog = () => router.dismissTo('/');
export default function ProfessionalLayout() {
  const { colors } = useAppearance();
  const [, section] = useSegments();
  const [session, setSession] = useState(undefined);
  const [revision, setRevision] = useState(0);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [writing, setWriting] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const writeLock = useRef(false);
  usePreventRemove(writing, () => {});

  useEffect(() => {
    let active = true;
    obtenerSesionProfesional()
      .then((value) => { if (active) setSession(value); })
      .catch((cause) => { if (active) setError(cause.message); });
    return () => { active = false; };
  }, [revision]);

  const endSession = useCallback((message) => {
    setNotice(message);
    setSession(null);
  }, []);

  function beginWrite() {
    if (writeLock.current) return false;
    writeLock.current = true;
    setWriting(true);
    return true;
  }

  function endWrite() {
    writeLock.current = false;
    setWriting(false);
  }

  async function logout() {
    if (!beginWrite()) return;
    setSigningOut(true);
    try {
      await cerrarSesionProfesional(session.csrfToken);
      endSession('Cerraste sesión.');
    } catch (cause) {
      if (cause.status === 403) {
        try {
          const current = await obtenerSesionProfesional();
          if (current?.id === session.id) {
            setSession(current);
            Alert.alert('Sesión actualizada', 'Vuelve a intentar cerrar sesión.');
          } else {
            endSession(sessionExpired);
          }
        } catch (error) {
          Alert.alert('No pudimos verificar la sesión', error.message);
        }
      } else {
        Alert.alert('No pudimos cerrar sesión', cause.message);
      }
    } finally {
      setSigningOut(false);
      endWrite();
    }
  }

  return (
    <>
      <Stack.Screen options={{
        headerTitle: () => <Brand caption={session ? professionalTabs[section ?? 'index']?.label ?? 'Inicio' : undefined} />,
        headerRight: () => session ? (
          <Pressable accessibilityRole="button" accessibilityState={{ disabled: writing }} disabled={writing}
            onPress={logout} style={styles.logout}>
            <Text style={[styles.logoutLabel, { color: writing ? colors.muted : colors.accent }]}>
              {signingOut ? 'Cerrando…' : 'Cerrar sesión'}
            </Text>
          </Pressable>
        ) : null,
      }} />
      {session ? (
        <ProfessionalSession.Provider value={{ session, onSession: setSession, onSessionEnd: endSession, writing, beginWrite, endWrite }}>
          <Tabs initialRouteName="index" backBehavior="initialRoute" screenOptions={{ headerShown: false }}
            tabBar={(props) => <ProfessionalTabBar {...props} writing={writing} />}>
            {Object.entries(professionalTabs).map(([name, { label }]) => (
              <Tabs.Screen key={name} name={name} options={{ title: label }} />
            ))}
          </Tabs>
        </ProfessionalSession.Provider>
      ) : session === null ? (
        <ProfessionalLogin onSession={setSession} notice={notice} onBack={returnToCatalog} />
      ) : (
        <BookingPage title="Panel profesional">
          {error ? (
            <>
              <Message error>{error}</Message>
              <Button label="Reintentar" onPress={() => { setError(''); setRevision((value) => value + 1); }} />
            </>
          ) : (
            <>
              <ActivityIndicator color={colors.accent} />
              <Message>Verificando la sesión…</Message>
            </>
          )}
          <Button label="Volver al catálogo" secondary onPress={returnToCatalog} />
        </BookingPage>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  logout: { minHeight: 44, minWidth: 44, justifyContent: 'center', paddingHorizontal: 4, paddingVertical: 4 },
  logoutLabel: { fontSize: 13, fontWeight: '700' },
});
