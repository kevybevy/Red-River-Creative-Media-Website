# Red River Creative Media Website

The RedRiver website: a scrolling homepage, seven blog posts, and five portfolio project pages. Plain HTML, CSS, and JavaScript; no build step is required to view the site.

## Run locally

```sh
python3 serve.py
```

Open http://localhost:8123/. Add `?motion=off` to preview reduced motion. Google Fonts load from an external service and require an internet connection. GSAP 3.12.5 and ScrollTrigger are served from `js/vendor/`.

The contact form only delivers on Netlify. In a local preview, sending shows the "that did not go through" message.

## Layout

The homepage is `index.html`, with styles in `css/`, scripts in `js/`, and images in `assets/`.

Blog and portfolio pages are in `blog/` and `portfolio/`. They are generated: edit `tools/subpages/content.py`, `common.css` or `motion.js`, then run

```sh
python3 tools/subpages/build.py
```

The generator also rewrites the content security policy tag in `index.html`, so run it after changing any inline script or script tag on the homepage. It writes `404.html` (the page-not-found page), `robots.txt` and `sitemap.xml` at the site root too. Its output is checked in.

Link-preview pictures and the browser icons are drawn by a second script:

```sh
python3 tools/subpages/share_cards.py
```

It writes one 1200 x 630 picture per blog post and project into `blog/share/` and `portfolio/share/`, the homepage picture `assets/share-card.jpg`, and the icons in `assets/logo/`. Run it when a title, post or project changes, then run `build.py`. The four films use a photograph with a slight grain, cropped clear of any burnt-in web address, logo or name caption. Every other page gets a drawn scene, and the homepage is the logo alone. The headline and the line under it for each page are in `SHARE` in `build.py`. It needs a Mac with Google Chrome and Pillow (`pip install pillow`); the pictures are checked in.

## Hosting on Netlify

`netlify.toml` sets the publish folder and the security response headers. The build command copies the pages and their assets into `dist/`, so `tools/`, `serve.py` and this file are not published.

The contact form uses Netlify Forms. After the first deploy:

1. In the Netlify dashboard, enable form detection for the site and redeploy.
2. Confirm a form named `contact` appears under Forms.
3. Add an email notification for that form with the address that should receive messages. The address is set there, not in the code.
4. Send a test message from the deployed site.

Link previews, `robots.txt` and `sitemap.xml` use the full address `https://redrivercreativemedia.com`. If the domain changes, update `DOMAIN` in `tools/subpages/build.py` and the `og:url` and `og:image` tags in `index.html`, then run `build.py`.

Netlify shows `404.html` for any address that does not exist.
