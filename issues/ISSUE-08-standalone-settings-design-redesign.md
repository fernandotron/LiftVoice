# ISSUE-08: Rediseño Visual de la Configuración Replicando el Sistema de Diseño de `standalone-assistant`

## 1. Contexto y Justificación
El diseño de `AdminPanelShell.tsx` en `standalone-assistant-recovered` destaca por una calidad de interfaz y ergonomía de primer nivel:
- **Carril Lateral Estilizado (`carril.ts`)**: Selector vertical con transiciones suaves, iconos de trazo vectorial limpio (sin emojis), títulos y badges de estado semántico (`ONLINE`, `CLÍNICO`, `MASTER`).
- **Pie de Acciones con Degradado (`DegradadoPie` y `CLASE_PIE_ACCIONES`)**: Barra fija en la base con degradado suave sobre el lienzo desplazable, alojando el botón primario de guardado y secundario de cancelación.
- **Detección de Cambios Sucios y Aviso de Salida (`AvisoCambios.tsx`)**: Si el usuario modifica campos y pretende salir sin guardar, una escalera de confirmación evita pérdidas accidentales de datos.
- **Cuadrículas Ergonómicas de Formulario**: Jerarquía visual en 2 columnas en pantallas medianas/grandes, con etiquetas claras (`text-sm font-medium`), inputs de 40px (`h-10 rounded-xl`), dropdowns accesibles (`SelectDropdown`) y textos de ayuda descriptivos.

En `LiftVoice`, la configuración actual (heredada de un modal básico) puede elevarse significativamente si adopta estos mismos componentes y patrones visuales, aportando un acabado refinado tipo Apple / Reness 2026.

## 2. Alcance Técnico
1. **Componente de Carril Lateral (`AdminSidebarRail.jsx`)**:
   - Replicar la estructura de carril lateral de `standalone-assistant`:
     - Filas interactivas con iconos vectoriales Lucide.
     - Insignias (badges) contextuales por sección (ej. `$200 Crédito`, `4 Cabinas`, `0 Emojis`).
     - Resumen del motor activo ("Cadena Activa: Deepgram Nova-3 + Gemini 3.1 Flash-Lite").
2. **Pie de Acciones con Degradado Fijo (`AdminStickyFooter.jsx`)**:
   - `DegradadoPie`: Degradado transparente hacia el fondo del tema que se superpone suavemente a la zona de scroll.
   - Botón Primario:
     - Estado normal: `Guardar Preferencias`.
     - Estado guardando: `Guardando...` con spinner animado.
     - Estado guardado: `Preferencias Guardadas` con icono de verificación esmeralda (`stroke-[3]`).
     - Deshabilitado automáticamente si el formulario no está "sucio" (`!isDirty`).
   - Botón Secundario: `Cancelar / Cerrar`.
3. **Control de Cambios sin Guardar (`UnsavedChangesPrompt.jsx`)**:
   - Monitor de cambios en el estado del formulario (`isDirty`).
   - Al intentar cerrar el modal o cambiar de ruta con cambios pendientes, despliega una alerta elegante para confirmar el descarte o aplicar los cambios pendientes.
4. **Campos y Selects Personalizados (`SelectDropdown.jsx`)**:
   - Reemplazar los `<select>` nativos del navegador por dropdowns estilizados accesibles (teclas de flecha, focus ring, soporte de temas claro/oscuro y chevron animado).
5. **Tipografía y Paleta Semántica**:
   - Rejilla adaptativa de 2 columnas (`grid grid-cols-1 md:grid-cols-2 gap-6`).
   - Textos de ayuda estilizados con `text-xs text-zinc-500 dark:text-zinc-400`.
   - Separadores limpios `border-t border-zinc-200 dark:border-zinc-800`.

## 3. Criterios de Aceptación (Acceptance Criteria)
- [ ] La interfaz de configuración cuenta con un carril lateral moderno con iconos SVG consistentes y badges informativos.
- [ ] El pie de guardado permanece visible en la parte inferior con degradado sobre el área desplazable.
- [ ] El botón de guardado refleja reactivamente el estado sucio/limpio del formulario y confirma el guardado con feedback visual.
- [ ] Si se intenta salir con modificaciones no guardadas, se solicita confirmación antes de descartarlas.
- [ ] Cero emojis en los controles; uso estricto de iconos vectoriales e indicadores neutros.
- [ ] Soporte impecable y probado para modo claro (`light`) y modo oscuro (`dark`).
