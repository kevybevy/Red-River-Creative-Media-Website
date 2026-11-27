#!/usr/bin/env python3
"""Build the blog and portfolio pages from content.py.

    python3 tools/subpages/build.py

Writes blog/index.html, blog/<post>/index.html, portfolio/index.html and
portfolio/<film>/index.html, and copies common.css, motion.js and js/links.js
into both folders, so each folder stands alone (ready for its own subdomain).
Also writes 404.html, robots.txt and sitemap.xml at the site root.
Edit content.py, common.css or motion.js here, then run this again.

Link-preview pictures (blog/share/, portfolio/share/) are made separately by
share_cards.py; run it when a title, post or film changes.
"""
import html
import sys
sys.dont_write_bytecode = True
import re
import shutil
import struct
from pathlib import Path

from content import POSTS, FILMS, PROJECTS, COURSE, BLOG_INDEX, PORTFOLIO_INDEX
from security import secure_html

HERE = Path(__file__).resolve().parent
SITE = HERE.parent.parent
BLOG = SITE / "blog"
PORT = SITE / "portfolio"

FONTS = ("https://fonts.googleapis.com/css2?family=Bree+Serif&family=IBM+Plex+Mono"
         "&family=Inter:wght@400;500&family=Playfair+Display:ital,wght@0,400;1,400&display=swap")

# The live address. Link previews (og:url, og:image), robots.txt and sitemap.xml
# need full URLs. index.html carries the same address in its own og: tags.
DOMAIN = "https://redrivercreativemedia.com"

# The still behind each film's link-preview picture (see share_cards.py).
SHARE_STILLS = {
    "saving-clayton": "01-bill-and-lisa",
    "trans-oklahoma": "02-laura-kitchen-interview",
    "oasis-in-atlanta": "04-family-archive",
    "sacrificing-lincoln": "05-water-at-sunset",
}

e = html.escape


def words(n):
    return len(re.sub(r"<[^>]+>", " ", n).split())


def minutes(body):
    return max(1, round(words(body) / 200))


def rise(text, start=0):
    """Wrap each word so the heading rises in word by word, line by line."""
    out = []
    for i, w in enumerate(text.split()):
        out.append(f'<span class="w"><span style="--i:{start + i}">{e(w)}</span></span>')
    return " ".join(out)


