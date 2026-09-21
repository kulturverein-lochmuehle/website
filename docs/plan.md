# Greenfield plan — kvlm.de website

Status: phase 0 not started · branch `next` · written 2026-09-21

Rebuild of the association website as a portable static site. The previous
experiment lives on `poc/next` (Astro 7 + Sveltia CMS + separately built web
component package); it is kept for reference only. The production site
(Stencil SPA on Netlify) is **not** a migration source except for its content.

## Ground rules

1. **The build output is a plain folder of files.** No redirects, headers,
   functions or identity services. GitHub Pages enforces this; the site stays
   movable to Netlify or a own server at any time.
2. **Flat frontmatter, structure in the body.** Scalars only in frontmatter,
   Markdoc tags in the body where a page genuinely needs structure.
3. **Gated content never enters the static artifact.** Phase 2 lives on its own
   origin.
4. **Components are reusable but consumed as source.** No dist/importmap
   indirection until something outside this repo imports them.

## Locked decisions

| Topic | Decision |
| --- | --- |
| Hosting (phase 0) | GitHub Pages, project page, `site`/`base` from workflow env |
| Custom domain | not before go-live, stay on `github.io/website/` |
| Astro | 7.2.2, `output: 'static'`, **no adapter** |
| Components | Lit, stay in `packages/ui`, consumed as **workspace source**, tree-shaken by the site build |
| Lit SSR | no — `@astrojs/lit` is stale (4.3.0, Sep 2025, no Astro 7 peer). Content is light DOM, handle upgrade flash with `:not(:defined)` |
| Content format | flat frontmatter + **Markdoc** body (`@astrojs/markdoc` 2.0.9) |
| Tag surface | `{% section %}`, `{% teaser %}` — expected in `startseite.md` only |
| CMS | phase 1, Keystatic local mode preferred, format keeps Sveltia / Pages CMS open |
| Members | phase 2, separate origin, Webling checked first |
| Node | 24.19.0 (`.node-version`) |

## Target repo shape (after phase 0)

```
packages/
  ui/                     # Lit components, no build step
    src/{components,styles,utils,assets}
  website/
    astro.config.ts       # static, markdoc, no adapter
    src/
      content/{pages,chronicle,navigation}
      content.config.ts   # zod schemas
      markdoc/            # tag schema -> components
      components/*.astro
      layouts/
      pages/
    public/{uploads,docs}
.github/workflows/deploy.yml
docs/plan.md
```

Deleted along the way: `vendor/`, `Dockerfile`, `compose.yaml`,
`src/collections/`, `src/integrations/`, `packages/ui/.configs/vite.config.ts`
and everything it pulled in (dts, CEM analyzer, static-copy, checker,
top-level-await, mkcert, node-polyfills, barrelsby, typedoc), the
`@webcomponents-preview` app, the importmap, `astro-loader-sveltia-cms`.

## Phase 0 — static site on GitHub Pages

Goal: the real site, all content, deployed, portable. ~1–2 focused days,
most of it content.

### 1. Branch

Done: `poc/next` holds the previous state, `next` is this branch.
The Directus compose stays preserved on `poc/next`, so no extra spike branch is needed.

### 2. Subtraction pass

Delete everything in the list above, commit, then look at what is left before
writing new code.

Done when `packages/ui` contains only source plus test/lint config, and
`packages/website` has no adapter, no loader, no dev proxy.

### 3. Skeleton

- `@kvlm/ui` exports `./src/index.ts`; `publishConfig` swaps to `dist` on the
  day it gets published (not now).
- `astro.config.ts`: `output: 'static'`, `@astrojs/markdoc`, `site`/`base` from
  env.
- Remove `prerender = false`; the catch-all route gets `getStaticPaths`, `/`
  becomes a real generated page.

Done when `pnpm build && npx serve packages/website/dist` renders the pages.

### 4. Content model

- `content.config.ts`: zod schemas for `pages` (title, theme?, nav flags),
  `chronicle` (title, date, teaser, **draft**), `navigation`.
- `src/markdoc/`: tag schema mapping `section` / `teaser` onto the Astro
  components, with attribute validation.
- `preparePage` and the Section/Content component tree are deleted — Markdoc
  renders the body directly.
- **Base path correctness**, both are real bugs under `base: '/website'`:
  - root-relative links in content (`[…](/mitgliedsantrag)`) must be rewritten
    with `import.meta.env.BASE_URL` by a remark plugin, so authors keep writing
    `/mitgliedsantrag` and the later custom-domain switch is a no-op;
  - section ids are matched against `location.pathname` by the layout scroll
    logic — strip the base before matching, or build ids including it.

### 5. Content port

From `poc/next` (convert):

| File | Work |
| --- | --- |
| `pages/startseite.md` | frontmatter blocks -> body with `{% section %}` + `{% teaser %}` |
| `pages/kontakt.md` | single section -> `theme` in frontmatter, address as prose, no tags |
| `pages/mitglied-werden.md` | same, no tags |
| `chronicle/*.md` (9) | unchanged; the three `tba` entries (all 2025) get `draft: true` and stay as skeletons to fill later |
| `navigation/navigation.yml` | extended in step 6 |

