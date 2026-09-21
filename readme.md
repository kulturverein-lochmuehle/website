# KVLM

Monorepo of the Kulturverein Lochmühle e.V. website.

## Development

- Install dependencies using `bun install`.
- Build all packages using `bun run build`.
- Start the development servers using `bun run dev`.
- Start the website development server using `bun run --filter @kvlm/website dev`.

Bun installs and orchestrates, the tools themselves (Astro, web-test-runner,
ESLint) still run on node — see `.node-version`.

## Updating dependencies

```bash
bmpr -a -f -c
```
