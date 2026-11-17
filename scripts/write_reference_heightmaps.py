#!/usr/bin/env python3
"""Write 16-bit reference heightmaps from example STL plates.

Each pixel is the height in microns (z millimetres × 1000), big-endian.
Row 0 is the top of the plate. The reference STLs are not stored in the repo.

  python3 scripts/write_reference_heightmaps.py --stl-dir /tmp/example-dogs
"""

from __future__ import annotations

import argparse
import struct
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
FACES = {
    'Right-1.stl': ('right.png', 948, 1055, 94.8, 105.5),
    'Back-2.stl': ('back.png', 826, 1055, 82.6, 105.5),
    'Left-3.stl': ('left.png', 948, 1055, 94.8, 105.5),
}


def heights(path: Path, cols: int, rows: int, width: float, height: float) -> bytes:
    data = path.read_bytes()
    count = struct.unpack_from('<I', data, 80)[0]
    values = [0.0] * (cols * rows)
    offset = 84
    for _ in range(count):
        base = offset + 12
        for vertex in range(3):
            x, y, z = struct.unpack_from('<fff', data, base + vertex * 12)
            i = round(((x + width / 2) / width) * cols)
            j = round(((y + height / 2) / height) * rows)
            if 0 <= i < cols and 0 <= j < rows and z > values[j * cols + i]:
                values[j * cols + i] = z
        offset += 50
    # PNG row 0 is the top of the plate (maximum Y). Values are microns.
    raw = bytearray(cols * rows * 2)
    for j in range(rows):
        for i in range(cols):
            microns = max(0, min(65535, round(values[j * cols + i] * 1000)))
            y = rows - 1 - j
            struct.pack_into('>H', raw, (y * cols + i) * 2, microns)
    return bytes(raw)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument('--stl-dir', type=Path, required=True)
    parser.add_argument('--out', type=Path, default=ROOT / 'packages/print-core/fixtures/heightmaps')
    args = parser.parse_args()
    args.out.mkdir(parents=True, exist_ok=True)
    for filename, (dest, cols, rows, width, height) in FACES.items():
        raw = heights(args.stl_dir / filename, cols, rows, width, height)
        image = Image.frombytes('I;16B', (cols, rows), bytes(raw))
        image.save(args.out / dest)
        print(dest, cols, rows, (args.out / dest).stat().st_size)


if __name__ == '__main__':
    main()