def page(*, title, desc, depth, section, body, path, share, share_alt, progress=False, og_type="website"):
    """path: this page's address under the site root. share: its picture in <section>/share/."""
    up = "../" * depth                      # to the folder root (blog/ or portfolio/)
    home = "../" * (depth + 1)              # to the main site
    other = "portfolio" if section == "blog" else "blog"
    blog_href = up if section == "blog" else f"{home}blog/"
    port_href = up if section == "portfolio" else f"{home}portfolio/"
    cur_b = ' aria-current="page"' if section == "blog" and depth == 0 else (' aria-current="true"' if section == "blog" else "")
    cur_p = ' aria-current="page"' if section == "portfolio" and depth == 0 else (' aria-current="true"' if section == "portfolio" else "")
    return secure_html(f"""<!DOCTYPE html>
<html lang="en" data-hosting="paths">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>{e(title)}</title>
  <meta name="description" content="{e(desc)}">
  <meta name="theme-color" content="#f2f0eb">
  <meta property="og:type" content="{og_type}">
  <meta property="og:site_name" content="RedRiver Creative Media">
  <meta property="og:title" content="{e(title)}">
  <meta property="og:description" content="{e(desc)}">
  <meta property="og:url" content="{DOMAIN}/{path}">
  <meta property="og:image" content="{DOMAIN}/{section}/share/{share}.jpg">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:image:alt" content="{e(share_alt)}">
  <meta name="twitter:card" content="summary_large_image">
  <link rel="icon" href="{up}favicon-32.png" sizes="32x32" type="image/png">
  <link rel="apple-touch-icon" href="{up}apple-touch-icon.png">
  <!-- One motion policy with the main page: ?motion=off, the main page's
       "Reduce motion" choice (rr-motion), or the OS setting stops all motion,
       page-to-page transitions included. If motion.js does not run, the class
       comes off again so nothing stays hidden. -->
  <script>
    (function () {{
      var d = document.documentElement, still = /[?&]motion=off\\b/.test(location.search);
      try {{ still = still || localStorage.getItem('rr-motion') === 'off'; }} catch (e) {{}}
      still = still || !window.matchMedia || window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      d.classList.add(still ? 'no-motion' : 'motion');
      if (still) ['pageswap', 'pagereveal'].forEach(function (t) {{
        window.addEventListener(t, function (e) {{ if (e.viewTransition) e.viewTransition.skipTransition(); }});
      }});
      window.addEventListener('load', function () {{ if (!window.RRmotion) d.classList.remove('motion'); }});
    }})();
  </script>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link rel="stylesheet" href="{FONTS}">
  <script src="{up}page-start.js"></script>
  <link rel="stylesheet" href="{up}common.css">
  <link rel="stylesheet" href="{up}buttons.css">
  <script src="{up}key-feedback.js" defer></script>
  <script src="{up}links.js" defer></script>
  <script src="{up}motion.js" defer></script>
</head>
<body>
  <a class="skip-link mono" href="#main">Skip to content</a>
{'  <div class="progress" aria-hidden="true"></div>' + chr(10) if progress else ''}  <header class="bar">
    <a class="bar__brand" data-link="home" href="{home}">
      <span class="wordmark" aria-hidden="true">RedRiver<span class="wordmark__red">media</span></span>
      <span class="sr-only">RedRiver Creative Media, main site</span>
    </a>
    <nav class="mono" aria-label="Blog and portfolio">
      <a class="link" data-link="blog" href="{blog_href}"{cur_b}>Blog</a>
      <a class="link" data-link="portfolio" href="{port_href}"{cur_p}>Portfolio</a>
    </nav>
    <nav class="bar__right mono" aria-label="Main site">
      <a class="link" data-link="home" href="{home}">Main site</a>
      <a class="link" data-link="home" href="{home}#contact">Contact</a>
    </nav>
  </header>

  <main id="main" tabindex="-1">
{body}
  </main>

  <footer class="foot">
    <div class="col col--wide">
      <a class="bar__brand" data-link="home" href="{home}"><span class="wordmark" aria-hidden="true">RedRiver<span class="wordmark__red">media</span></span><span class="sr-only">RedRiver Creative Media, main site</span></a>
      <p class="foot__place mono">Est. 2011 / The Woodlands, Texas</p>
      <nav class="mono" aria-label="Footer">
        <a class="link" data-link="home" href="{home}">Main site</a>
        <a class="link" data-link="{other}" href="{home}{other}/">{other.capitalize()}</a>
        <a class="link" data-link="home" href="{home}#contact">Contact</a>
      </nav>
    </div>
  </footer>
</body>
</html>
""")


# ---------------------------------------------------------------------------
# Blog
# ---------------------------------------------------------------------------
def blog_index():
    rows = []
    for i, p in enumerate(POSTS):
        rows.append(f"""        <li data-reveal style="--i:{min(i, 2)}">
          <a class="entry" href="{p['slug']}/">
            <p class="entry__meta mono"><time datetime="{p['date']}">{p['date_label']}</time><br>{e(p['cat'])}</p>
            <div>
              <h2 class="entry__t">{e(p['title'])}</h2>
              <p class="entry__dek">{e(p['dek'])}</p>
              <p class="entry__more mono">Read, {minutes(p['body'])} min <span class="arrow" aria-hidden="true">&rarr;</span></p>
            </div>
          </a>
        </li>""")
    body = f"""    <div class="col">
      <header class="head">
        <h1 class="head__t rise">{rise('Blog')}</h1>
        <p class="head__sub intro" style="--i:0">{e(BLOG_INDEX['intro'])}</p>
      </header>
      <ol class="posts intro" style="--i:1" aria-label="Posts">
{chr(10).join(rows)}
      </ol>
    </div>"""
    return page(title="Blog | RedRiver Creative Media",
                desc=BLOG_INDEX['meta_description'],
                depth=0, section="blog", body=body, path="blog/", share="index",
                share_alt="Blog. Notes for families, from RedRiver Creative Media.")


