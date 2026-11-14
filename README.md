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

The generator also rewrites the content security policy tag in `index.html`, so run it after changing any inline script or script tag on the homepage. Its output is checked in.

## Hosting on Netlify

`netlify.toml` sets the publish folder and the security response headers. The build command copies the pages and their assets into `dist/`, so `tools/`, `serve.py` and this file are not published.

The contact form uses Netlify Forms. After the first deploy:

1. In the Netlify dashboard, enable form detection for the site and redeploy.
2. Confirm a form named `contact` appears under Forms.
3. Add an email notification for that form with the address that should receive messages. The address is set there, not in the code.
4. Send a test message from the deployed site.

Link previews use `https://redrivercreativemedia.com/assets/share-card.jpg` (`og:image` in `index.html`). Update it if the domain changes.
