#!/usr/bin/env python3
"""Turn phone photos of products into planogram pack shots.

  1. cut the background out with the macOS Vision framework (tools/cutout.swift)
  2. straighten the product: warp the detected front face back to a rectangle,
     which removes the tilt from shooting slightly above/below the product
  3. trim to the subject and scale down

  usage: python3 tools/packshot.py -o assets/products photo1.jpg photo2.jpg
         python3 tools/packshot.py -o assets/products --map names.csv photos/*.jpg

`names.csv` renames the output: one `IMG_7340.jpeg,A10018` line per photo, so
the file lands as assets/products/A10018.png where the web app looks for it.
Add the real size — `IMG_7340.jpeg,A10018,12.5,8` — and the straightened face
is given that width:height ratio instead of the one guessed from the photo.
"""

import argparse
import csv
import pathlib
import subprocess
import sys
import tempfile

import numpy as np
from PIL import Image

# 50MP phone photos are ordinary here, and these are the user's own files
Image.MAX_IMAGE_PIXELS = 300_000_000

ALPHA_CUTOFF = 128
# A quad that the subject does not fill is not a flat product face (chair mats,
# monitor arms, cables) — straightening those would bend them, so we only trim.
MIN_QUAD_FILL = 0.86
MAX_QUAD_FILL = 1.15  # real boxes overshoot a little; a circle sits at 1.57
MAX_STRETCH = 1.7
TOOLS = pathlib.Path(__file__).resolve().parent


def already_cut(path):
    """True when the file arrives with its background already erased.

    A camera photo saved as RGBA still has every alpha at 255, so any pixel
    below that means someone has cut the background out already.
    """
    try:
        image = Image.open(path)
    except OSError:
        return False
    if image.mode not in ('RGBA', 'LA'):
        return False
    return image.getchannel('A').getextrema()[0] < 250


def cutout(photos, workdir):
    """Run the Vision cutout tool, returning the RGBA files it produced."""
    binary = TOOLS / 'cutout'
    cmd = [str(binary)] if binary.exists() else ['swift', str(TOOLS / 'cutout.swift')]
    result = subprocess.run(
        cmd + [str(workdir)] + [str(p) for p in photos],
        capture_output=True, text=True,
    )
    produced = {}
    for line in result.stdout.splitlines():
        status, source, detail = (line.split('\t') + ['', ''])[:3]
        if status == 'ok':
            produced[pathlib.Path(source).name] = pathlib.Path(detail)
        else:
            print(f'  ! {pathlib.Path(source).name}: {detail}', file=sys.stderr)
    if result.returncode and not produced:
        sys.exit(result.stderr.strip() or 'cutout failed')
    return produced


def corners(mask):
    """Corners of the subject, picked the way a document scanner does it."""
    ys, xs = np.nonzero(mask)
    total, diff = xs + ys, xs - ys
    pick = lambda idx: (float(xs[idx]), float(ys[idx]))
    return np.array([
        pick(total.argmin()),   # top-left
        pick(diff.argmax()),    # top-right
        pick(total.argmax()),   # bottom-right
        pick(diff.argmin()),    # bottom-left
    ])


def quad_area(quad):
    x, y = quad[:, 0], quad[:, 1]
    return 0.5 * abs(np.dot(x, np.roll(y, -1)) - np.dot(y, np.roll(x, -1)))


def perspective_coeffs(dst, src):
    """PIL wants the output→input map, so solve for that direction."""
    rows = []
    for (dx, dy), (sx, sy) in zip(dst, src):
        rows.append([dx, dy, 1, 0, 0, 0, -sx * dx, -sx * dy])
        rows.append([0, 0, 0, dx, dy, 1, -sy * dx, -sy * dy])
    return np.linalg.solve(np.array(rows), np.array(src).reshape(8))


def straighten(image, mask, aspect=None):
    """Warp the product's face back to a rectangle. Returns (image, note).

    A photo alone cannot say how wide the product really is, so the rectangle
    keeps the average projected size unless `aspect` (width/height, e.g. from
    the sheet's Width_cm/Height_cm) says otherwise.
    """
    quad = corners(mask)
    subject = float(mask.sum())
    if not subject or quad_area(quad) <= 0:
        return image, 'empty'
    # A flat face fills its own corner-to-corner quad; a round or spindly
    # subject either leaves it empty or bulges outside it.
    fill = subject / quad_area(quad)
    if not MIN_QUAD_FILL <= fill <= MAX_QUAD_FILL:
        return image, f'trim only (not a flat face, fill {fill:.2f})'

    side = lambda a, b: float(np.hypot(*(quad[a] - quad[b])))
    width = round((side(0, 1) + side(3, 2)) / 2)
    height = round((side(0, 3) + side(1, 2)) / 2)
    if width < 8 or height < 8:
        return image, 'trim only (too small)'

    stretch = max(side(0, 1) / side(3, 2), side(3, 2) / side(0, 1),
                  side(0, 3) / side(1, 2), side(1, 2) / side(0, 3))
    if stretch > MAX_STRETCH:
        return image, f'trim only (skew {stretch:.1f}x — reshoot straight on)'

    if aspect:
        # Trust the sheet only when it roughly agrees with the photo: a box shot
        # lying on its long edge does not match the upright width:height and
        # forcing it would squash the picture into a sliver.
        natural = width / height
        if 0.5 <= aspect / natural <= 2:
            height = max(8, round(width / aspect))
        else:
            note_aspect = ' (sheet ratio ignored, does not match the photo)'
            return _finish(image, quad, width, height, stretch, note_aspect)

    return _finish(image, quad, width, height, stretch, '')