def blog_post(i, p):
    nxt = POSTS[(i + 1) % len(POSTS)]
    body = f"""    <article class="col">
      <div class="article__top"><a class="back mono" href="../"><span class="arrow" aria-hidden="true">&larr;</span> All posts</a></div>
      <p class="article__meta mono intro" style="--i:0"><time datetime="{p['date']}">{p['date_label']}</time> / {e(p['cat'])} / {minutes(p['body'])} min read</p>
      <h1 class="article__t rise">{rise(p['title'])}</h1>
      <p class="article__dek intro" style="--i:1">{e(p['dek'])}</p>
      <div class="article__rule" aria-hidden="true"></div>
      <div class="prose intro" style="--i:2">
{p['body'].strip()}
      </div>
      <p class="ask">{e(p['nav']['contact_lead'])} <a data-link="home" href="../../#contact">Start with a conversation</a>.</p>
      <a class="next" href="../{nxt['slug']}/" data-reveal>
        <span class="next__label mono">Next post</span>
        <span class="next__t"><span>{e(nxt['title'])}</span><span class="arrow" aria-hidden="true">&rarr;</span></span>
      </a>
    </article>"""
    return page(title=f"{p['title']} | RedRiver Creative Media blog", desc=p["dek"],
                depth=1, section="blog", body=body, progress=True, og_type="article",
                path=f"blog/{p['slug']}/", share=p["slug"],
                share_alt=f"{p['title']}. From the RedRiver Creative Media blog.")


# ---------------------------------------------------------------------------
# Portfolio
# ---------------------------------------------------------------------------
def vt(slug):
    return f'style="view-transition-name: poster-{slug}"'


def portfolio_index():
    rows = []
    for i, f in enumerate(PROJECTS):
        sub = f'\n              <p class="film-row__sub">{e(f["sub"])}</p>' if f["sub"] else ""
        rows.append(f"""        <li data-reveal>
          <a class="film-row{' film-row--course' if f['slug'] == COURSE['slug'] else ''}" href="{f['slug']}/">
            <figure class="poster"><img src="media/{f['poster']}" width="{f['w']}" height="{f['h']}" alt="{e(f['alt'])}" {'loading="lazy" ' if i > 0 else ''}{vt(f['slug'])}></figure>
            <div>
              <p class="film-row__status mono">{e(f['status'])}</p>
              <h2 class="film-row__t">{e(f['title'])}</h2>{sub}
              <p class="film-row__line">{e(f['line'])}</p>
              <p class="film-row__more mono">{e(f['card_label'])} <span class="arrow" aria-hidden="true">&rarr;</span></p>
            </div>
          </a>
        </li>""")
    body = f"""    <div class="col col--wide">
      <header class="head">
        <h1 class="head__t rise">{rise('Portfolio')}</h1>
        <p class="head__sub intro" style="--i:0">{e(PORTFOLIO_INDEX['intro'])}</p>
      </header>

      <ol class="films" aria-label="Projects">
{chr(10).join(rows)}
      </ol>

      <p class="portfolio-blog" data-reveal><a class="link mono" data-link="blog" href="../blog/">Blog <span class="arrow" aria-hidden="true">&rarr;</span></a></p>

      <p class="ask" data-reveal>Have a story in mind? <a data-link="home" href="../#contact">Start with a conversation</a>.</p>
    </div>"""
    return page(title="Portfolio | RedRiver Creative Media",
                desc=PORTFOLIO_INDEX['meta_description'],
                depth=0, section="portfolio", body=body, path="portfolio/", share="index",
                share_alt="Portfolio. Documentaries and courses by RedRiver Creative Media.")


def still(slug, item, lead=False):
    """One frame from the film at its natural size, with its caption."""
    sid, w, h, cap, alt = item
    load = 'decoding="async"' if lead else 'loading="lazy" decoding="async"'
    return (f'<figure class="still{" still--lead intro" if lead else ""}"{" style=\"--i:2\"" if lead else ""}>'
            f'<img src="../media/stills/{slug}/{sid}.webp" width="{w}" height="{h}" alt="{e(alt)}" {load}>'
            f'<figcaption class="still__cap">{e(cap)}</figcaption></figure>')


