import normalizeModalityLUT from './normalizeModalityLUT';

describe('normalizeModalityLUT', () => {
  it('converts valid DICOM decimal strings to numbers', () => {
    expect(normalizeModalityLUT('-1024', '2.5')).toEqual({
      rescaleIntercept: -1024,
      rescaleSlope: 2.5,
    });
  });

  it.each([
    ['', ''],
    ['   ', '   '],
    ['not-a-number', '1'],
    ['0', '0'],
  ])('uses the identity transform for unusable values %#', (intercept, slope) => {
    expect(normalizeModalityLUT(intercept, slope)).toEqual({
      rescaleIntercept: 0,
      rescaleSlope: 1,
    });
  });

  it.each([
    [undefined, undefined],
    [null, null],
    [0, undefined],
  ])('leaves missing values to fallback metadata providers %#', (intercept, slope) => {
    expect(normalizeModalityLUT(intercept, slope)).toBeUndefined();
  });
});
