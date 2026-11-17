#!/usr/bin/env python3
"""Download example reference STLs and write the 16-bit heightmaps.

The plates are about 100 MB each and are not committed. Pass the three URLs
Dominic shared, or point --stl-dir at files you already have. Heightmap
comparison tests skip when the PNGs are absent.

  python3 scripts/fetch_example_references.py --stl-dir /tmp/example-dogs
  python3 scripts/fetch_example_references.py --right URL --back URL --left URL
"""

from __future__ import annotations

import argparse
import subprocess
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def download(url: str, dest: Path) -> None:
    dest.parent.mkdir(parents=True, exist_ok=True)
    urllib.request.urlretrieve(url, dest)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument('--stl-dir', type=Path, default=Path('/tmp/example-dogs'))
    parser.add_argument('--right', default='')
    parser.add_argument('--back', default='')
    parser.add_argument('--left', default='')
    parser.add_argument('--out', type=Path, default=ROOT / 'packages/print-core/fixtures/heightmaps')
    args = parser.parse_args()
    args.stl_dir.mkdir(parents=True, exist_ok=True)
    names = {'right': 'Right-1.stl', 'back': 'Back-2.stl', 'left': 'Left-3.stl'}
    for key, filename in names.items():
        url = getattr(args, key)
        if url:
            print('downloading', filename)
            download(url, args.stl_dir / filename)
    subprocess.check_call([
        'python3', str(ROOT / 'scripts/write_reference_heightmaps.py'),
        '--stl-dir', str(args.stl_dir),
        '--out', str(args.out),
    ])


if __name__ == '__main__':
    main()
