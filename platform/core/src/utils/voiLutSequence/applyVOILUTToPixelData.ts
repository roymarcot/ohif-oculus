import type { ParsedVOILUT } from './parseVOILUTSequence';

export interface VOILUTTransformResult {
  pixelData: Uint8Array | Uint16Array;
  minPixelValue: number;
  maxPixelValue: number;
}

/**
 * Remapea pixelData a través de una VOI LUT no lineal, valor a valor.
 *
 * La entrada de la VOI LUT es la salida de la Modality LUT, por lo que si los
 * datos aún no están reescalados se aplica slope/intercept antes de indexar.
 * Clipping según PS3.3 C.11.2: valores por debajo de firstMapped toman la
 * primera entrada y valores por encima del último valor mapeable la última.
 */
export default function applyVOILUTToPixelData(
  pixelData: ArrayLike<number>,
  voiLut: ParsedVOILUT,
  slope = 1,
  intercept = 0
): VOILUTTransformResult {
  const { data, firstMapped, numEntries, lutMax } = voiLut;
  const lastIndex = numEntries - 1;
  const length = pixelData.length;
  const hasModalityLUT = slope !== 1 || intercept !== 0;

  const output = lutMax <= 255 ? new Uint8Array(length) : new Uint16Array(length);

  let min = Infinity;
  let max = -Infinity;

  for (let i = 0; i < length; i++) {
    let value = pixelData[i];
    if (hasModalityLUT) {
      value = value * slope + intercept;
    }

    let index = Math.round(value) - firstMapped;
    if (index < 0) {
      index = 0;
    } else if (index > lastIndex) {
      index = lastIndex;
    }

    const mapped = data[index];
    output[i] = mapped;
    if (mapped < min) {
      min = mapped;
    }
    if (mapped > max) {
      max = mapped;
    }
  }

  if (length === 0) {
    min = 0;
    max = 0;
  }

  return { pixelData: output, minPixelValue: min, maxPixelValue: max };
}
