import { deepStrictEqual, equal, match, rejects } from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { URL } from 'node:url';
import { createContext, SourceTextModule, SyntheticModule } from 'node:vm';
import ts from 'typescript';

const base = 'https://bookings.example.test/api';
const legacyKey = 'barberbook.booking-tracking';
const token = (id) => id.toString(16).padStart(64, '0');
const credential = (id) => ({ id, token: token(id), apiUrl: base });
const entryKey = (index, url = base) => {
  const namespace = Buffer.from(url, 'utf16le').swap16().toString('hex');
  return `${legacyKey}.v2.${namespace}.${index}`;
};
const booking = (id, status = 'pending', startsAt = '2030-03-08T10:00:00-03:00') => ({
  id, status, startsAt, professionalName: 'Profesional de prueba', serviceName: 'Servicio de prueba',
});
const ids = (entries) => Array.from(entries, ({ id }) => id);
const response = (status, data) => ({ status, ok: status === 200, json: async () => data });
const scripts = Object.fromEntries(['api', 'bookingTracking', 'bookingHistory'].map((name) => [
  `./${name}`, readFileSync(new URL(`../src/services/${name}.js`, import.meta.url), 'utf8'),
]));
const bookingUtils = readFileSync(new URL('../src/utils/booking.js', import.meta.url), 'utf8');
const transpile = (path) => ts.transpileModule(
  readFileSync(new URL(path, import.meta.url), 'utf8'),
  { compilerOptions: { module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX } },
).outputText;
const bookingReceipt = transpile('../src/components/BookingReceipt.jsx');
const bookingScreen = transpile('../src/app/mi-reserva.jsx');
const bookingHook = readFileSync(new URL('../src/hooks/useBookingHistory.js', import.meta.url), 'utf8');

function mockSecureStore(values = new Map()) {
  const calls = [];
  const controls = { available: true };
  const methods = {
    WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'device-only',
    isAvailableAsync: async () => controls.available,
    getItemAsync: async (key) => {
      calls.push(['get', key]);
      const value = values.get(key) ?? null;
      return controls.read ? controls.read(key, value) : value;
    },
    setItemAsync: async (key, value, options) => {
      calls.push(['set', key, options.keychainAccessible]);
      await controls.beforeWrite?.(key, value);
      values.set(key, value);
    },
    deleteItemAsync: async (key) => {
      calls.push(['delete', key]);
      controls.beforeDelete?.(key);
      values.delete(key);
    },
  };
  return { methods, values, controls, calls };
}

