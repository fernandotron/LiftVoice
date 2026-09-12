# ISSUE-07: Control de Visibilidad Condicional en la Interfaz según Permisos del Usuario

## 1. Contexto y Justificación
En `standalone-assistant`, el usuario solo ve las opciones para las cuales se le ha otorgado permiso explícito:
- Si el usuario no tiene la feature `ADMIN_PANEL`, la opción de administración ni siquiera se muestra en el menú de usuario.
- En el editor de planes (`PlanEditor.tsx`), si el usuario carece de permiso para gestionar cuotas o acceso, el componente renderiza `<AccessDenied />` o directamente omite los controles sensibles.

En `LiftVoice`, se requiere replicar este comportamiento: al usuario se le asigna un perfil o conjunto de permisos, y con base en ellos la interfaz oculta o muestra dinámicamente cada sección. Un ponente de una sala sólo debe poder ajustar los parámetros de emisión de su propia conferencia, mientras que las claves de API maestras y los servidores de traducción deben permanecer visibles única y exclusivamente para usuarios con privilegios de superadministrador.

## 2. Alcance Técnico
1. **Hook React de Permisos (`usePermissions.js`)**:
   - Ubicación: `client/src/hooks/usePermissions.js`.
   - Lee el rol o los permisos asignados al usuario en la sesión actual:
     ```javascript
     const { hasPermission, role } = usePermissions();
     // hasPermission('API_KEYS') -> true | false
     // hasPermission('ROOM_SETTINGS') -> true | false
     // hasPermission('SERVER_METRICS') -> true | false
     ```
2. **Catálogo Granular de Permisos en LiftVoice**:
   - `PERM_ACCESS_ADMIN`: Permite abrir el panel `/admin`.
   - `PERM_ROOM_AUDIO`: Permite modificar micrófono de entrada, cabinas de idiomas y voces de la sala activa.
   - `PERM_AI_MODELS`: Permite seleccionar modelos LLM (Gemini 3.1 Flash-Lite, Qwen, GPT-4o Mini) y modo clínico.
   - `PERM_API_KEYS`: Permite ver y editar claves secretas (Deepgram, OpenAI, ElevenLabs) y variables de servidor.
   - `PERM_ROOM_MANAGEMENT`: Permite expulsar participantes, silenciar oyentes y cerrar salas.
3. **Renderizado Condicional en `AdminSettingsShell.jsx`**:
   - El carril lateral de pestañas (Tabs) filtra dinámicamente las entradas:
     - Un ponente o co-anfitrión sólo ve las pestañas de **Cabinas de Voz** y **Modo Clínico**.
     - La pestaña de **Claves de API** y **Modelos del Servidor** se oculta automáticamente a usuarios sin el permiso `PERM_API_KEYS`.
4. **Protección en Cabeceras y Menús (`DesktopHeaderMenu.jsx` y `Navbar.jsx`)**:
   - Los botones que abren la configuración o la administración se ocultan para los oyentes o usuarios no autorizados.

## 3. Criterios de Aceptación (Acceptance Criteria)
- [ ] Un usuario con rol de solo ponente (`host`) no ve la pestaña de "Claves de API" ni puede inspeccionar las credenciales maestras.
- [ ] Solo los usuarios con permiso `PERM_API_KEYS` / `admin_master` pueden ver y modificar las claves del servidor.
- [ ] En la vista de oyente (`ListenerView` o `/join`), todos los accesos a configuraciones administrativas están totalmente ausentes del DOM.
- [ ] Intentar forzar la visualización de una pestaña no permitida mediante parámetros URL (`?panel=keys`) redirige a la primera pestaña autorizada o muestra un estado de acceso denegado.
