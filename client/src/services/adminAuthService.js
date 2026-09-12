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
    let res;
    try {
      res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      });
    } catch (networkErr) {
      throw new Error('No se pudo conectar con el servidor backend (puerto 3001).');
    }

    if (!res.ok) {
      let msg = 'Contraseña incorrecta';
      let retryAfter = null;
      try {
        const errData = await res.json();
        if (errData.error) {
          msg = errData.error === 'Invalid password' ? 'Contraseña incorrecta' : errData.error;
        }
        if (errData.retryAfter) {
          retryAfter = Number(errData.retryAfter);
        }
      } catch (e) {
        if (res.status >= 500) {
          msg = 'Error interno del servidor backend (puerto 3001).';
        }
      }
      const errorObj = new Error(msg);
      errorObj.status = res.status;
      errorObj.retryAfter = retryAfter;
      throw errorObj;
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
