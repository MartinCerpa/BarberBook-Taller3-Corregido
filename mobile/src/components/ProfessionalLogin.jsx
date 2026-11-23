import { useRef, useState } from 'react';
import { usePreventRemove } from 'expo-router';
import { ActivityIndicator, Keyboard, StyleSheet, Text, TextInput, View } from 'react-native';
import { BookingPage, Button, Message, useBookingStyles } from './BookingPage';
import { iniciarSesionProfesional } from '../services/professionalApi';
import { useAppearance } from '../theme/AppearanceProvider';

export function ProfessionalLogin({ notice, onSession, onBack }) {
  const { mode, colors } = useAppearance();
  const styles = useBookingStyles();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const submitting = useRef(false);
  const emailInput = useRef(null);
  const passwordInput = useRef(null);
  usePreventRemove(busy, () => {});

  async function login() {
    if (submitting.current) return;
    const address = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address)) {
      setError('Ingresa un correo electrónico válido.');
      emailInput.current?.focus();
      return;
    }
    if (!password.length) {
      setError('Ingresa tu contraseña.');
      passwordInput.current?.focus();
      return;
    }
    submitting.current = true;
    setError('');
    setBusy(true);
    Keyboard.dismiss();
    try {
      const session = await iniciarSesionProfesional(address, password);
      setPassword('');
      onSession(session);
    } catch (cause) {
      setError(cause.status === 401 ? 'Correo o contraseña incorrectos.' : cause.message);
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }

  return (
    <BookingPage title="Acceso profesional">
      <View style={styles.card}>
        {!!notice && !error && <Message>{notice}</Message>}
        <Text style={styles.label}>Correo electrónico</Text>
        <TextInput
          ref={emailInput}
          accessibilityLabel="Correo electrónico"
          autoComplete="email"
          keyboardType="email-address"
          keyboardAppearance={mode}
          autoCapitalize="none"
          autoCorrect={false}
          maxLength={254}
          editable={!busy}
          value={email}
          onChangeText={setEmail}
          returnKeyType="next"
          onSubmitEditing={() => passwordInput.current?.focus()}
          style={styles.input}
        />
        <Text style={styles.label}>Contraseña</Text>
        <View style={form.row}>
          <TextInput
            ref={passwordInput}
            accessibilityLabel="Contraseña"
            autoComplete="current-password"
            keyboardAppearance={mode}
            autoCapitalize="none"
            autoCorrect={false}
            secureTextEntry={!visible}
            maxLength={128}
            editable={!busy}
            value={password}
            onChangeText={setPassword}
            returnKeyType="go"
            onSubmitEditing={login}
            style={[styles.input, form.password]}
          />
          <Button label={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
            secondary disabled={busy} onPress={() => setVisible((value) => !value)} />
        </View>
        {!!error && <Message error>{error}</Message>}
        {busy && <ActivityIndicator color={colors.accent} accessibilityLabel="Verificando el acceso" />}
        <Button label={busy ? 'Verificando…' : 'Iniciar sesión'} disabled={busy} onPress={login} />
      </View>
      <Button label="Volver al catálogo" secondary disabled={busy} onPress={onBack} />
    </BookingPage>
  );
}

const form = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  password: { flexGrow: 1, flexShrink: 1, flexBasis: 135 },
});