async function loadApp({ storage = mockSecureStore(), url = base, fetch, alert, hooks, routeHistory } = {}) {
  const context = createContext({
    process: { env: { EXPO_PUBLIC_API_URL: url } }, fetch, AbortController, setTimeout, clearTimeout, require: () => 0,
  });
  const modules = Object.fromEntries(Object.entries(scripts).map(([path, source]) => [
    path, new SourceTextModule(source, { identifier: path, context }),
  ]));
  modules['./bookingUtils'] = new SourceTextModule(bookingUtils, { context });
  modules['expo-secure-store'] = new SyntheticModule(Object.keys(storage.methods), function () {
    for (const [name, value] of Object.entries(storage.methods)) this.setExport(name, value);
  }, { context });
  const exports = ['./api', './bookingTracking', './bookingHistory', './bookingUtils'];
  if (alert || hooks) {
    const jsx = (type, props) => ({ type, props });
    const theme = { light: {}, dark: {} };
    const stubs = {
      react: hooks ?? { useRef: (value) => ({ current: value }) },
      'react/jsx-runtime': { jsx, jsxs: jsx, Fragment: 'Fragment' },
      'react-native': { Alert: { alert }, StyleSheet: { create: (styles) => styles, hairlineWidth: 1 },
        ActivityIndicator: 'ActivityIndicator', FlatList: 'FlatList', Image: 'Image',
        Pressable: 'Pressable', Text: 'Text', View: 'View' },
      '../theme/tokens': { palettes: theme, serif: 'serif' },
      '../theme/AppearanceProvider': { useAppearance: () => ({ mode: 'light', colors: theme.light }) },
      './BookingPage': { BookingPage: 'BookingPage', Button: 'Button', Message: 'Message' },
      'expo-router': { router: {} },
    };
    for (const [specifier, values] of Object.entries(stubs)) {
      modules[specifier] = new SyntheticModule(Object.keys(values), function () {
        for (const [name, value] of Object.entries(values)) this.setExport(name, value);
      }, { context });
    }
    modules['../services/bookingHistory'] = modules['./bookingHistory'];
    modules['../services/bookingTracking'] = modules['./bookingTracking'];
    modules['../utils/booking'] = modules['./bookingUtils'];
    modules['./BookingReceipt'] = new SourceTextModule(bookingReceipt, { context });
    exports.push('./BookingReceipt');
  }
  if (hooks) {
    modules['./useBookingHistory'] = new SourceTextModule(bookingHook, { context });
    exports.push('./useBookingHistory');
  }
  if (routeHistory) {
    modules['../hooks/useBookingHistory'] = new SyntheticModule(['useBookingHistory'], function () {
      this.setExport('useBookingHistory', routeHistory);
    }, { context });
    modules['../components/BookingPage'] = modules['./BookingPage'];
    modules['../components/BookingReceipt'] = modules['./BookingReceipt'];
    modules['./mi-reserva'] = new SourceTextModule(bookingScreen, { context });
  }
  const source = exports.map((path) => `export * from '${path}';`).join('\n')
    + (routeHistory ? "\nexport { default as MisReservas } from './mi-reserva';" : '');
  const app = new SourceTextModule(source, { context });
  await app.link((specifier) => modules[specifier]);
  await app.evaluate();
  return app.namespace;
}

// Renderizados controlados para recorrer el hook y el carrusel sin un dispositivo nativo.
function mockHooks() {
  const values = [];
  let effects;
  let index;
  let mounted = false;
  const hooks = {
    useState(initial) {
      const slot = index++;
      if (!(slot in values)) values[slot] = typeof initial === 'function' ? initial() : initial;
      return [values[slot], (next) => { values[slot] = typeof next === 'function' ? next(values[slot]) : next; }];
    },
    useRef(initial) {
      const slot = index++;
      if (!(slot in values)) values[slot] = { current: initial };
      return values[slot];
    },
    useCallback: (callback) => callback,
    useEffect(effect) { if (!mounted) effects.push(effect); },
    useLayoutEffect(effect) { effects.push(effect); },
  };
  return {
    hooks,
    render(component, props) {
      index = 0;
      effects = [];
      const result = component(props);
      mounted = true;
      effects.forEach((effect) => effect());
      return result;
    },
  };
}

test('guarda una credencial en SecureStore con acceso limitado al dispositivo', async () => {
  const storage = mockSecureStore();
  const app = await loadApp({ storage });
  equal(await app.guardarSeguimiento(1, token(1)), true);
  const history = await app.obtenerSeguimientosGuardados();
  deepStrictEqual({ ...history.credenciales[0] }, credential(1));
  deepStrictEqual(storage.calls.find(([call]) => call === 'set'), ['set', entryKey(0), 'device-only']);
  equal(history.temporal, false);
});

test('tres escrituras simultáneas conservan todas las credenciales tras reiniciar', async () => {
  const storage = mockSecureStore();
  const app = await loadApp({ storage });
  deepStrictEqual(await Promise.all([1, 2, 3].map((id) => app.guardarSeguimiento(id, token(id)))), [true, true, true]);
  deepStrictEqual(Array.from(storage.values.values(), (value) => JSON.parse(value).token), [token(1), token(2), token(3)]);
  const restarted = await loadApp({ storage });
  deepStrictEqual(ids((await restarted.obtenerSeguimientosGuardados()).credenciales), [1, 2, 3]);
});

