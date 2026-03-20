export async function api(path, options = {}) {
  const { headers: optHeaders, body, ...rest } = options;
  const headers = { ...optHeaders };
  if (body != null && typeof body === 'string' && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }
  const res = await fetch(path, {
    credentials: 'include',
    ...rest,
    body,
    headers
  });
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text };
  }
  if (!res.ok) {
    const err = new Error(data?.error || data?.message || res.statusText);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

export const auth = {
  me: () => api('/api/auth/me', { method: 'GET' }),
  login: (username, password) =>
    api('/api/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) }),
  logout: () => api('/api/auth/logout', { method: 'POST' })
};

export const contactsApi = {
  list: () => api('/api/contacts', { method: 'GET' }),
  get: (id) => api(`/api/contacts/${id}`, { method: 'GET' }),
  create: (body) => api('/api/contacts', { method: 'POST', body: JSON.stringify(body) }),
  update: (id, body) => api(`/api/contacts/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  remove: (id) => api(`/api/contacts/${id}`, { method: 'DELETE' })
};