def film_page(i, f):
    nxt = PROJECTS[(i + 1) % len(PROJECTS)]
    sub = f'\n          <p class="film__sub intro" style="--i:0">{e(f["sub"])}</p>' if f["sub"] else ""
    about = "\n".join(f"            <p>{e(t)}</p>" for t in f["about"])
    lead, *rest = f["stills"]
    gallery = "\n".join(f"            {still(f['slug'], s)}" for s in rest)
    production = "\n".join(f"            <p>{e(t)}</p>" for t in f["production"])
    rec = ""
    if f["recognition"]:
        items = "\n".join(f"            <li>{e(r)}</li>" for r in f["recognition"])
        rec = f"""
        <section class="film__sec" aria-labelledby="rec-t" data-reveal>
          <h2 class="film__h mono" id="rec-t">Recognition</h2>
          <ul class="film__list">
{items}
          </ul>
        </section>"""
    creds = ""
    if f["credits"]:
        rows = "\n".join(f'              <div><dt class="mono">{e(k)}</dt><dd>{e(v)}</dd></div>' for k, v in f["credits"])
        creds = f"""
            <dl class="credits">
{rows}
            </dl>"""
    watch = ""
    if f["watch"]:
        label, url = f["watch"]
        watch = f'\n        <a class="film__watch link mono" href="{url}" target="_blank" rel="noreferrer">{e(label)}<span class="sr-only"> (opens in a new tab)</span></a>'
    body = f"""    <div class="col col--wide">
      <div class="article__top"><a class="back mono" href="../"><span class="arrow" aria-hidden="true">&larr;</span> All projects</a></div>
      <article class="film">
        <figure class="film__poster"><img src="../media/{f['poster']}" width="{f['w']}" height="{f['h']}" alt="{e(f['alt'])}" {vt(f['slug'])}></figure>
        <div>
          <p class="film__status mono intro" style="--i:0">{e(f['status'])}</p>
          <h1 class="film__t rise">{rise(f['title'])}</h1>{sub}
          <p class="film__line intro" style="--i:1">{e(f['line'])}</p>
          {still(f['slug'], lead, lead=True)}
          <section class="film__sec" aria-labelledby="about-t" data-reveal>
            <h2 class="film__h mono" id="about-t">About the film</h2>
            <div class="film__about">
{about}
            </div>{watch}
          </section>
          <section class="film__sec" aria-labelledby="stills-t" data-reveal>
            <h2 class="film__h mono" id="stills-t">From the film</h2>
            <div class="stills">
{gallery}
            </div>
          </section>{rec}
          <section class="film__sec" aria-labelledby="prod-t" data-reveal>
            <h2 class="film__h mono" id="prod-t">Production</h2>
            <div class="film__about">
{production}
            </div>{creds}
          </section>
          <a class="next" href="../{nxt['slug']}/" data-reveal>
            <span class="next__label mono">Next project</span>
            <span class="next__t"><span>{e(nxt['title'])}</span><span class="arrow" aria-hidden="true">&rarr;</span></span>
          </a>
        </div>
      </article>
    </div>"""
    share_alt = next(alt for sid, _w, _h, _cap, alt in f["stills"] if sid == SHARE_STILLS[f["slug"]])
    return page(title=f"{f['title']} | RedRiver Creative Media", desc=f["seo"],
                depth=1, section="portfolio", body=body, progress=True, og_type="video.movie",
                path=f"portfolio/{f['slug']}/", share=f["slug"],
                share_alt=f"{f['title']}. {share_alt}")


def course_page():
    f = COURSE
    about = "\n".join(f"          <p>{e(t)}</p>" for t in f['about'])
    production = "\n".join(f"          <p>{e(t)}</p>" for t in f['production'])
    photos = "\n".join(
        f'''          <figure class="still" data-reveal><img src="../media/relationship-rescue/{p['file']}" width="{p['w']}" height="{p['h']}" alt="{e(p['alt'])}" loading="lazy" decoding="async"><figcaption class="still__cap">{e(p['caption'])}</figcaption></figure>'''
        for p in f['photos'])
    links = []
    for c in f['ctas']:
        attrs = 'target="_blank" rel="noreferrer"' if c['external'] else 'data-link="home"'
        note = '<span class="sr-only"> (opens in a new tab)</span>' if c['external'] else ''
        links.append(f'''        <a class="film__watch link mono" href="{e(c['href'])}" {attrs}>{e(c['label'])}{note}</a>''')
    body = f'''    <article class="col">
      <div class="article__top"><a class="back mono" href="../"><span class="arrow" aria-hidden="true">&larr;</span> All projects</a></div>
      <header class="head">
        <p class="film__status mono intro">{e(f['status'])}</p>
        <h1 class="head__t rise">{rise(f['title'])}</h1>
        <p class="film__sub intro">{e(f['sub'])}</p>
        <p class="head__sub intro">{e(f['line'])}</p>
      </header>
      <section class="film__sec" aria-labelledby="about-t">
        <h2 class="film__h mono" id="about-t">About the project</h2>
        <div class="film__about">
{about}
        </div>
      </section>
      <section class="film__sec" aria-labelledby="photos-t">
        <h2 class="film__h mono" id="photos-t">From the project</h2>
        <div class="project-photos">
{photos}
        </div>
      </section>
      <section class="film__sec" aria-labelledby="prod-t" data-reveal>
        <h2 class="film__h mono" id="prod-t">Production</h2>
        <div class="film__about">
{production}
        </div>
      </section>
      <nav class="project-links" aria-label="Project links" data-reveal>
{chr(10).join(links)}
      </nav>
      <a class="next" href="{e(f['nav']['next_href'])}" data-reveal>
        <span class="next__label mono">Next project</span>
        <span class="next__t"><span>{e(f['nav']['next_title'])}</span><span class="arrow" aria-hidden="true">&rarr;</span></span>
      </a>
    </article>'''
    return page(title=f"{f['title']} | RedRiver Creative Media", desc=f['seo'],
                depth=1, section='portfolio', body=body, progress=True,
                path=f"portfolio/{f['slug']}/", share=f['slug'],
                share_alt=f"{f['title']}. {f['alt']}")