test('lee más de un lote y deduplica el ID conservando la credencial original', async () => {
  const storage = mockSecureStore();
  const app = await loadApp({ storage });
  const expected = Array.from({ length: 12 }, (_, index) => index + 1);
  await Promise.all(expected.map((id) => app.guardarSeguimiento(id, token(id))));
  equal(await app.guardarSeguimiento(1, token(1)), true);
  equal(await app.guardarSeguimiento(1, token(99)), false);
  equal(await app.guardarSeguimiento(0, token(1)), false);
  equal(await app.guardarSeguimiento(13, 'inválido'), false);
  equal(storage.values.size, 12);
  deepStrictEqual(ids((await app.obtenerSeguimientosGuardados()).credenciales), expected);
  equal(JSON.parse(storage.values.get(entryKey(0))).token, token(1));
});

test('migra la clave antigua, verifica la copia y después elimina el original', async () => {
  const storage = mockSecureStore(new Map([[legacyKey, JSON.stringify(credential(1))]]));
  const app = await loadApp({ storage });
  const result = await app.obtenerSeguimientosGuardados();
  deepStrictEqual(ids(result.credenciales), [1]);
  equal(result.incompleto, false);
  equal(storage.values.has(legacyKey), false);
  const written = storage.calls.findIndex(([action, key]) => action === 'set' && key === entryKey(0));
  deepStrictEqual(storage.calls.slice(written, written + 3), [
    ['set', entryKey(0), 'device-only'], ['get', entryKey(0)], ['delete', legacyKey],
  ]);
  const restarted = await loadApp({ storage });
  deepStrictEqual(ids((await restarted.obtenerSeguimientosGuardados()).credenciales), [1]);
});

test('conserva la clave antigua si no logra verificar la copia y reintenta sin duplicar', async () => {
  const storage = mockSecureStore(new Map([[legacyKey, JSON.stringify(credential(2))]]));
  storage.controls.read = (key, value) => {
    if (key === entryKey(0) && value !== null) throw new Error('No se pudo verificar la escritura');
    return value;
  };
  const app = await loadApp({ storage });
  const result = await app.obtenerSeguimientosGuardados();
  deepStrictEqual(ids(result.credenciales), [2]);
  equal(result.incompleto, true);
  equal(storage.values.has(legacyKey), true);
  delete storage.controls.read;
  const retry = await app.obtenerSeguimientosGuardados();
  deepStrictEqual(ids(retry.credenciales), [2]);
  equal(retry.incompleto, false);
  equal(storage.values.size, 1);
});

test('reintenta la limpieza de la clave antigua si SecureStore impide borrarla', async () => {
  const storage = mockSecureStore(new Map([[legacyKey, JSON.stringify(credential(1))]]));
  storage.controls.beforeDelete = () => { throw new Error('Borrado rechazado'); };
  const app = await loadApp({ storage });
  const first = await app.obtenerSeguimientosGuardados();
  equal(first.incompleto, true);
  deepStrictEqual(ids(first.credenciales), [1]);
  equal(storage.values.size, 2);
  delete storage.controls.beforeDelete;
  deepStrictEqual(ids((await app.obtenerSeguimientosGuardados()).credenciales), [1]);
  equal(storage.values.size, 1);
});

test('separa URL de API aunque los ID coincidan y migra solo el entorno original', async () => {
  const storage = mockSecureStore(new Map([[legacyKey, JSON.stringify(credential(1))]]));
  const secondUrl = 'https://alternate.example.test/api';
  const otherApp = await loadApp({ storage, url: secondUrl });
  equal((await otherApp.obtenerSeguimientosGuardados()).credenciales.length, 0);
  equal(await otherApp.guardarSeguimiento(1, token(21)), true);
  equal(storage.values.has(legacyKey), true);
  const app = await loadApp({ storage });
  equal((await app.obtenerSeguimientosGuardados()).credenciales[0].token, token(1));
  const other = (await otherApp.obtenerSeguimientosGuardados()).credenciales[0];
  equal(other.apiUrl, secondUrl);
  equal(other.token, token(21));
});

