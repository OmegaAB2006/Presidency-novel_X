const BASE = '/api';

function getToken() {
  return localStorage.getItem('token');
}

async function request(path, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  const token = getToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${BASE}${path}`, { ...options, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

async function upload(path, formData) {
  const token = getToken();
  const headers = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${BASE}${path}`, { method: 'POST', headers, body: formData });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

export const auth = {
  register: (body) => request('/auth/register', { method: 'POST', body: JSON.stringify(body) }),
  login: (body) => request('/auth/login', { method: 'POST', body: JSON.stringify(body) }),
  me: () => request('/auth/me'),
};

export const items = {
  list: () => request('/items'),
  marketplace: (category) => request(`/items/marketplace${category ? `?category=${category}` : ''}`),
  create: (formData) => upload('/items', formData),
  update: (id, body) => request(`/items/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  delete: (id) => request(`/items/${id}`, { method: 'DELETE' }),
};

export const trades = {
  matches: (itemId) => request(`/trades/matches/${itemId}`),
  create: (body) => request('/trades', { method: 'POST', body: JSON.stringify(body) }),
  list: () => request('/trades'),
  respond: (id, action, meetupLocation = '') =>
    request(`/trades/${id}/respond`, {
      method: 'PUT',
      body: JSON.stringify({ action, meetup_location: meetupLocation }),
    }),
  rate: (id, body) => request(`/trades/${id}/rate`, { method: 'POST', body: JSON.stringify(body) }),
  confirm: (id) => request(`/trades/${id}/confirm`, { method: 'POST' }),
};

export const profile = {
  get: (userId) => request(`/profile/${userId}`),
  topup: (amount) => request('/profile/wallet/topup', { method: 'POST', body: JSON.stringify({ amount }) }),
};