# ---------------------------------------------------------------------------
# Site root: page not found, robots.txt, sitemap.xml
# ---------------------------------------------------------------------------
def not_found():
    """Netlify serves /404.html for any missing address, at any depth, so every
    link and file here starts at the site root. No scripts: the page is still.
    The jokes are about filmmaking only, never about a film's subject."""
    return secure_html(f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Page not found | RedRiver Creative Media</title>
  <meta name="robots" content="noindex">
  <meta name="theme-color" content="#f2f0eb">
  <link rel="icon" href="/assets/logo/favicon-32.png" sizes="32x32" type="image/png">
  <link rel="apple-touch-icon" href="/assets/logo/apple-touch-icon.png">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link rel="stylesheet" href="{FONTS}">
  <link rel="stylesheet" href="/blog/common.css">
  <link rel="stylesheet" href="/blog/buttons.css">
  <style>
    .nf__rec {{ display: inline-flex; align-items: center; gap: 0.7em; margin-bottom: 26px; padding: 0.55em 0.9em; background: var(--ink); color: #fff; }}
    .nf__dot {{ width: 0.55em; height: 0.55em; border-radius: 50%; background: #e02020; }}
    .nf .head__t {{ text-wrap: balance; }}
    .nf .ask + .ask {{ margin-top: 14px; }}
  </style>
</head>
<body>
  <a class="skip-link mono" href="#main">Skip to content</a>
  <header class="bar">
    <a class="bar__brand" href="/">
      <span class="wordmark" aria-hidden="true">RedRiver<span class="wordmark__red">media</span></span>
      <span class="sr-only">RedRiver Creative Media, main site</span>
    </a>
    <nav class="mono" aria-label="Blog and portfolio">
      <a class="link" href="/blog/">Blog</a>
      <a class="link" href="/portfolio/">Portfolio</a>
    </nav>
    <nav class="bar__right mono" aria-label="Main site">
      <a class="link" href="/">Main site</a>
      <a class="link" href="/#contact">Contact</a>
    </nav>
  </header>

  <main id="main" tabindex="-1">
    <div class="col nf">
      <header class="head">
        <p class="nf__rec mono"><span class="nf__dot" aria-hidden="true"></span>REC 00:00:04:04</p>
        <p class="film__status mono">Scene 404 / Take 1 / Page not found</p>
        <h1 class="head__t">This scene did not make the final cut</h1>
        <p class="head__sub">We checked the camera card, the backup drive, and the backup of the backup. The page you asked for is not on any of them.</p>
      </header>
      <p class="ask">Quiet on set. Take two starts at the <a href="/">main site</a>. Or see what did make the cut in the <a href="/portfolio/">portfolio</a> and the <a href="/blog/">blog</a>.</p>
      <p class="ask">If one of our links sent you here, that one is on us. <a href="/#contact">Tell us</a> and we will fix it in post.</p>
    </div>
  </main>

  <footer class="foot">
    <div class="col col--wide">
      <a class="bar__brand" href="/"><span class="wordmark" aria-hidden="true">RedRiver<span class="wordmark__red">media</span></span><span class="sr-only">RedRiver Creative Media, main site</span></a>
      <p class="foot__place mono">Est. 2011 / The Woodlands, Texas</p>
    </div>
  </footer>
</body>
</html>
""")


def sitemap():
    urls = [("", None), ("blog/", None)]
    urls += [(f"blog/{p['slug']}/", p["date"]) for p in POSTS]
    urls += [("portfolio/", None)] + [(f"portfolio/{f['slug']}/", None) for f in PROJECTS]
    rows = "\n".join(
        f"  <url><loc>{DOMAIN}/{path}</loc>{f'<lastmod>{date}</lastmod>' if date else ''}</url>" for path, date in urls)
    return f'<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n{rows}\n</urlset>\n'


# robots.txt: the lines search engines read, under a note for whoever opens the file.
ROBOTS = f"""# Hello, robot. You found the call sheet.
#
# RedRiver Creative Media makes documentaries, so nothing here is off the record.
# Look around. Read everything. Please do not ask for a producer credit.
#
# If you are a person reading this, you are exactly the kind of curious we like.
# The films:  {DOMAIN}/portfolio/
# Say hello:  {DOMAIN}/#contact

User-agent: *
Allow: /

Sitemap: {DOMAIN}/sitemap.xml
"""


def check_share_cards():
    """Every page that names a link-preview picture has one on disk."""
    wanted = [BLOG / "share" / "index.jpg", PORT / "share" / "index.jpg"]
    wanted += [BLOG / "share" / f"{p['slug']}.jpg" for p in POSTS]
    wanted += [PORT / "share" / f"{f['slug']}.jpg" for f in PROJECTS]
    missing = [str(w.relative_to(SITE)) for w in wanted if not w.exists()]
    if missing:
        sys.exit("missing link-preview pictures (run tools/subpages/share_cards.py): " + ", ".join(missing))


# ---------------------------------------------------------------------------
def webp_size(path):
    """Width and height from a WebP file's header (VP8, VP8L or VP8X)."""
    b = path.read_bytes()[:30]
    if b[:4] != b"RIFF" or b[8:12] != b"WEBP":
        raise ValueError(f"{path} is not a WebP file")
    kind = b[12:16]
    if kind == b"VP8X":
        return 1 + int.from_bytes(b[24:27], "little"), 1 + int.from_bytes(b[27:30], "little")
    if kind == b"VP8 ":
        return struct.unpack("<H", b[26:28])[0] & 0x3FFF, struct.unpack("<H", b[28:30])[0] & 0x3FFF
    v = int.from_bytes(b[21:25], "little")
    return (v & 0x3FFF) + 1, ((v >> 14) & 0x3FFF) + 1


def check_stills():
    """Every film has five stills on disk, each the size content.py states, and nothing else."""
    for f in FILMS:
        if len(f["stills"]) != 5:
            sys.exit(f"{f['slug']}: expected 5 stills, found {len(f['stills'])}")
        folder = PORT / "media" / "stills" / f["slug"]
        for sid, w, h, _cap, _alt in f["stills"]:
            path = folder / f"{sid}.webp"
            if not path.exists():
                sys.exit(f"missing still: {path}")
            if webp_size(path) != (w, h):
                sys.exit(f"{path}: file is {webp_size(path)}, content.py says {(w, h)}")
        extra = sorted({p.name for p in folder.iterdir()} - {f"{sid}.webp" for sid, *_ in f["stills"]})
        if extra:
            sys.exit(f"{folder}: files not listed in content.py: {extra}")


def write(path, text):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text)


def main():
    check_stills()
    write(SITE / 'index.html', secure_html((SITE / 'index.html').read_text()))
    for folder in (BLOG, PORT):
        # Clear generated post and film folders so renamed ones do not linger.
        for d in folder.iterdir():
            if d.is_dir() and (d / "index.html").exists():
                shutil.rmtree(d)
        shutil.copy(HERE / "page-start.js", folder / "page-start.js")
        shutil.copy(HERE / "common.css", folder / "common.css")
        shutil.copy(HERE / "motion.js", folder / "motion.js")
        shutil.copy(SITE / "js" / "links.js", folder / "links.js")
        shutil.copy(SITE / "css" / "buttons.css", folder / "buttons.css")
        shutil.copy(SITE / "js" / "key-feedback.js", folder / "key-feedback.js")
        for icon in ("favicon-32.png", "apple-touch-icon.png"):
            shutil.copy(SITE / "assets" / "logo" / icon, folder / icon)
    write(BLOG / "index.html", blog_index())
    for i, p in enumerate(POSTS):
        write(BLOG / p["slug"] / "index.html", blog_post(i, p))
    write(PORT / "index.html", portfolio_index())
    for i, f in enumerate(FILMS):
        write(PORT / f["slug"] / "index.html", film_page(i, f))
    write(PORT / COURSE['slug'] / 'index.html', course_page())
    write(SITE / "404.html", not_found())
    write(SITE / "sitemap.xml", sitemap())
    write(SITE / "robots.txt", ROBOTS)
    check_share_cards()
    print(f"blog: {len(POSTS)} posts, portfolio: {len(PROJECTS)} projects")


if __name__ == "__main__":
    main()
