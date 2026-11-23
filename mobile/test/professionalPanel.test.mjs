import { deepStrictEqual, equal, match, ok, rejects } from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { setImmediate as settle } from 'node:timers/promises';
import { test } from 'node:test';
import { URL } from 'node:url';
import { createContext, SourceTextModule, SyntheticModule } from 'node:vm';
import ts from 'typescript';

const base = 'https://panel.example.test/api';
const csrfToken = 'a'.repeat(64);
const session = { id: 1, name: 'Profesional de prueba', automatic_approval: false, csrfToken };
const profile = { id: 1, name: session.name, title: 'Barbero', bio: null, location: '', instagram: '', whatsapp: '', specialties: [] };
const service = { id: 4, name: 'Servicio de prueba', price: 12000, duration_minutes: 45, active: true };
const week = { days: [1, 2, 3, 4, 5, 6, 0].map((day) => ({ day, enabled: false, intervals: [] })) };
const makeBooking = (id, status, startsAt) => ({
  id, status, starts_at: startsAt, ends_at: new Date(Date.parse(startsAt) + 1800000).toISOString(),
  service_name: `Servicio ${id}`, customer_name: 'Cliente de prueba', customer_phone: '+56900000000',
});
const response = (data, status = 200) => ({ status, ok: status < 400, json: async () => status < 400 ? { data } : { error: data } });
const normalize = (value) => JSON.parse(JSON.stringify(value));

const files = {
  './api': 'services/api.js',
  './professionalApi': 'services/professionalApi.js',
  './professionalAgenda': 'utils/professionalAgenda.js',
  './professionalSettings': 'utils/professionalSettings.js',
  './useProfessionalSettings': 'hooks/useProfessionalSettings.js',
  './booking': 'utils/booking.js',
  './ProfessionalRequests': 'components/ProfessionalRequests.jsx',
  './ProfessionalSettingsForms': 'components/ProfessionalSettingsForms.jsx',
  './ProfessionalTabBar': 'components/ProfessionalTabBar.tsx',
  './Agenda': 'app/profesional/agenda.jsx',
};

const sources = Object.fromEntries(Object.entries(files).map(([key, file]) => {
  const input = readFileSync(new URL(`../src/${file}`, import.meta.url), 'utf8');
  const source = /\.[jt]sx$/.test(file) ? ts.transpileModule(input, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX },
  }).outputText : input;
  return [key, source];
}));

function renderHarness() {
  const state = [];
  let cursor = 0;
  let focused = false;
  return {
    hooks: {
      useState(initial) {
        const key = cursor++;
        if (!(key in state)) state[key] = typeof initial === 'function' ? initial() : initial;
        return [state[key], (value) => { state[key] = typeof value === 'function' ? value(state[key]) : value; }];
      },
      useRef(value) {
        const key = cursor++;
        state[key] ??= { current: value };
        return state[key];
      },
      useCallback: (callback) => callback,
      useMemo: (callback) => callback(),
    },
    focus(callback) { if (!focused) { focused = true; callback(); } },
    render(component, props) { cursor = 0; return component(props); },
  };
}

