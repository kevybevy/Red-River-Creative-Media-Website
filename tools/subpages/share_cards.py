#!/usr/bin/env python3
"""Make the link-preview pictures and the browser icons.

    python3 tools/subpages/share_cards.py

Writes a 1200 x 630 JPEG for the blog index, each post, the portfolio index and
each project into blog/share/ and portfolio/share/, plus assets/share-card.jpg
for the homepage and the two icons in assets/logo/. build.py points each
page's og:image at its picture and copies the icons into blog/ and portfolio/.

Needs a Mac with Google Chrome (it draws each picture as a small web page and
takes a screenshot) and an internet connection for the fonts. The pictures are
checked in, so the site itself does not need this script to run.
"""
import html
import os
import subprocess
import sys
import tempfile
sys.dont_write_bytecode = True
from pathlib import Path

from build import BLOG, PORT, SITE, SHARE_STILLS
from content import POSTS, FILMS, COURSE, BLOG_INDEX, PORTFOLIO_INDEX

CHROME = os.environ.get("CHROME", "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome")
FONTS = ("https://fonts.googleapis.com/css2?family=Bree+Serif&family=IBM+Plex+Mono"
         "&family=Inter:wght@400;500&family=Playfair+Display:ital,wght@0,400;1,400&display=block")
e = html.escape

CSS = """
:root{--red:#900000;--ink:#111014;--paper:#f2f0eb;--grey:#5f5b56}
*{box-sizing:border-box;margin:0;padding:0}
html,body{width:100%;height:100%;overflow:hidden}
body{position:relative;background:var(--paper);color:var(--ink);font-family:"Inter",system-ui,sans-serif;-webkit-font-smoothing:antialiased}
.mono{font-family:"IBM Plex Mono",monospace;text-transform:uppercase;letter-spacing:.08em}
.word{font-family:"Bree Serif",Georgia,serif;letter-spacing:.01em;white-space:nowrap}.word b{font-weight:400;color:var(--red)}
h1{font-family:"Playfair Display",Georgia,serif;font-weight:400;letter-spacing:-.02em;line-height:1.02;text-wrap:balance}
.pad{position:absolute;inset:60px 64px}
.top{position:absolute;left:0;right:0;top:0;display:flex;justify-content:space-between;align-items:baseline;font-size:22px;color:var(--grey)}
.top .word{font-size:36px;color:var(--ink);text-transform:none}
.mid{position:absolute;left:0;right:0;top:96px;bottom:0;display:flex;flex-direction:column;justify-content:center}
.rule{width:150px;height:1px;background:#11101480;margin:34px 0 26px}
.dek{font-size:29px;line-height:1.38;color:#2a2a2a;max-width:960px}
/* film cards: a still, shaded on the left so the title reads */
.bg{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
.shade{position:absolute;inset:0;background:linear-gradient(90deg,#0d0c0feb 0%,#0d0c0fb8 44%,#0d0c0f00 76%)}
.dark{color:#fff}.dark .top{color:#ffffffcc}.dark .top .word{color:#fff}.dark .word b{color:#d42a2a}
.low{position:absolute;left:0;bottom:0;max-width:760px}.low .mono{font-size:22px;color:#ffffffcc;margin-bottom:20px}
/* logo lockup, as on the homepage */
.lockup{display:inline-flex;flex-direction:column;align-items:flex-start;line-height:1}
.lockup .tag{font-family:"Playfair Display",Georgia,serif;font-style:italic;font-size:.3em;margin-top:.22em;color:#2b2a2e;white-space:nowrap}
"""


def render(out, w, h, body, css="", px=None):
    """Draw one page in Chrome at w x h. Saves a JPEG, or with px a square PNG icon scaled to px."""
    out.parent.mkdir(parents=True, exist_ok=True)
    page = (f'<!doctype html><html><head><meta charset="utf-8"><link rel="stylesheet" href="{FONTS}">'
            f"<style>{CSS}{css}</style></head><body>{body}</body></html>")
    with tempfile.TemporaryDirectory() as tmp:
        src, png = Path(tmp) / "card.html", Path(tmp) / "card.png"
        src.write_text(page)
        subprocess.run([CHROME, "--headless=new", "--disable-gpu", "--hide-scrollbars",
                        "--force-device-scale-factor=1", f"--window-size={w},{h}",
                        "--virtual-time-budget=9000", "--allow-file-access-from-files",
                        f"--screenshot={png}", src.as_uri()], capture_output=True, check=True)
        if px:
            subprocess.run(["sips", "-z", str(px), str(px), str(png), "--out", str(out)], capture_output=True, check=True)
        else:
            subprocess.run(["sips", "-s", "format", "jpeg", "-s", "formatOptions", "84", str(png), "--out", str(out)],
                           capture_output=True, check=True)
    print("wrote", out.relative_to(SITE))


