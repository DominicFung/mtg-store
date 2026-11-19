/** Copy left.stl, right.stl, and spine.stl out of a stored (uncompressed) zip. */

export const FACE_STL_NAMES = ['left.stl', 'right.stl', 'spine.stl'] as const;

type ZipEntry = {
  name: string;
  method: number;
  crc: number;
  compressedSize: number;
  uncompressedSize: number;
  dataOffset: number;
};

function findEocd(tail: Buffer, fileSize: number): { cdOffset: number; cdSize: number } {
  const start = Math.max(0, fileSize - tail.length);
  for (let index = tail.length - 22; index >= 0; index -= 1) {
    if (tail.readUInt32LE(index) !== 0x06054b50) continue;
    const cdSize = tail.readUInt32LE(index + 12);
    const cdOffset = tail.readUInt32LE(index + 16);
    if (cdOffset === 0xffffffff || cdSize === 0xffffffff) throw new Error('Zip64 print files need the full download');
    if (cdOffset >= start && cdOffset + cdSize <= fileSize) return { cdOffset, cdSize };
  }
  throw new Error('Could not read the print zip');
}

function centralEntries(directory: Buffer): Array<Omit<ZipEntry, 'dataOffset'> & { localOffset: number }> {
  const entries = [];
  let cursor = 0;
  while (cursor + 46 <= directory.length) {
    if (directory.readUInt32LE(cursor) !== 0x02014b50) break;
    const method = directory.readUInt16LE(cursor + 10);
    const crc = directory.readUInt32LE(cursor + 16);
    const compressedSize = directory.readUInt32LE(cursor + 20);
    const uncompressedSize = directory.readUInt32LE(cursor + 24);
    const nameLength = directory.readUInt16LE(cursor + 28);
    const extraLength = directory.readUInt16LE(cursor + 30);
    const commentLength = directory.readUInt16LE(cursor + 32);
    const localOffset = directory.readUInt32LE(cursor + 42);
    const name = directory.subarray(cursor + 46, cursor + 46 + nameLength).toString('utf8');
    entries.push({ name, method, crc, compressedSize, uncompressedSize, localOffset });
    cursor += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
}

function localHeader(name: string, entry: Pick<ZipEntry, 'crc' | 'compressedSize' | 'uncompressedSize'>): Buffer {
  const nameBytes = Buffer.from(name);
  const header = Buffer.alloc(30 + nameBytes.length);
  header.writeUInt32LE(0x04034b50, 0);
  header.writeUInt16LE(20, 4);
  header.writeUInt16LE(0, 8);
  header.writeUInt32LE(entry.crc, 14);
  header.writeUInt32LE(entry.compressedSize, 18);
  header.writeUInt32LE(entry.uncompressedSize, 22);
  header.writeUInt16LE(nameBytes.length, 26);
  nameBytes.copy(header, 30);
  return header;
}

function centralHeader(name: string, entry: ZipEntry, localOffset: number): Buffer {
  const nameBytes = Buffer.from(name);
  const header = Buffer.alloc(46 + nameBytes.length);
  header.writeUInt32LE(0x02014b50, 0);
  header.writeUInt16LE(20, 4);
  header.writeUInt16LE(20, 6);
  header.writeUInt32LE(entry.crc, 16);
  header.writeUInt32LE(entry.compressedSize, 20);
  header.writeUInt32LE(entry.uncompressedSize, 24);
  header.writeUInt16LE(nameBytes.length, 28);
  header.writeUInt32LE(localOffset, 42);
  nameBytes.copy(header, 46);
  return header;
}

async function locate(read: (start: number, end: number) => Promise<Buffer>, size: number): Promise<ZipEntry[]> {
  const tailLength = Math.min(size, 70_000);
  const tail = await read(size - tailLength, size - 1);
  const eocd = findEocd(tail, size);
  const directory = await read(eocd.cdOffset, eocd.cdOffset + eocd.cdSize - 1);
  const listed = centralEntries(directory);
  const wanted: ZipEntry[] = [];
  for (const name of FACE_STL_NAMES) {
    const entry = listed.find((item) => item.name === name || item.name.endsWith(`/${name}`));
    if (!entry) throw new Error(`The print zip has no ${name}`);
    if (entry.method !== 0) throw new Error(`${name} is compressed. Download all files instead.`);
    const header = await read(entry.localOffset, entry.localOffset + 29);
    const nameLength = header.readUInt16LE(26);
    const extraLength = header.readUInt16LE(28);
    wanted.push({ ...entry, name, dataOffset: entry.localOffset + 30 + nameLength + extraLength });
  }
  return wanted;
}

/** Stream a stored zip that contains only the three face plates. */
export async function streamFacesZip(
  read: (start: number, end: number) => Promise<Buffer>,
  size: number,
  sink: (chunk: Buffer) => Promise<void>,
): Promise<void> {
  const entries = await locate(read, size);
  const placed: Array<{ entry: ZipEntry; offset: number }> = [];
  let offset = 0;
  for (const entry of entries) {
    const header = localHeader(entry.name, entry);
    await sink(header);
    placed.push({ entry, offset });
    offset += header.length;
    let cursor = entry.dataOffset;
    const end = entry.dataOffset + entry.compressedSize;
    while (cursor < end) {
      const take = Math.min(1024 * 1024, end - cursor);
      const chunk = await read(cursor, cursor + take - 1);
      await sink(chunk);
      cursor += chunk.length;
      offset += chunk.length;
    }
  }
  const centralStart = offset;
  const parts = placed.map(({ entry, offset: localOffset }) => centralHeader(entry.name, entry, localOffset));
  for (const part of parts) {
    await sink(part);
    offset += part.length;
  }
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(parts.length, 8);
  eocd.writeUInt16LE(parts.length, 10);
  eocd.writeUInt32LE(offset - centralStart, 12);
  eocd.writeUInt32LE(centralStart, 16);
  await sink(eocd);
}

export async function facesZipBytes(
  read: (start: number, end: number) => Promise<Buffer>,
  size: number,
): Promise<Buffer> {
  const chunks: Buffer[] = [];
  await streamFacesZip(read, size, async (chunk) => {
    chunks.push(chunk);
  });
  return Buffer.concat(chunks);
}
