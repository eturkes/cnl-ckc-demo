declare module 'subset-font' {
  const subsetFont: (
    font: Uint8Array,
    text: string,
    options?: { targetFormat?: 'sfnt' | 'truetype' | 'woff' | 'woff2' },
  ) => Promise<Buffer>;
  export default subsetFont;
}

declare module 'fontverter' {
  const fontverter: {
    convert: (font: Uint8Array, to: 'sfnt' | 'truetype' | 'woff' | 'woff2') => Promise<Buffer>;
  };
  export default fontverter;
}