test('un error de escritura mantiene las anteriores y permite reintentar los accesos en memoria', async () => {
  const storage = mockSecureStore();
  const app = await loadApp({ storage });
  equal(await app.guardarSeguimiento(1, token(1)), true);
  storage.controls.beforeWrite = () => { throw new Error('Escritura rechazada'); };
  equal(await app.guardarSeguimiento(2, token(2)), false);
  const session = await app.obtenerSeguimientosGuardados();
  equal(session.temporal, true);
  deepStrictEqual(ids(session.credenciales), [1, 2]);
  const restarted = await loadApp({ storage });
  deepStrictEqual(ids((await restarted.obtenerSeguimientosGuardados()).credenciales), [1]);
  delete storage.controls.beforeWrite;
  const retry = await app.obtenerSeguimientosGuardados();
  equal(retry.temporal, false);
  deepStrictEqual(ids((await restarted.obtenerSeguimientosGuardados()).credenciales), [1, 2]);
});

test('un fallo de lectura no convierte una entrada existente en un espacio libre', async () => {
  const storage = mockSecureStore();
  const app = await loadApp({ storage });
  await Promise.all([1, 2].map((id) => app.guardarSeguimiento(id, token(id))));
  storage.controls.read = (key, value) => {
    if (key === entryKey(1)) throw new Error('Lectura rechazada');
    return value;
  };
  equal(await app.guardarSeguimiento(3, token(3)), false);
  equal(JSON.parse(storage.values.get(entryKey(1))).token, token(2));
  delete storage.controls.read;
  deepStrictEqual(ids((await app.obtenerSeguimientosGuardados()).credenciales), [1, 2, 3]);
});

test('SecureStore no disponible conserva temporalmente más de una reserva', async () => {
  const storage = mockSecureStore();
  storage.controls.available = false;
  const app = await loadApp({ storage });
  equal(await app.guardarSeguimiento(1, token(1)), false);
  equal(await app.guardarSeguimiento(2, token(2)), false);
  const result = await app.obtenerSeguimientosGuardados();
  deepStrictEqual(ids(result.credenciales), [1, 2]);
  equal(result.incompleto, true);
  equal(result.temporal, true);
  equal(storage.values.size, 0);
});

test('almacenamiento corrupto conserva el original y permite leer y agregar otras reservas', async () => {
  const malformed = '{ilegible';
  const storage = mockSecureStore(new Map([
    [legacyKey, malformed], [entryKey(0), malformed], [entryKey(1), JSON.stringify(credential(2))],
  ]));
  const app = await loadApp({ storage });
  const result = await app.obtenerSeguimientosGuardados();
  deepStrictEqual(ids(result.credenciales), [2]);
  equal(result.incompleto, true);
  equal(await app.guardarSeguimiento(3, token(3)), true);
  deepStrictEqual(ids((await app.obtenerSeguimientosGuardados()).credenciales), [2, 3]);
  equal(storage.values.get(legacyKey), malformed);
  equal(storage.values.get(entryKey(0)), malformed);
});

test('ordena futuras, pasadas y fallidas por instante con desempate y formatea en Chile', async () => {
  const app = await loadApp();
  const dates = [
    [1, '2030-03-08T16:00:00Z'], [2, '2030-03-08T10:01:00-03:00'],
    [3, '2030-03-07T15:00:00Z'], [4, '2030-03-08T09:59:00-03:00'],
    [5, '2030-03-08T13:01:00Z'],
  ];
  const now = Date.parse('2030-03-08T13:00:00Z');
  const entries = [{ id: 6 }].concat(dates.map(([id, startsAt]) => ({ id, booking: booking(id, 'pending', startsAt) })));
  deepStrictEqual(ids(app.ordenarReservas(entries, now)), [2, 5, 1, 4, 3, 6]);
  match(app.formatTrackingDate('2030-03-08T02:30:00Z'), /^7 de marzo/);
  equal(app.formatTrackingTime('2030-03-08T02:30:00Z'), '23:30');
});

