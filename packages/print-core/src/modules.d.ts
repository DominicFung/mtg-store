declare module 'earcut' {
  export default function earcut(vertices: number[], holes?: number[], dimensions?: number): number[];
}

declare module 'opentype.js' {
  interface Glyph {
    unicode?: number;
  }
  interface Font {
    charToGlyph(character: string): Glyph;
    getPath(text: string, x: number, y: number, fontSize: number): { commands: unknown[] };
  }
  function parse(buffer: ArrayBuffer): Font;
  export default { parse };
}
