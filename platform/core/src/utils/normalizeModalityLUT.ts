export type ModalityLUTParameters = {
  rescaleIntercept: number;
  rescaleSlope: number;
};

function toFiniteNumber(value): number | undefined {
  if (typeof value === 'string' && value.trim() === '') {
    return;
  }

  const numericValue = Number(value);

  return Number.isFinite(numericValue) ? numericValue : undefined;
}

/**
 * Normalizes the values used by the DICOM linear modality transform.
 *
 * Missing values are left undefined so another metadata provider can supply
 * them. Values that are present but unusable fall back to the identity
 * transform. In particular, an empty DICOM DS value must not become zero via
 * Number(''), because a zero slope collapses every pixel to a single value.
 */
export default function normalizeModalityLUT(
  rescaleIntercept,
  rescaleSlope
): ModalityLUTParameters | undefined {
  if (rescaleIntercept == null || rescaleSlope == null) {
    return;
  }

  const normalizedIntercept = toFiniteNumber(rescaleIntercept);
  const normalizedSlope = toFiniteNumber(rescaleSlope);

  if (normalizedIntercept === undefined || normalizedSlope === undefined || normalizedSlope === 0) {
    return {
      rescaleIntercept: 0,
      rescaleSlope: 1,
    };
  }

  return {
    rescaleIntercept: normalizedIntercept,
    rescaleSlope: normalizedSlope,
  };
}
