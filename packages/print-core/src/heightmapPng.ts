import { inflateSync } from 'node:zlib';

function paeth(left: number, up: number, upLeft: number): number {
  const estimate = left + up - upLeft;
  const leftDistance = Math.abs(estimate - left);
  const upDistance = Math.abs(estimate - up);
  const diagonal = Math.abs(estimate - upLeft);
  if (leftDistance <= upDistance && leftDistance <= diagonal) return left;
  if (upDistance <= diagonal) return up;
  return upLeft;
}

/** 16-bit grayscale PNG. Values are big-endian samples, one per pixel. */
export function readGray16Png(bytes: Uint8Array): { width: number; height: number; values: Uint16Array } {
  if (bytes.length < 8 || bytes[0] !== 0x89 || bytes[1] !== 0x50) throw new Error('Not a PNG');
  let offset = 8;
  let width = 0;
  let height = 0;
  let depth = 0;
  let color = 0;
  const parts: Buffer[] = [];
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  while (offset + 8 <= bytes.byteLength) {
    const length = view.getUint32(offset);
    const type = String.fromCharCode(bytes[offset + 4], bytes[offset + 5], bytes[offset + 6], bytes[offset + 7]);
    const start = offset + 8;
    const data = bytes.subarray(start, start + length);
    if (type === 'IHDR') {
      width = view.getUint32(start);
      height = view.getUint32(start + 4);
      depth = bytes[start + 8];
      color = bytes[start + 9];
    } else if (type === 'IDAT') {
      parts.push(Buffer.from(data));
    } else if (type === 'IEND') {
      break;
    }
    offset = start + length + 4;
  }
  if (depth !== 16 || color !== 0) throw new Error('Heightmap PNG must be 16-bit grayscale');
  const inflated = inflateSync(Buffer.concat(parts));
  const stride = width * 2;
  const values = new Uint16Array(width * height);
  let previous = new Uint8Array(stride);
  let cursor = 0;
  for (let y = 0; y < height; y += 1) {
    const filter = inflated[cursor];
    cursor += 1;
    const row = Uint8Array.from(inflated.subarray(cursor, cursor + stride));
    cursor += stride;
    for (let index = 0; index < stride; index += 1) {
      const left = index >= 2 ? row[index - 2] : 0;
      const up = previous[index];
      const upLeft = index >= 2 ? previous[index - 2] : 0;
      let value = row[index];
      if (filter === 1) value += left;
      else if (filter === 2) value += up;
      else if (filter === 3) value += Math.floor((left + up) / 2);
      else if (filter === 4) value += paeth(left, up, upLeft);
      row[index] = value & 255;
    }
    previous = row;
    for (let x = 0; x < width; x += 1) {
      values[y * width + x] = (row[x * 2] << 8) | row[x * 2 + 1];
    }
  }
  return { width, height, values };
}
