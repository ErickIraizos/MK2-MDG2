function isJwtExpired(token) {
  if (!token || typeof token !== 'string') return true;
  const parts = token.split('.');
  if (parts.length !== 3) return true;
  try {
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');
    const jsonStr = typeof atob === 'function'
      ? atob(padded)
      : Buffer.from(padded, 'base64').toString('utf8');
    const payload = JSON.parse(jsonStr);
    if (!payload || typeof payload.exp !== 'number') return false;
    return payload.exp * 1000 <= Date.now();
  } catch {
    return true;
  }
}

class Store {
  constructor() {
    const initialToken = localStorage.getItem('psi_token') || null;
    let initialUser = null;
    try {
      initialUser = JSON.parse(localStorage.getItem('psi_user') || 'null');
    } catch {
      initialUser = null;
    }
    const validSession = !!initialToken && !!initialUser && !isJwtExpired(initialToken);
    if (!validSession && (initialToken || initialUser)) {
      localStorage.removeItem('psi_token');
      localStorage.removeItem('psi_user');
    }
    this.state = {
      token: validSession ? initialToken : null,
      user: validSession ? initialUser : null,
      publicConfig: null,
      sidebarOpen: false
    };
    this.listeners = [];
  }

  getState() {
    return this.state;
  }

  isAuthenticated() {
    if (!this.state.token || !this.state.user) return false;
    if (isJwtExpired(this.state.token)) {
      this.state.token = null;
      this.state.user = null;
      localStorage.removeItem('psi_token');
      localStorage.removeItem('psi_user');
      return false;
    }
    return true;
  }

  syncFromStorage() {
    const token = localStorage.getItem('psi_token') || null;
    let user = null;
    try {
      user = JSON.parse(localStorage.getItem('psi_user') || 'null');
    } catch {
      user = null;
    }
    const valid = !!token && !!user && !isJwtExpired(token);
    if (!valid && (token || user)) {
      localStorage.removeItem('psi_token');
      localStorage.removeItem('psi_user');
    }
    this.state.token = valid ? token : null;
    this.state.user = valid ? user : null;
    this.notify();
  }

  getUserRole() {
    return this.state.user ? this.state.user.rol : null;
  }

  setSession(token, user) {
    this.state.token = token;
    this.state.user = user;
    if (token) {
      localStorage.setItem('psi_token', token);
      localStorage.setItem('psi_user', JSON.stringify(user));
    } else {
      localStorage.removeItem('psi_token');
      localStorage.removeItem('psi_user');
    }
    this.notify();
  }

  setUser(user) {
    this.state.user = user ? { ...(this.state.user || {}), ...user } : null;
    if (this.state.user) {
      localStorage.setItem('psi_user', JSON.stringify(this.state.user));
    } else {
      localStorage.removeItem('psi_user');
    }
    this.notify();
  }

  clearSession() {
    this.setSession(null, null);
  }

  setPublicConfig(config) {
    this.state.publicConfig = config;
    this.notify();
  }

  toggleSidebar(forceState = null) {
    this.state.sidebarOpen = forceState !== null ? forceState : !this.state.sidebarOpen;
    this.notify();
  }

  subscribe(listener) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  notify() {
    for (const listener of this.listeners) {
      listener(this.state);
    }
  }
}

export const store = new Store();
