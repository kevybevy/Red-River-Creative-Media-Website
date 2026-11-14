# Launch plan: RedRiver site on Netlify

Handoff for the model finishing this work. Read all of it before changing anything.

## Goal

Get `main` to a state that deploys on Netlify as is, with a contact form that will deliver email once Netlify is connected. Connecting Netlify is not part of this pass; the owner does it later. This pass ends when the pull request is open and verified.

## How to treat the reviews

Two AI reviews of commit `f2c44ce` produced the list of changes below. They are guidance, not requirements. The owner said so directly. Apply this rule throughout:

- If a change is needed to launch, make it work.
- If a change is not needed to launch and it fails a check or looks risky, revert its commit and move on. Do not spend time debugging it. Each change is its own commit for this reason.
- Do not add work because a review suggested it. The "Not doing" list at the end is deliberate.

## Owner decisions (fixed, do not reopen)

- Hosting is Netlify, static. Use Netlify's HTTPS and platform protection; add no other security layer beyond the five headers in `netlify.toml`.
- Contact form uses Netlify Forms. The receiving address is set in the Netlify dashboard, never in code.
- GSAP is served from the site (`js/vendor/`), not a CDN.
- Production domain is `https://redrivercreativemedia.com` (apex).
- Landscape phones use the phone particle count for the People portraits.
- Work reaches `main` through a pull request that the owner merges. Do not push to `main`.
- No page, section or visible feature is removed, merged or redesigned. Layout, copy, typography and animation choreography stay as they are.
- The homepage has no project links on purpose. The redaction (Studio) scene is approved and must not change. The contact section's hidden, discover-by-typing presentation is intentional. Services stay together in one scene; do not remove or split a service unless the owner names one.

## State of the branch

Branch `claude/gracious-allen-ltsj80`, nine commits ahead of `main` (`f2c44ce`), pushed. No pull request yet.

| Commit | Change | Needed to launch |
| --- | --- | --- |
| `10dcdb7` | GSAP 3.12.5 and ScrollTrigger vendored into `js/vendor/`. Hashes match the integrity values in `index.html`. | No, owner asked for it |
| `bae459b` | Deleted 8 unreferenced images (1.3 MB), dead CSS (`.plate__link`, `.reel`), stale comments, a 1-to-1 opacity tween, one unused binding, two empty `build()` exports. | No |
| `0f11836` | Grain opacity variable animated on `.grain` instead of `<html>` (`js/overlay.js`). The main performance fix. | No |
| `de411ad` | People portraits load independently; a failed one shows its ordinary photo (`.is-photo`). Per-particle angles precomputed. | No |
| `204e076` | Landscape phones get the phone particle count (`compact` instead of `small` in `js/scenes/people.js`). | No, owner asked for it |
| `cca7e27` | `is-still` class on `<html>` for the on-page and `?motion=off` setting; contact transitions switch off under it. | No |
| `32b06dc` | Section keys compute each destination once per frame and write attributes only on change. | No |
| `ff077d8` | `netlify.toml` (publish `dist/`, five response headers), `.gitignore`, absolute `og:image` and `og:url`. | Yes |
| `dd9729d` | Netlify Forms: form attributes in `index.html`, `deliver()` in `js/scenes/contact.js` posts to `/`, README hosting steps. | Yes |

What has been checked so far:

- Desktop 1440x900: 33 frames (every scene at five scroll positions, plus the full static page) compared against two captures of the original. No visible change. Studio, People and Contact frames are pixel-identical, which covers the grain and angle changes at that size.
- The Netlify build command was run in a scratch copy: `dist/` holds 92 files, 4.4 MB, with no `tools/`, `serve.py` or README, and every local `href`, `src` and CSS `url()` in it resolves.
- The page generator still reproduces the checked-in blog and portfolio pages.
- All JS files pass `node --check`.

What has not been checked. This is your first job:

- Phone 390x844, landscape 844x390 and small 320x568 screenshot comparisons. The runs were stopped before they finished.
- Every behaviour test in `tools/checks/func.mjs`. That script has never been run, so expect to fix the script itself before trusting a failure.
- Whether the performance fixes helped (`tools/checks/perf.mjs`, also never run).
- One reviewer claim was wrong and others may be: the review said both `eager` bindings in `js/scenes/collage.js` were unused, but the second is used in a cleanup. Do not assume a review claim is correct because it is specific.

## Step 1: verify the branch

Serve two copies locally. The original, with GSAP already local so it runs without the CDN, is commit `10dcdb7`:

```sh
git worktree add /tmp/rr-orig 10dcdb7
(cd /tmp/rr-orig && python3 -m http.server 8201) &
python3 -m http.server 8202 &      # from the repo root, on the branch
```

Run the checks (Playwright and Chromium are preinstalled in Claude cloud sessions; the scripts load Playwright from `/opt/node-tools/node_modules/`):

