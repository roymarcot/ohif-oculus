# Instrucciones para validar e implementar los commits de Roymar Buelvas

## Commits a validar

1. `1b7e6c6b87` — Ignore settings vs code
   - Verificar que el archivo `.gitignore` se actualizó para ignorar configuraciones de editor/IDE relacionadas con VS Code.
   - Confirmar que no se están comprometiendo archivos de configuración locales de VS Code.

2. `7f1151c736` — Modified order buttons toolbar
   - Revisar los cambios en `modes/longitudinal/src/index.js` y `modes/longitudinal/src/toolbarButtons.js`.
   - Validar que la barra de herramientas del modo longitudinal haya sido reorganizada.
   - Confirmar la presencia de las nuevas secciones o botones: Zoom, RotateTools, MagnifyTool, StackScrollTool, MeasurementTools, Layout, MPR, MprAnd3DVolumeViewport, Capture, Crosshairs, MoreTools.
   - Verificar que la ordenación y los grupos de botones reflejen correctamente la intención del commit.

3. `b192224659` — Add text coob angle
   - Verificar la entrada de traducción en `platform/i18n/src/locales/es/Buttons.json` para el texto "Coob Angle".
   - Confirmar que la cadena española esté presente y correcta: "Ángulo de coob".

4. `7936a40771` — Remove only investigations
   - Revisar `platform/i18n/src/locales/es/Header.json`.
   - Confirmar que la etiqueta de texto de advertencia "INVESTIGATIONAL USE ONLY" haya sido eliminada o reemplazada por un valor vacío en español.

5. `abe1bd6077` — Modified show text
   - Revisar `platform/ui/src/components/AboutModal/AboutModal.tsx`.
   - Validar que se haya eliminado el bloque de enlaces importantes del modal "About".
   - Confirmar que la información de versión permanezca y que no se hayan eliminado otras secciones relevantes.

6. `14f59e0cb8` — Oculus Logo
   - Verificar que se hayan agregado los archivos de logo en `platform/viewer/public/assets/`: `oculus-logo.png` y `oculus-logo.svg`.
   - Confirmar que ambos archivos existan y estén en el formato esperado.

7. `e6af012d08` — Add Oculus Logo
   - Revisar `platform/viewer/public/config/default.js`.
   - Validar la habilitación de la configuración de whiteLabeling con la función para crear el componente del logo.
   - Confirmar que la ruta usada apunte a `./assets/oculus-logo.svg`.

## Pasos de verificación general

1. Inspeccionar el historial de Git y los archivos modificados en cada commit para asegurar que el alcance del cambio se alinea con los mensajes de commit.
2. Comprobar que no existen conflictos o modificaciones adicionales no relacionadas en los mismos archivos.
3. Ejecutar una verificación de los cambios de localización y UI mediante revisión de archivos y, si es posible, pruebas manuales ligeras.
4. Validar que los cambios de la interfaz de usuario no rompan el modo longitudinal ni el modal "About".
5. Confirmar que el logo de Oculus aparece correctamente en la configuración del visor y que los activos están en el directorio correcto.

## Recomendaciones para la implementación

- Aplicar cada cambio en secuencia según los commits listados.
- Priorizar primero la revisión del `.gitignore` y luego los cambios de UI y localización.
- Combinar la implementación de los assets del logo y la configuración correspondiente como un único conjunto lógico para evitar inconsistencias.
- Asegurarse de que no se elimine información de versión o enlaces previstos fuera del alcance de los cambios de `AboutModal`.

## Resultado esperado

- `.gitignore` excluye configuraciones de VS Code.
- La barra de herramientas del modo longitudinal está reorganizada con los nuevos botones y grupos.
- El texto de "Coob Angle" se presenta en español.
- La advertencia investigacional se removió en la traducción al español.
- El modal "About" ya no muestra el bloque de enlaces importantes eliminado.
- Los assets del logo de Oculus están presentes.
- La configuración de whiteLabeling del visor referencia el logo de Oculus.