From the old production site (content only, no code) —
`~/Projects/david@kvlm.de/website/src`:

| Source | Target | Notes |
| --- | --- | --- |
| `pages/satzung.mdx` (107 lines) | `pages/satzung.md` | pure prose, no tags — port the four legal pages first |
| `pages/datenschutz.mdx` (230) | `pages/datenschutz.md` | pure prose |
| `pages/beitragsordnung.mdx` (23) | `pages/beitragsordnung.md` | pure prose |
| `pages/impressum.mdx` (24) | `pages/impressum.md` | pure prose |
| `pages/start.mdx` (85) | chronicle entry (SOMMERFESTival 2026, Bombastico workshop) + teaser on `startseite.md` | event content belongs in chronicle |
| `pages/newsletter-anmeldung.mdx`, `-abonniert.mdx` | `pages/…` | form target still open, see parked |
| `docs/Mitgliedsantrag.pdf` | `public/docs/` | target of the existing "Mitgliedsantrag ausfüllen" link |
| `assets/images/*` | `public/uploads/` | flat folder, stable names |

Not ported: `protokolle.mdx` (phase 2), the MJML newsletter template,
`preisliste.html` (separate `kulturverein-lochmuehle/pricelist` repo with its
own Pages deploy).

### 6. Navigation

Extend `navigation.yml` with main versus footer grouping; the four legal pages
belong into a footer group.

### 7. CI

One workflow: install -> lint -> test -> `astro build` ->
`upload-pages-artifact` -> `deploy-pages`, pinned action SHAs.

Pages is already enabled on this repo (`build_type: workflow`, source branch
`next`) and currently serves the old component preview at
<https://kulturverein-lochmuehle.github.io/website/>. The first deploy of this
branch replaces it. No Pages setup needed.

### 8. Acceptance

- `npx serve dist/` is indistinguishable from the deployed site.
- Deep links and `404.html` work **on the deployed project page**, including
  section deep links (base path!).
- JS <= ~50 KB gzipped per page. Check CSS too: `fonts.css` was 369 KB in the
  old build (embedded font data) — subset or serve `@font-face` files.
- No host-specific artifact anywhere in the repo.

## Phase 1 — git-based CMS

Precondition: phase 0 deployed, content format stable.

Keystatic GitHub mode needs Node API routes, so it cannot be deployed on Pages.

| Option | Static-compatible | Edit from | Preview of own components |
| --- | --- | --- | --- |
| Keystatic local mode | yes, admin dev-only | checkout | yes (content components) |
| Sveltia | yes, client-side | any browser | yes (`registerEditorComponent`) |
| Pages CMS | yes, hosted | any browser | no |

Plan: spike Keystatic local mode (half a day). The admin route must be
registered conditionally so the static build never sees it (`CMS=1 pnpm dev`).
If that turns ugly, fall back to Pages CMS; the content format supports all
three unchanged.

Work: `keystatic.config.ts` mirroring the zod schemas, the shared Markdoc tag
schema, content components for the editor preview.

Done when a page can be edited in a browser UI showing the real `kvlm-*`
components, committed from the CMS, shipped by CI — with no admin route in the
production build.

## Phase 2 — member login and individual contents

Gate first, build second: Webling is already paid for and provides a member
portal (email-link login, 2FA, protected area, member lists) plus a REST API on
all plans. If linking members there covers the need, phase 2 is an afternoon.

| Approach | Cost | DNS | When |
| --- | --- | --- | --- |
| Webling portal link | included | none | default |
| Own server + small service (Google OIDC or Webling API) | ~3,29 EUR/mo | move domain, self-manage | gated pages plus per-member files |
| Directus (compose on `poc/next`) | ~3,29 EUR/mo | same | only if members need a real data model |

Rule: member area on its own origin (e.g. `mitglieder.kvlm.de`), private files
never in the public artifact, public site keeps deploying to dumb static
hosting untouched.

## Parked / non-goals

- **Events calendar function** — chronicle entries are the single source of
  truth. If the Google Calendar should stay authoritative: build-time fetch
  plus a daily GitHub Actions cron rebuild (free and unmetered on Pages).
- **Newsletter endpoint** — no functions on static hosting. Interim: link a
  Mailjet-hosted form. Decide at the end of phase 0.
- **Protocols / Google Drive pipeline** — phase 2, and by construction never
  part of the static build.
- **Component preview app** — dropped. Successor when wanted: a `/styleguide`
  page inside the site.
- **Directus compose** — preserved on `poc/next`.
- **Ops, unrelated:** `https://kvlm.de` serves a self-signed 2017 certificate
  that expired in 2020 (the domain redirects via networkinvest). Batch it into
  the next DNS request.

## Notes worth not re-deriving

- Netlify free plan is credit-based: 300 credits/month, 15 per production
  deploy (~20 publishes), bandwidth 20 credits/GB, site pauses when exhausted.
  Relevant only if Netlify becomes the host again.
- Netlify Identity survived its deprecation (Feb 2026 reversal) but Git Gateway
  did not. Not used here either way.
- `www.kulturverein-lochmuehle.de` currently CNAMEs to Netlify; all DNS lives
  at networkinvest and needs a phone call to change.
