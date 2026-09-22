# KVLM UI components

This package contains the UI components for the KVLM website. The [web components](https://developer.mozilla.org/en-US/docs/Web/Web_Components) are built using [lit](https://lit.dev/).

## tl;dr

- Use [correct Node version](.nvmrc): `nvm use`
- Prepare [`pnpm`](https://pnpm.io/): `npm i -g pnpm@latest`
- Install dependencies: `pnpm -r install`
- Build components with documentation: `pnpm build`
- Run dev server: `pnpm dev`
- Run tests: `pnpm test`
- Run tests in watch mode: `pnpm test:watch`

## Usage

### Web Components

To use the pure UI components, import them from `@kvlm/ui/components`:

```html
<kvlm-main scroll-observe-selector="kvlm-section"></kvlm-main>

<script type="module">
  import '@kvlm/ui/components/layout/main/main.component.js';
</script>
```

### Astro Components

To ease the usage with Astro, the components are re-exported as default exports with some TypeScript sugar to help with the type inference:

```tsx
---
import KvlmMain from '@kvlm/ui/astro/components/layout/main/main.js';
---

<KvlmMain client:idle scrollObserveSelector={'kvlm-section'} />
```
