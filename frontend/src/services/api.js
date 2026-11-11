/**
 * LandAssist Core API Client
 * Configured with credentials: 'include' and automatic CSRF handling.
 */

let cachedCsrfToken = null;

export async function fetchCsrfToken() {
  try {
    const res = await fetch('/api/auth/csrf-token', { credentials: 'include' });
    if (res.ok) {
      const data = await res.json();
      cachedCsrfToken = data.csrf_token;
      return cachedCsrfToken;
    }
  } catch (err) {
    console.warn('[CSRF Fetch Error]', err);
  }
  return null;
}

export function setCsrfToken(token) {
  cachedCsrfToken = token;
}

async function apiRequest(endpoint, options = {}) {
  const headers = options.headers ? { ...options.headers } : {};

  // Attach CSRF token on mutating requests if present
  if (['POST', 'PUT', 'DELETE'].includes(options.method)) {
    if (!cachedCsrfToken) {
      await fetchCsrfToken();
    }
    if (cachedCsrfToken) {
      headers['X-CSRF-Token'] = cachedCsrfToken;
    }
  }

  // If body is an object and not FormData, stringify it
  let body = options.body;
  if (body && !(body instanceof FormData) && typeof body === 'object') {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(body);
  }

  const response = await fetch(endpoint, {
    ...options,
    headers,
    body,
    credentials: 'include',
  });

  // Handle unauthorized gracefully
  if (response.status === 401 && !endpoint.includes('/api/auth/login') && !endpoint.includes('/api/auth/me')) {
    // Session expired or unauthenticated
    throw new Error('Your session has expired. Please sign in again.');
  }

  const contentType = response.headers.get('content-type') || '';
  let data = null;
  if (contentType.includes('application/json')) {
    data = await response.json();
  }

  // Handle CSRF retry if token expired or out of sync
  if (response.status === 403 && !options._csrfRetry) {
    const errorMsg = data?.error || data?.message || '';
    if (errorMsg.toLowerCase().includes('csrf')) {
      cachedCsrfToken = null;
      const refreshedToken = await fetchCsrfToken();
      if (refreshedToken) {
        const retryHeaders = { ...headers, 'X-CSRF-Token': refreshedToken };
        let retryBody = options.body;
        if (retryBody instanceof FormData) {
          retryBody.set('csrf_token', refreshedToken);
        }
        return apiRequest(endpoint, {
          ...options,
          headers: retryHeaders,
          body: retryBody,
          _csrfRetry: true,
        });
      }
    }
  }

  if (!response.ok) {
    const errorMsg = data?.error || data?.message || `Request failed with status ${response.status}`;
    const err = new Error(errorMsg);
    err.status = response.status;
    err.data = data;
    throw err;
  }

  return data;
}

