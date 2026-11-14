"""Compare a changed capture against two captures of the original.

usage: cmp3.py <origA> <origB> <changed>

The original site is not pixel-stable between loads (a few seeded effects are
re-rolled on each layout pass), so two original runs give the noise for each
frame. A frame counts as changed only where it differs from BOTH originals
outside the region where the originals already differ from each other.
"""
import os
import sys

from PIL import Image, ImageChops, ImageFilter

a, b, w = sys.argv[1:4]
clean = noisy = changed = 0
for d in sorted(os.listdir(a)):
    for f in sorted(os.listdir(os.path.join(a, d))):
        paths = [os.path.join(x, d, f) for x in (a, b, w)]
        if not all(os.path.exists(p) for p in paths):
            print('MISSING', d, f)
            continue
        ia, ib, iw = (Image.open(p).convert('RGB') for p in paths)
        if not (ia.size == ib.size == iw.size):
            print(f'SIZE {d}/{f}: {ia.size} {ib.size} {iw.size}')
            changed += 1
            continue
        mask = lambda x, y: ImageChops.difference(x, y).convert('L').point(lambda v: 255 if v else 0)
        noise = mask(ia, ib)
        # Grow the noise region a little: a re-rolled fragment lands near, not on, the old one.
        grown = noise.filter(ImageFilter.MaxFilter(15)) if noise.getbbox() else noise
        both = ImageChops.multiply(mask(iw, ia), mask(iw, ib))
        real = ImageChops.subtract(both, grown)
        n_noise = noise.histogram()[255]
        n_real = real.histogram()[255]
        total = ia.size[0] * ia.size[1]
        if n_real:
            changed += 1
            print(f'CHANGED {d}/{f}: {n_real} px ({100 * n_real / total:.3f}%) outside noise, bbox {real.getbbox()}; noise {n_noise} px')
        elif both.getbbox() or n_noise:
            noisy += 1
        else:
            clean += 1
print(f'pixel-identical in all three: {clean}; differs only within original run-to-run noise: {noisy}; changed: {changed}')