test('limita tres GET simultáneos y comparte la operación pendiente por reserva', async () => {
  const app = await loadApp();
  const releases = new Map();
  const started = [];
  const lookup = app.crearColaSeguimiento((id) => new Promise((resolve) => {
    started.push(id);
    releases.set(id, () => resolve(booking(id)));
  }));
  const requests = [1, 2, 3, 4, 5].map((id) => lookup(credential(id)));
  equal(lookup(credential(4)), requests[3]);
  equal(lookup(credential(1)), requests[0]);
  deepStrictEqual(started, [1, 2, 3]);
  releases.get(2)();
  await requests[1];
  deepStrictEqual(started, [1, 2, 3, 4]);
  releases.get(4)();
  await requests[3];
  deepStrictEqual(started, [1, 2, 3, 4, 5]);
  [1, 3, 5].forEach((id) => releases.get(id)());
  await Promise.all(requests);
});

test('actualiza una reserva y un fallo parcial conserva el último dato y las credenciales', async () => {
  const storage = mockSecureStore();
  const states = new Map([[1, 'pending'], [2, 'pending']]);
  const calls = [];
  let failId;
  const app = await loadApp({ storage, fetch: async (url, { headers }) => {
    const id = Number(url.match(/\/bookings\/(\d+)\/tracking$/)[1]);
    equal(url, `${base}/bookings/${id}/tracking`);
    equal(headers.Authorization, `Bearer ${token(id)}`);
    calls.push(id);
    if (id === failId) throw new Error('Sin conexión');
    return response(200, { data: booking(id, states.get(id)) });
  } });
  await Promise.all([1, 2].map((id) => app.guardarSeguimiento(id, token(id))));
  const { credenciales } = await app.obtenerSeguimientosGuardados();
  let entries = new Map();
  async function update(index) {
    const access = credenciales[index];
    const result = await app.consultarReservaGuardada(access);
    entries = app.aplicarEstadoReserva(entries, access.id, result);
  }
  await Promise.all([update(0), update(1)]);
  states.set(1, 'confirmed');
  states.set(2, 'rejected');
  await update(0);
  equal(entries.get(1).booking.status, 'confirmed');
  equal(entries.get(2).booking.status, 'pending');
  deepStrictEqual(calls, [1, 2, 1]);

  failId = 2;
  await Promise.all([update(0), update(1)]);
  equal(entries.get(1).error, null);
  match(entries.get(2).error, /Vuelve a intentar/);
  equal(entries.get(2).booking.status, 'pending');
  deepStrictEqual(ids((await app.obtenerSeguimientosGuardados()).credenciales), [1, 2]);
  failId = undefined;
  await update(1);
  equal(entries.get(2).booking.status, 'rejected');
  equal(entries.get(2).error, null);
});

test('rechaza credenciales incorrectas y una respuesta asociada a otra reserva', async () => {
  let sent = 0;
  const app = await loadApp({ fetch: async (_, { headers }) => {
    sent += 1;
    if (headers.Authorization === `Bearer ${token(2)}`) return response(404, { error: 'No encontrado' });
    return response(200, { data: booking(2) });
  } });
  await rejects(app.consultarSeguimiento(1, 'incorrecto'), /no es válida/);
  equal(sent, 0);
  await rejects(app.consultarSeguimiento(1, token(2)), { status: 404 });
  await rejects(app.consultarSeguimiento(1, token(1)), /No pudimos leer el estado/);
  const denied = await app.consultarReservaGuardada({ ...credential(1), token: token(2) });
  match(denied.error, /no permite consultar/);
  equal(denied.booking, undefined);
});

function findButton(node, label) {
  if (Array.isArray(node)) {
    for (const child of node) {
      const item = findButton(child, label);
      if (item) return item;
    }
    return;
  }
  if (node?.type === 'Button' && node.props.label === label) return node.props;
  return node?.props && findButton(node.props.children, label);
}

