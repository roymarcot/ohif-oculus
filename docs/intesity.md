# Plan: Combo MIP/MinIP/AvgIP + slider de grosor de corte para la vista MPR

## Contexto

El visor OHIF (fork oculus, v3.12.5, modo `modes/basic`) no permite cambiar la proyección de intensidad en vivo: `blendMode`/`slabThickness` solo se aplican al crear el viewport vía `displaySetOptions`. Se quiere agregar a la **toolbar principal** un control —visible **solo cuando el layout MPR está activo**— con un combo (MIP / MinIP / AvgIP) y un slider al lado para el grosor de corte con etiqueta en mm (mockup del usuario: select oscuro "MIP" + slider + "0.1 mm"). Al cambiar cualquiera de los dos, se aplica a **los 3 viewports MPR a la vez** (axial, sagital, coronal). Con el slider en el mínimo el corte se ve normal (no hay opción "Ninguno"). Branch: `feature/intensity-projection`.

## Decisiones de diseño (verificadas contra el código)

- **Un solo comando** `setIntensityProjection({ blendMode?, slabThickness? })`: ambos parámetros actúan sobre los mismos viewports y comparten iteración + `render()`. Itera `viewportGridService.getState().viewports` filtrando `viewport instanceof VolumeViewport` (patrón de `setViewportColormap`, `commandsModule.ts:1299`) — cubre los 3 viewports MPR sin hardcodear ids.
- **API Cornerstone verificada** (`node_modules/@cornerstonejs/core`): `VolumeViewport.setBlendMode(blendMode)` y `setSlabThickness(value)` existen; ninguno renderiza por sí solo → llamar `viewport.render()` al final. `setSlabThickness` clampa a mínimo 0.1. Getters `getBlendMode()`/`getSlabThickness()` disponibles para re-sync.
- **Estado del control**: `useState` local con defaults (`'mip'`, 0.1) + re-sync al montar leyendo los getters del viewport activo (mapeo inverso enum→string). Si el viewport está en COMPOSITE (estado inicial de MPR, el HP no define blendMode), se mantiene el default MIP sin aplicar nada hasta que el usuario interactúe.
- **Rango del slider**: min 0.1 / max 20 / step 0.1 (mm), configurables vía props del botón. Min 0.1 = clamp de cornerstone y visualmente igual al corte normal. Max 20 mm cubre el rango clínico (5-15 mm); la diagonal del volumen (~500-700 mm) haría el slider inusable.
- **Visibilidad: ocultar fuera de MPR** (no solo deshabilitar). Los evaluators soportan `visible: false` (`ToolbarService.ts:323-334`; `useToolbar.tsx:219-222` filtra `props.visible !== false`). Condición: `hangingProtocolService.getState().protocolId === 'mpr'` (verificado en `HangingProtocolService.ts:205-210`; **envolver en try/catch o validar `getState()`** porque lee `this.protocol.id` sin guard). `useToolbar` ya se re-evalúa en ACTIVE_VIEWPORT_ID_CHANGED / VIEWPORTS_READY / LAYOUT_CHANGED — sin suscripciones nuevas.
- **Persistencia**: al salir/volver de MPR se resetea a defaults (MIP + 0.1). Es consistente: los viewports recreados vuelven a COMPOSITE, que se ve igual que MIP con slab mínimo. Sin re-aplicación ni suscripción a PROTOCOL_CHANGED.
- **Riesgo Crosshairs**: sus handles de slab pueden desincronizar el valor mostrado. Mitigación: el comando siempre envía blendMode + slabThickness juntos, así cualquier interacción con el control re-homogeneiza los 3 viewports (self-healing). Ajustar config de Crosshairs solo si QA lo reporta.

## Pasos de implementación

### 1. Comando `setIntensityProjection`
**`extensions/cornerstone/src/commandsModule.ts`** — en `actions` (junto a `setViewportOrientation`, ~línea 2082):

```ts
setIntensityProjection: ({ blendMode, slabThickness }: { blendMode?: string; slabThickness?: number }) => {
  const { viewports } = viewportGridService.getState();
  viewports.forEach((_gridViewport, viewportId) => {
    const viewport = cornerstoneViewportService.getCornerstoneViewport(viewportId);
    if (!viewport || !(viewport instanceof VolumeViewport)) return;
    if (blendMode !== undefined) viewport.setBlendMode(getCornerstoneBlendMode(blendMode));
    if (slabThickness !== undefined) viewport.setSlabThickness(slabThickness);
    viewport.render();
  });
},
```

`VolumeViewport` ya está importado; importar `getCornerstoneBlendMode` desde `./utils/getCornerstoneBlendMode` (mapea 'mip'/'minip'/'avg' → enums, ya existe). Registrar en `definitions` (~línea 2582): `setIntensityProjection: { commandFn: actions.setIntensityProjection }`.

