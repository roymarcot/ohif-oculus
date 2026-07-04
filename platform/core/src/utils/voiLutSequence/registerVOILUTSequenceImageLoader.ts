import { registerImageLoader, utilities as csUtils } from '@cornerstonejs/core';
import dicomImageLoader from '@cornerstonejs/dicom-image-loader';

import parseVOILUTSequence from './parseVOILUTSequence';
import type { ParsedVOILUT } from './parseVOILUTSequence';
import applyVOILUTToPixelData from './applyVOILUTToPixelData';

/**
 * Política v1: solo imágenes monocromas de estas modalidades son elegibles,
 * para reducir el riesgo del cambio de pipeline de píxeles.
 */
const ELIGIBLE_MODALITIES = ['CR', 'DX', 'MG'];

/**
 * Resolutor de metadata por imageId (clases.MetadataProvider de @ohif/core).
 * Se inyecta para evitar un ciclo de imports utils -> classes -> utils.
 */
export interface InstanceMetadataProvider {
  getInstance(imageId: string): Record<string, unknown> | undefined;
}

type ImageLoadObject = {
  promise: Promise<Record<string, any>>;
  cancelFn?: () => void;
  decache?: () => void;
};

type DicomImageLoaderFn = (imageId: string, options?: unknown) => ImageLoadObject;

// Cache de LUT parseada por instancia (evita reprocesar el parseo cuando varios
// imageIds/frames comparten la misma instancia o cuando la cache de imágenes
// de Cornerstone expulsa y recarga una imagen).
const parsedLUTCache = new WeakMap<object, ParsedVOILUT | null>();

function getParsedVOILUT(instance: object): ParsedVOILUT | null {
  if (parsedLUTCache.has(instance)) {
    return parsedLUTCache.get(instance);
  }
  const parsed = parseVOILUTSequence(instance) ?? null;
  parsedLUTCache.set(instance, parsed);
  return parsed;
}

function isEligibleInstance(instance): boolean {
  if (!instance?.VOILUTSequence) {
    return false;
  }

  if (!ELIGIBLE_MODALITIES.includes(instance.Modality)) {
    return false;
  }

  const photometric = instance.PhotometricInterpretation;
  if (typeof photometric !== 'string' || !photometric.startsWith('MONOCHROME')) {
    return false;
  }

  const samplesPerPixel = Number(instance.SamplesPerPixel ?? 1);
  return samplesPerPixel === 1;
}

/**
 * Aplica la VOILUTSequence sobre un IImage recién cargado, si la instancia es
 * elegible. Devuelve la misma imagen (mutada) para mantener el resto de campos.
 *
 * Ajustes post-transformación (estado inicial y reset consistentes):
 * - pixelData/voxelManager con el buffer remapeado.
 * - min/maxPixelValue al rango transformado.
 * - windowCenter/windowWidth identidad sobre ese rango (VOI lineal).
 * - slope/intercept identidad: la Modality LUT ya quedó incorporada al remapeo.
 */
export function applyVOILUTSequenceToImage(
  image,
  imageId: string,
  metadataProvider: InstanceMetadataProvider
) {
  try {
    if (!image || image.color) {
      return image;
    }

    const instance = metadataProvider.getInstance(imageId);
    if (!instance || !isEligibleInstance(instance)) {
      return image;
    }

    const voiLut = getParsedVOILUT(instance);
    if (!voiLut) {
      return image;
    }

    const scalarData = image.voxelManager?.getScalarData?.() ?? image.getPixelData();
    if (!scalarData?.length) {
      return image;
    }

    // Si el loader ya reescaló los píxeles (preScale), la Modality LUT ya está
    // aplicada y la LUT se indexa directamente con el valor almacenado.
    const alreadyScaled = Boolean(image.preScale?.scaled);
    const slope = alreadyScaled ? 1 : (image.slope ?? 1);
    const intercept = alreadyScaled ? 0 : (image.intercept ?? 0);

    const { pixelData, minPixelValue, maxPixelValue } = applyVOILUTToPixelData(
      scalarData,
      voiLut,
      slope,
      intercept
    );

    const voxelManager = csUtils.VoxelManager.createImageVoxelManager({
      scalarData: pixelData,
      width: image.width,
      height: image.height,
      numberOfComponents: 1,
    });

    image.voxelManager = voxelManager;
    image.getPixelData = () => pixelData;
    image.dataType = pixelData.constructor.name;
    image.sizeInBytes = pixelData.byteLength;

    if (image.imageFrame) {
      image.imageFrame.pixelData = pixelData;
      image.imageFrame.pixelDataLength = pixelData.length;
      image.imageFrame.smallestPixelValue = minPixelValue;
      image.imageFrame.largestPixelValue = maxPixelValue;
    }

    image.minPixelValue = minPixelValue;
    image.maxPixelValue = maxPixelValue;
    image.slope = 1;
    image.intercept = 0;
    if (image.preScale) {
      image.preScale = { ...image.preScale, scaled: false };
    }

    // VOI identidad sobre el rango de salida de la LUT (PS3.3 C.11.2.1.2):
    // lower = c - 0.5 - (w-1)/2 = min ; upper = c - 0.5 + (w-1)/2 = max.
    image.windowWidth = Math.max(maxPixelValue - minPixelValue + 1, 1);
    image.windowCenter = (minPixelValue + maxPixelValue + 1) / 2;
    image.voiLUTFunction = 'LINEAR';

    return image;
  } catch (error) {
    console.warn(`VOILUTSequence: fallo aplicando la LUT para ${imageId}`, error);
    return image;
  }
}

function wrapLoader(
  baseLoadImage: DicomImageLoaderFn,
  metadataProvider: InstanceMetadataProvider
): DicomImageLoaderFn {
  return function voiLutSequenceLoader(imageId, options) {
    const imageLoadObject = baseLoadImage(imageId, options);
    return {
      ...imageLoadObject,
      promise: imageLoadObject.promise.then(image =>
        applyVOILUTSequenceToImage(image, imageId, metadataProvider)
      ),
    };
  };
}

let registered = false;

/**
 * Envuelve los loaders DICOM de @cornerstonejs/dicom-image-loader para aplicar
 * VOILUTSequence pixel a pixel en carga, sin tocar extension-cornerstone.
 *
 * Debe invocarse DESPUÉS de dicomImageLoader.init() (que registra los esquemas
 * originales); de lo contrario ese init sobrescribiría estos wrappers. En OHIF
 * eso significa después del preRegistration de extension-cornerstone, p. ej.
 * en el onModeEnter de una extensión.
 */
export default function registerVOILUTSequenceImageLoader(
  metadataProvider: InstanceMetadataProvider
): void {
  if (registered) {
    return;
  }
  registered = true;

  const { wadors, wadouri } = dicomImageLoader;

  registerImageLoader('wadors', wrapLoader(wadors.loadImage as DicomImageLoaderFn, metadataProvider) as any);

  const wadouriLoader = wrapLoader(wadouri.loadImage as DicomImageLoaderFn, metadataProvider);
  registerImageLoader('wadouri', wadouriLoader as any);
  registerImageLoader('dicomweb', wadouriLoader as any);
  registerImageLoader('dicomfile', wadouriLoader as any);
}
