import { useLayoutEffect, useRef, useState } from 'react';
import { router } from 'expo-router';
import { ActivityIndicator, FlatList, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { BookingPage, Button, Message } from '../components/BookingPage';
import { BookingTrackingCard } from '../components/BookingReceipt';
import { useBookingHistory } from '../hooks/useBookingHistory';
import { useAppearance } from '../theme/AppearanceProvider';
import { serif } from '../theme/tokens';

function CarouselArrow({ previous, disabled, onPress, colors }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={previous ? 'Reserva anterior' : 'Reserva siguiente'}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.arrowButton,
        { backgroundColor: colors.surface, borderColor: colors.border, opacity: pressed ? 0.7 : 1 },
      ]}
    >
      <View aria-hidden style={[
        styles.chevron, { borderColor: disabled ? colors.border : colors.accent, transform: [{ rotate: previous ? '-135deg' : '45deg' }] },
      ]} />
    </Pressable>
  );
}

function BookingCarousel({ entries, onRefresh, onCancel, colors }) {
  const list = useRef(null);
  const scrollIndex = useRef(0);
  const [pageWidth, setPageWidth] = useState(0);
  const [selection, setSelection] = useState(null);
  const selectedIndex = entries.findIndex((entry) => entry.id === selection?.id);
  const position = selectedIndex >= 0 ? selectedIndex : Math.min(selection?.index ?? 0, entries.length - 1);
  const activeId = entries[position].id;
  const hasPages = entries.length > 1;

  if (selection && (selection.id !== activeId || selection.index !== position)) {
    setSelection({ id: activeId, index: position });
  }

  useLayoutEffect(() => {
    if (!pageWidth || scrollIndex.current === position) return;
    scrollIndex.current = position;
    list.current?.scrollToOffset({ offset: position * pageWidth, animated: false });
  }, [pageWidth, position]);

  function goTo(next) {
    scrollIndex.current = next;
    list.current?.scrollToOffset({ offset: next * pageWidth, animated: false });
    setSelection({ id: entries[next].id, index: next });
  }

  return (
    <View style={styles.carousel} onLayout={({ nativeEvent }) => setPageWidth(nativeEvent.layout.width)}>
      <View style={styles.carouselControls}>
        {hasPages && (
          <CarouselArrow previous disabled={position === 0 || pageWidth === 0} colors={colors} onPress={() => goTo(position - 1)} />
        )}
        <Text accessibilityLiveRegion="polite" style={[styles.counter, { color: colors.muted }]}>
          {position + 1} de {entries.length}
        </Text>
        {hasPages && (
          <CarouselArrow disabled={position === entries.length - 1 || pageWidth === 0} colors={colors} onPress={() => goTo(position + 1)} />
        )}
      </View>
      {pageWidth > 0 && (
        <FlatList
          key={pageWidth}
          ref={list}
          horizontal
          pagingEnabled
          initialNumToRender={3}
          showsHorizontalScrollIndicator={false}
          data={entries}
          extraData={position}
          keyExtractor={(item) => String(item.id)}
          initialScrollIndex={position || undefined}
          getItemLayout={(_, page) => ({ length: pageWidth, offset: page * pageWidth, index: page })}
          onScroll={({ nativeEvent }) => {
            const next = Math.max(0, Math.min(entries.length - 1, Math.round(nativeEvent.contentOffset.x / pageWidth)));
            if (next === scrollIndex.current) return;
            scrollIndex.current = next;
            setSelection({ id: entries[next].id, index: next });
          }}
          scrollEventThrottle={32}
          renderItem={({ item, index: page }) => (
            <View style={{ width: pageWidth }}>
              <BookingTrackingCard entry={item} active={position === page}
                onRefresh={() => onRefresh(item.id)} onCancel={() => onCancel(item.id)} />
            </View>
          )}
        />
      )}
    </View>
  );
}

export default function MisReservas() {
  const { colors } = useAppearance();
  const { entries, initial, refreshing, storage, refreshAll, refreshBooking, cancelBooking } = useBookingHistory();
  const hasBookings = entries.length > 0;

  return (
    <BookingPage title="Mis reservas" footer={
      <>
        {!initial && (hasBookings || storage.incompleto) && (
          <Button
            label={refreshing ? 'Actualizando…' : hasBookings ? 'Actualizar todas' : 'Reintentar'}
            disabled={refreshing}
            onPress={refreshAll}
          />
        )}
        <Button label="Volver al catálogo" secondary={hasBookings || storage.incompleto} onPress={() => router.dismissTo('/')} />
      </>
    }>
      {initial && (
        <View style={styles.loading}>
          <ActivityIndicator color={colors.accent} />
          <Message>Recuperando tus reservas…</Message>
        </View>
      )}
      {!initial && storage.incompleto && (
        <Message error>{storage.limpiezaPendiente
          ? 'La reserva se canceló. Vuelve a intentar eliminar su acceso de este dispositivo.'
          : 'No pudimos recuperar o guardar todos los accesos. Vuelve a intentar.'}</Message>
      )}
      {!initial && storage.temporal && (
        <Message>Algunos accesos solo están disponibles durante esta sesión hasta que se puedan guardar.</Message>
      )}
      {!initial && hasBookings && (
        <>
          <Message>Reservas guardadas en este dispositivo.</Message>
          <BookingCarousel entries={entries} colors={colors} onRefresh={refreshBooking} onCancel={cancelBooking} />
        </>
      )}
      {!initial && (!storage.incompleto || storage.limpiezaPendiente) && !hasBookings && (
        <View style={[styles.empty, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View aria-hidden style={[styles.calendarTile, { backgroundColor: colors.surfaceStrong }]}>
            <Image source={require('../../assets/professional/calendar.png')} style={[styles.calendar, { tintColor: colors.accent }]} />
          </View>
          <Text accessibilityRole="header" style={[styles.emptyTitle, { color: colors.text }]}>
            Todavía no tienes reservas
          </Text>
          <Message>Cuando reserves desde este dispositivo, podrás consultar aquí el estado de tu solicitud.</Message>
        </View>
      )}
    </BookingPage>
  );
}

const styles = StyleSheet.create({
  loading: { flexDirection: 'row', gap: 10, alignItems: 'center', paddingVertical: 16 },
  carousel: { gap: 10 },
  carouselControls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  arrowButton: { width: 44, height: 44, borderWidth: 1, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  chevron: { width: 9, height: 9, borderTopWidth: 2, borderRightWidth: 2 },
  counter: { fontSize: 14, fontWeight: '700', fontVariant: ['tabular-nums'] },
  empty: { borderWidth: 1, borderRadius: 14, padding: 20, gap: 10 },
  emptyTitle: { fontFamily: serif, fontSize: 22, fontWeight: '700' },
  calendarTile: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  calendar: { width: 24, height: 24 },
});
