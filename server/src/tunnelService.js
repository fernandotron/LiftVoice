import localtunnel from 'localtunnel';

class TunnelService {
  constructor() {
    this.tunnel = null;
    this.publicUrl = null;
    this.isStarting = false;
  }

  async startTunnel(port = 5174) {
    if (this.tunnel && this.publicUrl) {
      return this.publicUrl;
    }

    if (this.isStarting) {
      return null;
    }

    this.isStarting = true;
    try {
      console.log(`[TunnelService] Starting public HTTPS tunnel on port ${port}...`);
      this.tunnel = await localtunnel({ port });
      this.publicUrl = this.tunnel.url;
      console.log(`[TunnelService] 🌐 Public Tunnel URL ready for 4G/5G Mobile Data: ${this.publicUrl}`);

      this.tunnel.on('close', () => {
        console.log('[TunnelService] Public tunnel closed.');
        this.tunnel = null;
        this.publicUrl = null;
      });

      this.isStarting = false;
      return this.publicUrl;
    } catch (err) {
      console.warn('[TunnelService] Could not initialize localtunnel:', err.message);
      this.isStarting = false;
      return null;
    }
  }

  async closeTunnel() {
    if (this.tunnel) {
      await this.tunnel.close();
      this.tunnel = null;
      this.publicUrl = null;
    }
  }

  getPublicUrl() {
    return this.publicUrl;
  }
}

export const tunnelService = new TunnelService();
