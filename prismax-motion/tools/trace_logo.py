"""Vectorise a logo crop (dark mark on a light background) into an SVG with potrace.

    python3 tools/trace_logo.py crop.png assets/prismax-wordmark.svg

The crop is upscaled before thresholding so the traced curves come out smooth.
Requires pillow, numpy and potracer (pip install potracer).
"""
import sys

import numpy as np
import potrace
from PIL import Image, ImageFilter

SCALE = 8
src, dst = sys.argv[1], sys.argv[2]

im = Image.open(src).convert('L')
im = im.resize((im.width * SCALE, im.height * SCALE), Image.LANCZOS).filter(ImageFilter.GaussianBlur(SCALE * 0.5))
a = np.asarray(im, dtype=np.float32)
lo, hi = np.percentile(a, 2), np.percentile(a, 98)
mask = a < (lo + hi) / 2

path = potrace.Bitmap(~mask).trace(  # potracer fills the False pixels
    turdsize=SCALE * SCALE * 4, alphamax=1.0, opticurve=True, opttolerance=0.2)
d = []
for curve in path:
    s = curve.start_point
    d.append(f'M{s.x:.1f},{s.y:.1f}')
    for seg in curve.segments:
        if seg.is_corner:
            d.append(f'L{seg.c.x:.1f},{seg.c.y:.1f}L{seg.end_point.x:.1f},{seg.end_point.y:.1f}')
        else:
            d.append(f'C{seg.c1.x:.1f},{seg.c1.y:.1f} {seg.c2.x:.1f},{seg.c2.y:.1f} {seg.end_point.x:.1f},{seg.end_point.y:.1f}')
    d.append('Z')

ys, xs = np.nonzero(mask)
pad = SCALE * 2
x0, y0 = xs.min() - pad, ys.min() - pad
w, h = xs.max() - x0 + pad, ys.max() - y0 + pad
svg = (f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" viewBox="{x0} {y0} {w} {h}">'
       f'<path fill="#202020" fill-rule="evenodd" d="{"".join(d)}"/></svg>\n')
open(dst, 'w').write(svg)
print('wrote', dst, f'{w}x{h}', len(path), 'curves')
