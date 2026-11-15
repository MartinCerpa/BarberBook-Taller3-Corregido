/* Swagger solo consume la API existente; no almacena contraseñas ni tokens. */
(() => {
  let csrfToken = null;
  const status = document.getElementById('session-status');
  const form = document.getElementById('session-login');
  const password = document.getElementById('session-password');
  const buttons = document.querySelectorAll('.session-tools button');

  async function sessionRequest(path, options = {}) {
    const response = await fetch(`/api/auth/${path}`, { credentials: 'include', cache: 'no-store', ...options });
    const result = await response.json();
    if (!response.ok) {
      if (response.status === 401) csrfToken = null;
      throw new Error(result.error || 'No se pudo comprobar la sesión.');
    }
    return result.data;
  }

  async function checkSession() {
    const data = await sessionRequest('session');
    csrfToken = data.csrfToken;
    status.textContent = 'Sesión activa. Las escrituras privadas incluirán CSRF automáticamente.';
  }

  async function perform(action) {
    buttons.forEach((button) => { button.disabled = true; });
    try { await action(); }
    catch (error) { status.textContent = error.message; }
    finally { password.value = ''; buttons.forEach((button) => { button.disabled = false; }); }
  }

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    perform(async () => {
      const body = JSON.stringify({ email: document.getElementById('session-email').value, password: password.value });
      password.value = '';
      const data = await sessionRequest('login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body });
      csrfToken = data.csrfToken;
      status.textContent = 'Sesión activa. Las escrituras privadas incluirán CSRF automáticamente.';
    });
  });
  document.getElementById('session-check').addEventListener('click', () => perform(checkSession));
  document.getElementById('session-logout').addEventListener('click', () => perform(async () => {
    if (!csrfToken) await checkSession();
    await sessionRequest('logout', { method: 'POST', headers: { 'X-CSRF-Token': csrfToken } });
    csrfToken = null;
    status.textContent = 'Sesión cerrada.';
  }));

  window.ui = SwaggerUIBundle({
    url: '/api/openapi.json', dom_id: '#swagger-ui', deepLinking: true,
    validatorUrl: null, persistAuthorization: false, withCredentials: true,
    queryConfigEnabled: false, showMutatedRequest: false,
    supportedSubmitMethods: ['get', 'post', 'patch', 'put'],
    requestInterceptor: async (request) => {
      const url = new URL(request.url, window.location.origin);
      if (url.origin !== window.location.origin || !url.pathname.startsWith('/api/')) throw new Error('Este explorador solo envía peticiones a la API local del mismo origen.');
      request.credentials = 'include';
      const write = ['POST', 'PATCH', 'PUT'].includes(request.method?.toUpperCase());
      if (write && (url.pathname.startsWith('/api/professional/') || url.pathname === '/api/auth/logout')) {
        if (!csrfToken) { try { await checkSession(); } catch { /* La API responderá 401 si no hay sesión. */ } }
        if (csrfToken) request.headers['X-CSRF-Token'] = csrfToken;
      }
      return request;
    },
    responseInterceptor: (response) => {
      const path = new URL(response.url, window.location.origin).pathname;
      if (response.status === 401) csrfToken = null;
      if (['/api/auth/login', '/api/auth/session'].includes(path) && response.ok && response.obj?.data?.csrfToken) csrfToken = response.obj.data.csrfToken;
      if (path === '/api/auth/logout' && response.ok) { csrfToken = null; status.textContent = 'Sesión cerrada.'; }
      return response;
    },
  });
})();
