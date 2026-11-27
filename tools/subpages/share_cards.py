#!/usr/bin/env python3
"""Make the link-preview pictures and the browser icons.

    python3 tools/subpages/share_cards.py

Writes a 1200 x 630 JPEG for the blog index, each post, the portfolio index and
each project into blog/share/ and portfolio/share/, plus assets/share-card.jpg
for the homepage and the two icons in assets/logo/. build.py points each
page's og:image at its picture and copies the icons into blog/ and portfolio/.

The four films use a photograph with a slight grain, cropped clear of any
burnt-in web address, logo or name caption. Everything else is a drawn scene
in the homepage's camera-and-chair style. The homepage is the logo alone.

Needs a Mac with Google Chrome (it draws each picture as a small web page and
takes a screenshot), Pillow (pip install pillow) for the photographs, and an
internet connection for the fonts. The pictures are checked in, so the site
itself does not need this script to run.
"""
import html
import os
import random
import subprocess
import sys
import tempfile
sys.dont_write_bytecode = True
from pathlib import Path

from PIL import Image, ImageChops, ImageEnhance

from build import BLOG, PORT, SITE
from content import POSTS, FILMS, COURSE

CHROME = os.environ.get("CHROME", "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome")
FONTS = ("https://fonts.googleapis.com/css2?family=Bree+Serif&family=IBM+Plex+Mono"
         "&family=Inter:wght@400;500&family=Playfair+Display:ital,wght@0,400;1,400&display=block")
e = html.escape
W, H = 1200, 630
TMP = Path(tempfile.mkdtemp())

CSS = """
:root{--red:#900000;--redlit:#d0241f;--ink:#111014;--paper:#f2f0eb}
*{box-sizing:border-box;margin:0;padding:0}
html,body{width:100%;height:100%;overflow:hidden}
body{position:relative;background:var(--paper);color:var(--ink);font-family:"Inter",system-ui,sans-serif;-webkit-font-smoothing:antialiased}
.mono{font-family:"IBM Plex Mono",monospace;text-transform:uppercase;letter-spacing:.09em}
.word{font-family:"Bree Serif",Georgia,serif;letter-spacing:.01em;white-space:nowrap;font-size:38px;line-height:1}.word b{font-weight:400;color:var(--red)}
.word.lit{color:#fff}.word.lit b{color:var(--redlit)}
h1{font-family:"Playfair Display",Georgia,serif;font-weight:400;letter-spacing:-.02em;line-height:1.04;text-wrap:balance}
.abs{position:absolute}.full{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
.ground{position:absolute;left:0;right:0;bottom:52px;height:1.5px;background:#11101499}
svg .i{fill:var(--ink);stroke:none}svg .l{fill:none;stroke:var(--ink);stroke-width:5}svg .t{fill:none;stroke:var(--ink);stroke-width:2.5}svg .p{fill:none;stroke:#e9e9e9;stroke-width:1.6}
.lockup{display:inline-flex;flex-direction:column;align-items:flex-start;line-height:1}
.lockup .tag{font-family:"Playfair Display",Georgia,serif;font-style:italic;font-size:.3em;margin-top:.22em;color:#2b2a2e;white-space:nowrap}
"""

# ---- photographs: picture, the part to use (left, top, right, bottom), color kept (1 = all)
PHOTOS = {
    # The Wagoner marker. Clear of "RescueClayton.com" (top left) and the Project 46 logo (bottom right).
    "saving-clayton": (PORT / "media/stills/saving-clayton/05-wagoner.webp", (60, 40, 1022, 545), 1),
    # The skyline. No watermark on this frame.
    "trans-oklahoma": (PORT / "media/stills/trans-oklahoma/05-city-skyline.webp", (30, 0, 1249, 640), 1),
    # Norman Shands. His name caption at the bottom of the frame is cropped off.
    "oasis-in-atlanta": (PORT / "media/stills/oasis-in-atlanta/02-norman-shands.webp", (0, 58, 990, 578), 1),
    # The corridor from the poster, with only a little of its color.
    "sacrificing-lincoln": (PORT / "media/sacrificing-lincoln.webp", (0, 316, 1066, 876), 0.42),
}


