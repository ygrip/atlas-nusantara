"""Key the generated 4x2 pose sheets and pack eight frames in one GPU-translated strip.

Usage: uv run --with pillow --with numpy python scripts/prepare-hero-sprites.py
Imagegen source PNGs remain in output/imagegen/hero-motion, outside the release assets.
"""
import json
from pathlib import Path

import numpy as np
from PIL import Image

SOURCE = Path('output/imagegen/hero-motion')
DESTINATION = Path('static/illustrations/hero/motion')
DESTINATION.mkdir(parents=True, exist_ok=True)


def remove_magenta(image):
    pixels = np.asarray(image.convert('RGBA')).astype(np.float32)
    rgb = pixels[:, :, :3]
    # Only magenta-dominant pixels are keyed, preserving orange fur and green clay.
    dominance = np.minimum(rgb[:, :, 0] - rgb[:, :, 1], rgb[:, :, 2] - rgb[:, :, 1])
    alpha = 1 - np.clip((dominance - 15) / 160, 0, 1)
    safe_alpha = np.maximum(alpha, .01)
    key = np.array([255, 0, 255], dtype=np.float32)
    rgb = (rgb - key * (1 - alpha[:, :, None])) / safe_alpha[:, :, None]
    output = np.zeros_like(pixels)
    output[:, :, :3] = np.clip(rgb, 0, 255)
    output[:, :, 3] = alpha * pixels[:, :, 3]
    return Image.fromarray(output.astype(np.uint8), 'RGBA')


def prepare(name):
    sheet = remove_magenta(Image.open(SOURCE / f'{name}-sheet.png'))
    cell_width = sheet.width // 4
    cell_height = sheet.height // 2
    if cell_width != cell_height:
        raise ValueError(f'{name}: expected square cells, got {cell_width}x{cell_height}')
    frames = []
    for index in range(8):
        left = (index % 4) * cell_width
        top = (index // 4) * cell_height
        frames.append(sheet.crop((left, top, left + cell_width, top + cell_height)))
    # The generated third monkey pose lifts the wrong arm. Reuse its matching
    # returning pose so the entire wave stays on the same anatomical side.
    if name == 'orangutan':
        frames[2] = frames[5].copy()
    resting_bounds = frames[0].getchannel('A').point(lambda value: 255 * (value > 128)).getbbox()
    if resting_bounds is None:
        raise ValueError(f'{name}: missing first frame')
    left, top, right, bottom = resting_bounds
    reference = Image.open(Path('static/illustrations/hero') / f'{name}.webp')
    resting_height = bottom - top
    width_percent = 100 * (reference.height / reference.width) * (cell_height / resting_height)
    left_percent = 50 - ((left + right) / 2 / cell_width) * width_percent
    bottom_percent = -100 * (cell_height - bottom) / resting_height
    strip = Image.new('RGBA', (256 * 8, 256))
    for index, frame in enumerate(frames):
        strip.paste(frame.resize((256, 256), Image.Resampling.LANCZOS), (256 * index, 0))
    output = DESTINATION / f'{name}.webp'
    strip.save(output, 'WEBP', quality=86, method=6)
    print(json.dumps({'id': name, 'width': round(width_percent, 2), 'left': round(left_percent, 2),
                      'bottom': round(bottom_percent, 2), 'bytes': output.stat().st_size}))


for name in ['tiger', 'orangutan', 'komodo', 'volcano', 'pinisi', 'cendrawasih', 'flag']:
    prepare(name)
