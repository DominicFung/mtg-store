import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { encodeBinaryStl, decodeBinaryStl } from '../../../packages/print-core/src/printGeometry';
import { buildLidTextMesh, splitLid } from '../../../packages/print-core/src/lidGeometry';
import { lidColourLines, type LidFinish } from '../orders/logic';

export type LidPrintFiles = {
  boxBody: Uint8Array;
  base: Uint8Array;
  spark: Uint8Array;
  text: Uint8Array | null;
  coloursText: string;
  manifest: Record<string, unknown>;
};

function asset(name: string): Buffer {
  return readFileSync(join(__dirname, 'assets', name));
}

function stamp(bytes: Uint8Array, header: string): Uint8Array {
  const copy = Uint8Array.from(bytes);
  copy.fill(0, 0, 80);
  const encoded = new TextEncoder().encode(header).subarray(0, 80);
  copy.set(encoded, 0);
  return copy;
}

export function buildLidPrint(lid: LidFinish): LidPrintFiles {
  const lidTriangles = decodeBinaryStl(new Uint8Array(asset('Lid.stl')));
  const parts = splitLid(lidTriangles, true);
  const fontBytes = asset('Oswald-Bold.ttf');
  const font = fontBytes.buffer.slice(fontBytes.byteOffset, fontBytes.byteOffset + fontBytes.byteLength);
  const textTriangles = lid.text ? buildLidTextMesh(font, lid.text) : [];
  const text = textTriangles.length > 0 ? encodeBinaryStl(textTriangles, 'Mana Ramp lid text') : null;
  const lines = [
    'Mana Ramp lid colours',
    'Import the lid files together. They share one origin, so the logo and the name sit on the plate.',
    '',
    `box-body.stl and lid-base.stl`,
    `  ${lid.boxFilamentName} (${lid.boxHex})`,
    '',
    'lid-spark.stl',
    `  ${lid.logoFilamentName} (${lid.logoHex})`,
    '',
  ];
  if (lid.text && lid.textFilamentName && text) {
    lines.push('lid-text.stl', `  ${lid.text}`, `  ${lid.textFilamentName} (${lid.textHex})`, '');
  } else {
    lines.push('No name on the lid.', '');
  }
  lines.push('The face plates are front.stl, spine.stl, and back.stl.', ...lidColourLines(lid).map((line) => line));
  return {
    boxBody: stamp(new Uint8Array(asset('edh_box.stl')), `box ${lid.boxFilamentName}`),
    base: encodeBinaryStl(parts.base, 'Mana Ramp lid base'),
    spark: encodeBinaryStl(parts.spark, 'Mana Ramp lid spark'),
    text,
    coloursText: lines.join('\n'),
    manifest: {
      box: { filamentId: lid.boxFilamentId, name: lid.boxFilamentName, hex: lid.boxHex, files: ['box-body.stl', 'lid-base.stl'] },
      logo: { filamentId: lid.logoFilamentId, name: lid.logoFilamentName, hex: lid.logoHex, file: 'lid-spark.stl' },
      text: text && lid.text ? {
        value: lid.text,
        filamentId: lid.textFilamentId,
        name: lid.textFilamentName,
        hex: lid.textHex,
        file: 'lid-text.stl',
      } : null,
    },
  };
}
