import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { once } from 'node:events';
import { readFile, readdir } from 'node:fs/promises';
import pg from 'pg';
import Parser from '@apidevtools/swagger-parser';
import { pool } from '../src/database/connection.js';
import { initializeDatabase } from '../src/database/initialize.js';
import { createApp } from '../src/app.js';
import { hashPassword } from '../src/services/authService.js';

test('OpenAPI y documentación: contrato y HTTP con PostgreSQL aislado', { timeout: 90000 }, async (t) => {
  t.after(() => pool.end());
  assert.match(pool.options.database, /^barberbook_t3/);
  const name = `barberbook_t3_docs_${randomUUID().replaceAll('-', '').slice(0, 12)}`;
  await pool.query(`CREATE DATABASE ${name}`);
  const db = new pg.Pool({ ...pool.options, password: pool.options.password, database: name, connectionTimeoutMillis: 5000 });
  t.after(() => db.end());
  await initializeDatabase(db, true);
  const server = createApp(db).listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}/api`;
  let cookie, csrf, spec;
  async function request(path, { method = 'GET', body, authenticated = true, includeCsrf = true, token } = {}) {
    const headers = { 'Content-Type': 'application/json' };
    if (cookie && authenticated) headers.Cookie = cookie;
    if (csrf && includeCsrf && authenticated) headers['X-CSRF-Token'] = csrf;
    if (token) headers.Authorization = `Bearer ${token}`;
    const response = await fetch(base + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
    return { status: response.status, body: await response.json(), cookie: response.headers.get('set-cookie'), headers: response.headers };
  }
  function properties(schema) {
    if (schema.$ref) return properties(spec.components.schemas[schema.$ref.split('/').at(-1)]);
    return Object.assign({}, ...(schema.allOf ?? []).map(properties), schema.properties ?? {});
  }
  function assertFields(value, schemaName) {
    assert.deepEqual(Object.keys(value).sort(), Object.keys(properties({ $ref: `#/components/schemas/${schemaName}` })).sort());
  }

  await t.test('documento OpenAPI 3 válido y servido como JSON público', async () => {
    const r = await request('/openapi.json'); assert.equal(r.status, 200); spec = r.body;
    await Parser.validate(structuredClone(spec));
    assert.equal(spec.openapi, '3.0.3'); assert.equal(spec.servers[0].url, '/api');
    assert.equal(JSON.stringify(spec).includes('password_hash'), false);
  });

  await t.test('las 21 operaciones reales están documentadas sin rutas de negocio inventadas', async () => {
    const files = (await readdir(new URL('../src/routes/', import.meta.url))).filter((f) => f.endsWith('.js') && f !== 'documentationRoutes.js');
    const actual = new Set(['get /health']);
    for (const file of files) {
      const source = await readFile(new URL(`../src/routes/${file}`, import.meta.url), 'utf8');
      for (const match of source.matchAll(/router\.(get|post|put|patch|delete)\('([^']+)'/g)) actual.add(`${match[1]} ${match[2].replace(/:([A-Za-z]+)/g, '{$1}')}`);
    }
    const documented = new Set(Object.entries(spec.paths).filter(([p]) => p !== '/openapi.json').flatMap(([p, item]) => Object.keys(item).map((method) => `${method} ${p}`)));
    assert.equal(actual.size, 21); assert.deepEqual([...documented].sort(), [...actual].sort());
    const ids = Object.values(spec.paths).flatMap((p) => Object.values(p).map((op) => op.operationId));
    assert.equal(ids.length, new Set(ids).size);
  });

  await t.test('Swagger HTML, assets locales y procedimiento privado sin persistencia ni validador externo', async () => {
    const redirect = await fetch(base + '/docs', { redirect: 'manual' }); assert.equal(redirect.status, 302); assert.equal(redirect.headers.get('location'), '/api/docs/');
    const page = await fetch(base + '/docs/'); assert.equal(page.status, 200);
    const html = await page.text(); assert.ok(html.includes('type="password"')); assert.ok(!html.includes('https://'));
    for (const asset of ['assets/swagger-ui.css', 'assets/swagger-ui-bundle.js', 'init.js', 'style.css']) assert.equal((await fetch(base + '/docs/' + asset)).status, 200);
    const script = await (await fetch(base + '/docs/init.js')).text();
    assert.ok(script.includes('validatorUrl: null')); assert.ok(script.includes('persistAuthorization: false'));
    assert.ok(!/localStorage|sessionStorage/.test(script));
  });

  await t.test('salud, catálogo y disponibilidad responden con sus campos documentados', async () => {
    const health = await request('/health'); assert.equal(health.status, 200); assertFields(health.body, 'Health');
    const people = await request('/professionals'); assert.equal(people.status, 200); assertFields(people.body.data[0], 'PublicProfessional');
    const services = await request('/services'); assert.equal(services.status, 200); assertFields(services.body.data[0], 'PublicService');
    const service = services.body.data[0];
    const calendar = await request(`/availability?professionalId=${service.professional_id}&serviceId=${service.id}&days=14`);
    assert.equal(calendar.status, 200); assert.equal(calendar.body.data.length, 14); assertFields(calendar.body.data[0], 'AvailabilityDay');
    const slot = calendar.body.data.flatMap((d) => d.slots)[0]; assertFields(slot, 'AvailableSlot');
    assert.equal((await request('/availability')).status, 400);
    assert.equal((await request('/bookings', { method: 'POST', body: {} })).status, 400);
  });

  await t.test('sesión y CSRF están documentados como requisitos conjuntos y siguen siendo exigidos', async () => {
    const writes = [];
    for (const [path, operations] of Object.entries(spec.paths)) {
      for (const [method, op] of Object.entries(operations)) {
        if (path.startsWith('/professional/') || path === '/auth/session' || path === '/auth/logout') {
          assert.ok(Object.hasOwn(op.security[0], 'cookieSession'));
          assert.ok(op.responses[401]);
          if (method !== 'get') {
            assert.ok(Object.hasOwn(op.security[0], 'csrfToken')); assert.ok(op.responses[403]); writes.push([path.replace('{id}', '1'), method]);
          }
          const r = await request(path.replace('{id}', '1'), { method: method.toUpperCase(), body: method === 'get' ? undefined : {}, authenticated: false });
          assert.equal(r.status, 401);
        }
      }
    }
    const owner = (await db.query('SELECT id FROM professionals ORDER BY id LIMIT 1')).rows[0];
    const password = randomUUID();
    await db.query('UPDATE professionals SET email=$2,password_hash=$3 WHERE id=$1', [owner.id, 'docs@test.invalid', await hashPassword(password)]);
    const login = await request('/auth/login', { method: 'POST', body: { email: 'docs@test.invalid', password } });
    assert.equal(login.status, 200); assertFields(login.body.data, 'Session'); assert.ok(login.cookie.includes('HttpOnly'));
    cookie = login.cookie.split(';')[0]; csrf = login.body.data.csrfToken;
    for (const [path, method] of writes) assert.equal((await request(path, { method: method.toUpperCase(), body: {}, includeCsrf: false })).status, 403);
    assert.equal((await request('/professional/settings', { method: 'PATCH', body: { automatic_approval: false } })).status, 200);
  });

  await t.test('respuestas privadas coinciden con los DTO documentados', async () => {
    for (const [path, schema, list] of [['/professional/profile', 'Profile'], ['/professional/services', 'ManagedService', true], ['/professional/working-hours', 'WorkingWeek'], ['/professional/agenda', 'Agenda']]) {
      const r = await request(path); assert.equal(r.status, 200); assertFields(list ? r.body.data[0] : r.body.data, schema);
    }
    const agenda = (await request('/professional/agenda')).body.data; assertFields(agenda.days[0], 'AgendaDay');
    const slot = agenda.days.flatMap((d) => d.slots)[0]; assertFields(slot, 'AgendaSlot'); assertFields(slot.services[0], 'AgendaServiceOffer');
  });

  await t.test('seguimiento privado, reservas competitivas y estados en PostgreSQL aislado', async () => {
    const service = (await request('/services')).body.data[0];
    const days = (await request(`/availability?professionalId=${service.professional_id}&serviceId=${service.id}&days=14`)).body.data;
    const slot = days.flatMap((d) => d.slots).find((s) => s.isBookable && s.bookingStatus === 'available'); assert.ok(slot);
    await db.query('DROP TABLE booking_tracking_credentials');
    const legacy = (await db.query(
      `INSERT INTO bookings(service_id, customer_name, customer_phone, starts_at, ends_at, status)
       VALUES ($1, 'Cliente sin seguimiento', '+56900000002', $2, $3, 'rejected') RETURNING id`,
      [service.id, slot.startsAt, slot.endsAt],
    )).rows[0];
    await initializeDatabase(db);
    assert.equal((await db.query('SELECT status FROM bookings WHERE id=$1', [legacy.id])).rows[0].status, 'rejected');
    const r = await request('/bookings', { method: 'POST', body: { serviceId: service.id, customerName: 'Cliente aislado', customerPhone: '+56900000000', startsAt: slot.startsAt } });
    const other = await request('/bookings', { method: 'POST', body: { serviceId: service.id, customerName: 'Otro cliente aislado', customerPhone: '+56900000001', startsAt: slot.startsAt } });
    assert.equal(r.status, 201); assertFields(r.body.data, 'BookingCreated'); assert.equal(r.body.data.status, 'pending');
    assert.equal(other.status, 201);
    assert.equal(r.headers.get('cache-control'), 'no-store');
    const { id, trackingToken: token } = r.body.data;
    const { id: otherId, trackingToken: otherToken } = other.body.data;
    assert.ok(/^[0-9a-f]{64}$/.test(token) && /^[0-9a-f]{64}$/.test(otherToken) && token !== otherToken);
    const track = (bookingId, credential) => request(`/bookings/${bookingId}/tracking`, { token: credential, authenticated: false });
    const absent = await track(id);
    assert.equal(absent.status, 401); assert.match(absent.headers.get('www-authenticate'), /^Bearer /);
    assert.equal((await track(id, 'invalida')).status, 401);
    assert.equal((await track('2147483648', token)).status, 400);
    const denied = await track(otherId, token);
    assert.equal(denied.status, 404);
    assert.equal((await track(id, otherToken)).status, 404);
    assert.deepEqual((await track(2147483647, token)).body, denied.body);
    const pending = await track(id, token);
    assert.equal(pending.status, 200); assertFields(pending.body.data, 'TrackedBooking');
    assert.equal(pending.headers.get('cache-control'), 'no-store');
    assert.equal(pending.body.data.status, 'pending');
    assert.equal(pending.body.data.startsAt, slot.startsAt);
    assert.equal(pending.body.data.serviceName, service.name);

    const list = await request('/professional/bookings?status=pending');
    for (const booking of list.body.data) assertFields(booking, 'ProfessionalBooking');
    const confirmed = await request(`/professional/bookings/${id}/status`, { method: 'PATCH', body: { status: 'confirmed' } });
    assert.equal(confirmed.status, 200); assertFields(confirmed.body.data, 'Booking');
    assert.equal((await track(id, token)).body.data.status, 'confirmed');
    assert.equal((await track(otherId, otherToken)).body.data.status, 'pending');
    assert.equal((await request(`/professional/bookings/${otherId}/status`, { method: 'PATCH', body: { status: 'rejected' } })).status, 200);
    assert.equal((await track(otherId, otherToken)).body.data.status, 'rejected');
    await db.query("UPDATE bookings SET status='cancelled' WHERE id=$1", [otherId]);
    assert.equal((await track(otherId, otherToken)).body.data.status, 'cancelled');
    await db.query("UPDATE bookings SET status='completed' WHERE id=$1", [otherId]);
    assert.equal((await track(otherId, otherToken)).body.data.status, 'completed');
    await initializeDatabase(db);
    assert.deepEqual((await track(legacy.id, token)).body, denied.body);
    assert.equal((await track(id, token)).body.data.status, 'confirmed');
    const credential = (await db.query('SELECT token_hash FROM booking_tracking_credentials WHERE booking_id=$1', [id])).rows[0];
    assert.ok(credential && credential.token_hash !== token && credential.token_hash === createHash('sha256').update(token).digest('hex'));
  });

  await t.test('cancelación privada, idempotencia e historial profesional', async (t) => {
    const operation = spec.paths['/bookings/{id}/cancel'].post;
    assert.deepEqual(operation.security, [{ bookingTracking: [] }]);
    assert.equal(operation.requestBody, undefined);
    for (const code of [200, 400, 401, 404, 409]) assert.ok(operation.responses[code]);

    const service = (await request('/services')).body.data[0];
    const query = `/availability?professionalId=${service.professional_id}&serviceId=${service.id}&days=14`;
    const slots = async () => (await request(query)).body.data.flatMap((day) => day.slots);
    const [competitive, terminal, concurrent] = (await slots()).filter((slot) => slot.isBookable && slot.bookingStatus === 'available');
    const create = async ({ startsAt }) => {
      const r = await request('/bookings', {
        method: 'POST', authenticated: false,
        body: { serviceId: service.id, customerName: 'Cliente de prueba', customerPhone: '+56900000003', startsAt },
      });
      assert.equal(r.status, 201);
      assert.equal(r.body.data.status, 'pending');
      return r.body.data;
    };
    const cancel = (id, token) => request(`/bookings/${id}/cancel`, { method: 'POST', token, authenticated: false });
    const track = (booking) => request(`/bookings/${booking.id}/tracking`, { token: booking.trackingToken, authenticated: false });
    const change = (booking, status) => request(`/professional/bookings/${booking.id}/status`, { method: 'PATCH', body: { status } });
    const currentSlot = async (slot) => (await slots()).find((item) => item.startsAt === slot.startsAt);

    await t.test('valida ID y token antes de cambiar el estado e impide enumerar reservas', async () => {
      const a = await create(terminal);
      const b = await create(terminal);
      const unauthorized = await cancel(a.id);
      assert.equal(unauthorized.status, 401);
      assert.match(unauthorized.headers.get('www-authenticate'), /^Bearer /);
      assert.equal((await cancel(a.id, 'malformado')).status, 401);
      assert.equal((await cancel('2147483648', a.trackingToken)).status, 400);
      const crossed = await cancel(a.id, b.trackingToken);
      assert.equal(crossed.status, 404);
      assert.equal((await cancel(a.id, '0'.repeat(64))).status, 404);
      assert.deepEqual((await cancel(2147483647, a.trackingToken)).body, crossed.body);
      assert.equal((await track(a)).body.data.status, 'pending');
      assert.equal((await track(b)).body.data.status, 'pending');

      await db.query("UPDATE bookings SET status='completed' WHERE id=$1", [a.id]);
      assert.equal((await change(b, 'rejected')).status, 200);
      assert.equal((await cancel(a.id, a.trackingToken)).status, 409);
      assert.equal((await cancel(b.id, b.trackingToken)).status, 409);
      assert.equal((await track(a)).body.data.status, 'completed');
      assert.equal((await track(b)).body.data.status, 'rejected');
    });

    await t.test('libera el horario sin decidir solicitudes competidoras y conserva FIFO', async () => {
      const a = await create(competitive);
      const b = await create(competitive);
      const c = await create(competitive);
      assert.equal((await change(a, 'confirmed')).status, 200);
      assert.equal((await currentSlot(competitive)).isBookable, false);
      assert.equal((await request('/professional/settings', { method: 'PATCH', body: { automatic_approval: true } })).status, 200);

      const cancelled = await cancel(a.id, a.trackingToken);
      assert.equal(cancelled.status, 200);
      assert.equal(cancelled.headers.get('cache-control'), 'no-store');
      assertFields(cancelled.body.data, 'TrackedBooking');
      assert.equal(cancelled.body.data.status, 'cancelled');
      assert.deepEqual((await cancel(a.id, a.trackingToken)).body, cancelled.body);
      assert.deepEqual((await track(a)).body, cancelled.body);
      assert.equal((await track(b)).body.data.status, 'pending');
      assert.equal((await track(c)).body.data.status, 'pending');
      const reopened = await currentSlot(competitive);
      assert.equal(reopened.isBookable, true);
      assert.equal(reopened.bookingStatus, 'pending');

      const fifo = await change(c, 'confirmed');
      assert.equal(fifo.status, 409);
      assert.match(fifo.body.error, /FIFO/);
      assert.equal((await cancel(b.id, b.trackingToken)).body.data.status, 'cancelled');
      assert.equal((await track(c)).body.data.status, 'pending');
      assert.equal((await change(c, 'confirmed')).status, 200);
      assert.equal((await cancel(c.id, c.trackingToken)).body.data.status, 'cancelled');
      assert.equal((await currentSlot(competitive)).bookingStatus, 'available');

      for (const state of ['pending', 'confirmed', 'cancelled']) {
        const bookings = (await request(`/professional/bookings?status=${state}`)).body.data;
        assert.equal(bookings.some((item) => item.id === a.id), state === 'cancelled');
      }
      const agenda = (await request('/professional/agenda')).body.data;
      assert.equal(agenda.days.flatMap((day) => day.bookings).some((booking) => [a.id, b.id, c.id].includes(booking.id)), false);
      assert.equal((await db.query('SELECT status FROM bookings WHERE id=$1', [a.id])).rows[0].status, 'cancelled');
      assert.equal((await request('/professional/settings', { method: 'PATCH', body: { automatic_approval: false } })).status, 200);
    });

    await t.test('serializa confirmación y cancelación de la misma reserva', async () => {
      const booking = await create(concurrent);
      const [confirmation, cancellation] = await Promise.all([
        change(booking, 'confirmed'), cancel(booking.id, booking.trackingToken),
      ]);
      assert.ok([200, 409].includes(confirmation.status));
      assert.equal(cancellation.status, 200);
      assert.equal((await track(booking)).body.data.status, 'cancelled');
      assert.equal((await currentSlot(concurrent)).isBookable, true);
    });

    await t.test('admite cancelar una reserva pendiente aunque ya haya pasado su hora', async () => {
      const booking = await create(concurrent);
      await db.query("UPDATE bookings SET starts_at='2000-01-03T13:00:00Z', ends_at='2000-01-03T13:45:00Z' WHERE id=$1", [booking.id]);
      const result = await cancel(booking.id, booking.trackingToken);
      assert.equal(result.status, 200);
      assert.equal(result.body.data.status, 'cancelled');
    });

    assert.equal((await request('/auth/logout', { method: 'POST' })).status, 200);
    assert.equal((await request('/auth/session')).status, 401);
  });
  console.log(`Base aislada de documentación conservada: ${name}`);
});