WORD = '<span class="word">RedRiver<b>media</b></span>'


def title_size(title):
    return 112 if len(title) <= 22 else 98 if len(title) <= 30 else 86


def paper_card(label, title, dek):
    return (f'<div class="pad"><div class="top mono"><span>{e(label)}</span>{WORD}</div>'
            f'<div class="mid"><h1 style="font-size:{title_size(title)}px">{e(title)}</h1>'
            f'<div class="rule"></div><p class="dek">{e(dek)}</p></div></div>')


def film_card(f):
    still = PORT / "media" / "stills" / f["slug"] / f"{SHARE_STILLS[f['slug']]}.webp"
    return (f'<div class="dark"><img class="bg" src="{still.as_uri()}"><div class="shade"></div>'
            f'<div class="pad"><div class="top mono">{WORD}<span></span></div>'
            f'<div class="low"><p class="mono">{e(f["status"])}</p>'
            f'<h1 style="font-size:{title_size(f["title"])}px">{e(f["title"])}</h1></div></div></div>')


def course_card(f):
    photo = PORT / "media" / f["poster"]
    return (f'<div class="pad"><div class="top mono"><span>{e(f["status"])}</span>{WORD}</div>'
            f'<div class="mid" style="flex-direction:row;align-items:center;gap:48px">'
            f'<div style="flex:1"><h1 style="font-size:74px">{e(f["title"])}</h1>'
            f'<p style="font-family:\'Playfair Display\',serif;font-style:italic;font-size:27px;margin-top:18px">{e(f["sub"])}</p></div>'
            f'<img src="{photo.as_uri()}" style="width:520px;aspect-ratio:16/9;object-fit:cover;box-shadow:0 24px 50px -30px #000a">'
            f'</div></div>')


def main():
    # Homepage card: the logo lockup alone.
    render(SITE / "assets" / "share-card.jpg", 1200, 630,
           '<div style="position:absolute;inset:0;display:grid;place-items:center"><div class="lockup" style="font-size:132px">'
           '<div class="word">RedRiver<b>media</b></div><div class="tag">Media for good and media for all</div></div></div>')
    # Icons: the wordmark's R, drawn large and scaled down. Bree Serif's capital R is
    # 0.66 of the font size tall and sits 0.08 below the middle of its line, so each
    # is nudged up by that much to land in the middle of the square.
    icon = '<div style="position:absolute;inset:0;display:grid;place-items:center"><div class="word" style="font-size:{0}px;line-height:1;transform:translateY(-{1}px)">R</div></div>'
    render(SITE / "assets" / "logo" / "apple-touch-icon.png", 720, 720, icon.format(673, 53), px=180)
    render(SITE / "assets" / "logo" / "favicon-32.png", 512, 512, icon.format(556, 44), px=32)

    render(BLOG / "share" / "index.jpg", 1200, 630, paper_card("Notes for families", "Blog", BLOG_INDEX["intro"]))
    for i, p in enumerate(POSTS, 1):
        render(BLOG / "share" / f"{p['slug']}.jpg", 1200, 630, paper_card(f"Blog / {p['cat']}", p["title"], p["dek"]))
    render(PORT / "share" / "index.jpg", 1200, 630, paper_card("The work", "Portfolio", PORTFOLIO_INDEX["intro"]))
    for f in FILMS:
        render(PORT / "share" / f"{f['slug']}.jpg", 1200, 630, film_card(f))
    render(PORT / "share" / f"{COURSE['slug']}.jpg", 1200, 630, course_card(COURSE))


if __name__ == "__main__":
    main()
