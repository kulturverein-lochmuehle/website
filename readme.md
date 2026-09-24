# KVLM

Monorepo of the Kulturverein Lochmühle e.V. website.

## Development

- Install dependencies using `bun install`.
- Build all packages using `bun run build`.
- Start the development servers using `bun run dev`.
- Start the website development server using `bun run --filter @kvlm/website dev`.
- Start the 3D editor using `bun run --filter @kvlm/editor dev`, then open
  <http://localhost:5173/>.
- Preview a build exactly as deployed using `bun run --filter @kvlm/website preview`,
  which builds first - the preview server only ever serves `dist/`.

The packages:

- `packages/ui` - the site's Lit components and styles.
- `packages/website` - the Astro site.
- `packages/visualization` - the Lochmühle's 3D model: its data, the terrain,
  what stands on it, the bakes, a plain scene that renders it, and the views
  baked for the site (`npm run data:views`), which `kvlm-scene` in
  `packages/ui` draws - every view listed at `/demo`, each at `/demo/<name>`. It is built into `dist/` and used
  from there only (`bun run --filter @kvlm/visualization build`); the editor's
  and the website's `dev` and `build` build it first, and its own `dev`
  rebuilds it on every change.
- `packages/editor` - the editor of that model, a Vite app: the camera, the
  seam's handles, the landfill brush and the reference points.

The components are consumed as source, so the dev server picks up changes in
`packages/ui` right away. Content loaders are different: they run once when
the dev server starts, so restart it after changing one (`astro dev stop`,
then start again, `--force` clears the content cache as well).

The site is served from a project page, so it lives under `/website/`. Both
`site` and `base` come from the deploy workflow (`SITE`/`BASE`), a build with
`BASE=/` is equally valid — no host knowledge is baked into the repo.

Bun installs and orchestrates, the tools themselves (Astro, web-test-runner,
ESLint) still run on node — see `.node-version`.

## Deployment

Both branches deploy themselves, to two different places:

- `next` builds and publishes to GitHub Pages, where it is served from
  `/website`.
- `main` builds with `BASE=/` and is published to the netlify project `kvlm`
  from the workflow. It needs `NETLIFY_AUTH_TOKEN` and `NETLIFY_SITE_ID` as
  repository secrets, `KVLM_CALENDAR_URL` as a repository variable and,
  optionally, `NETLIFY_SITE_URL` as one - the public url the site is built
  for, `https://www.kulturverein-lochmuehle.de` by default.

Netlify must not build the repository itself, the workflow ships a finished
`dist` to it. `public/_headers` travels with that build and tells netlify to
keep the hashed assets forever, everything else stays revalidated.

## Google calendar

The public ical feed of the association fills an `events` collection, read at
build time. It is required: copy `.env.example` to `.env` in the
repository root (or set `KVLM_CALENDAR_URL` in the environment), the build refuses without it and
fails on a feed it cannot read. The deploy workflow takes it from the
repository variable of the same name. Teasers reach the events through the
`events:upcoming`, `events:next` or `agenda:*` scopes, and keeping them current
needs a scheduled rebuild - the chronicle entries do not.

The `agenda:*` scopes join both: every upcoming event and every upcoming
chronicle entry, collapsed into one item per day (german time). Where both know
a day, the entry's title, teaser and page win, the event only contributes its
start. Without a feed the agenda is the upcoming chronicle.

## Updating dependencies

```bash
bmpr -a -f -c
```