async function loadApp({ fetch, resource = () => ({}), ui = renderHarness(), alert = () => {}, sessionContext = {} } = {}) {
  const context = createContext({
    process: { env: { EXPO_PUBLIC_API_URL: base } }, AbortController, setTimeout, clearTimeout, fetch, require: (asset) => asset,
  });
  const modules = Object.fromEntries(Object.entries(sources).map(([key, source]) => [
    key, new SourceTextModule(source, { context, identifier: key }),
  ]));
  const jsx = (type, props) => ({ type, props });
  const colors = {};
  const appearance = () => ({ colors, mode: 'light' });
  const stubs = {
    react: ui.hooks,
    'react/jsx-runtime': { jsx, jsxs: jsx, Fragment: 'Fragment' },
    'expo-router': { useFocusEffect: ui.focus, usePreventRemove: () => {} },
    'react-native': {
      StyleSheet: { create: (style) => style, hairlineWidth: 1 },
      Alert: { alert }, ActivityIndicator: 'ActivityIndicator', Pressable: 'Pressable', ScrollView: 'ScrollView',
      SectionList: 'SectionList', Switch: 'Switch', Text: 'Text', TextInput: 'TextInput', View: 'View', Image: 'Image',
    },
    'react-native-safe-area-context': { SafeAreaView: 'SafeAreaView' },
    './BookingPage': { BookingPage: 'BookingPage', Button: 'Button', Message: 'Message', useBookingStyles: () => ({}) },
    './ProfessionalIcon': { ProfessionalIcon: 'ProfessionalIcon' },
    './ProfessionalSession': { useProfessionalSession: () => sessionContext },
    './useProfessionalRead': { sessionExpired: 'Sesión terminada.', useProfessionalRead: resource },
    './tokens': { palettes: { light: colors, dark: colors }, serif: 'serif' },
    './AppearanceProvider': { useAppearance: appearance },
  };
  for (const [name, exports] of Object.entries(stubs)) {
    modules[name] = new SyntheticModule(Object.keys(exports), function () {
      for (const [key, value] of Object.entries(exports)) this.setExport(key, value);
    }, { context });
  }
  function resolve(specifier) {
    return modules[specifier] ?? modules[`./${specifier.split('/').at(-1)}`];
  }
  const entry = new SourceTextModule(Object.keys(files).filter((key) => key !== './Agenda').map((key) => (
    `export * from '${key}';`
  )).join('\n') + "\nexport { default as Agenda } from './Agenda';", { context });
  await entry.link(resolve);
  await entry.evaluate();
  return entry.namespace;
}

function find(node, predicate) {
  if (Array.isArray(node)) {
    for (const child of node) {
      const item = find(child, predicate);
      if (item) return item;
    }
  } else if (node?.props) {
    return predicate(node) ? node : find(node.props.children, predicate);
  }
}

const texts = (node) => {
  if (Array.isArray(node)) return node.map(texts).join('');
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  return node?.props ? texts(node.props.children) : '';
};

test('Solicitudes conserva las pendientes primero y despliega el historial ordenado y virtualizado', async () => {
  const bookings = [
    makeBooking(3, 'pending', '2030-02-01T15:00:00Z'),
    makeBooking(4, 'cancelled', '2030-02-01T12:00:00Z'),
    makeBooking(2, 'pending', '2030-02-01T14:00:00Z'),
    makeBooking(1, 'pending', '2030-02-01T14:00:00Z'),
    makeBooking(5, 'completed', '2030-02-01T17:00:00Z'),
    makeBooking(6, 'confirmed', '2030-02-01T16:00:00Z'),
    makeBooking(7, 'rejected', '2030-02-01T13:00:00Z'),
  ];
  const ui = renderHarness();
  const app = await loadApp({ ui, fetch: async (_, { credentials }) => {
    equal(credentials, 'include');
    return response(bookings);
  } });
  const render = () => ui.render(app.ProfessionalRequests, { session, onSessionEnd: () => {} });
  render();
  await settle();
  const getList = () => find(render(), ({ type }) => type === 'SectionList').props;
  const ids = (rows) => Array.from(rows, ({ id }) => id);
  let list = getList();
  deepStrictEqual(ids(list.sections[0].data), [2, 1, 3]);
  equal(list.sections[1].data.length, 0);
  const disclosure = find(list.renderSectionHeader({ section: list.sections[1] }), ({ type }) => type === 'Pressable');
  equal(disclosure.props.accessibilityState.expanded, false);
  match(texts(disclosure), /4 registros/);
  disclosure.props.onPress();
  list = getList();
  deepStrictEqual(ids(list.sections[1].data), [5, 6, 7, 4]);
  deepStrictEqual(Array.from(list.sections[1].data, ({ status }) => app.estadosSolicitud[status]),
    ['Completada', 'Confirmada', 'Rechazada', 'Cancelada']);
  deepStrictEqual(ids(list.sections[0].data), [2, 1, 3]);
});

