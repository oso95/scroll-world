#!/usr/bin/env python3
"""Border-connected background knockout for diorama stills.

Removes the flat background of a scene image (leaving the diorama floating on
transparency) via a flood fill from the borders over pixels near the corner
colour. Interior regions that happen to match the background (e.g. cream walls
inside the scene) are preserved because the fill only reaches border-connected
pixels. The soft contact shadow is kept as a natural base.

Usage:
    python3 knockout.py scene1.png scene2.png ...
    # writes scene1.rgba.png, scene2.rgba.png, ...
    # optional: TOL env var (default 34) widens/narrows the bg match

Then encode to webp with alpha, e.g.:
    cwebp -q 84 -alpha_q 95 -resize 1800 0 scene1.rgba.png -o scene1.webp

No numpy/ImageMagick needed — pure PIL. Pairs with SKILL.md Phase 4.
"""
import os
import sys
from collections import deque
from PIL import Image, ImageFilter

TOL = float(os.environ.get("TOL", "34"))   # RGB Euclidean distance counted as background


def corner_color(im):
    w, h = im.size
    px = im.load()
    pts = [(1, 1), (w - 2, 1), (1, h - 2), (w - 2, h - 2)]
    r = sum(px[x, y][0] for x, y in pts) // 4
    g = sum(px[x, y][1] for x, y in pts) // 4
    b = sum(px[x, y][2] for x, y in pts) // 4
    return (r, g, b)


def knock(inp, outp):
    im = Image.open(inp).convert("RGB")
    w, h = im.size
    px = im.load()
    cr, cg, cb = corner_color(im)
    tol2 = TOL * TOL

    def is_bg(x, y):
        r, g, b = px[x, y]
        dr, dg, db = r - cr, g - cg, b - cb
        return dr * dr + dg * dg + db * db <= tol2

    bg = bytearray(w * h)
    seen = bytearray(w * h)
    dq = deque()
    for x in range(w):
        for y in (0, h - 1):
            i = y * w + x
            if not seen[i] and is_bg(x, y):
                seen[i] = 1; bg[i] = 1; dq.append((x, y))
    for y in range(h):
        for x in (0, w - 1):
            i = y * w + x
            if not seen[i] and is_bg(x, y):
                seen[i] = 1; bg[i] = 1; dq.append((x, y))
    while dq:
        x, y = dq.popleft()
        for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
            if 0 <= nx < w and 0 <= ny < h:
                i = ny * w + nx
                if not seen[i]:
                    seen[i] = 1
                    if is_bg(nx, ny):
                        bg[i] = 1; dq.append((nx, ny))

    alpha = Image.new("L", (w, h), 255)
    ap = alpha.load()
    for y in range(h):
        base = y * w
        for x in range(w):
            if bg[base + x]:
                ap[x, y] = 0
    alpha = alpha.filter(ImageFilter.GaussianBlur(1.4))   # soften the threshold contour
    out = im.convert("RGBA")
    out.putalpha(alpha)
    out.save(outp)
    print("knocked", outp)


if __name__ == "__main__":
    for name in sys.argv[1:]:
        knock(name, name.rsplit(".", 1)[0] + ".rgba.png")
