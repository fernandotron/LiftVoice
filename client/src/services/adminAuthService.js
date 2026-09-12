export const adminAuthService = {
  getToken() {
    return localStorage.getItem('liftvoice_admin_token');
  },
  
  setToken(token) {
    localStorage.setItem('liftvoice_admin_token', token);
  },

  clearToken() {
    localStorage.removeItem('liftvoice_admin_token');
  },

  async login(password) {
    const res = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password })
    });
    if (!res.ok) {
      throw new Error('Credenciales inválidas');
    }
    const data = await res.json();
    this.setToken(data.token);
    return data;
  },

  async logout() {
    const token = this.getToken();
    if (token) {
      try {
        await fetch('/api/admin/logout', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` }
        });
      } catch (err) {
        console.error('Logout failed:', err);
      }
      this.clearToken();
    }
  },

  async verify() {
    const token = this.getToken();
    if (!token) return false;
    try {
      const res = await fetch('/api/admin/verify', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) {
        this.clearToken();
        return false;
      }
      return true;
    } catch (err) {
      this.clearToken();
      return false;
    }
  }
};
