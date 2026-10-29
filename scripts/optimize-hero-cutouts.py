"""Produce display-sized 1x/2x cutouts from an immutable Git source (never re-encode outputs).

Usage: uv run --with pillow python scripts/optimize-hero-cutouts.py --source-revision 1780632
The 2x widths cover the largest rendered ornament in the 1280px page shell.
"""
import argparse
from io import BytesIO
from pathlib import Path
import subprocess

from PIL import Image


WIDTHS = {
    'tiger': 144, 'volcano': 144, 'orangutan': 152, 'flag': 176,
    'komodo': 168, 'pinisi': 160, 'cendrawasih': 128,
}


def prepare(name, width, revision):
    path = Path('static/illustrations/hero') / f'{name}.webp'
    original = subprocess.run(['git', 'show', f'{revision}:{path.as_posix()}'],
                              check=True, capture_output=True).stdout
    image = Image.open(BytesIO(original)).convert('RGBA')
    for suffix, target_width in [('', width), ('-1x', width // 2)]:
        height = round(image.height * target_width / image.width)
        output = path.with_name(f'{name}{suffix}.webp')
        image.resize((target_width, height), Image.Resampling.LANCZOS).save(
            output, 'WEBP', quality=82, method=6)
        print(f'{output}: {target_width}x{height}, {output.stat().st_size} bytes')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source-revision', required=True)
    args = parser.parse_args()
    for name, width in WIDTHS.items():
        prepare(name, width, args.source_revision)
