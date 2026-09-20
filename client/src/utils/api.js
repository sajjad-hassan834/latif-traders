// Dynamic API URL: points to Railway backend in production or uses Vite local proxy in dev
const DEFAULT_PROD_API = 'https://latif-traders-production.up.railway.app';
const rawBase = import.meta.env.VITE_API_URL || (import.meta.env.PROD ? DEFAULT_PROD_API : '');
const API_BASE = rawBase ? `${rawBase.replace(/\/$/, '')}/api` : '/api';

export async function request(endpoint, options = {}) {
  const token = localStorage.getItem('lt_token');

  const headers = {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    'Pragma': 'no-cache',
    ...(options.headers || {})
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const config = {
    cache: 'no-store',
    ...options,
    headers,
    credentials: 'include'
  };

  try {
    const res = await fetch(`${API_BASE}${endpoint}`, config);
    const contentType = res.headers.get('content-type') || '';
    let data;
    if (contentType.includes('application/json')) {
      data = await res.json();
    } else {
      const text = await res.text();
      try {
        data = JSON.parse(text);
      } catch (e) {
        data = { success: false, message: `Server returned non-JSON response (${res.status}).` };
      }
    }

    if (!res.ok) {
      if (res.status === 401 && !endpoint.includes('/auth/login')) {
        localStorage.removeItem('lt_token');
        localStorage.removeItem('lt_user');
        window.location.reload();
      }
      throw new Error(data.message || 'Request failed');
    }

    return data;
  } catch (err) {
    throw err;
  }
}

export const api = {
  get: (endpoint, options) => request(endpoint, { ...options, method: 'GET' }),
  post: (endpoint, body, options) => request(endpoint, { ...options, method: 'POST', body: JSON.stringify(body) }),
  put: (endpoint, body, options) => request(endpoint, { ...options, method: 'PUT', body: JSON.stringify(body) }),
  delete: (endpoint, options) => request(endpoint, { ...options, method: 'DELETE' })
};