def grain(im, seed, clump=8, fine=6):
    """A slight film grain: a coarse colored layer and a finer one."""
    random.seed(seed)
    small = (im.width * 2 // 3, im.height * 2 // 3)
    im = Image.merge("RGB", [ImageChops.overlay(c, Image.effect_noise(small, clump).resize(im.size, Image.BICUBIC)) for c in im.split()])
    n = Image.effect_noise(im.size, fine)
    return ImageChops.overlay(im, Image.merge("RGB", [n] * 3))


def photo(slug):
    path, box, color = PHOTOS[slug]
    im = Image.open(path).convert("RGB").crop(box).resize((W, H), Image.LANCZOS)
    if color != 1:
        im = ImageEnhance.Color(im).enhance(color)
    out = TMP / f"{slug}.png"; grain(im, 1).save(out)
    return out


def sky():
    """The plain evening sky behind the drawn scenes, with the same slight grain."""
    top, bottom = (120, 152, 166), (238, 224, 196)
    g = Image.linear_gradient("L").resize((W, H))
    im = Image.merge("RGB", [g.point([int(a + (b - a) * (v / 255) ** 0.85) for v in range(256)]) for a, b in zip(top, bottom)])
    out = TMP / "sky.png"; grain(im, 2).save(out)
    return out


# ---- line art, in the homepage drawing's own coordinates (ground at y = 300)
CAMERA = ('<path class="l" d="M231 160 L168 300 M231 160 L294 300 M231 160 L236 300"/><path class="t" d="M197 240 L231 236 L266 240 M231 160 V236 M218 150 L150 170"/>'
          '<rect class="i" x="216" y="142" width="30" height="16" rx="2"/><rect class="i" x="196" y="98" width="84" height="46" rx="3"/><path class="l" d="M210 98 V84 H262 V98"/>'
          '<rect class="i" x="226" y="73" width="30" height="8" rx="3"/><rect class="i" x="280" y="106" width="30" height="30"/><path class="i" d="M310 100 L336 90 V152 L310 142 Z"/>'
          '<rect class="i" x="172" y="92" width="20" height="16" rx="1"/><path class="t" d="M192 100 H198"/>')
CHAIR = ('<path class="l" d="M380 172 V236 M446 172 V236"/><rect class="i" x="377" y="174" width="72" height="24"/><path class="l" d="M366 214 H460 M370 236 H456 M376 236 L452 300 M450 236 L374 300"/><path class="t" d="M376 278 H450"/>')
ARMCHAIR = ('<rect class="i" x="410" y="186" width="90" height="84" rx="17"/><rect class="i" x="397" y="226" width="27" height="62" rx="11"/><rect class="i" x="486" y="226" width="27" height="62" rx="11"/>'
            '<rect class="i" x="418" y="248" width="74" height="40" rx="5"/><rect class="i" x="404" y="286" width="8" height="14"/><rect class="i" x="498" y="286" width="8" height="14"/>'
            '<path class="p" d="M426 250 H484 M424.5 236 V284 M485.5 236 V284"/>')
LAMP = '<path class="t" d="M546 300 V148" style="stroke-width:3"/><path class="i" d="M525 152 L534 112 H558 L567 152 Z"/><rect class="i" x="531" y="295" width="30" height="5" rx="2"/>'
PHONE = ('<rect class="i" x="486" y="212" width="92" height="6" rx="1"/><path class="l" d="M494 218 L488 300 M570 218 L576 300" style="stroke-width:4"/><path class="t" d="M491 262 H573" style="stroke-width:2"/>'
         '<path class="i" d="M508 212 L516 191 H550 L558 212 Z"/><rect class="i" x="513" y="183" width="6" height="10"/><rect class="i" x="547" y="183" width="6" height="10"/>'
         '<path class="i" d="M500 186 q0 -11 11 -11 h44 q11 0 11 11 v7 h-15 v-6 h-36 v6 h-15 z"/><circle cx="533" cy="203" r="4.5" fill="#e9e9e9"/>')
LIGHT = '<path class="t" d="M530 190 V300 M530 258 L506 300 M530 258 L554 300" style="stroke-width:3.5"/><rect class="i" x="500" y="124" width="60" height="68" rx="3"/>'
TABLE = '<rect class="i" x="248" y="214" width="224" height="8" rx="1"/><path class="l" d="M262 222 V300 M458 222 V300"/><path class="t" d="M262 250 H458" style="stroke-width:2"/>'
MIC = ('<g transform="translate({x} 214)"><rect class="i" x="-15" y="-5" width="30" height="5" rx="2"/><path class="t" d="M0 -5 V-32" style="stroke-width:3.5"/>'
       '<g transform="translate(0 -32) rotate({r})"><rect class="i" x="-8" y="-32" width="16" height="34" rx="8"/><path class="p" d="M-8 -12 H8"/></g></g>')
SEAT = f'<g transform="translate(-218 0)">{CHAIR}</g>'                     # a chair pulled up to the left of the table
DESK = "140 140 344 162"
SCENES = {
    "set": ("140 60 340 242", CAMERA + CHAIR),
    "sitting": ("140 60 440 242", CAMERA + ARMCHAIR + LAMP),
    "call": ("350 150 240 152", CHAIR + PHONE),
    "shoot": ("140 60 440 242", CAMERA + CHAIR + LIGHT),
    "podcast": ("140 140 444 162", SEAT + TABLE + MIC.format(x=306, r=-30) + MIC.format(x=414, r=30) + f'<g transform="translate(112 0)">{CHAIR}</g>'),
    "budget": (DESK, SEAT + TABLE + '<rect class="i" x="296" y="205" width="64" height="9" rx="1"/><rect class="i" x="408" y="209" width="32" height="5" rx="2"/>'
               '<path class="t" d="M424 209 V182 L398 166" style="stroke-width:3"/><path class="i" d="M386 160 L412 149 L419 170 L393 180 Z"/>'),
    "releases": (DESK, SEAT + TABLE + '<rect class="i" x="322" y="158" width="48" height="56" rx="3"/><rect class="i" x="337" y="152" width="18" height="9" rx="2"/>'
                 '<path class="p" d="M331 176 H361 M331 186 H361 M331 196 H352"/><path class="t" d="M398 212 L432 193" style="stroke-width:3.5"/>'),
    "edit": (DESK, SEAT + TABLE + '<rect class="i" x="316" y="146" width="92" height="58" rx="3"/><path class="t" d="M362 204 V212" style="stroke-width:5"/><rect class="i" x="344" y="209" width="36" height="5" rx="2"/>'
             '<path class="p" d="M326 190 H398"/>'),
    "delivery": (DESK, SEAT + TABLE + '<rect class="i" x="312" y="196" width="76" height="18" rx="4"/><rect class="i" x="320" y="179" width="60" height="16" rx="4"/>'
                 '<rect class="i" x="408" y="198" width="44" height="16" rx="3"/><path class="p" d="M320 205 H380"/>'),
}
POST_SCENES = {"what-a-family-legacy-film-is": ("sitting", 560), "what-happens-on-the-first-call": ("call", 400), "what-goes-into-a-film-budget": ("budget", 430),
               "what-a-shoot-day-looks-like": ("shoot", 560), "releases-and-permissions": ("releases", 430), "how-an-edit-comes-together": ("edit", 430),
               "what-you-get-at-delivery": ("delivery", 430)}


def scene(kind, width):
    vb, art = SCENES[kind]; w, h = [float(v) for v in vb.split()[2:]]
    return f'<svg viewBox="{vb}" style="position:absolute;right:70px;bottom:52px;width:{width}px;height:{width * h / w:.0f}px">{art}</svg>'


def render(out, w, h, body, px=None):
    """Draw one page in Chrome at w x h. Saves a JPEG, or with px a square PNG icon scaled to px."""
    out.parent.mkdir(parents=True, exist_ok=True)
    page = (f'<!doctype html><html><head><meta charset="utf-8"><link rel="stylesheet" href="{FONTS}">'
            f"<style>{CSS}</style></head><body>{body}</body></html>")
    src, png = TMP / "card.html", TMP / "card.png"
    src.write_text(page)
    subprocess.run([CHROME, "--headless=new", "--disable-gpu", "--hide-scrollbars",
                    "--force-device-scale-factor=1", f"--window-size={w},{h}",
                    "--virtual-time-budget=9000", "--allow-file-access-from-files",
                    f"--screenshot={png}", src.as_uri()], capture_output=True, check=True)
    if px:
        subprocess.run(["sips", "-z", str(px), str(px), str(png), "--out", str(out)], capture_output=True, check=True)
    else:
        subprocess.run(["sips", "-s", "format", "jpeg", "-s", "formatOptions", "86", str(png), "--out", str(out)],
                       capture_output=True, check=True)
    print("wrote", out.relative_to(SITE))


MARK = ('<svg viewBox="0 0 40 40" style="position:absolute;right:58px;top:52px;width:38px;height:38px" fill="none" stroke="#f6efe2" stroke-width="1.3"><circle cx="20" cy="20" r="8.5"/>'
        '<path d="M20 2v10M20 28v10M2 20h10M28 20h10"/><circle cx="20" cy="20" r="1.7" fill="#f6efe2" stroke="none"/></svg>')


def tsize(t, big, mid, small):
    return big if len(t) <= 16 else mid if len(t) <= 26 else small


def film_card(n, f):
    """The photograph fills the frame; plate label and title bottom left, wordmark bottom right."""
    return (f'<img class="full" src="{photo(f["slug"]).as_uri()}">'
            '<div class="abs" style="inset:0;background:linear-gradient(0deg,#000000d1 0%,#00000080 26%,#00000000 54%)"></div>' + MARK +
            '<div class="abs" style="left:64px;right:64px;bottom:50px;display:flex;justify-content:space-between;align-items:flex-end;color:#f6efe2">'
            f'<div><p class="mono" style="font-size:19px;opacity:.85;margin-bottom:15px">Plate {n:02d} / {e(f["status"])}</p>'
            f'<h1 style="font-size:{tsize(f["title"], 98, 82, 74)}px">{e(f["title"])}</h1></div><span class="word lit">RedRiver<b>media</b></span></div>')


def drawn_card(title, label, kind, width, plate):
    """A drawn scene on the evening sky, with a quiet title."""
    return (f'<img class="full" src="{plate.as_uri()}"><div class="ground"></div>' + scene(kind, width) +
            '<div class="abs" style="left:64px;right:64px;top:54px;display:flex;justify-content:space-between;align-items:center">'
            f'<span class="word">RedRiver<b>media</b></span><span class="mono" style="font-size:19px">{e(label)}</span></div>'
            f'<div class="abs" style="left:64px;top:150px;width:560px"><h1 style="font-size:{tsize(title, 60, 54, 48)}px">{e(title)}</h1></div>')


def main():
    # Homepage card: the logo lockup alone.
    render(SITE / "assets" / "share-card.jpg", W, H,
           '<div style="position:absolute;inset:0;display:grid;place-items:center"><div class="lockup" style="font-size:132px">'
           '<div class="word" style="font-size:1em">RedRiver<b>media</b></div><div class="tag">Media for good and media for all</div></div></div>')
    # Icons: the wordmark's R, drawn large and scaled down. Bree Serif's capital R is
    # 0.66 of the font size tall and sits 0.08 below the middle of its line, so each
    # is nudged up by that much to land in the middle of the square.
    icon = '<div style="position:absolute;inset:0;display:grid;place-items:center"><div class="word" style="font-size:{0}px;line-height:1;transform:translateY(-{1}px)">R</div></div>'
    render(SITE / "assets" / "logo" / "apple-touch-icon.png", 720, 720, icon.format(673, 53), px=180)
    render(SITE / "assets" / "logo" / "favicon-32.png", 512, 512, icon.format(556, 44), px=32)

    plate = sky()
    render(BLOG / "share" / "index.jpg", W, H, drawn_card("Blog", "Notes for families", "sitting", 560, plate))
    for i, p in enumerate(POSTS, 1):
        kind, width = POST_SCENES[p["slug"]]
        render(BLOG / "share" / f"{p['slug']}.jpg", W, H, drawn_card(p["title"], f"Note {i:02d} / {p['cat']}", kind, width, plate))
    render(PORT / "share" / "index.jpg", W, H, drawn_card("Portfolio", "The work", "set", 430, plate))
    for n, f in enumerate(FILMS, 1):
        render(PORT / "share" / f"{f['slug']}.jpg", W, H, film_card(n, f))
    render(PORT / "share" / f"{COURSE['slug']}.jpg", W, H, drawn_card(COURSE["title"], f"Plate {len(FILMS) + 1:02d} / Courses", "podcast", 540, plate))


if __name__ == "__main__":
    main()
