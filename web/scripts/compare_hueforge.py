"""Build side-by-side previews against the HueForge screenshots."""

import json
import subprocess
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path('/agent/repos/mtg-store/web')
ASSETS = Path('/home/ubuntu/.cursor/projects/agent-repos-mtg-store/assets')
OUT = Path('/opt/cursor/artifacts')
TMP = Path('/tmp/hueforge-compare')
TMP.mkdir(parents=True, exist_ok=True)
OUT.mkdir(parents=True, exist_ok=True)

CASES = [
    {
        'name': 'fire-case-3-right',
        'preset': 'fire',
        'source': ASSETS / 'source-art.png',
        'shot': ASSETS / 'hueforge-screenshot.png',
        'plate': '94.67 × 105.45 mm right face',
    },
    {
        'name': 'brigid-case-2-back',
        'preset': 'brigid',
        'source': ASSETS / 'brigid-source-art.png',
        'shot': ASSETS / 'brigid-hueforge-screenshot.png',
        'plate': '82.44 × 105.45 mm back face',
    },
]


def crop_preview(shot: Image.Image) -> Image.Image:
    """The mesh preview sits immediately left of the cyan colour-core frame."""
    pixels = shot.load()
    width, height = shot.size
    cyan_x = []
    cyan_y = []
    for y in range(200, height - 80, 3):
        for x in range(800, width - 20, 3):
            red, green, blue = pixels[x, y][:3]
            if blue > 200 and green > 180 and red < 60:
                cyan_x.append(x)
                cyan_y.append(y)
    if not cyan_x:
        raise RuntimeError('colour core border not found')
    core_left = min(cyan_x)
    background = (25, 35, 45)
    mid = (min(cyan_y) + max(cyan_y)) // 2

    def content(x: int, y: int) -> bool:
        red, green, blue = pixels[x, y][:3]
        return not (
            abs(red - background[0]) < 18
            and abs(green - background[1]) < 18
            and abs(blue - background[2]) < 18
        )

    right = core_left - 4
    while right > 200 and not content(right, mid):
        right -= 1
    left = right
    while left > 200 and content(left, mid):
        left -= 1
    probe_x = (left + right) // 2
    top = mid
    while top > 150 and content(probe_x, top):
        top -= 1
    bottom = mid
    while bottom < height - 40 and content(probe_x, bottom):
        bottom += 1
    return shot.crop((left + 1, top + 1, right, bottom))


def rgba_image(path: Path, width: int, height: int) -> Image.Image:
    raw = path.read_bytes()
    return Image.frombytes('RGBA', (width, height), raw)


def label(draw: ImageDraw.ImageDraw, xy, text: str) -> None:
    draw.rectangle([xy[0], xy[1], xy[0] + 8 + 7 * len(text), xy[1] + 18], fill=(12, 16, 28))
    draw.text((xy[0] + 4, xy[1] + 3), text, fill=(255, 236, 190))


def main() -> None:
    font = ImageFont.load_default()
    summaries = []
    for case in CASES:
        source = Image.open(case['source']).convert('RGBA')
        raw_path = TMP / f"{case['name']}.rgba"
        raw_path.write_bytes(source.tobytes())
        out = TMP / case['name']
        subprocess.check_call([
            'npx', 'tsx', 'scripts/render-preview.ts',
            '--preset', case['preset'],
            '--rgba', str(raw_path),
            '--width', str(source.width),
            '--height', str(source.height),
            '--out', str(out),
        ], cwd=ROOT)
        meta = json.loads(Path(f'{out}-meta.json').read_text())
        summaries.append(meta)
        flat = rgba_image(Path(f'{out}-flat.rgba'), source.width, source.height).convert('RGB')
        shade = rgba_image(Path(f'{out}-shade.rgba'), source.width, source.height).convert('RGB')
        height = rgba_image(Path(f'{out}-height.rgba'), source.width, source.height).convert('RGB')
        hue = crop_preview(Image.open(case['shot']).convert('RGB'))
        target_h = 640
        def fit(image: Image.Image) -> Image.Image:
            scale = target_h / image.height
            return image.resize((max(1, round(image.width * scale)), target_h), Image.Resampling.LANCZOS)
        panels = [
            (fit(flat), 'Our blend (flat)'),
            (fit(shade), 'Our blend (lit)'),
            (fit(hue), 'HueForge preview'),
            (fit(height), 'Height (dark=min)'),
        ]
        gap = 12
        width = sum(panel.width for panel, _ in panels) + gap * (len(panels) + 1)
        canvas = Image.new('RGB', (width, target_h + 36), (18, 22, 36))
        draw = ImageDraw.Draw(canvas)
        x = gap
        for panel, title in panels:
            canvas.paste(panel, (x, 28))
            draw.text((x, 8), title, fill=(255, 236, 190), font=font)
            x += panel.width + gap
        dest = OUT / f"{case['name']}-compare.png"
        canvas.save(dest)
        print(case['name'], meta['bounds'], 'triangles', meta['triangles'], 'plate', meta['widthMm'], meta['heightMm'])
        print('wrote', dest)
    (OUT / 'stl-report.json').write_text(json.dumps(summaries, indent=2))


if __name__ == '__main__':
    main()
