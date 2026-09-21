# Vendored packages

## astro-loader-sveltia-cms-0.2.0.tgz

Built from [joknoll/astro-loader-sveltia-cms](https://github.com/joknoll/astro-loader-sveltia-cms)
at commit `978fd1b` ("Target Astro 7").

npm still serves `0.1.5`, which peers `astro@^6` and breaks with Astro 7. The astro 7
support only exists on `main` and was never released, so we build and vendor it ourselves.

Rebuild (drop in place, keep the filename in sync with `packages/website/package.json`):

```sh
git clone https://github.com/joknoll/astro-loader-sveltia-cms.git
cd astro-loader-sveltia-cms && git checkout 978fd1b
pnpm install --ignore-scripts && pnpm run build
pnpm pack --pack-destination <this folder>
```

Remove this once upstream publishes an astro 7 release and depend on the registry again.
