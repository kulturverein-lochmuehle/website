# KVLM

Monorepo of the Kulturverein Lochmühle e.V. website.

## Development

- Install dependencies using `pnpm i`.
- Build all packages using `pnpm -r build`.
- Start the development servers using `pnpm -r --filter @kvlm/ui dev` or `pnpm -r --filter @kvlm/website dev`.

## Updating dependencies

```bash
pnpm -r exec pnpx npm-check-updates -u
pnpm i
```
