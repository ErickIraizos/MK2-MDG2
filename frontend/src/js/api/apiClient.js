import { store } from '../store.js';
import { Toast } from '../components/Toast.js';

class ApiClient {
  constructor(baseUrl = '/api') {
    this.baseUrl = baseUrl;
  }

  async request(endpoint, options = {}) {
    let cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    if (cleanEndpoint.startsWith('/api/')) {
      cleanEndpoint = cleanEndpoint.slice(4); // Remover /api inicial para evitar duplicación
    }
    const url = `${this.baseUrl}${cleanEndpoint}`;
    const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData;
    const headers = { ...(options.headers || {}) };
    if (!isFormData && !headers['Content-Type']) {
      headers['Content-Type'] = 'application/json';
    }

    const token = store.getState().token;
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    try {
      const response = await fetch(url, {
        ...options,
        headers
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        // Manejo automático de sesión expirada
        if (response.status === 401) {
          if (store.isAuthenticated()) {
            Toast.error('Su sesión ha expirado. Por favor, vuelva a ingresar.');
            store.clearSession();
            window.location.hash = '#/login';
          }
        }

        const errorMessage = data.error?.message || data.message || `Error HTTP ${response.status}`;
        const error = new Error(errorMessage);
        error.code = data.error?.code || 'API_ERROR';
        error.details = data.error?.details || null;
        error.status = response.status;
        throw error;
      }

      return data;
    } catch (err) {
      if (!err.status) {
        // Error de conexión / offline
        const networkError = new Error('No se pudo conectar con el servidor backend. Verifique su conexión.');
        networkError.code = 'NETWORK_ERROR';
        throw networkError;
      }
      throw err;
    }
  }

  get(endpoint, options = {}) {
    return this.request(endpoint, { ...options, method: 'GET' });
  }

  post(endpoint, body, options = {}) {
    const isFormData = typeof FormData !== 'undefined' && body instanceof FormData;
    return this.request(endpoint, {
      ...options,
      method: 'POST',
      body: isFormData ? body : (body !== undefined ? JSON.stringify(body) : undefined)
    });
  }

  put(endpoint, body, options = {}) {
    const isFormData = typeof FormData !== 'undefined' && body instanceof FormData;
    return this.request(endpoint, {
      ...options,
      method: 'PUT',
      body: isFormData ? body : (body !== undefined ? JSON.stringify(body) : undefined)
    });
  }

  patch(endpoint, body, options = {}) {
    const isFormData = typeof FormData !== 'undefined' && body instanceof FormData;
    return this.request(endpoint, {
      ...options,
      method: 'PATCH',
      body: isFormData ? body : (body !== undefined ? JSON.stringify(body) : undefined)
    });
  }

  delete(endpoint, bodyOrOptions = {}) {
    let body = undefined;
    let options = {};

    if (bodyOrOptions) {
      if (bodyOrOptions.body !== undefined) {
        body = typeof bodyOrOptions.body === 'string' ? bodyOrOptions.body : JSON.stringify(bodyOrOptions.body);
        const { body: _, ...rest } = bodyOrOptions;
        options = rest;
      } else if (bodyOrOptions.headers || bodyOrOptions.params) {
        options = bodyOrOptions;
      } else if (typeof bodyOrOptions === 'object' && Object.keys(bodyOrOptions).length > 0) {
        body = JSON.stringify(bodyOrOptions);
      }
    }

    return this.request(endpoint, {
      ...options,
      method: 'DELETE',
      ...(body ? { body } : {})
    });
  }

  upload(endpoint, formData, options = {}) {
    return this.request(endpoint, {
      ...options,
      method: 'POST',
      body: formData
    });
  }
}

export const apiClient = new ApiClient();
