// Dynamic API URL: points to Railway backend in production or uses Vite local proxy in dev
const DEFAULT_PROD_API = 'https://latif-traders-production.up.railway.app';
// In production on Vercel, requests use relative '/api' so Vercel forwards them seamlessly (same-origin, 0 CORS issues)
// Normalize: accept values without protocol (e.g. 'host.up.railway.app') by prepending https://
const envApi = (import.meta.env.VITE_API_URL || '').trim();
export const API_ORIGIN = envApi ? (/^https?:\/\//i.test(envApi) ? envApi : `https://${envApi}`).replace(/\/+$/, '') : '';
const rawBase = API_ORIGIN;
const API_BASE = rawBase ? `${rawBase.replace(/\/$/, '')}/api` : '/api';

// High-performance in-memory cache for instant tab navigation (0ms load)
const memoryCache = new Map();
const inFlightRequests = new Map();
const CACHE_TTL_MS = 25000; // 25 seconds cache for instant tab switching

export function clearApiCache() {
  memoryCache.clear();
  inFlightRequests.clear();
}

export async function request(endpoint, options = {}) {
  const method = (options.method || 'GET').toUpperCase();
  const isGet = method === 'GET';
  const forceFresh = options.fresh === true || (options.headers && options.headers['x-refresh'] === 'true');

  // If a mutation is called (POST/PUT/DELETE/PATCH), invalidate cache so fresh real-time data is loaded
  if (!isGet) {
    clearApiCache();
  }

  const superownerTenantId = localStorage.getItem('lt_superowner_tenant_id') || '';
  const cacheKey = `${method}:${endpoint}:${superownerTenantId}`;

  // Instant response from cache for rapid tab navigation
  if (isGet && !forceFresh) {
    const cached = memoryCache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp < CACHE_TTL_MS)) {
      return cached.data;
    }
    // Deduplicate identical simultaneous GET requests
    if (inFlightRequests.has(cacheKey)) {
      return inFlightRequests.get(cacheKey);
    }
  }

  const fetchPromise = (async () => {
    const token = localStorage.getItem('lt_token');

    const headers = {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    };

    if (superownerTenantId) {
      headers['x-tenant-id'] = superownerTenantId;
    }

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const config = {
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
          const hadToken = !!localStorage.getItem('lt_token');
          if (hadToken) {
            localStorage.removeItem('lt_token');
            localStorage.removeItem('lt_user');
            const isInvalidated = data?.message?.includes('invalidated') || data?.message?.includes('version') || data?.message?.includes('revoked');
            if (isInvalidated) {
              sessionStorage.setItem('auth_notice', 'Your session was terminated because your credentials or permissions were changed. Please sign in again.');
            }
            window.dispatchEvent(new CustomEvent('auth_expired', { detail: { message: data?.message } }));
          }
        } else if (res.status === 403 && (data?.must_change_password || data?.message?.includes('Password change required'))) {
          window.dispatchEvent(new CustomEvent('password_change_required', { detail: data }));
        }
        const error = new Error(data.message || 'Request failed');
        error.status = res.status;
        error.data = data;
        throw error;
      }

      if (isGet && data?.success) {
        memoryCache.set(cacheKey, { timestamp: Date.now(), data });
      }

      return data;
    } finally {
      inFlightRequests.delete(cacheKey);
    }
  })();

  if (isGet && !forceFresh) {
    inFlightRequests.set(cacheKey, fetchPromise);
  }

  return fetchPromise;
}

export const api = {
  get: (endpoint, options) => request(endpoint, { ...options, method: 'GET' }),
  post: (endpoint, body, options) => request(endpoint, { ...options, method: 'POST', body: JSON.stringify(body) }),
  put: (endpoint, body, options) => request(endpoint, { ...options, method: 'PUT', body: JSON.stringify(body) }),
  patch: (endpoint, body, options) => request(endpoint, { ...options, method: 'PATCH', body: JSON.stringify(body) }),
  delete: (endpoint, body, options) => request(endpoint, { ...options, method: 'DELETE', body: body ? JSON.stringify(body) : undefined }),
  clearCache: clearApiCache
};

export default api;