### 2. Componente React (nuevo)
**Crear `extensions/cornerstone/src/components/IntensityProjectionControls/IntensityProjectionControls.tsx`** + `index.ts`. Inline en la toolbar (sin popover, según mockup): `Select` + `Slider` de `@ohif/ui-next` + `<span>{value.toFixed(1)} mm</span>`.

- Usa `useSystem()` (patrón de `ThresholdMenuWrapper`) para `commandsManager`/`servicesManager`.
- `useEffect` con `[viewportId]`: re-sync desde `viewport.getBlendMode()`/`getSlabThickness()` si el viewport activo es orthographic (mapeo inverso enum→'mip'|'minip'|'avg'; COMPOSITE ⇒ mantener default).
- Handlers: al cambiar combo o slider, `setState` + `commandsManager.run('setIntensityProjection', { blendMode, slabThickness })` **siempre con ambos valores** (self-healing frente a Crosshairs).
- Props `minThickness=0.1, maxThickness=20, stepThickness=0.1` recibidas del botón.
- Slider radix: `value={[slabThickness]}`, `onValueChange={([v]) => ...}`. Select: `SelectTrigger` ancho ~w-24, items MIP/MinIP/AvgIP (siglas, sin i18n).

### 3. Registro en el toolbar module
**`extensions/cornerstone/src/getToolbarModule.tsx`** — agregar `hangingProtocolService` al destructuring de services (hoy no está) y dos entradas (junto a `thresholdMenu`, ~línea 249):

```ts
{ name: 'ohif.intensityProjection', defaultComponent: IntensityProjectionControls },
{
  name: 'evaluate.intensityProjection',
  evaluate: () => {
    let isMPR = false;
    try { isMPR = hangingProtocolService.getState()?.protocolId === 'mpr'; } catch {}
    return isMPR ? { disabled: false } : { disabled: true, visible: false };
  },
},
```

### 4. Botón y sección en el modo basic
**`modes/basic/src/toolbarButtons.ts`** — nuevo botón (junto a `Crosshairs` ~línea 679, estilo de la personalización oculus `PlanarRotate`:210-226):

```ts
{
  id: 'IntensityProjection',
  uiType: 'ohif.intensityProjection',
  props: {
    label: i18n.t('Buttons:Intensity Projection'),
    minThickness: 0.1, maxThickness: 20, stepThickness: 0.1,
    evaluate: 'evaluate.intensityProjection',
  },
},
```

**`modes/basic/src/index.tsx`** — en `toolbarSections` sección primary (líneas 212-222), insertar `'IntensityProjection'` después de `'Crosshairs'` (línea 220).

### 5. Traducciones
- `platform/i18n/src/locales/en-US/Buttons.json`: `"Intensity Projection": "Intensity Projection"`, `"Slab Thickness": "Slab Thickness"`.
- `platform/i18n/src/locales/es/Buttons.json`: `"Intensity Projection": "Proyección de intensidad"`, `"Slab Thickness": "Grosor de corte"`.

## Desafíos anticipados
- **Ancho en toolbar primaria** (~230 px): si desborda en pantallas pequeñas, fallback = envolver en Popover (patrón `ThresholdMenuWrapper`). Empezar inline como pide el mockup.
- **Radix Select en la toolbar**: usa portal por defecto, no debería recortarse por overflow; verificar visualmente.
- **`viewport.type`**: comparar contra `'orthographic'` (string, como `evaluate.thresholdMenu`:312) siendo consistente con el código circundante.

## Verificación end-to-end
1. `yarn dev` (levanta http://localhost:3000; el puerto ya quedó libre).
2. Abrir estudio CT reconstruible → en layout stack el control **no** aparece.
3. LayoutSelector → MPR: aparecen los 3 viewports y el control (combo "MIP" + slider + "0.1 mm").
4. Slider a ~10 mm: los 3 viewports muestran MIP simultáneamente; etiqueta "10.0 mm".
5. Combo a MinIP y AvgIP: cambio visual coherente en los 3 manteniendo el slab.
6. Slider al mínimo: la imagen vuelve al corte normal.
7. Crosshairs activo + navegación → sin errores; mover el slider re-sincroniza los 3 viewports.
8. Volver a 1x1: el control desaparece; volver a MPR: reaparece con defaults (comportamiento documentado).
9. Idioma español: labels traducidos. Regresión rápida: W/L, zoom, scroll, mediciones.

## Archivos críticos
- `extensions/cornerstone/src/commandsModule.ts` (modificar)
- `extensions/cornerstone/src/components/IntensityProjectionControls/IntensityProjectionControls.tsx` (+`index.ts`, nuevos)
- `extensions/cornerstone/src/getToolbarModule.tsx` (modificar)
- `modes/basic/src/toolbarButtons.ts` y `modes/basic/src/index.tsx` (modificar)
- `platform/i18n/src/locales/{en-US,es}/Buttons.json` (modificar)
