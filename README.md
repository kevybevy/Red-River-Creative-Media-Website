# Red River Creative Media Website

The current RedRiver website: a scrolling homepage, seven blog posts, and five portfolio project pages. Plain HTML, CSS, and JavaScript; no build step is required to view the site.

Run locally with Python 3:

```sh
python3 serve.py
```

Open http://localhost:8123/. Add `?motion=off` to preview reduced motion. Google Fonts and GSAP load from external services and require an internet connection.

The homepage is `index.html`, with styles in `css/`, scripts in `js/`, and images in `assets/`. Blog and portfolio pages are in `blog/` and `portfolio/`. Their generator and content are included in `tools/subpages/`; the checked-in HTML and CSS preserve the current working version. Review generator output before replacing those pages because the working site also contains later presentation changes.

This copy preserves the current local working site from `.council/content-integration/site/`, including the approved button changes, slower navigation transitions, wider mobile Studio layout, and light-only appearance. The original local preview remains in place. Internal reviews, backups, transcripts, design references, and proposal files are excluded.

The contact form is a preview and does not deliver messages. Uploading this repository does not publish a live website or configure hosting.
