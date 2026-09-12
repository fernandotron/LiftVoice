# ISSUE-05: Arquitectura de Doble Entrada (Modal In-Studio y Página `/admin`) con `AdminSettingsShell` Unificado

## 1. Contexto y Justificación
Al analizar `standalone-assistant-recovered`, se observa un patrón arquitectónico fundamental:
- **`AdminPanelModal.tsx`**: Proyecta la configuración como un modal sobre la aplicación activa (el chat), permitiendo realizar ajustes rápidos sin recargar ni interrumpir la conversación.
- **`AdminPanelPagina.tsx`**: Proyecta el mismo panel como una página completa en `/admin`, habilitando recargas con `F5`, enlaces directos compartibles y soporte completo de accesibilidad.
- **`AdminPanelShell.tsx`**: Contiene el 100% de la lógica, pestañas, estado y diseño, evitando duplicar código entre el modal y la página.

Actualmente en `LiftVoice`, tenemos `SettingsModal.jsx` y `AdminSettingsView.jsx` como implementaciones separadas que duplican gran parte de la lógica de guardado y los formularios de configuración. Si un anfitrión está emitiendo en directo y necesita ajustar un micrófono o el volumen de una cabina, navegar a una página completa puede cortar la transmisión. Por el contrario, un administrador general necesita entrar directamente por URL (`/admin`) a pantalla completa.

## 2. Alcance Técnico
1. **Creación del Núcleo Unificado `AdminSettingsShell.jsx`**:
   - Ubicación: `client/src/components/admin/AdminSettingsShell.jsx`.
   - Propiedad `variant`: `'modal'` | `'page'`.
   - Centraliza el estado de las pestañas (STT, TTS, Modelos, Glosario, API Keys, etc.), la detección de cambios sin guardar (`isDirty`) y las llamadas a `/api/config`.
   - En modo `'modal'`, expone botón de cierre rápido `onClose` con trampa de foco.
   - En modo `'page'`, expone cabecera con botón de retorno al estudio o a la sala activa.
2. **Refactorización de `SettingsModal.jsx`**:
   - Pasa a ser un contenedor delgado (`portal` + velo de fondo) que envuelve a `<AdminSettingsShell variant="modal" />`.
3. **Refactorización de `AdminSettingsView.jsx`**:
   - Pasa a ser un anfitrión-página limpio que envuelve a `<AdminSettingsShell variant="page" />`.
4. **Sincronización Silenciosa de URL**:
   - Al igual que en `url-panel.ts` de `standalone-assistant`, cuando el modal o la página cambia de pestaña, actualiza el parámetro `?panel=<id>` vía `window.history.replaceState` sin recargar la pantalla.

## 3. Criterios de Aceptación (Acceptance Criteria)
- [ ] El Host puede abrir la configuración en plena transmisión en directo como modal sin perder el audio ni desconectar el WebSocket de la sala.
- [ ] El Administrador puede acceder directamente a `/admin` o `/admin?room=...` y visualizar el panel completo a pantalla completa.
- [ ] Toda la lógica de guardado, carga de configuración y estados reactivos reside en un único componente (`AdminSettingsShell.jsx`), eliminando duplicación de código.
- [ ] Si se pulsa `F5` estando en `/admin`, la página recarga manteniendo la pestaña activa mediante `?panel=...`.
