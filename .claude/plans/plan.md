# Greenfield plan — kvlm.de website

Status: phase 0 built, not deployed yet · branch `next` · written
2026-09-21, updated 2026-09-22

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
| Package manager | bun workspaces (`bun.lock`); node still runs astro, eslint and the test runner |
| Layout | app shell: `kvlm-layout` is a grid of header, content and footer, the content is the only scroll container and sections fill it with `min-height: 100%` |
| Components | Lit, stay in `packages/ui`, consumed as **workspace source**, tree-shaken by the site build |
| Lit SSR | **yes, `@lit-labs/ssr` directly** — `@astrojs/lit` is stale (4.3.0, Sep 2025, no Astro 7 peer), so `renderShadow()` in `src/utils/ssr.utils.ts` renders the tree into declarative shadow roots itself. Reversed 2026-09-22, see below |
| Content format | flat frontmatter + **Markdoc** body (`@astrojs/markdoc` 2.0.9), files are `.mdoc` — the integration claims no other extension |
| Tag surface | `{% section %}`, `{% teaser %}` — only `startseite.mdoc` uses them, a page without sections gets an implicit one themed by its frontmatter |
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
      loaders/            # the calendar feed, read at build time
      markdoc/            # tag schema -> components
      components/*.astro
      layouts/
      pages/              # plus chronik/<entry>
    public/{uploads,docs}
    .env.example          # KVLM_CALENDAR_URL
.github/workflows/workflow.yml
.claude/plans/plan.md
```

Deleted along the way: `vendor/`, `Dockerfile`, `compose.yaml`,
`src/collections/`, `src/integrations/`, `packages/ui/.configs/vite.config.ts`
and everything it pulled in (dts, CEM analyzer, static-copy, checker,
top-level-await, mkcert, node-polyfills, barrelsby, typedoc), the
`@webcomponents-preview` app, the importmap, `astro-loader-sveltia-cms`.
Gone as well: the pnpm files, and `kvlm-content`, which was never used
anywhere and did what `kvlm-section` does.

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

**Done.** The pnpm setup went with it: bun workspaces, `bunfig.toml` keeps the
exact-version and minimum-release-age policies.

### 3. Skeleton

- `@kvlm/ui` exports `./src/index.ts`; `publishConfig` swaps to `dist` on the
  day it gets published (not now).
- `astro.config.ts`: `output: 'static'`, `@astrojs/markdoc`, `site`/`base` from
  env.
- Remove `prerender = false`; the catch-all route gets `getStaticPaths`, `/`
  becomes a real generated page.

Done when `bun run build` and `bun run --filter @kvlm/website preview` render
the pages.

**Done**, then superseded on 2026-09-22: the styles are plain CSS and
`vite-plugin-lit-css` turns the component sheets into lit `css` templates, so
the `?inline` query and `unsafeCSS()` are gone. See `native-css.md`.

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

**Done**, with two deviations: remark plugins never see `.mdoc`, so the base is
applied by a Markdoc **link node**; and anchors are built *including* the base,
because the layout writes them back into `history.pushState`. The layout also
normalizes the trailing slash the deployed pages carry.

### 5. Content port

From `poc/next` (convert):

| File | Work |
| --- | --- |
| `pages/startseite.mdoc` | frontmatter blocks -> body with `{% section %}` + `{% teaser %}` |
| `pages/kontakt.mdoc` | single section -> `theme` in frontmatter, address as prose, no tags |
| `pages/mitglied-werden.mdoc` | same, no tags |
| `chronicle/*.mdoc` (9, plus the 2026 one below) | unchanged; the three `tba` entries (all 2025) get `draft: true` and stay as skeletons to fill later |
| `navigation/navigation.yml` | extended in step 6 |

From the old production site (content only, no code) —
`~/Projects/david@kvlm.de/website/src`:

| Source | Target | Notes |
| --- | --- | --- |
| `pages/satzung.mdx` (107 lines) | `pages/satzung.mdoc` | pure prose, no tags — port the four legal pages first |
| `pages/datenschutz.mdx` (230) | `pages/datenschutz.mdoc` | pure prose |
| `pages/beitragsordnung.mdx` (23) | `pages/beitragsordnung.mdoc` | pure prose |
| `pages/impressum.mdx` (24) | `pages/impressum.mdoc` | pure prose |
| `pages/start.mdx` (85) | chronicle entry (SOMMERFESTival 2026, Bombastico workshop) + teaser on `startseite.mdoc` | event content belongs in chronicle |
| `pages/newsletter-anmeldung.mdx`, `-abonniert.mdx` | `pages/…` | form target still open, see parked |
| `docs/Mitgliedsantrag.pdf` | `public/docs/` | target of the existing "Mitgliedsantrag ausfüllen" link |
| `assets/images/*` | `public/uploads/` | flat folder, stable names |

Not ported: `protokolle.mdx` (phase 2), the MJML newsletter template,
`preisliste.html` (separate `kulturverein-lochmuehle/pricelist` repo with its
own Pages deploy).

**Done except the newsletter pages** — they need `kvlm-subscribe-newsletter`,
which the new package does not have, and an endpoint static hosting cannot
provide. Chronicle entries are named `<yyyy>-<mm>-<dd>-<slug>` throughout, the
way the git based CMSs generate them, and carry an optional `image`.

### 6. Navigation

Extend `navigation.yml` with main versus footer grouping; the four legal pages
belong into a footer group.

**Done.** The file holds one entry per group. Below `lg` the footer row stays
empty — its entries appear at the end of the mobile menu instead, so the
layout does not care whether a footer is there.

### 7. CI

One workflow: install -> lint -> test -> `astro build` ->
`upload-pages-artifact` -> `deploy-pages`, pinned action SHAs.

Pages is already enabled on this repo (`build_type: workflow`, source branch
`next`) and currently serves the old component preview at
<https://kulturverein-lochmuehle.github.io/website/>. The first deploy of this
branch replaces it. No Pages setup needed.

**Written, never run** — nothing is pushed yet. `site` and `base` come from
`actions/configure-pages`, deploy is gated to pushes on `next`.

### 8. Acceptance

- `bun run --filter @kvlm/website preview` is indistinguishable from the
  deployed site.
- Deep links and `404.html` work **on the deployed project page**, including
  section deep links (base path!).
- JS <= ~50 KB gzipped per page. Check CSS too: `fonts.css` was 369 KB in the
  old build (embedded font data) — subset or serve `@font-face` files.
- No host-specific artifact anywhere in the repo.

Measured locally: **14.4 KB of JS gzipped** per page, pages between 2.3 and
9.3 KB gzipped, fonts emitted as files (the 369 KB `fonts.css` is gone), no
host-specific file left, and a build with `BASE=/` produces clean root
relative links. The two deployed checks — deep links and `404.html` on the
project page — are open until the first push.

### 9. Added along the way

- **App shell layout.** Sections used to size themselves as `100svh - header`,
  which made every page with a single section scroll by the height of the
  footer. The grid does the sizing now and no component knows another one's
  height. The one measure both sides share is the height of the navigation,
  a style token: the sections continue its gradient seamlessly and need to
  know where it ends.
- **Chronicle pages** at `/chronik/<entry>`, carrying the full text and the
  image; the timeline items link to them, drafts stay without a page.
- **The calendar feed**, see parked.

## Phase 1 — git-based CMS

Precondition: phase 0 deployed, content format stable.

Keystatic GitHub mode needs Node API routes, so it cannot be deployed on Pages.

| Option | Static-compatible | Edit from | Preview of own components |
| --- | --- | --- | --- |
| Keystatic local mode | yes, admin dev-only | checkout | yes (content components) |
| Sveltia | yes, client-side | any browser | yes (`registerEditorComponent`) |
| Pages CMS | yes, hosted | any browser | no |

Plan: spike Keystatic local mode (half a day). The admin route must be
registered conditionally so the static build never sees it (`CMS=1 bun run
dev`).
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

- **Events calendar function** — the logic of the old netlify function is
  ported to `src/loaders/calendar.loader.ts`: it reads the public ical feed at
  build time, no credentials involved. `KVLM_CALENDAR_URL` is required (see
  `.env.example`), the deploy takes it from the repository variable of the same
  name, and a build without a reachable feed fails. The teaser merges the events
  with the chronicle by day. The daily cron rebuild is still open: a scheduled
  run checks out the default branch, which still holds the old site.
- **Newsletter endpoint** — no functions on static hosting. Interim: link a
  Mailjet-hosted form. Still open, which is why the two newsletter pages are
  not ported. The privacy policy lost its newsletter section along with them -
  it has to come back with the signup, together with the tracking pixel part if
  that is kept.
- **Protocols / Google Drive pipeline** — phase 2, and by construction never
  part of the static build. The live site links a `/protokolle` page behind a
  login, which currently lists nothing at all - dropping the link is no loss
  until the pipeline exists.
- **Component preview app** — dropped. The `EXAMPLES.md` files are kept as the
  seed for its successor, a `/styleguide` page inside the site; nothing reads
  them today.
- **Directus compose** — preserved on `poc/next`.
- **Ops, unrelated:** `https://kvlm.de` serves a self-signed 2017 certificate
  that expired in 2020 (the domain redirects via networkinvest). Batch it into
  the next DNS request.

## Notes worth not re-deriving

- **Lit SSR is load-bearing, and the decision above was reversed.** Measured
  2026-09-22 on the start page, with JavaScript switched off: rendered into
  declarative shadow roots the page is complete — header, navigation, gradient,
  timeline, footer. Without it there is no layout at all: `kvlm-layout`'s grid,
  the header and the footer rows all live in a shadow root, so the document
  collapses into every section's content stacked in one column with no
  navigation. That is also what every first visit looks like until the module
  arrives. The `:not(:defined)` mitigation the old row named was never written,
  and could only have hidden content, never produced the layout.

  It costs 5.7 KB gzipped per page (9.2 against 3.5 on the start page, 163 KB
  against 24 KB across all 27) plus ~7.5 KB of hydration client. The lever on
  page weight is elsewhere.

- **The hydration handshake in `base.layout.astro` is three separate
  requirements, and dropping any one of them makes every component render
  twice** — which is exactly what happened until it was fixed:
  1. `@lit-labs/ssr-client/lit-element-hydrate-support.js` only patches
     `LitElement` if it is in place when `lit-element` evaluates. It never was:
     in the build that module sits in the chunk the script imports, and the dev
     server serves the component sheets — lit modules since the CSS migration —
     as script tags ahead of it. So the patch is applied by hand, guarded by
     `Object.hasOwn(LitElement, 'observedAttributes')`; reading the value would
     throw on the un-finalized base class.
  2. `@kvlm/ui` is imported **dynamically**, so every element is defined against
     the patched base class.
  3. Nothing on the client owns the SSR'd nodes — the page comes from a single
     `render()` at the top — so the script clears `defer-hydration` itself, in
     document order.

- Chronicle entries live under `/veranstaltung/<id>`, not below the section
  listing them: a section is decided by the date and changes when an entry
  moves from upcoming to past, a url should not. The section is still read
  from the teaser scopes, for the navigation mark and the back link.

- Netlify free plan is credit-based: 300 credits/month, 15 per production
  deploy (~20 publishes), bandwidth 20 credits/GB, site pauses when exhausted.
  Relevant only if Netlify becomes the host again.
- Netlify Identity survived its deprecation (Feb 2026 reversal) but Git Gateway
  did not. Not used here either way.
- `www.kulturverein-lochmuehle.de` currently CNAMEs to Netlify; all DNS lives
  at networkinvest and needs a phone call to change.
