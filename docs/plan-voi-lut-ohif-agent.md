# Plan Operativo para Agente: VOI LUT Sequence en OHIF (sin tocar extension-cornerstone)

## Objetivo
Implementar soporte de VOILUTSequence (0028,3010) en OHIF para que imagenes CR/DX/MG se visualicen con contraste correcto cuando no exista WindowCenter/WindowWidth, sin modificar extension-cornerstone ni paquetes externos de Cornerstone.

## Restricciones obligatorias
- No editar nada en extensions/cornerstone/**.
- No modificar paquetes @cornerstonejs/* ni codigo externo al repo OHIF.
- Limitar cambios a platform/core y extensions/default.
- No incluir pruebas del punto 6 en este alcance.

## Alcance funcional
- Aplicar VOI LUT no lineal pixel a pixel durante carga de imagen cuando exista VOILUTSequence valida.
- Mantener comportamiento actual cuando la imagen no tenga VOILUTSequence.
- Mantener reset consistente al estado inicial post-transformacion usando metadata del image object.
- Documentar que herramientas tipo Probe mostraran valor post-transformacion.

## Entregables
1. Utilidad de parseo VOI LUT en platform/core.
2. Hook de loader para transformar IImage antes de render.
3. Registro del hook desde extension-default en preRegistration.
4. Ajuste de metadata de imagen post-transformacion (min/max y WW/WL identidad).
5. Documento de decisiones y limitaciones de v1.

## Plan paso a paso

### Paso 1. Definir politica de aplicacion VOI
- Regla v1: si hay VOILUTSequence valida, aplicar el primer item.
- Si coexisten WC/WW y VOILUTSequence, preferir VOILUTSequence por defecto.
- Limitar v1 a imagenes monocromas de modalidades CR/DX/MG para reducir riesgo.

Resultado esperado:
- Politica funcional cerrada y estable antes de escribir codigo.

### Paso 2. Implementar parser VOI LUT en platform/core
- Crear utilidad dedicada para:
  - Leer LUTDescriptor: [entries, firstMapped, bitsPerEntry].
  - Soportar entries=0 como 65536.
  - Parsear LUTData en 8 o 16 bits.
  - Soportar payload binario tipo OW (16-bit little-endian).
- Exponer estructura normalizada lista para lookup rapido.

Resultado esperado:
- Se obtiene una LUT indexable y valida con clipping definido.

### Paso 3. Implementar remapeo pixel a pixel
- Crear funcion de remapeo que reciba pixelData + LUT normalizada.
- Aplicar clipping:
  - valor < firstMapped -> primera entrada.
  - valor > ultimo valor mapeable -> ultima entrada.
- Devolver nuevo buffer tipado compatible con renderer.

Resultado esperado:
- PixelData transformado de forma deterministica, sin aproximacion lineal/sigmoide.

### Paso 4. Implementar hook de loader en platform/core
- Registrar wrapper sobre loaders DICOM usando APIs publicas.
- Flujo del wrapper:
  1) Cargar IImage original.
  2) Resolver instance metadata por imageId.
  3) Si aplica VOILUTSequence, transformar pixelData.
  4) Devolver IImage equivalente con datos transformados.
- Añadir cache por imageId/frame para evitar reprocesado.

Resultado esperado:
- Transformacion ejecutada una sola vez por imagen/frame en carga.

### Paso 5. Activar hook desde extension-default
- Invocar el registrador en extensions/default/src/init.ts dentro de preRegistration.
- Garantizar que la activacion ocurra antes del uso de viewports en modo.

Resultado esperado:
- Hook activo globalmente sin tocar extension-cornerstone.

### Paso 6. Ajustar metadata post-transformacion en IImage
- Actualizar minPixelValue y maxPixelValue al rango transformado.
- Definir windowCenter/windowWidth identidad para ese rango.
- Preservar otros campos necesarios del IImage original.

Resultado esperado:
- Estado inicial consistente tras carga y reset.

### Paso 7. Documentar decisiones y limites v1
- Registrar limites del alcance:
  - Sin selector UI de multiples VOI LUT items.
  - Sin alternador UI entre VOI LUT y WC/WW.
- Registrar impacto esperado en Probe (valor post-transformacion).

Resultado esperado:
- Comportamiento explicito para producto y soporte.

## Archivos objetivo sugeridos
- platform/core/src/classes/MetadataProvider.ts
- platform/core/src/utils/metadataProvider/fetchPaletteColorLookupTableData.js
- platform/core/src/index.ts
- extensions/default/src/init.ts
- extensions/default/src/DicomWebDataSource/utils/getImageId.js
- extensions/default/src/DicomWebDataSource/utils/getWADORSImageId.js

## Criterios de completitud (sin pruebas)
- Se aplica VOILUTSequence en carga para casos elegibles.
- No hay cambios en extension-cornerstone ni en @cornerstonejs/*.
- No se altera el flujo de imagenes sin VOILUTSequence.
- Existe documentacion de decisiones y limites de v1.