export const api = {
  // Authentication
  auth: {
    login: async (email, password) => {
      const res = await apiRequest('/api/auth/login', {
        method: 'POST',
        body: { email, password },
      });
      if (res.csrf_token) setCsrfToken(res.csrf_token);
      return res;
    },
    register: async (email, password, full_name, role) => {
      const res = await apiRequest('/api/auth/register', {
        method: 'POST',
        body: { email, password, full_name, role },
      });
      return res;
    },
    logout: async () => {
      const res = await apiRequest('/api/auth/logout', { method: 'POST' });
      cachedCsrfToken = null;
      return res;
    },
    me: async () => {
      const res = await apiRequest('/api/auth/me', { method: 'GET' });
      if (res.csrf_token) setCsrfToken(res.csrf_token);
      return res;
    },
    changePassword: async (old_password, new_password) => {
      return apiRequest('/api/auth/change-password', {
        method: 'POST',
        body: { old_password, new_password },
      });
    },
  },

  // Land Records
  records: {
    list: async (params = {}) => {
      const query = new URLSearchParams(params).toString();
      return apiRequest(`/api/records${query ? `?${query}` : ''}`, { method: 'GET' });
    },
    get: async (id) => {
      return apiRequest(`/api/records/${id}`, { method: 'GET' });
    },
    create: async (recordData) => {
      return apiRequest('/api/records', {
        method: 'POST',
        body: recordData,
      });
    },
    update: async (id, recordData) => {
      return apiRequest(`/api/records/${id}`, {
        method: 'PUT',
        body: recordData,
      });
    },
    delete: async (id) => {
      return apiRequest(`/api/records/${id}`, { method: 'DELETE' });
    },
    rerunValidation: async (id) => {
      return apiRequest(`/api/records/${id}/validate`, { method: 'POST' });
    },
    uploadOwnerPhoto: async (file) => {
      let token = cachedCsrfToken;
      if (!token) {
        token = await fetchCsrfToken();
      }
      const formData = new FormData();
      formData.append('photo', file);
      if (token) {
        formData.append('csrf_token', token);
      }
      return apiRequest('/api/records/owner-photo', {
        method: 'POST',
        body: formData,
      });
    },
  },

  // Mobile Two-Factor OTP Verification
  otp: {
    send: async (mobile) => {
      return apiRequest('/api/otp/send', {
        method: 'POST',
        body: { mobile },
      });
    },
    verify: async (mobile, otp) => {
      return apiRequest('/api/otp/verify', {
        method: 'POST',
        body: { mobile, otp },
      });
    },
    status: async (mobile) => {
      return apiRequest(`/api/otp/status?mobile=${encodeURIComponent(mobile)}`, {
        method: 'GET',
      });
    },
  },

  // Document Management & OCR
  documents: {
    list: async () => {
      return apiRequest('/api/documents', { method: 'GET' });
    },
    get: async (id) => {
      return apiRequest(`/api/documents/${id}`, { method: 'GET' });
    },
    upload: async (file) => {
      const formData = new FormData();
      formData.append('file', file);
      return apiRequest('/api/documents/upload', {
        method: 'POST',
        body: formData,
      });
    },
    verify: async (file) => {
      const formData = new FormData();
      formData.append('file', file);
      return apiRequest('/api/documents/verify', {
        method: 'POST',
        body: formData,
      });
    },
    getVerification: async (id) => {
      return apiRequest(`/api/documents/${id}/verification`, { method: 'GET' });
    },
    delete: async (id) => {
      return apiRequest(`/api/documents/${id}`, { method: 'DELETE' });
    },
    getPreviewUrl: (id) => `/api/documents/${id}/preview`,
    getDownloadUrl: (id) => `/api/documents/${id}/download`,
  },

  // Agreement Generator & Sharing
  agreements: {
    list: async () => {
      return apiRequest('/api/agreements', { method: 'GET' });
    },
    listSharedWithMe: async () => {
      return apiRequest('/api/agreements/shared-with-me', { method: 'GET' });
    },
    get: async (id) => {
      return apiRequest(`/api/agreements/${id}`, { method: 'GET' });
    },
    generate: async (payload) => {
      return apiRequest('/api/agreements/generate', {
        method: 'POST',
        body: payload,
      });
    },
    update: async (id, updatePayload) => {
      return apiRequest(`/api/agreements/${id}`, {
        method: 'PUT',
        body: updatePayload,
      });
    },
    share: async (id, email) => {
      return apiRequest(`/api/agreements/${id}/share`, {
        method: 'POST',
        body: { email },
      });
    },
    revokeShare: async (agreementId, shareId) => {
      return apiRequest(`/api/agreements/${agreementId}/shares/${shareId}/revoke`, {
        method: 'POST',
      });
    },
    addComment: async (id, comment_text, section_ref = '') => {
      return apiRequest(`/api/agreements/${id}/comments`, {
        method: 'POST',
        body: { comment_text, section_ref },
      });
    },
    getPdfUrl: (id) => `/api/agreements/${id}/pdf`,
  },

  // Dashboard Aggregates
  dashboard: {
    getStats: async () => {
      return apiRequest('/api/dashboard/stats', { method: 'GET' });
    },
  },

  // Official TN Land Records portal guide
  official: {
    getInfo: async () => {
      return apiRequest('/api/official-services/info', { method: 'GET' });
    },
  },

  // Admin Module
  admin: {
    getUsers: async () => {
      return apiRequest('/api/admin/users', { method: 'GET' });
    },
    updateUser: async (id, payload) => {
      return apiRequest(`/api/admin/users/${id}`, {
        method: 'PUT',
        body: payload,
      });
    },
    getAuditLogs: async (params = {}) => {
      const query = new URLSearchParams(params).toString();
      return apiRequest(`/api/admin/audit-logs${query ? `?${query}` : ''}`, { method: 'GET' });
    },
    getSystemStatus: async () => {
      return apiRequest('/api/admin/system-status', { method: 'GET' });
    },
  },
};