test('Agenda usa los 14 días, el estado vacío, una destacada y las restantes sin duplicarlas', async () => {
  const ui = renderHarness();
  const dates = Array.from({ length: 14 }, (_, index) => ({
    id: `2030-02-${String(index + 1).padStart(2, '0')}`, bookings: [],
  }));
  const future = new Date(Date.now() + 3600000).toISOString();
  const later = new Date(Date.now() + 7200000).toISOString();
  dates[1].bookings = [makeBooking(1, 'confirmed', future), makeBooking(2, 'pending', later)];
  dates[2].bookings = [makeBooking(4, 'confirmed', later), makeBooking(3, 'confirmed', future)];
  let refreshed = false;
  const app = await loadApp({ ui, resource: () => ({ data: dates, refresh: () => { refreshed = true; } }) });
  const render = () => ui.render(app.Agenda);
  let tree = render();
  match(texts(tree), /Sin atenciones confirmadas/);
  const datesRail = find(tree, ({ type }) => type === 'ScrollView');
  equal(datesRail.props.children.length, 14);
  datesRail.props.children[1].props.onPress();
  tree = render();
  match(texts(tree), /1 atención confirmada/);
  const first = find(tree, ({ type }) => type.name === 'Appointment');
  equal(first.props.featured, true);
  equal(first.props.booking.id, 1);
  datesRail.props.children[2].props.onPress();
  tree = render();
  match(texts(tree), /2 atenciones confirmadas/);
  const featured = find(tree, ({ type, props }) => type.name === 'Appointment' && props.featured);
  equal(featured.props.booking.id, 3);
  const other = find(tree, ({ props }) => props.booking?.id === 4);
  ok(other);
  const past = makeBooking(10, 'confirmed', '2020-01-01T13:00:00Z');
  const summary = app.summarizeAgendaDate([past], new Date(future));
  equal(summary.featured.id, 10);
  equal(summary.upcoming, false);
  tree.props.footer.props.onPress();
  equal(refreshed, true);
});

test('la barra muestra tres pestañas y navega con la clave de Expo Router', async () => {
  const app = await loadApp();
  const state = { index: 0, routes: ['(inicio)', 'solicitudes', 'agenda'].map((name) => ({ name, key: `${name}-route` })) };
  const visited = [];
  const props = { state, insets: { bottom: 24, left: 0, right: 0 }, writing: false,
    emitter: { emit: ({ target }) => { visited.push(target); return {}; } },
    navigateToTab: (key) => visited.push(key) };
  const tree = app.ProfessionalTabBar(props);
  equal(tree.props.style[1].paddingBottom, 24);
  for (const [label, key] of [['Solicitudes', 'solicitudes-route'], ['Agenda', 'agenda-route']]) {
    find(tree, ({ props }) => props.accessibilityLabel === label).props.onPress();
    deepStrictEqual(visited.slice(-2), [key, key]);
  }
  equal(find(tree, ({ props }) => props.accessibilityLabel === 'Ajustes'), undefined);
});

test('Ajustes utiliza cookie, cuerpos válidos, CSRF y una consulta posterior a cada guardado', async () => {
  const calls = [];
  const values = { '/professional/profile': profile, '/professional/services': [service], '/professional/working-hours': week,
    '/auth/session': session };
  const writes = { '/professional/profile': profile, '/professional/services/4': service, '/professional/working-hours': week,
    '/professional/settings': { id: session.id, name: session.name, automatic_approval: true } };
  const app = await loadApp({ fetch: async (url, options) => {
    const path = url.slice(base.length);
    equal(options.credentials, 'include');
    calls.push([path, options.method ?? 'GET', options.headers['X-CSRF-Token'], options.body && JSON.parse(options.body)]);
    return response(options.method ? writes[path] : values[path]);
  } });
  const profileBody = app.prepararPerfil({ ...profile, name: '  Profesional A  ' }).payload;
  const serviceBody = app.prepararServicio({ ...service, price: '12000', duration_minutes: '45', active: false }).payload;
  const hoursBody = app.prepararJornada(week.days).payload;
  const updates = [
    [(csrf) => app.guardarPerfilProfesional(profileBody, csrf), app.obtenerPerfilProfesional, '/professional/profile', 'PATCH', profileBody, '/professional/profile'],
    [(csrf) => app.guardarServicioProfesional(4, serviceBody, csrf), app.obtenerServiciosProfesionales, '/professional/services/4', 'PATCH', serviceBody, '/professional/services'],
    [(csrf) => app.guardarJornadaProfesional(hoursBody, csrf), app.obtenerJornadaProfesional, '/professional/working-hours', 'PUT', hoursBody, '/professional/working-hours'],
    [(csrf) => app.guardarAprobacionProfesional(true, csrf), app.obtenerAprobacionProfesional, '/professional/settings', 'PATCH', { automatic_approval: true }, '/auth/session'],
  ];
  for (const [write, reload, path, method, payload, readPath] of updates) {
    const snapshots = [];
    const result = await app.persistProfessionalSetting({ session, write, reload, onSaved: (data) => snapshots.push(data) });
    equal(result.notice, 'Cambios guardados.');
    equal(snapshots.length, 2);
    deepStrictEqual(calls.slice(-2), [[path, method, csrfToken, normalize(payload)], [readPath, 'GET', undefined, undefined]]);
  }
  equal(profileBody.name, 'Profesional A');
  equal(serviceBody.active, false);
  equal(hoursBody.days.length, 7);
});

