# KVLM

Monorepo of the Kulturverein Lochmühle e.V. website.

## Development

- Install dependencies using `bun install`.
- Build all packages using `bun run build`.
- Start the development servers using `bun run dev`.
- Start the website development server using `bun run --filter @kvlm/website dev`.
- Preview a build exactly as deployed using `bun run --filter @kvlm/website preview`.

The site is served from a project page, so it lives under `/website/`. Both
`site` and `base` come from the deploy workflow (`SITE`/`BASE`), a build with
`BASE=/` is equally valid — no host knowledge is baked into the repo.

Bun installs and orchestrates, the tools themselves (Astro, web-test-runner,
ESLint) still run on node — see `.node-version`.

## Updating dependencies

```bash
bmpr -a -f -c
```