test('la tarjeta ofrece cancelación solo para estados elegibles y confirma desde un diálogo', async () => {
  const dialogs = [];
  const app = await loadApp({ alert: (...args) => dialogs.push(args) });
  let cancelled = 0;
  const card = (status, extra) => app.BookingTrackingCard({
    entry: { id: 1, booking: booking(1, status), ...extra }, onCancel: () => { cancelled += 1; },
  });
  const action = (status, extra) => findButton(card(status, extra), 'Cancelar reserva');
  for (const status of ['pending', 'confirmed']) equal(action(status).disabled, undefined);
  for (const status of ['completed', 'rejected', 'cancelled']) equal(action(status), undefined);
  equal(action('confirmed', { cancelling: true }).disabled, true);
  const blocked = card('pending', { verificationRequired: true });
  equal(findButton(blocked, 'Cancelar reserva').disabled, true);
  equal(findButton(blocked, 'Comprobar estado').disabled, undefined);

  const cancel = action('pending');
  cancel.onPress();
  cancel.onPress();
  equal(dialogs.length, 1);
  const [title, message, buttons, options] = dialogs[0];
  equal(title, '¿Cancelar esta reserva?');
  equal(message, 'Esta acción cancelará tu solicitud de atención. ¿Deseas continuar?');
  deepStrictEqual(Array.from(buttons, ({ text, style }) => [text, style]), [
    ['Volver', 'cancel'], ['Sí, cancelar reserva', 'destructive'],
  ]);
  buttons[0].onPress();
  equal(cancelled, 0);
  cancel.onPress();
  equal(dialogs.length, 2);
  equal(options.cancelable, true);
  dialogs[1][3].onDismiss();
  equal(cancelled, 0);
  cancel.onPress();
  dialogs[2][2][1].onPress();
  equal(cancelled, 1);
});

