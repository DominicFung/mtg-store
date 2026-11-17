#!/usr/bin/env python3
"""Compare generated example relief STLs with the reference plates.

Rasterises both meshes onto the 0.1 mm vertex grid and writes a height
difference image per face. Reference files are not stored in the repo.

Usage:
  python3 scripts/compare_example_relief.py \
    --reference-dir /tmp/example-dogs \
    --out /tmp/example-relief-report
"""

from __future__ import annotations

import argparse
import json
import math
import struct
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
WEB = ROOT / 'web'

REFERENCES = {
    'right': 'Right-1.stl',
    'back': 'Back-2.stl',
    'left': 'Left-3.stl',
}


def read_stl_grid(path: Path, cols: int, rows: int, width: float, height: float) -> list[float]:
    data = path.read_bytes()
    count = struct.unpack_from('<I', data, 80)[0]
    values = [float('-inf')] * ((cols + 1) * (rows + 1))
    offset = 84
    for _ in range(count):
        base = offset + 12
        for vertex in range(3):
            x, y, z = struct.unpack_from('<fff', data, base + vertex * 12)
            i = round(((x + width / 2) / width) * cols)
            j = round(((y + height / 2) / height) * rows)
            if 0 <= i <= cols and 0 <= j <= rows:
                slot = j * (cols + 1) + i
                if z > values[slot]:
                    values[slot] = z
        offset += 50
    return values


def bounds(path: Path) -> dict[str, list[float]]:
    data = path.read_bytes()
    count = struct.unpack_from('<I', data, 80)[0]
    low = [math.inf, math.inf, math.inf]
    high = [-math.inf, -math.inf, -math.inf]
    offset = 84
    for _ in range(count):
        base = offset + 12
        for vertex in range(3):
            point = struct.unpack_from('<fff', data, base + vertex * 12)
            for axis, value in enumerate(point):
                low[axis] = min(low[axis], value)
                high[axis] = max(high[axis], value)
        offset += 50
    return {
        'min': [round(value, 4) for value in low],
        'max': [round(value, 4) for value in high],
        'size': [round(high[axis] - low[axis], 4) for axis in range(3)],
        'triangles': count,
    }


def write_diff(path: Path, cols: int, rows: int, delta: list[float], limit: float) -> None:
    from PIL import Image

    image = Image.new('RGB', (cols, rows))
    pixels = image.load()
    for j in range(rows):
        for i in range(cols):
            value = delta[j * cols + i]
            if value is None or math.isnan(value):
                pixels[i, rows - 1 - j] = (32, 32, 32)
                continue
            t = max(-1.0, min(1.0, value / limit))
            if t >= 0:
                pixels[i, rows - 1 - j] = (255, round(255 * (1 - t)), round(255 * (1 - t)))
            else:
                pixels[i, rows - 1 - j] = (round(255 * (1 + t)), round(255 * (1 + t)), 255)
    image.save(path)


def summarise(ours: list[float], reference: list[float], cols: int, rows: int) -> tuple[dict[str, float], list[float]]:
    absolute = 0.0
    worst = 0.0
    count = 0
    errors: list[float] = []
    delta = [0.0] * (cols * rows)
    for j in range(rows):
        for i in range(cols):
            slot = j * (cols + 1) + i
            left = ours[slot]
            right = reference[slot]
            if left == float('-inf') or right == float('-inf'):
                delta[j * cols + i] = float('nan')
                continue
            diff = left - right
            delta[j * cols + i] = diff
            error = abs(diff)
            errors.append(error)
            absolute += error
            count += 1
            if error > worst:
                worst = error
    errors.sort()

    def percentile(fraction: float) -> float | None:
        if not errors:
            return None
        index = min(len(errors) - 1, max(0, math.ceil(fraction * len(errors)) - 1))
        return round(errors[index], 6)

    return {
        'samples': count,
        'meanAbsMm': round(absolute / count, 6) if count else None,
        'p50AbsMm': percentile(0.50),
        'p95AbsMm': percentile(0.95),
        'p99AbsMm': percentile(0.99),
        'maxAbsMm': round(worst, 6),
    }, delta


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument('--reference-dir', type=Path, default=Path('/tmp/example-dogs'))
    parser.add_argument('--out', type=Path, default=Path('/tmp/example-relief-report'))
    parser.add_argument('--max-depth', default='2')
    parser.add_argument('--scale', type=float, default=0.15, help='Diff image clips at this many millimetres')
    parser.add_argument('--skip-generate', action='store_true')
    args = parser.parse_args()
    args.out.mkdir(parents=True, exist_ok=True)
    generated = args.out / 'generated'
    if not args.skip_generate:
        subprocess.check_call([
            'npx', 'tsx', 'scripts/export-example-faces.ts',
            '--out', str(generated),
            '--max-depth', str(args.max_depth),
        ], cwd=WEB)
    manifest = json.loads((generated / 'manifest.json').read_text())
    faces = []
    for face in manifest['faces']:
        reference_path = args.reference_dir / REFERENCES[face['face']]
        cols = face['cols']
        rows = face['rows']
        width = face['widthMm']
        height = face['heightMm']
        ours = read_stl_grid(Path(face['stl']), cols, rows, width, height)
        reference = read_stl_grid(reference_path, cols, rows, width, height)
        stats, delta = summarise(ours, reference, cols, rows)
        diff_path = args.out / f"{face['face']}-diff.png"
        write_diff(diff_path, cols, rows, delta, args.scale)
        entry = {
            'face': face['face'],
            'generated': {
                'widthMm': face['widthMm'],
                'heightMm': face['heightMm'],
                'cols': cols,
                'rows': rows,
                'triangles': face['triangles'],
                'actualDepthMm': face['actualDepthMm'],
                'bounds': bounds(Path(face['stl'])),
            },
            'reference': bounds(reference_path),
            'heightError': stats,
            'diffImage': str(diff_path),
        }
        faces.append(entry)
        print(json.dumps(entry))
    report = {
        'maxDepthMm': manifest['maxDepth'],
        'endLayers': manifest['stops'],
        'diffClipMm': args.scale,
        'faces': faces,
    }
    (args.out / 'report.json').write_text(json.dumps(report, indent=2))
    print('wrote', args.out / 'report.json')


if __name__ == '__main__':
    main()
