import { useEffect, useRef, useState } from 'react';
import { router, usePreventRemove } from 'expo-router';
import { ActivityIndicator, Text, TextInput, View } from 'react-native';
import { crearReserva, esCredencialSeguimiento, obtenerDisponibilidad } from '../services/api';
import { guardarSeguimiento } from '../services/bookingTracking';
import { useAppearance } from '../theme/AppearanceProvider';
import { formatPrice, getSlotStatus, validateCustomer } from '../utils/booking';
import { BookingPage, Button, Message, Option, useBookingStyles } from './BookingPage';
import { BookingResult, BookingReview } from './BookingReceipt';
import { BookingSchedule, PendingSlotNotice } from './BookingSchedule';

const titles = ['Elige un servicio', 'Elige fecha y hora', 'Datos de contacto', 'Revisa tu reserva'];

export function BookingFlow({ professional, services }) {
  const { mode, colors } = useAppearance();
  const styles = useBookingStyles();
  const professionalId = professional.id;
  const [step, setStep] = useState(0);
  const [service, setService] = useState(null);
  const [days, setDays] = useState(null);
  const [dateId, setDateId] = useState(null);
  const [slot, setSlot] = useState(null);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [availabilityError, setAvailabilityError] = useState('');
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [uncertain, setUncertain] = useState(false);
  const sending = useRef(false);
  const serviceId = service?.id;

  usePreventRemove(busy, () => {});

  useEffect(() => {
    if (!serviceId) return;
    let active = true;
    obtenerDisponibilidad(professionalId, serviceId)
      .then((items) => { if (active) setDays(items); })
      .catch((cause) => { if (active) setAvailabilityError(cause.message); });
    return () => { active = false; };
  }, [professionalId, serviceId, revision]);

  function refreshAvailability() {
    setDays(null);
    setAvailabilityError('');
    setDateId(null);
    setSlot(null);
    setRevision((value) => value + 1);
  }

  function goTo(next) {
    setError('');
    setStep(next);
  }

  function review() {
    const customer = validateCustomer(name, phone);
    if (customer.error) {
      setError(customer.error);
      return;
    }
    setName(customer.customerName);
    setPhone(customer.customerPhone);
    goTo(3);
  }

  async function submit() {
    if (sending.current || !service || !slot?.isBookable) return;
    sending.current = true;
    setBusy(true);
    setError('');
    try {
      const currentDays = await obtenerDisponibilidad(professionalId, service.id);
      const currentSlot = currentDays.find((day) => day.id === dateId)?.slots
        .find((item) => item.startsAt === slot.startsAt);
      if (!currentSlot?.isBookable) {
        setError('Esta hora ya no está disponible. Elige otra.');
        refreshAvailability();
        setStep(1);
        sending.current = false;
        return;
      }
      const booking = await crearReserva({
        serviceId: service.id,
        customerName: name,
        customerPhone: phone,
        startsAt: slot.startsAt,
      });
      const hasTracking = esCredencialSeguimiento(booking.trackingToken);
      const trackingSaved = hasTracking && await guardarSeguimiento(booking.id, booking.trackingToken);
      setResult({ id: booking.id, status: booking.status, hasTracking, trackingSaved });
    } catch (cause) {
      setError(cause.message);
      setUncertain(!!cause.uncertain);
      if (!cause.uncertain) sending.current = false;
      if ([409, 422].includes(cause.status)) {
        refreshAvailability();
        setStep(1);
      }
    } finally {
      setBusy(false);
    }
  }

  const returnToCatalog = () => router.dismissTo('/');
  if (result) {
    return (
      <BookingPage centered footer={
        <>
          {result.hasTracking && <Button label="Consultar estado" onPress={() => router.push('/mi-reserva')} />}
          <Button label="Volver al catálogo" secondary={result.hasTracking} onPress={returnToCatalog} />
        </>
      }>
        <BookingResult result={result} professionalName={professional.name} service={service} dateId={dateId} time={slot.time} />
        {result.hasTracking && !result.trackingSaved && (
          <Message>El seguimiento de esta reserva está disponible hasta que cierres la aplicación.</Message>
        )}
        {!result.hasTracking && <Message>La API no entregó acceso de seguimiento para esta reserva.</Message>}
      </BookingPage>
    );
  }

  const slots = days?.find((day) => day.id === dateId)?.slots ?? [];
  let footer;
  if (step === 1 && days?.length) {
    footer = <Button label="Continuar" disabled={!slot?.isBookable} onPress={() => goTo(2)} />;
  }
  if (step === 3) {
    footer = uncertain ? (
      <Button label="Volver al catálogo" onPress={returnToCatalog} />
    ) : (
      <>
        <Button label={busy ? 'Enviando…' : 'Enviar solicitud'} disabled={busy} onPress={submit} />
        <Button label="Editar datos" secondary disabled={busy} onPress={() => goTo(2)} />
      </>
    );
  }

  return (
    <BookingPage title={titles[step]} step={step + 1} footer={footer}>
      {!!error && <Message error>{error}</Message>}
      {step === 0 && (
        <>
          {services.map((item) => (
            <Option key={item.id} label={item.name} detail={`${item.duration_minutes} min · ${formatPrice(item.price)}`}
              selected={service?.id === item.id} onPress={() => {
                setService(item);
                refreshAvailability();
                goTo(1);
              }} />
          ))}
          <Button label="Volver al catálogo" secondary onPress={returnToCatalog} />
        </>
      )}
      {step === 1 && (
        <>
          <View style={styles.scheduleContext}>
            <View style={styles.contextCopy}>
              <Text style={styles.label}>{service.name}</Text>
              <Text style={styles.muted}>Horario de Chile</Text>
            </View>
            <Button label="Cambiar servicio" secondary onPress={() => goTo(0)} />
          </View>
          {availabilityError ? (
            <>
              <Message error>{availabilityError}</Message>
              <Button label="Reintentar disponibilidad" onPress={refreshAvailability} />
            </>
          ) : !days ? (
            <>
              <ActivityIndicator color={colors.accent} />
              <Message>Consultando disponibilidad…</Message>
            </>
          ) : days.length === 0 ? (
            <>
              <Message>No hay horas disponibles en los próximos 14 días.</Message>
              <Button label="Actualizar disponibilidad" onPress={refreshAvailability} />
            </>
          ) : (
            <BookingSchedule days={days} dateId={dateId} slots={slots} slot={slot}
              onSelectDate={(id) => { setDateId(id); setSlot(null); setError(''); }}
              onSelectSlot={(item) => { if (item.isBookable) setSlot(item); }} />
          )}
        </>
      )}
      {step === 2 && (
        <>
          <Text style={styles.label}>Nombre</Text>
          <TextInput accessibilityLabel="Nombre" autoComplete="name" autoCapitalize="words"
            style={styles.input} value={name} onChangeText={setName} maxLength={100} keyboardAppearance={mode} />
          <Text style={styles.label}>Celular chileno</Text>
          <TextInput accessibilityLabel="Celular chileno" autoComplete="tel" keyboardType="phone-pad"
            style={styles.input} value={phone} onChangeText={setPhone} maxLength={30} keyboardAppearance={mode}
            placeholder="+56 9 XXXX XXXX" placeholderTextColor={colors.muted} />
          <Button label="Revisar reserva" onPress={review} />
          <Button label="Volver a fecha y hora" secondary onPress={() => goTo(1)} />
        </>
      )}
      {step === 3 && (
        <>
          <BookingReview professionalName={professional.name} service={service} dateId={dateId} time={slot.time} name={name} phone={phone} />
          {getSlotStatus(slot) === 'pending' && <PendingSlotNotice />}
        </>
      )}
    </BookingPage>
  );
}