```sh
node tools/checks/func.mjs http://localhost:8202 http://localhost:8201 /tmp/rr-func
node tools/checks/shots.mjs http://localhost:8201 /tmp/rr-shots/a1
node tools/checks/shots.mjs http://localhost:8201 /tmp/rr-shots/a2
node tools/checks/shots.mjs http://localhost:8202 /tmp/rr-shots/w
python3 tools/checks/cmp3.py /tmp/rr-shots/a1 /tmp/rr-shots/a2 /tmp/rr-shots/w
```

Things to know about the screenshot comparison:

- The original site is not pixel-stable between loads. GSAP's `stagger: { from: 'random' }` uses `Math.random`, and a seeded generator in the Services scene is consumed again on each layout refresh. `shots.mjs` pins `Math.random` and holds CSS animations at time 0, and `cmp3.py` uses two original captures to learn the remaining noise.
- Expect `cmp3.py` to still report a few frames as changed by a fraction of a percent, in Services, Work, the hero, and Process. On desktop these were sparse fragments and one sub-pixel text shift, invisible at 4x zoom. Open any frame reported above about 0.5 percent, or any with a solid changed region, and look at it.
- The one intended visible change is `landscape-motion/people-*`: lighter, stippled portraits instead of nearly solid black.
- A full capture takes several minutes per run. Running three at once is slow but works. Pass a profile list as a third argument (`phone,small`) to run a subset.

What must hold before moving on:

1. No console errors on the homepage at any viewport, with motion on and off.
2. Contact form: a successful post shows the thank-you message, a failed post shows the retry message and keeps the text, a filled honeypot sends nothing. The post body is `form-name=contact&email=...&message=...`.
3. With one portrait blocked, the other still renders, and the blocked one falls back without errors.
4. Deep links `/#work`, `/#people` and `/#contact` land on the settled scene.
5. No frame outside landscape People shows a visible difference from the original.
6. All 14 blog and portfolio pages load with no errors or broken images.

If a check fails on a commit marked "No" above, revert that commit. If it fails on `ff077d8` or `dd9729d`, fix it.

Look at the fallback screenshots in `/tmp/rr-func` (`fallback-phone.png`, `fallback-landscape.png`, `fallback-small.png`, `sample-failed-janelle.png`). The fallback photo's size is set by one rule in `css/scenes.css` (`.is-motion .person.is-photo .person__photo`). It only appears when a portrait fails, so it needs to be presentable, not polished.

Optional, only if time allows: `node tools/checks/perf.mjs http://localhost:8201` and then `:8202` to compare style and script time per frame on a throttled phone profile. The grain change should cut style time in Studio, Work and Services sharply. This informs the PR description and blocks nothing.

## Step 2: open the pull request

1. Delete this file (`PLAN.md`) in a final commit. Keep `tools/checks/`; it is not published.
2. Open a PR from `claude/gracious-allen-ltsj80` into `main`. There is no PR template. Describe what changed, what was verified and how, the one visible change (landscape portraits), and the owner's Netlify steps from Step 3.
3. Do not merge. The owner merges.

## Step 3: owner's Netlify steps, for later (put these in the PR description)

1. Merge the PR.
2. In Netlify, add a new site from this GitHub repository, branch `main`. Build command and publish directory come from `netlify.toml`; leave the dashboard fields empty.
3. Site configuration, Forms: enable form detection. Trigger a new deploy afterward, because forms are detected at deploy time.
4. Confirm a form named `contact` is listed under Forms. Add an email notification for it with the address that should receive messages.
5. Add the custom domain `redrivercreativemedia.com` and follow Netlify's DNS instructions. HTTPS is automatic once DNS resolves.
6. On the live site, send a real test message and confirm the email arrives. Check the spam folder on the first one.
7. Open the site on an iPhone and an Android phone and scroll the whole homepage once. No review tested real devices or Safari.

## Step 4: after the first deploy, in a later pass

- `curl -sI https://redrivercreativemedia.com/` shows the five headers from `netlify.toml`.
- `https://redrivercreativemedia.com/tools/subpages/build.py` and `/README.md` return 404.
- A link preview of the homepage shows the share card image.
- Run Lighthouse against the deployed URL. Earlier sessions could not, because their sandboxes blocked the CDN.

## Not doing

Raised by the reviews and deliberately left out. None is needed to launch.

- Dropping the duplicate `ScrollTrigger.refresh()` at load, pausing off-screen CSS animations, and changing the `gsap.ticker` sampler. Small gains in the most fragile code.
- Hero mark: CSS and GSAP both animate its transform. Fixing it means choosing a look. Left alone.
- Removing a service or changing the Services fit at 320x568.
- Collapsing the triplicated shared files in `blog/` and `portfolio/`, and the dormant subdomain code in `links.js`.
- Re-encoding the two course PNGs to WebP, the font request cleanup, a custom 404 page, `og:image` on blog and portfolio pages, HSTS header.
- The dead `.redact__poem` selector in `js/overlay.js`. Harmless, and the redaction scene is off limits.
- Real-device profiling beyond the owner's own check in Step 3.
