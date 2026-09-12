# ISSUE-09: Módulo Administrativo de Gestión de Usuarios, Participantes y Salas en Vivo

## 1. Contexto y Justificación
En `standalone-assistant-recovered`, el componente `UsuariosClient.tsx` ofrece una interfaz administrativa completa para gestionar a las personas que usan la plataforma:
- Búsqueda y listado paginado de usuarios en una tabla responsiva (`TablaResponsiva.tsx`).
- Edición del perfil de usuario: cambio de Plan (lo que habilita o inhabilita permisos administrativos) y estado de la cuenta (`Activo` vs `Suspendido`).
- Feedback interactivo con notificaciones y gestión limpia de salida.

En `LiftVoice`, los usuarios se registran como oyentes con nombre/correo mediante el lobby de bienvenida ([`AttendeeLobbyView.jsx`](file:///c:/Users/Rodolfo%20Montilla/Desktop/Repositorio/LiftVoice/client/src/views/AttendeeLobbyView.jsx)) o crean salas como anfitriones. Sin embargo, el administrador no cuenta hoy con una pantalla para visualizar a todos los usuarios, promover a un usuario a ponente/administrador, expulsar o suspender cuentas problemáticas, ni monitorizar las salas que están emitiendo en directo.

## 2. Alcance Técnico
1. **Nueva Pestaña en el Panel Administrativo (`Usuarios & Salas`)**:
   - Integrada en `AdminSettingsShell.jsx`.
   - Dos subvistas conmutables:
     - **Gestión de Usuarios y Participantes**: Listado con nombre, email, rol asignado (`listener` | `host` | `admin_master`), última sala visitada y fecha de registro.
     - **Monitorización de Salas Activas**: Lista de conferencias en curso con código de sala, ponente, cantidad de oyentes en vivo y desglose por idioma (ES, EN, IT, PT).
2. **Asignación de Permisos y Roles en Vivo**:
   - Modal o drawer lateral para editar el perfil del usuario (replicando `FormularioUsuario` de `standalone-assistant`):
     - Selector de Rol: `Oyente`, `Ponente Autorizado (Host)` o `Super Administrador (Master)`.
     - Selector de Estado: `Activo` o `Bloqueado/Suspendido`.
     - Al guardar, emite `POST /api/admin/users/:id/role` actualizando los privilegios en base de datos o almacenamiento persistente.
3. **Endpoints de Administración en Backend (`server/src/index.js`)**:
   - `GET /api/admin/users`: Devuelve lista de usuarios registrados con su rol y estado.
   - `PATCH /api/admin/users/:id`: Modifica rol y estado del usuario (protegido con `requireAdminAuth`).
   - `GET /api/admin/rooms`: Devuelve todas las salas en memoria gestionadas por `roomManager.js`.
   - `DELETE /api/admin/rooms/:roomId`: Cierra forzosamente una sala activa desde el panel de control.
4. **Exportación de Reportes**:
   - Botón para exportar listado de asistentes y participantes a formato CSV (reutilizando la lógica existente de leads).

## 3. Criterios de Aceptación (Acceptance Criteria)
- [ ] La pestaña "Usuarios & Salas" aparece en el panel administrativo para usuarios con permiso `admin_master`.
- [ ] El administrador puede buscar y visualizar usuarios registrados y salas activas en tiempo real.
- [ ] El administrador puede modificar el rol de un usuario para otorgarle permisos de administración o ponente.
- [ ] Un usuario suspendido es rechazado de inmediato si intenta unirse a una conferencia o emitir audio.
- [ ] La tabla es completamente responsiva y sigue la estética minimalista de `standalone-assistant`.