test('la jornada valida formato y pausas, y los formularios rechazan valores fuera de contrato', async () => {
  const app = await loadApp();
  match(app.prepararPerfil({ ...profile, name: ' ' }).error, /nombre/);
  match(app.prepararServicio({ ...service, price: '12.4', duration_minutes: '45' }).error, /precio/);
  match(app.prepararServicio({ ...service, price: '100', duration_minutes: '43' }).error, /múltiplos/);
  const withIntervals = (intervals) => week.days.map((day) => day.day === 1 ? { ...day, enabled: true, intervals } : day);
  match(app.prepararJornada(withIntervals([{ start: '9:00', end: '13:00' }])).error, /HH:MM/);
  match(app.prepararJornada(withIntervals([{ start: '09:00', end: '13:00' }, { start: '12:00', end: '14:00' }])).error, /superponen/);
  const intervals = [{ start: '09:00', end: '13:00' }, { start: '15:00', end: '24:00' }];
  deepStrictEqual(normalize(app.prepararJornada(withIntervals(intervals)).payload.days[0].intervals), intervals);
});

test('errores reales, 401 y 403 conservan control de sesión y evitan repetir escrituras', async () => {
  const calls = [];
  let current = { ...session, csrfToken: 'b'.repeat(64) };
  const app = await loadApp({ fetch: async (url) => {
    calls.push(url);
    if (url.endsWith('/auth/session')) return current ? response(current) : response('Sesión ausente', 401);
    return response('No se guardó la jornada porque afectaría la reserva #42.', 409);
  } });
  const failure = (status, message) => async () => { throw Object.assign(new Error(message), { status }); };
  const sessions = [];
  const endings = [];
  const args = { session, reload: async () => { throw new Error('Lectura inesperada'); },
    onSaved: () => { throw new Error('Guardado inesperado'); }, onSession: (value) => sessions.push(value), onSessionEnd: (value) => endings.push(value) };
  const conflict = await app.persistProfessionalSetting({ ...args, write: (csrf) => app.guardarJornadaProfesional(week, csrf) });
  match(conflict.error, /reserva #42/);
  equal(calls.length, 1);
  const csrf = await app.persistProfessionalSetting({ ...args, write: failure(403, 'CSRF rechazado.') });
  match(csrf.error, /CSRF rechazado.*Sesión actualizada/);
  equal(sessions[0].csrfToken, current.csrfToken);
  equal(calls.length, 2);
  await app.persistProfessionalSetting({ ...args, write: failure(401, 'Sesión terminada.') });
  equal(endings.length, 1);
  current = null;
  await rejects(app.obtenerAprobacionProfesional(), { status: 401 });
});

test('la aprobación requiere confirmar el diálogo antes de enviar el PATCH', async () => {
  const ui = renderHarness();
  const dialogs = [];
  const calls = [];
  const sessionContext = { session, writing: false, beginWrite: () => true, endWrite: () => {}, onSession: () => {} };
  const app = await loadApp({ ui, sessionContext, alert: (...args) => dialogs.push(args), fetch: async (url, options) => {
    calls.push(options.method ?? 'GET');
    const updated = { ...session, automatic_approval: true };
    if (options.method) {
      equal(url, base + '/professional/settings');
      deepStrictEqual(JSON.parse(options.body), { automatic_approval: true });
    }
    return response(updated);
  } });
  const render = () => ui.render(app.ApprovalSettingsForm, { initial: session });
  find(render(), ({ type }) => type.name === 'Toggle').props.onChange(true);
  const save = () => find(render(), ({ type }) => type.name === 'SaveAction').props.onPress();
  save();
  equal(calls.length, 0);
  dialogs[0][2][0].onPress();
  equal(calls.length, 0);
  save();
  dialogs[1][2][1].onPress();
  await settle();
  deepStrictEqual(calls, ['PATCH', 'GET']);
  match(find(render(), ({ type }) => type.name === 'SettingsCard').props.title, /automática/);
});