test('oculta la tarjeta al confirmar el POST y borra solo su credencial aunque SecureStore siga ocupado', async () => {
  const storage = mockSecureStore();
  const requests = [];
  const ui = mockHooks();
  const app = await loadApp({ storage, hooks: ui.hooks, fetch: async (url, options) => {
    const id = Number(url.match(/\/bookings\/(\d+)\//)[1]);
    equal(options.headers.Authorization, `Bearer ${token(id)}`);
    equal(options.body, undefined);
    requests.push([options.method ?? 'GET', url]);
    return response(200, { data: booking(id, options.method === 'POST' ? 'cancelled' : 'confirmed') });
  } });
  await Promise.all([1, 2, 3].map((id) => app.guardarSeguimiento(id, token(id))));
  const render = () => ui.render(app.useBookingHistory);
  await render().refreshAll();
  deepStrictEqual(ids(render().entries), [1, 2, 3]);

  const cleanupStarted = Promise.withResolvers();
  const finishCleanup = Promise.withResolvers();
  storage.controls.beforeWrite = (key) => {
    if (key === entryKey(1)) {
      cleanupStarted.resolve();
      return finishCleanup.promise;
    }
  };
  const cancellation = render().cancelBooking(2);
  equal(render().cancelBooking(2), undefined);
  await cleanupStarted.promise;
  deepStrictEqual(ids(render().entries), [1, 3]);
  equal(JSON.parse(storage.values.get(entryKey(1))).token, token(2));
  finishCleanup.resolve();
  await cancellation;

  deepStrictEqual(JSON.parse(storage.values.get(entryKey(1))), { eliminada: true });
  deepStrictEqual(requests.filter(([method]) => method === 'POST'), [['POST', `${base}/bookings/2/cancel`]]);
  const restarted = await loadApp({ storage });
  const saved = Array.from((await restarted.obtenerSeguimientosGuardados()).credenciales, (entry) => ({ ...entry }));
  deepStrictEqual(saved, [credential(1), credential(3)]);
  equal(await restarted.guardarSeguimiento(4, token(4)), true);
  deepStrictEqual(ids((await restarted.obtenerSeguimientosGuardados()).credenciales), [1, 3, 4]);
});

test('una respuesta perdida conserva tarjeta y credencial hasta que el GET confirma cancelled', async () => {
  const storage = mockSecureStore();
  const ui = mockHooks();
  const lookupStarted = Promise.withResolvers();
  const finishLookup = Promise.withResolvers();
  const calls = [];
  let sent = false;
  const app = await loadApp({ storage, hooks: ui.hooks, fetch: async (_, options) => {
    calls.push(options.method ?? 'GET');
    if (options.method === 'POST') {
      sent = true;
      throw new Error('Respuesta perdida');
    }
    if (!sent) return response(200, { data: booking(1) });
    lookupStarted.resolve();
    await finishLookup.promise;
    return response(200, { data: booking(1, 'cancelled') });
  } });
  await app.guardarSeguimiento(1, token(1));
  const render = () => ui.render(app.useBookingHistory);
  await render().refreshAll();
  const cancellation = render().cancelBooking(1);
  await lookupStarted.promise;
  deepStrictEqual(ids(render().entries), [1]);
  equal(JSON.parse(storage.values.get(entryKey(0))).token, token(1));
  finishLookup.resolve();
  await cancellation;
  deepStrictEqual(ids(render().entries), []);
  equal((await app.obtenerSeguimientosGuardados()).credenciales.length, 0);
  deepStrictEqual(calls, ['GET', 'POST', 'GET']);
});

test('un fallo de verificación bloquea otro POST hasta consultar un estado válido', async () => {
  const storage = mockSecureStore();
  const ui = mockHooks();
  const calls = [];
  let online = true;
  const app = await loadApp({ storage, hooks: ui.hooks, fetch: async (_, options) => {
    calls.push(options.method ?? 'GET');
    if (!online) throw new Error('Sin conexión');
    return response(200, { data: booking(1, options.method === 'POST' ? 'cancelled' : 'pending') });
  } });
  await app.guardarSeguimiento(1, token(1));
  const render = () => ui.render(app.useBookingHistory);
  await render().refreshAll();
  online = false;
  await render().cancelBooking(1);
  equal(render().entries[0].booking.status, 'pending');
  equal(render().entries[0].verificationRequired, true);
  equal(JSON.parse(storage.values.get(entryKey(0))).token, token(1));
  await render().cancelBooking(1);
  deepStrictEqual(calls, ['GET', 'POST', 'GET']);

  online = true;
  await render().refreshBooking(1);
  equal(render().entries[0].verificationRequired, false);
  equal(render().entries[0].booking.status, 'pending');
  await render().cancelBooking(1);
  deepStrictEqual(ids(render().entries), []);
  deepStrictEqual(calls, ['GET', 'POST', 'GET', 'GET', 'POST']);
});

test('un conflicto vuelve a consultar el estado y una credencial ajena no cambia la tarjeta', async () => {
  let requests = 0;
  const app = await loadApp({ fetch: async (_, options) => {
    requests += 1;
    if (options.headers.Authorization === `Bearer ${token(2)}`) return response(404, { error: 'No encontrado' });
    if (options.method === 'POST') return response(409, { error: 'Conflicto' });
    return response(200, { data: booking(1, 'completed') });
  } });
  const result = await app.cancelarReservaGuardada(credential(1));
  equal(result.booking.status, 'completed');
  match(result.cancelError, /no permite/);
  const denied = await app.cancelarReservaGuardada({ ...credential(1), token: token(2) });
  equal(denied.booking, undefined);
  match(denied.cancelError, /no permitió/);
  equal(requests, 3);
});

test('una reserva que ya estaba cancelada se retira al abrir Mis reservas', async () => {
  const storage = mockSecureStore(new Map([
    [legacyKey, JSON.stringify(credential(1))],
    [entryKey(0), JSON.stringify(credential(1))],
    [entryKey(1), JSON.stringify(credential(2))],
  ]));
  const foreignUrl = 'https://another.example.test/api';
  const foreignKey = entryKey(0, foreignUrl);
  const foreignValue = JSON.stringify({ id: 1, token: token(7) });
  storage.values.set(foreignKey, foreignValue);
  const ui = mockHooks();
  const app = await loadApp({ storage, hooks: ui.hooks, fetch: async (url) => {
    const id = Number(url.match(/\/bookings\/(\d+)\//)[1]);
    return response(200, { data: booking(id, id === 1 ? 'cancelled' : 'confirmed') });
  } });
  const render = () => ui.render(app.useBookingHistory);
  await render().refreshAll();
  deepStrictEqual(ids(render().entries), [2]);
  equal(storage.values.has(legacyKey), false);
  deepStrictEqual(JSON.parse(storage.values.get(entryKey(0))), { eliminada: true });
  equal(storage.values.get(foreignKey), foreignValue);
  const restarted = await loadApp({ storage });
  deepStrictEqual(ids((await restarted.obtenerSeguimientosGuardados()).credenciales), [2]);
});

test('un fallo de SecureStore no trae de vuelta la tarjeta y reintentar completa la eliminación', async () => {
  const storage = mockSecureStore();
  const ui = mockHooks();
  const app = await loadApp({ storage, hooks: ui.hooks, fetch: async (_, { method }) => (
    response(200, { data: booking(1, method === 'POST' ? 'cancelled' : 'pending') })
  ) });
  await app.guardarSeguimiento(1, token(1));
  const render = () => ui.render(app.useBookingHistory);
  await render().refreshAll();
  storage.controls.beforeWrite = () => { throw new Error('SecureStore no disponible'); };
  await render().cancelBooking(1);
  deepStrictEqual(ids(render().entries), []);
  equal(render().storage.limpiezaPendiente, true);
  equal(JSON.parse(storage.values.get(entryKey(0))).token, token(1));
  delete storage.controls.beforeWrite;
  await render().refreshAll();
  deepStrictEqual(ids(render().entries), []);
  equal(render().storage.limpiezaPendiente, false);
  deepStrictEqual(JSON.parse(storage.values.get(entryKey(0))), { eliminada: true });
});

function findElement(node, matchElement) {
  if (Array.isArray(node)) {
    for (const child of node) {
      const match = findElement(child, matchElement);
      if (match) return match;
    }
  } else if (node?.props) {
    if (matchElement(node)) return node;
    return findElement(node.props.children, matchElement);
  }
}

test('el carrusel ajusta el contador, mantiene una vecina y muestra el vacío al quitar la última', async () => {
  const ui = mockHooks();
  let entries = [1, 2, 3].map((id) => ({ id }));
  const app = await loadApp({ hooks: ui.hooks, routeHistory: () => ({ entries, storage: {} }) });
  const isCarousel = ({ type }) => type.name === 'BookingCarousel';
  const carousel = () => {
    const node = findElement(app.MisReservas(), isCarousel);
    return ui.render(node.type, node.props);
  };
  const counter = (tree) => Array.from(findElement(tree, ({ props }) => props.accessibilityLiveRegion === 'polite').props.children).join('');
  const flatList = (tree) => findElement(tree, ({ type }) => type === 'FlatList').props;
  const move = [];
  carousel().props.onLayout({ nativeEvent: { layout: { width: 320 } } });
  const list = flatList(carousel());
  list.ref.current = { scrollToOffset: ({ offset }) => move.push(offset) };
  list.onScroll({ nativeEvent: { contentOffset: { x: 320 } } });
  equal(counter(carousel()), '2 de 3');

  entries = entries.filter(({ id }) => id !== 2);
  const reduced = carousel();
  equal(counter(reduced), '2 de 2');
  const reducedList = flatList(reduced);
  const active = reducedList.renderItem({ item: entries[1], index: 1 }).props.children;
  equal(active.props.active, true);
  equal(active.props.entry.id, 3);
  const next = findElement(reduced, ({ props }) => props.previous === undefined && props.onPress && props.colors);
  equal(next.props.disabled, true);

  entries = entries.filter(({ id }) => id !== 3);
  const last = carousel();
  equal(counter(last), '1 de 1');
  deepStrictEqual(move, [0]);
  equal(flatList(last).data.length, 1);

  entries = [];
  const empty = app.MisReservas();
  equal(findElement(empty, isCarousel), undefined);
  equal(findElement(empty, ({ props }) => props.children === 'Todavía no tienes reservas').type, 'Text');
});
