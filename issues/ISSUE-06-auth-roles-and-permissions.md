# ISSUE-06: Sistema de Autenticación, Roles y Permisos de Administrador (`requireAdminAuth`)

## 1. Contexto y Justificación
En `standalone-assistant`, el acceso a la administración no está abierto a cualquier usuario:
- Se evalúa `hasAdminAccess(userId)` basándose en el plan y los permisos del usuario (`code === 'MASTER'`).
- El guardián central `exigirAdminServidor.ts` intercepta la entrada a la ruta `/admin` y redirige al login si la sesión falta, está revocada o carece de permisos.
- Las acciones del servidor invocan `exigirAdminAccion()` para impedir que peticiones no autorizadas modifiquen variables del sistema.

En `LiftVoice`, la aplicación opera actualmente sin un sistema de autorización para la configuración global (`/api/config` guarda cambios sin validar si quien los envía es un oyente curioso o el administrador legítimo). Es indispensable incorporar un control de acceso por roles y credenciales para blindar los motores de IA y las claves de API (OpenAI, Deepgram, ElevenLabs).

## 2. Alcance Técnico
1. **Definición de Roles y Jerarquía**:
   - **`listener` (Oyente)**: Acceso únicamente a sintonizar salas (`/join`). No puede acceder a `/admin` ni crear salas.
   - **`host` (Ponente / Anfitrión de Sala)**: Acceso a emitir en su sala (`/host?room=...`). Puede configurar dispositivos de entrada y voces de su sala, pero no las claves de API globales del servidor.
   - **`admin_master` (Super Administrador)**: Acceso total al panel administrativo (`/admin`), gestión de claves de API, selección de modelos de IA del servidor y monitorización de todas las salas.
2. **Autenticación Administrativa en Backend (`server/src/`)**:
   - Variable de entorno `ADMIN_SECRET_KEY` o `ADMIN_PASSWORD` en `server/.env`.
   - Nuevo endpoint de autenticación:
     - `POST /api/admin/login`: Recibe credencial administrativa y emite un token JWT firmado de corta duración o cookie segura `HttpOnly`.
     - `POST /api/admin/logout`: Revoca la sesión administrativa.
     - `GET /api/admin/verify`: Comprueba el estado de la sesión activa y devuelve los permisos (`permissions: ['ADMIN_PANEL', 'API_KEYS', 'MANAGE_ROOMS']`).
3. **Middleware de Protección en Express (`server/src/index.js`)**:
   - Middleware `requireAdminAuth`: Intercepta `POST /api/config`, `/api/tunnel/*` y rutas administrativas devolviendo HTTP 401/403 si el cliente no aporta un token válido de `admin_master`.
4. **Pantalla de Desbloqueo / Login de Administrador en Frontend**:
   - Si un usuario navega a `/admin` sin sesión administrativa activa, se le presenta un formulario de acceso seguro (estilo Reness / Apple) para ingresar la clave o credencial maestra antes de renderizar el panel.

## 3. Criterios de Aceptación (Acceptance Criteria)
- [ ] Peticiones a `POST /api/config` sin cabecera de autorización o token válido son rechazadas con HTTP 401 Unauthorized.
- [ ] La ruta `/admin` exige autenticación previa; usuarios no autenticados ven la pantalla de inicio de sesión administrativo en lugar de las opciones del servidor.
- [ ] Al iniciar sesión correctamente con la credencial de administrador, se desbloquea el panel completo y se almacena la sesión de forma segura.
- [ ] El oyente no puede acceder a las configuraciones del servidor ni simulando peticiones a la API.
