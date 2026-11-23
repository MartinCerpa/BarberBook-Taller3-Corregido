import { useRef, useState } from 'react';
import { Alert, Pressable, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { Button, Message, useBookingStyles } from './BookingPage';
import { useProfessionalSession } from './ProfessionalSession';
import { useProfessionalSettingsSave } from '../hooks/useProfessionalSettings';
import {
  guardarAprobacionProfesional, guardarJornadaProfesional, guardarPerfilProfesional, guardarServicioProfesional,
  obtenerAprobacionProfesional, obtenerJornadaProfesional, obtenerPerfilProfesional, obtenerServiciosProfesionales,
} from '../services/professionalApi';
import { useAppearance } from '../theme/AppearanceProvider';
import { serif } from '../theme/tokens';
import { formatPrice } from '../utils/booking';
import { prepararJornada, prepararPerfil, prepararServicio, weekDays } from '../utils/professionalSettings';

function Field({ label, accessibleLabel = label, disabled, ...props }) {
  const styles = useBookingStyles();
  const { colors } = useAppearance();
  return (
    <View style={layout.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput {...props} accessibilityLabel={accessibleLabel} editable={!disabled} placeholderTextColor={colors.muted}
        style={[styles.input, props.multiline && layout.multiline]} />
    </View>
  );
}

function SettingsCard({ title, children }) {
  const styles = useBookingStyles();
  const { colors } = useAppearance();
  return (
    <View style={styles.card}>
      <Text accessibilityRole="header" style={[layout.title, { color: colors.text }]}>{title}</Text>
      {children}
    </View>
  );
}

function SaveAction({ editor, label, onPress, disabled = false }) {
  return (
    <>
      {!!editor.feedback?.notice && <Message>{editor.feedback.notice}</Message>}
      {!!editor.feedback?.error && <Message error>{editor.feedback.error}</Message>}
      <Button label={editor.saving ? 'Guardando…' : label} disabled={editor.disabled || disabled} onPress={onPress} />
    </>
  );
}

function Toggle({ label, value, onChange, disabled }) {
  const styles = useBookingStyles();
  const { colors } = useAppearance();
  return (
    <View style={layout.toggle}>
      <Text style={[styles.label, layout.grow]}>{label}</Text>
      <Switch accessibilityLabel={label} value={value} onValueChange={onChange} disabled={disabled}
        trackColor={{ false: colors.border, true: colors.accent }} />
    </View>
  );
}

export function ProfileSettingsForm({ initial }) {
  const [draft, setDraft] = useState(initial);
  const { onSession } = useProfessionalSession();
  const editor = useProfessionalSettingsSave();
  const set = (field, value) => setDraft((previous) => ({ ...previous, [field]: value }));
  const fields = (entries) => entries.map(([field, label, props]) => (
    <Field key={field} label={label} value={draft[field] ?? ''} disabled={editor.disabled}
      onChangeText={(value) => set(field, value)} {...props} />
  ));

  function submit() {
    const { error, payload } = prepararPerfil(draft);
    if (error) return editor.setFeedback({ error });
    const apply = (saved) => {
      setDraft(saved);
      onSession((current) => current?.id === saved.id ? { ...current, name: saved.name } : current);
    };
    return editor.save({ write: (csrf) => guardarPerfilProfesional(payload, csrf), reload: obtenerPerfilProfesional, onSaved: apply });
  }

  return (
    <>
      <SettingsCard title="Identidad pública">
        {fields([['name', 'Nombre profesional', { maxLength: 100 }], ['title', 'Título profesional', { maxLength: 100 }]])}
        {fields([['bio', 'Descripción', { multiline: true, maxLength: 2000 }], ['location', 'Ubicación', { maxLength: 200 }]])}
      </SettingsCard>
      <SettingsCard title="Especialidades">
        {draft.specialties.map((value, index) => (
          <View key={index} style={layout.field}>
            <Field label={`Especialidad ${index + 1}`} value={value} maxLength={60} disabled={editor.disabled}
              onChangeText={(text) => set('specialties', draft.specialties.map((item, i) => i === index ? text : item))} />
            <Button label={`Quitar especialidad ${index + 1}`} secondary disabled={editor.disabled}
              onPress={() => set('specialties', draft.specialties.filter((_, i) => i !== index))} />
          </View>
        ))}
        <Button label="Añadir especialidad" secondary disabled={editor.disabled || draft.specialties.length >= 8}
          onPress={() => set('specialties', [...draft.specialties, ''])} />
      </SettingsCard>
      <SettingsCard title="Contacto">
        {fields([['instagram', 'Usuario de Instagram', { autoCapitalize: 'none', autoCorrect: false, maxLength: 31 }],
          ['whatsapp', 'WhatsApp', { keyboardType: 'phone-pad', maxLength: 30 }]])}
      </SettingsCard>
      <SaveAction editor={editor} label="Guardar perfil" onPress={submit} />
    </>
  );
}

const serviceDraft = (service) => ({ ...service, price: String(service.price), duration_minutes: String(service.duration_minutes) });

export function ServiceSettingsForm({ initial }) {
  const [services, setServices] = useState(initial);
  const [draft, setDraft] = useState(null);
  const editor = useProfessionalSettingsSave();
  const set = (field, value) => setDraft((previous) => ({ ...previous, [field]: value }));

  function submit() {
    const { error, payload } = prepararServicio(draft);
    if (error) return editor.setFeedback({ error });
    const { id } = draft;
    return editor.save({
      write: (csrf) => guardarServicioProfesional(id, payload, csrf),
      reload: obtenerServiciosProfesionales,
      onSaved: (saved) => {
        setServices((current) => current.map((item) => item.id === id ? saved : item));
        setDraft(serviceDraft(saved));
      },
      onReload: (current) => {
        setServices(current);
        const selected = current.find((item) => item.id === id);
        setDraft(selected ? serviceDraft(selected) : null);
      },
    });
  }

  return draft ? (
    <>
      <Button label="Volver a servicios" secondary disabled={editor.disabled}
        onPress={() => { editor.setFeedback(null); setDraft(null); }} />
      <SettingsCard title="Editar servicio">
        <Field label="Nombre del servicio" value={draft.name} maxLength={100} disabled={editor.disabled}
          onChangeText={(value) => set('name', value)} />
        <Field label="Precio en pesos chilenos" value={draft.price} inputMode="numeric" disabled={editor.disabled}
          onChangeText={(value) => set('price', value)} />
        <Field label="Duración en minutos" value={draft.duration_minutes} inputMode="numeric" disabled={editor.disabled}
          onChangeText={(value) => set('duration_minutes', value)} />
        <Toggle label="Visible en el catálogo" value={draft.active} disabled={editor.disabled} onChange={(value) => set('active', value)} />
      </SettingsCard>
      <SaveAction editor={editor} label="Guardar servicio" onPress={submit} />
    </>
  ) : (
    <>
      {services.length === 0 && <Message>No hay servicios registrados.</Message>}
      {services.map((service) => (
        <SettingsCard key={service.id} title={service.name}>
          <Message>{formatPrice(service.price)} · {service.duration_minutes} min · {service.active ? 'Activo' : 'Inactivo'}</Message>
          <Button label={`Editar ${service.name}`} secondary disabled={editor.disabled}
            onPress={() => setDraft(serviceDraft(service))} />
        </SettingsCard>
      ))}
    </>
  );
}

function DaySetting({ day, open, toggleOpen, update, disabled }) {
  const styles = useBookingStyles();
  const name = weekDays[day.day];
  function changeInterval(index, key, value) {
    update((current) => ({ ...current, intervals: current.intervals.map((interval, i) => i === index ? { ...interval, [key]: value } : interval) }));
  }
  return (
    <View style={styles.card}>
      <Pressable accessibilityRole="button" accessibilityState={{ expanded: open, disabled }} disabled={disabled} onPress={toggleOpen}
        style={({ pressed }) => [layout.dayButton, pressed && styles.pressed]}>
        <Text style={styles.label}>{name}</Text>
        <Text style={styles.muted}>{day.enabled
          ? `${day.intervals.length} ${day.intervals.length === 1 ? 'intervalo' : 'intervalos'}` : 'Cerrado'}</Text>
      </Pressable>
      {open && (
        <>
          <Toggle label={`Atender el ${name.toLowerCase()}`} value={day.enabled} disabled={disabled}
            onChange={(enabled) => update((current) => ({ ...current, enabled,
              intervals: enabled && !current.intervals.length ? [{ start: '', end: '' }] : current.intervals }))} />
          {day.enabled && day.intervals.map((interval, index) => (
            <View key={index} style={layout.field}>
              <View style={layout.times}>
                {Object.entries({ start: 'Apertura', end: 'Cierre' }).map(([key, label]) => (
                  <View key={key} style={layout.timeField}>
                    <Field label={label} accessibleLabel={`${name}, ${label.toLowerCase()} del intervalo ${index + 1}`}
                      value={interval[key]} disabled={disabled} placeholder="HH:MM" maxLength={5} autoCorrect={false}
                      onChangeText={(value) => changeInterval(index, key, value)} />
                  </View>
                ))}
              </View>
              <Button label={`Quitar intervalo ${index + 1}`} secondary disabled={disabled || day.intervals.length === 1}
                onPress={() => update((current) => ({ ...current, intervals: current.intervals.filter((_, i) => i !== index) }))} />
            </View>
          ))}
          {day.enabled && (
            <Button label="Añadir intervalo" secondary disabled={disabled || day.intervals.length >= 4}
              onPress={() => update((current) => ({ ...current, intervals: [...current.intervals, { start: '', end: '' }] }))} />
          )}
        </>
      )}
    </View>
  );
}

export function HoursSettingsForm({ initial }) {
  const [week, setWeek] = useState(initial.days);
  const [openDay, setOpenDay] = useState(null);
  const editor = useProfessionalSettingsSave();

  function submit() {
    const { error, payload } = prepararJornada(week);
    if (error) return editor.setFeedback({ error });
    return editor.save({
      write: (csrf) => guardarJornadaProfesional(payload, csrf), reload: obtenerJornadaProfesional,
      onSaved: (value) => setWeek(value.days),
    });
  }

  return (
    <>
      <Message>Usa HH:MM en hora de Chile. Para dejar una pausa, añade otro intervalo después del descanso.</Message>
      {week.map((day) => <DaySetting key={day.day} day={day} open={day.day === openDay} disabled={editor.disabled}
        toggleOpen={() => setOpenDay((current) => current === day.day ? null : day.day)}
        update={(edit) => setWeek((current) => current.map((item) => item.day === day.day ? edit(item) : item))} />)}
      <SaveAction editor={editor} label="Guardar horario" onPress={submit} />
    </>
  );
}

export function ApprovalSettingsForm({ initial }) {
  const [savedMode, setSavedMode] = useState(initial.automatic_approval);
  const [automatic, setAutomatic] = useState(savedMode);
  const { onSession } = useProfessionalSession();
  const editor = useProfessionalSettingsSave();
  const confirming = useRef(false);

  function confirm() {
    if (editor.disabled || confirming.current || savedMode === automatic) return;
    confirming.current = true;
    const close = () => { confirming.current = false; };
    const mode = automatic ? 'automática' : 'manual';
    const showMode = (current) => {
      setSavedMode(current.automatic_approval);
      setAutomatic(current.automatic_approval);
    };
    Alert.alert(`¿Guardar aprobación ${mode}?`, 'La modalidad se aplica a las solicitudes nuevas.', [
      { text: 'Volver', style: 'cancel', onPress: close },
      { text: 'Guardar modalidad', onPress: () => {
        close();
        void editor.save({
          write: (csrf) => guardarAprobacionProfesional(automatic, csrf), reload: obtenerAprobacionProfesional,
          onSaved: showMode, onReload: (current) => { showMode(current); onSession(current); },
        });
      } },
    ], { cancelable: true, onDismiss: close });
  }

  return (
    <>
      <SettingsCard title={`Modalidad actual: ${savedMode ? 'automática' : 'manual'}`}>
        <Message>Manual: revisas cada solicitud y eliges si la confirmas o rechazas.</Message>
        <Message>Automática: una solicitud nueva puede confirmarse si el horario está disponible y respeta el orden de las solicitudes pendientes.</Message>
        <Toggle label="Usar aprobación automática" value={automatic} onChange={setAutomatic} disabled={editor.disabled} />
      </SettingsCard>
      <SaveAction editor={editor} label="Guardar modalidad" onPress={confirm}
        disabled={savedMode === automatic} />
    </>
  );
}

const layout = StyleSheet.create({
  title: { fontFamily: serif, fontSize: 21, fontWeight: '700' },
  field: { gap: 6 },
  multiline: { minHeight: 96, textAlignVertical: 'top' },
  toggle: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 8 },
  grow: { flex: 1 },
  dayButton: { minHeight: 48, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  times: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  timeField: { flexGrow: 1, flexBasis: 116 },
});
