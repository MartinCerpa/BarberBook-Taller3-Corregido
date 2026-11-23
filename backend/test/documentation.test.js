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

  await t.test('las 20 operaciones reales están documentadas sin rutas de negocio inventadas', async () => {
    const files = (await readdir(new URL('../src/routes/', import.meta.url))).filter((f) => f.endsWith('.js') && f !== 'documentationRoutes.js');
    const actual = new Set(['get /health']);
    for (const file of files) {
      const source = await readFile(new URL(`../src/routes/${file}`, import.meta.url), 'utf8');
      for (const match of source.matchAll(/router\.(get|post|put|patch|delete)\('([^']+)'/g)) actual.add(`${match[1]} ${match[2].replace(/:([A-Za-z]+)/g, '{$1}')}`);
    }
    const documented = new Set(Object.entries(spec.paths).filter(([p]) => p !== '/openapi.json').flatMap(([p, item]) => Object.keys(item).map((method) => `${method} ${p}`)));
    assert.equal(actual.size, 20); assert.deepEqual([...documented].sort(), [...actual].sort());
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
    assert.equal((await request('/auth/logout', { method: 'POST' })).status, 200);
    assert.equal((await request('/auth/session')).status, 401);
  });
  console.log(`Base aislada de documentación conservada: ${name}`);
});
