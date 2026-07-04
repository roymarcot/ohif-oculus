import toNumber from '../toNumber';

const MAX_LUT_ENTRIES = 65536;

/**
 * VOI LUT normalizada, lista para lookup O(1) por índice.
 * `data` siempre se almacena como Uint16Array (los valores de 8 bits caben sin pérdida).
 */
export interface ParsedVOILUT {
  /** Número de entradas de la LUT (LUTDescriptor[0], 0 => 65536). */
  numEntries: number;
  /** Primer valor de píxel mapeado (LUTDescriptor[1]). */
  firstMapped: number;
  /** Bits por entrada declarados (LUTDescriptor[2]). */
  bitsPerEntry: number;
  /** Valor mínimo presente en la LUT. */
  lutMin: number;
  /** Valor máximo presente en la LUT. */
  lutMax: number;
  /** Entradas de la LUT. */
  data: Uint16Array;
}

function base64ToBytes(base64: string): Uint8Array | undefined {
  try {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  } catch (e) {
    return undefined;
  }
}

function bytesToLUTData(
  bytes: Uint8Array,
  numEntries: number,
  bitsPerEntry: number
): Uint16Array | undefined {
  const data = new Uint16Array(numEntries);

  // Payload OW: cada entrada ocupa una palabra de 16 bits little-endian. También
  // cubre LUTs que declaran 8 bits pero almacenan una entrada por palabra.
  if (bitsPerEntry > 8 || bytes.byteLength >= numEntries * 2) {
    if (bytes.byteLength < numEntries * 2) {
      return undefined;
    }
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    for (let i = 0; i < numEntries; i++) {
      data[i] = view.getUint16(i * 2, true);
    }
    return data;
  }

  // Una entrada por byte.
  if (bytes.byteLength < numEntries) {
    return undefined;
  }
  for (let i = 0; i < numEntries; i++) {
    data[i] = bytes[i];
  }
  return data;
}

function normalizeLUTData(
  rawData,
  numEntries: number,
  bitsPerEntry: number
): Uint16Array | undefined {
  let raw = rawData;

  // dcmjs suele envolver valores únicos en un array: [ArrayBuffer], [base64], ...
  if (Array.isArray(raw) && raw.length === 1 && typeof raw[0] !== 'number') {
    raw = raw[0];
  }

  if (raw === undefined || raw === null) {
    return undefined;
  }

  // Metadata DICOMweb sin naturalizar: { InlineBinary } | { BulkDataURI }.
  // BulkDataURI requeriría una petición asíncrona adicional: fuera de alcance v1.
  if (
    typeof raw === 'object' &&
    !Array.isArray(raw) &&
    !ArrayBuffer.isView(raw) &&
    !(raw instanceof ArrayBuffer)
  ) {
    if (typeof (raw as { InlineBinary?: string }).InlineBinary === 'string') {
      raw = (raw as { InlineBinary: string }).InlineBinary;
    } else {
      return undefined;
    }
  }

  // Valores numéricos ya parseados (JSON US o naturalización de dcmjs).
  if (Array.isArray(raw)) {
    if (raw.length < numEntries) {
      return undefined;
    }
    const data = new Uint16Array(numEntries);
    for (let i = 0; i < numEntries; i++) {
      const value = Number(raw[i]);
      if (!Number.isFinite(value)) {
        return undefined;
      }
      // Valores US leídos erróneamente como signed: reinterpretar como unsigned.
      data[i] = value < 0 ? value + MAX_LUT_ENTRIES : value;
    }
    return data;
  }

  if (typeof raw === 'string') {
    const bytes = base64ToBytes(raw);
    return bytes && bytesToLUTData(bytes, numEntries, bitsPerEntry);
  }

  if (raw instanceof Uint16Array) {
    if (raw.length < numEntries) {
      return undefined;
    }
    return new Uint16Array(raw.buffer, raw.byteOffset, numEntries).slice();
  }

  if (raw instanceof ArrayBuffer) {
    return bytesToLUTData(new Uint8Array(raw), numEntries, bitsPerEntry);
  }

  if (ArrayBuffer.isView(raw)) {
    const view = raw as ArrayBufferView;
    return bytesToLUTData(
      new Uint8Array(view.buffer, view.byteOffset, view.byteLength),
      numEntries,
      bitsPerEntry
    );
  }

  return undefined;
}

/**
 * Parsea la VOILUTSequence (0028,3010) de una instancia naturalizada y devuelve
 * una LUT normalizada, o undefined si no existe o no es utilizable.
 *
 * Política v1: se usa únicamente el primer item de la secuencia.
 */
export default function parseVOILUTSequence(instance): ParsedVOILUT | undefined {
  const sequence = instance?.VOILUTSequence;
  const item = Array.isArray(sequence) ? sequence[0] : sequence;

  if (!item || !item.LUTDescriptor || item.LUTData === undefined || item.LUTData === null) {
    return undefined;
  }

  const descriptor = toNumber(item.LUTDescriptor);
  if (
    !Array.isArray(descriptor) ||
    descriptor.length < 3 ||
    descriptor.some(value => !Number.isFinite(value))
  ) {
    return undefined;
  }

  let [numEntries, firstMapped] = descriptor;
  const bitsPerEntry = descriptor[2];

  // 0 significa 65536 entradas; un valor negativo es un US grande leído como signed.
  if (numEntries <= 0) {
    numEntries += MAX_LUT_ENTRIES;
  }
  if (numEntries < 1 || numEntries > MAX_LUT_ENTRIES || bitsPerEntry < 1 || bitsPerEntry > 16) {
    return undefined;
  }

  // LUTDescriptor[1] se interpreta como SS cuando los píxeles almacenados son signed.
  if (toNumber(instance.PixelRepresentation) === 1 && firstMapped > 32767) {
    firstMapped -= MAX_LUT_ENTRIES;
  }

  const data = normalizeLUTData(item.LUTData, numEntries, bitsPerEntry);
  if (!data) {
    return undefined;
  }

  let lutMin = data[0];
  let lutMax = data[0];
  for (let i = 1; i < data.length; i++) {
    const value = data[i];
    if (value < lutMin) {
      lutMin = value;
    }
    if (value > lutMax) {
      lutMax = value;
    }
  }

  return { numEntries, firstMapped, bitsPerEntry, lutMin, lutMax, data };
}
