import { strict as assert } from 'assert';
import roomManager from './src/roomManager.js';

console.log('🧪 Iniciando Test Suite: Modo Dual de Preguntas (Q&A)...');

const testRoomId = 'test-dual-qa-room';
const hostKey = 'test-host-secret-key-123';

// 1. Creación de sala con modo por defecto
console.log('Test 1: Verificación de configuración inicial en sala nueva...');
const room = roomManager.createRoom(testRoomId, 'Sala Dual QA Test', hostKey);
assert(room, 'La sala debe crearse correctamente');
assert.equal(room.config.qaMode, 'host_controlled', 'Por defecto, qaMode debe ser "host_controlled"');
assert.equal(room.config.qaEnabled, false, 'Por defecto, qaEnabled debe ser false');
assert.equal(roomManager.isQAAllowed(room), false, 'isQAAllowed debe ser false por defecto en modo host_controlled con switch apagado');

// 2. Oyente intenta preguntar con switch apagado -> DEBE BLOQUEAR
console.log('Test 2: Bloqueo de preguntas en modo host_controlled con switch apagado...');
const socket1 = 'socket_attendee_1';
const profile1 = { attendeeId: 'att_1', name: 'Dr. García', questionText: '¿Cuál es la dosis recomendada?' };
const item1 = roomManager.addHandRaise(testRoomId, socket1, profile1);
assert.equal(item1, null, 'addHandRaise debe retornar null cuando las preguntas están bloqueadas');
assert.equal(room.qaQueue.length, 0, 'La cola de preguntas debe estar vacía');

// 3. Ponente activa el switch de preguntas en modo host_controlled
console.log('Test 3: El ponente activa el switch de preguntas...');
const toggleRes = roomManager.setQAEnabled(testRoomId, true);
assert.equal(toggleRes, true);
assert.equal(roomManager.isQAAllowed(testRoomId), true, 'isQAAllowed debe ser true tras encender el switch');

const item1Retry = roomManager.addHandRaise(testRoomId, socket1, profile1);
assert(item1Retry, 'Ahora que el ponente activó el switch, la pregunta debe ser admitida');
assert.equal(room.qaQueue.length, 1, 'La cola ahora debe tener 1 pregunta');

// 4. Conmutar a modo 'always' (Preguntar en cualquier momento)
console.log('Test 4: Conmutación a modo "always" (Preguntar en cualquier momento)...');
const configRes = roomManager.setQAMode(testRoomId, 'always');
assert.equal(configRes.qaMode, 'always');
assert.equal(configRes.isQAAllowed, true, 'isQAAllowed debe ser true en modo always');

// 5. En modo always, incluso si qaEnabled fuera false, las preguntas siempre están permitidas
console.log('Test 5: En modo always las preguntas siempre están permitidas...');
room.config.qaEnabled = false;
assert.equal(roomManager.isQAAllowed(testRoomId), true, 'isQAAllowed debe ser true en modo always aun con qaEnabled false');

const socket2 = 'socket_attendee_2';
const profile2 = { attendeeId: 'att_2', name: 'Dra. López', questionText: '¿Cuándo empieza la ronda?' };
const item2 = roomManager.addHandRaise(testRoomId, socket2, profile2);
assert(item2, 'En modo always la pregunta es aceptada inmediatamente');
assert.equal(room.qaQueue.length, 2, 'La cola ahora debe tener 2 preguntas');

// 6. Volver a modo host_controlled con switch apagado
console.log('Test 6: Volver a host_controlled bloquea nuevamente si el switch está apagado...');
roomManager.setQAMode(testRoomId, 'host_controlled');
assert.equal(roomManager.isQAAllowed(testRoomId), false);
const socket3 = 'socket_attendee_3';
const item3 = roomManager.addHandRaise(testRoomId, socket3, { name: 'Oyente 3', questionText: 'Bloqueada' });
assert.equal(item3, null, 'Nuevas preguntas deben volver a ser rechazadas');

// 7. Verificación de telemetría y stats expuestos
console.log('Test 7: Verificación de telemetría getPublicStats y getHostStats...');
const publicStats = roomManager.getPublicStats(testRoomId);
assert.equal(publicStats.qaMode, 'host_controlled');
assert.equal(publicStats.isQAAllowed, false);

roomManager.setQAMode(testRoomId, 'always');
const publicStatsAlways = roomManager.getPublicStats(testRoomId);
assert.equal(publicStatsAlways.qaMode, 'always');
assert.equal(publicStatsAlways.isQAAllowed, true);

const hostStats = roomManager.getHostStats(testRoomId);
assert.equal(hostStats.qaMode, 'always');
assert.equal(hostStats.isQAAllowed, true);
assert.equal(hostStats.qaQueue.length, 2);

console.log('🎉 TODOS LOS TESTS DE MODO DUAL DE PREGUNTAS PASARON SATISFACTORIAMENTE (100% OK)');