def _finish(image, quad, width, height, stretch, extra):
    target = np.array([[0, 0], [width, 0], [width, height], [0, height]], dtype=float)
    coeffs = perspective_coeffs(target, quad)
    warped = image.transform((width, height), Image.PERSPECTIVE, coeffs, Image.BICUBIC)
    return warped, f'straightened ({stretch:.2f}x skew removed){extra}'


def trim(image):
    box = image.split()[-1].point(lambda a: 255 if a > ALPHA_CUTOFF else 0).getbbox()
    return image.crop(box) if box else image


def process(cut_path, out_path, longest, aspect=None):
    image = Image.open(cut_path).convert('RGBA')
    image = trim(image)
    mask = np.array(image.split()[-1]) > ALPHA_CUTOFF
    image, note = straighten(image, mask, aspect)
    image = trim(image)

    scale = longest / max(image.size)
    if scale < 1:
        image = image.resize((max(1, round(image.width * scale)),
                              max(1, round(image.height * scale))), Image.LANCZOS)
    # 256 colours is plenty for a pack shot and cuts the file to about a fifth
    image.quantize(colors=256, method=Image.FASTOCTREE).save(out_path, optimize=True)
    return note, image.size


def load_map(path):
    if not path:
        return {}
    mapping = {}
    with open(path, newline='', encoding='utf-8-sig') as handle:
        for row in csv.reader(handle):
            if len(row) < 2 or not row[0].strip():
                continue
            aspect = None
            if len(row) >= 4 and row[2].strip() and row[3].strip():
                try:
                    aspect = float(row[2]) / float(row[3])
                except (ValueError, ZeroDivisionError):
                    aspect = None
            mapping[row[0].strip()] = (row[1].strip(), aspect)
    return mapping


def selftest():
    """Warp a known rectangle out of shape and check straighten() undoes it."""
    flat = Image.new('RGBA', (200, 120), (255, 255, 255, 255))
    canvas = Image.new('RGBA', (400, 400), (0, 0, 0, 0))
    skewed_quad = np.array([[60, 40], [340, 90], [330, 300], [70, 260]], dtype=float)
    source = np.array([[0, 0], [200, 0], [200, 120], [0, 120]], dtype=float)
    canvas.paste(flat.transform((400, 400), Image.PERSPECTIVE,
                                perspective_coeffs(skewed_quad, source), Image.BICUBIC), (0, 0))

    mask = np.array(canvas.split()[-1]) > ALPHA_CUTOFF
    fixed, note = straighten(canvas, mask, aspect=200 / 120)
    assert note.startswith('straightened'), note
    assert abs(fixed.width / fixed.height - 200 / 120) < 0.02, 'given aspect ignored'
    # The keystone is gone when the subject fills its own frame again.
    filled = (np.array(fixed.split()[-1]) > ALPHA_CUTOFF).mean()
    assert filled > 0.95, f'still skewed, subject fills only {filled:.0%}'

    # A round product is not a flat face — it must be left alone, not bent.
    blob = Image.new('RGBA', (300, 300), (0, 0, 0, 0))
    yy, xx = np.mgrid[0:300, 0:300]
    circle = ((xx - 150) ** 2 + (yy - 150) ** 2) < 120 ** 2
    blob.putalpha(Image.fromarray(np.where(circle, 255, 0).astype('uint8')))
    _, note = straighten(blob, circle)
    assert note.startswith('trim only'), note

    print('selftest ok')


def main():
    parser = argparse.ArgumentParser(description=__doc__,
                                     formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('photos', nargs='*', type=pathlib.Path)
    parser.add_argument('--selftest', action='store_true', help='run the built-in checks and exit')
    parser.add_argument('-o', '--out', type=pathlib.Path, default=pathlib.Path('assets/products'))
    parser.add_argument('--map', dest='name_map', help='CSV of photo-filename,ODOO')
    parser.add_argument('--size', type=int, default=600, help='longest side in px (default 600)')
    args = parser.parse_args()

    if args.selftest:
        return selftest()
    if not args.photos:
        parser.error('no photos given')

    args.out.mkdir(parents=True, exist_ok=True)
    names = load_map(args.name_map)

    ready = [p for p in args.photos if already_cut(p)]
    raw = [p for p in args.photos if p not in ready]

    with tempfile.TemporaryDirectory() as workdir:
        produced = {p.name: p for p in ready}
        if ready:
            print(f'{len(ready)} photo(s) already cut out — straightening only')
        if raw:
            print(f'cutting out {len(raw)} photo(s)...')
            produced.update(cutout(raw, workdir))
        for photo in args.photos:
            cut_path = produced.get(photo.name)
            if not cut_path:
                continue
            name, aspect = names.get(photo.name, (photo.stem, None))
            out_path = args.out / f'{name}.png'
            note, size = process(cut_path, out_path, args.size, aspect)
            print(f'  {photo.name} → {out_path.name}  {size[0]}×{size[1]}  {note}')

    unmapped = [p.name for p in args.photos if names and p.name not in names]
    if unmapped:
        print(f'\nno ODOO code for {len(unmapped)}: {", ".join(unmapped[:5])}'
              f'{" ..." if len(unmapped) > 5 else ""}', file=sys.stderr)


if __name__ == '__main__':
    main()
