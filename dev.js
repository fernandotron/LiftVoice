/**
 * LiftVoice Dev Orchestrator
 * Spawns server and client directly via Node executable (no .cmd wrappers).
 * Immune to Windows EINVAL / CVE-2024-27980 restrictions.
 */

const { spawn } = require('child_process');
const path = require('path');

const rootDir = __dirname;
const nodeExe = process.execPath;
const serverScript = path.join(rootDir, 'server', 'src', 'index.js');
const viteScript = path.join(rootDir, 'client', 'node_modules', 'vite', 'bin', 'vite.js');
const clientDir = path.join(rootDir, 'client');

console.log('\x1b[36m%s\x1b[0m', '==========================================================');
console.log('\x1b[36m%s\x1b[0m', '           LIFTVOICE - SERVIDOR Y CLIENTE                 ');
console.log('\x1b[36m%s\x1b[0m', '==========================================================');
console.log('\x1b[32m%s\x1b[0m', '➜ Backend API & WebSockets : http://localhost:3001');
console.log('\x1b[32m%s\x1b[0m', '➜ Frontend Studio Web      : http://localhost:5173');
console.log('\x1b[90m%s\x1b[0m', 'Presiona Ctrl+C para detener ambos servicios.');
console.log('\x1b[36m%s\x1b[0m', '==========================================================\n');

// 1. Launch Backend Server with auto-reload on changes
const serverProcess = spawn(nodeExe, ['--watch', serverScript], {
  cwd: rootDir,
  stdio: 'inherit',
  env: { ...process.env, NODE_ENV: 'development', PORT: '3001' }
});

// 2. Launch Vite Client
const clientProcess = spawn(nodeExe, [viteScript, '--host', '0.0.0.0', '--port', '5173'], {
  cwd: clientDir,
  stdio: 'inherit',
  env: { ...process.env, NODE_ENV: 'development' }
});

let isShuttingDown = false;

function cleanup() {
  if (isShuttingDown) return;
  isShuttingDown = true;
  console.log('\n\x1b[33m%s\x1b[0m', 'Deteniendo servicios de LiftVoice...');
  
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
