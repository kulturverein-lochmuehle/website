# KVLM

Monorepo of the Kulturverein Lochmühle e.V. website.

## Development

- Install dependencies using `bun install`.
- Build all packages using `bun run build`.
- Start the development servers using `bun run dev`.
- Start the website development server using `bun run --filter @kvlm/website dev`.
- Preview a build exactly as deployed using `bun run --filter @kvlm/website preview`,
  which builds first - the preview server only ever serves `dist/`.

The components are consumed as source, so the dev server picks up changes in
`packages/ui` right away. Content loaders are different: they run once when
the dev server starts, so restart it after changing one (`astro dev stop`,
then start again, `--force` clears the content cache as well).

The site is served from a project page, so it lives under `/website/`. Both
`site` and `base` come from the deploy workflow (`SITE`/`BASE`), a build with
`BASE=/` is equally valid — no host knowledge is baked into the repo.

Bun installs and orchestrates, the tools themselves (Astro, web-test-runner,
ESLint) still run on node — see `.node-version`.

## Google calendar

The public ical feed of the association fills an `events` collection, read at
build time. It is required: copy `packages/website/.env.example` to `.env` (or
set `KVLM_CALENDAR_URL` in the environment), the build refuses without it and
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
