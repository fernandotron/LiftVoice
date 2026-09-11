/**
 * LiftVoice Dev Orchestrator
 * Spawns server and client directly via Node executable (no .cmd wrappers).
 * Immune to Windows EINVAL / CVE-2024-27980 restrictions.
 */

const { spawn } = require('child_process');
const path = require('path');
const os = require('os');

const rootDir = __dirname;
const nodeExe = process.execPath;
const serverScript = path.join(rootDir, 'server', 'src', 'index.js');
const viteScript = path.join(rootDir, 'client', 'node_modules', 'vite', 'bin', 'vite.js');
const clientDir = path.join(rootDir, 'client');

// Arguments & Environment detection
const isTunnelMode = process.argv.includes('--tunnel') || process.env.TUNNEL === '1';
const isPortless = Boolean(process.env.PORTLESS_URL || process.env.PORTLESS);
const clientPort = isPortless ? (process.env.PORT || '5174') : (process.env.CLIENT_PORT || '5174');
const serverPort = '3001';

// Get local network IPs for LAN / Mobile testing prioritizing physical Wi-Fi/Ethernet adapters
function getNetworkInterfacesList() {
  const interfaces = os.networkInterfaces();
  const candidates = [];
  for (const [name, addrs] of Object.entries(interfaces)) {
    for (const iface of addrs) {
      if (iface.family === 'IPv4' && !iface.internal) {
        const isVirtual = /vethernet|wsl|hyper-v|virtual|vbox|vmware|docker|bluetooth|tailscale|radmin|loopback/i.test(name);
        const isWifiOrEth = /wi-fi|wifi|wireless|wlan|ethernet|lan/i.test(name) && !isVirtual;
        const is192 = iface.address.startsWith('192.168.');
        const is10 = iface.address.startsWith('10.') && !iface.address.startsWith('100.');
        const isTailscale = /tailscale/i.test(name) || iface.address.startsWith('100.');
        let score = 0;
        if (isWifiOrEth) score += 100;
        if (!isVirtual) score += 50;
        if (is192) score += 30;
        if (is10) score += 20;
        candidates.push({ name, address: iface.address, isVirtual, isTailscale, score });
      }
    }
  }
  candidates.sort((a, b) => b.score - a.score);
  return candidates;
}

const networkList = getNetworkInterfacesList();
const primaryWifi = networkList.find(c => !c.isVirtual && !c.isTailscale) || networkList[0];
const tailscaleAdapter = networkList.find(c => c.isTailscale);

console.log('\x1b[36m%s\x1b[0m', '==========================================================');
console.log('\x1b[36m%s\x1b[0m', '           LIFTVOICE - SERVIDOR Y CLIENTE                 ');
console.log('\x1b[36m%s\x1b[0m', '==========================================================');

if (isPortless) {
  console.log('\x1b[35m%s\x1b[0m', `🔒 Modo Portless HTTPS     : ${process.env.PORTLESS_URL || 'https://liftvoice.localhost:1355'}`);
} else {
  console.log('\x1b[32m%s\x1b[0m', `➜ Frontend Web Local       : http://localhost:${clientPort}`);
}

console.log('\x1b[32m%s\x1b[0m', `➜ Backend API & WebSockets : http://localhost:${serverPort}`);

if (primaryWifi && primaryWifi.address) {
  console.log('\x1b[33m%s\x1b[0m', `📱 Móvil (Misma Wi-Fi)     : http://${primaryWifi.address}:${clientPort}`);
}

if (tailscaleAdapter && tailscaleAdapter.address) {
  console.log('\x1b[90m%s\x1b[0m', `🔒 VPN / Tailscale         : http://${tailscaleAdapter.address}:${clientPort}`);
}

let activeTunnel = null;

async function initTunnel() {
  try {
    const localtunnel = require(path.join(rootDir, 'server', 'node_modules', 'localtunnel'));
    console.log('\x1b[34m%s\x1b[0m', '🌐 Iniciando túnel público externo para pruebas 4G/5G...');
    activeTunnel = await localtunnel({ port: Number(clientPort) });
    console.log('\x1b[32m%s\x1b[0m', `🌐 Enlace Público Activo   : ${activeTunnel.url}`);
    console.log('\x1b[90m%s\x1b[0m', '   (Accesible desde cualquier teléfono fuera de la red local)');
    activeTunnel.on('close', () => {
      console.log('\x1b[33m%s\x1b[0m', 'Túnel público cerrado.');
      activeTunnel = null;
    });
  } catch (err) {
    console.warn('\x1b[31m%s\x1b[0m', 'No se pudo iniciar el túnel público:', err.message);
  }
}

console.log('\x1b[90m%s\x1b[0m', 'Presiona Ctrl+C para detener ambos servicios.');
console.log('\x1b[36m%s\x1b[0m', '==========================================================\n');

// 1. Launch Backend Server with fixed PORT=3001
const serverProcess = spawn(nodeExe, ['--watch', serverScript], {
  cwd: rootDir,
  stdio: 'inherit',
  env: { ...process.env, NODE_ENV: 'development', PORT: serverPort }
});

// 2. Launch Vite Client on assigned clientPort
const clientProcess = spawn(nodeExe, [viteScript, '--host', '0.0.0.0', '--port', String(clientPort)], {
  cwd: clientDir,
  stdio: 'inherit',
  env: { ...process.env, NODE_ENV: 'development', PORT: String(clientPort) }
});

if (isTunnelMode) {
  initTunnel();
}

let isShuttingDown = false;

function cleanup() {
  if (isShuttingDown) return;
  isShuttingDown = true;
  console.log('\n\x1b[33m%s\x1b[0m', 'Deteniendo servicios de LiftVoice...');
  
  if (activeTunnel) {
    try { activeTunnel.close(); } catch (e) {}
  }

  try {
    if (serverProcess && !serverProcess.killed) serverProcess.kill('SIGTERM');
  } catch (e) {}

  try {
    if (clientProcess && !clientProcess.killed) clientProcess.kill('SIGTERM');
  } catch (e) {}

  setTimeout(() => process.exit(0), 400);
}

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
process.on('SIGHUP', cleanup);

serverProcess.on('error', (err) => {
  console.error('Error en el servidor backend:', err.message);
  cleanup();
});

clientProcess.on('error', (err) => {
  console.error('Error en el cliente frontend:', err.message);
  cleanup();
});

serverProcess.on('close', (code) => {
  if (!isShuttingDown && code !== 0) {
    console.error(`Servidor detenido (código ${code})`);
  }
  cleanup();
});

clientProcess.on('close', (code) => {
  if (!isShuttingDown && code !== 0) {
    console.error(`Cliente detenido (código ${code})`);
  }
  cleanup();
});
