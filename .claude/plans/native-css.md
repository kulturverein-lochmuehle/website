# Plan — drop Sass, native CSS + PostCSS

Status: **done** 2026-09-22 · supersedes the "no lit-css plugin needed"
note in `plan.md` step 3, which now points here

Sass earns nothing here any more. The one thing it still does that CSS cannot
— named breakpoints in `@container` — is 30 lines of PostCSS. Everything else
is nesting, `calc()` and three `@font-face` blocks.

## Why now

| Sass feature | Sites | Native replacement |
| --- | --- | --- |
| Nesting (`&.brook`, `&::before`, `:host([opened]) &`) | 15 | native nesting, Baseline 2023. No `&--foo` concat anywhere |
| `@use` / `@forward` | 32 / 15 | `@import` + `postcss-import` |
| `rem()` / `size()` | ~30 | they already emit `calc(N * var(--kvlm-base-size-*))` — inline the calc |
| `relative-font-size()` | 3 | literal `clamp()` / `max()` |
| `math.div(16, 15)` | 1 | `calc(16 / 15)` |
| `%title` / `%lead` / `%body` + `@extend` | 3 | all three used once, in `typo.component.scss` — inline the declarations |
| `@each` over `$fonts` | 1 | 3 literal `@font-face` blocks |
| `implode()`, `replace()`, `prepare-query()` | — | existed only to serve the mixins, delete |
| `wrapper()` mixin | 3 | 5 declarations, inline them |
| `media()` / `container()` mixins | 21 | PostCSS plugin, see below |

Deleted outright: the `@supports (container-type: inline-size)` /
`@supports not (…)` double emission in `container.mixin.scss`. Container
queries are Baseline since Feb 2023; that fallback duplicates every one of the
21 query blocks in the shipped CSS for browsers nobody has.

Deleted along with it: `sass` from `packages/ui/package.json`, and the whole
`src/styles/{functions,mixins,variables}` tree except the breakpoint table,
which moves into the PostCSS plugin.

## 1. The breakpoint plugin

Named breakpoints cannot be done in plain CSS: `@custom-media` exists (and
`postcss-custom-media` implements it), but a **container condition takes no
custom-media and no `var()`** — only a literal length. So one plugin serving
both at-rules, which also keeps `@media` and `@container` symmetric the way
the two mixins are today.

```js
// packages/ui/scripts/postcss-breakpoints.js

// single source of the breakpoints, replaces styles/variables/breakpoint.variables.scss
const BREAKPOINTS = { xs: 480, sm: 768, md: 992, lg: 1200, xl: 1600 };

const TOKEN = /\(\s*--([a-z0-9-]+)\s*\)/gi;

const expand = (params, rule) =>
  params.replace(TOKEN, (match, token) => {
    const [direction, name] = token.split('-');
    const width = BREAKPOINTS[name];
    // an unresolved token would silently ship a dead query, so it is an error
    if (width === undefined || (direction !== 'from' && direction !== 'until')) {
      throw rule.error(`unknown breakpoint token "${match}"`, { word: match });
    }
    return direction === 'from'
      ? `(min-width: ${width}px)`
      : `(max-width: ${width - 1}px)`;
  });

const plugin = () => ({
  postcssPlugin: 'kvlm-breakpoints',
  AtRule: {
    media: rule => void (rule.params = expand(rule.params, rule)),
    container: rule => void (rule.params = expand(rule.params, rule)),
  },
});
plugin.postcss = true;

export default plugin;
```

`rule.error()` carries file and line, so a typo fails the build the way
`@error` in `prepare-query.function.scss` does today.

```js
// postcss.config.js (repo root — vite finds it from there)
import atImport from 'postcss-import';

import breakpoints from './packages/ui/scripts/postcss-breakpoints.js';

export default { plugins: [atImport(), breakpoints()] };
```

### Every current call site, before and after

All 21 go through the mixins; there is not one raw `@media` or `@container` in
a component sheet.

| Today | Sites | Native |
| --- | --- | --- |
| `@include utils.container(sm) { … }` | 6 | `@container (--from-sm) { … }` |
| `@include utils.container(lg) { … }` | 4 | `@container (--from-lg) { … }` |
| `@include utils.container($from: lg) { … }` | 5 | `@container (--from-lg) { … }` |
| `@include utils.container($until: lg) { … }` | 5 | `@container (--until-lg) { … }` |
| `@include utils.media($until: lg) { … }` | 1 | `@media (--until-lg) { … }` |

Unused today but supported by the mixins, and by the plugin without extra
code — the regex replaces each token in place and leaves everything around it
alone:

| Mixin form | Native |
| --- | --- |
| `container($from: sm, $until: lg)` | `@container (--from-sm) and (--until-lg)` |
| `container(sm, $container-name: layout)` | `@container layout (--from-sm)` |
| `container(960px)` | `@container (min-width: 960px)` — no token, passes through |

The bare-first-argument form (`container(sm)` meaning `$from: sm`) loses its
shorthand; `(--from-sm)` names the direction every time. That is the only
shape change, and it removes the reading trap where `container(lg)` and
`container($until: lg)` sit four lines apart in
`navigation.component.scss` and mean opposite things.

## 2. The sheets as lit styles

**Not `vite-plugin-lit-css`.** It hands ids carrying `?inline` back
untransformed, and `?inline` is exactly what the imports need: in dev astro
collects every *buildable* css request of a route and inlines it into a global
`<style>`, and its predicate is

```js
isBuildableCSSRequest = request =>
  isCSSRequest(request) && !rawRE.test(request) && !inlineRE.test(request);
```

A shadow sheet in the document applies its unscoped `a`, `svg` and `path` rules
to the whole page. With the plugin's plain `.css` imports every link on the site
came out uppercase, letter-spaced and line-height 1, courtesy of
`navigation-item.component.css`. The build was never affected, only dev — the
worse way round.

So the transform is ours, ~30 lines in
`packages/ui/scripts/vite-plugin-lit-css.js`: `enforce: 'post'`, it takes what
`vite:css-post` emits for a `?inline` id (`export default "…"`) and re-emits it
as ``css`…` ``. No monkey-patching of `vite:css-post` either.

What it does: patches `vite:css-post`'s `transform`, appends `?inline` to the
id itself, takes the `export default "…"` vite returns, and re-emits
``import { css } from 'lit'; export default css`…`;``. So it runs **after**
the whole vite CSS pipeline — the PostCSS plugin above applies untouched, and
Astro's `build.cssMinify: 'esbuild'` still governs the minification (the
lightningcss `animation-timeline` bug noted in `astro.config.ts` stays
avoided).

Gain: `unsafeCSS()` disappears from 11 components, and
`injectGlobalStyle()` already takes a `CSSResult`, so
`injectGlobalStyle(unsafeCSS(globalStyles))` becomes
`injectGlobalStyle(globalStyles)`.

```ts
// before
import styles from './logo.component.scss?inline';
static override readonly styles = unsafeCSS(styles);

// after
import styles from './logo.component.css';
static override readonly styles = styles;
```

### Four things to get right

1. **`?inline` must go.** The plugin explicitly bails on ids carrying
   `?inline` and hands them back untransformed — every one of the 11 imports
   would silently stay a `string`, and `static styles = "…"` throws in lit.
   Strip the query in the same commit that adds the plugin.

2. **`include` must be narrow.** The default filter is
   `/\.(css|less|sass|scss|…)/`, which also matches Astro's own
   `…astro&type=style&lang.css` requests and would turn every page's styles
   into a lit module. Scope it to the component sheets:

   ```ts
   litCss({ include: /packages\/ui\/src\/components\/.+\.css(\?|$)/ })
   ```

   `globals.css`, `fonts.css` and `typography.css` sit at `src/` root and are
   side-effect imports in `base.layout.astro` — outside the pattern, so no
   `exclude` needed. `navigation.global.css` sits under `components/` and
   *is* imported as a module, so it must stay inside the pattern.

3. **Register it in three places.** `astro.config.ts` (`vite.plugins`), and
   the web-test-runner config, which has no `vite.config.ts` to read:

   ```ts
   vitePlugin({ plugins: [litCss({ include: … })], optimizeDeps: { … } })
   ```

4. **Double-patching.** The plugin mutates the shared `vite:css-post` object
   in `configResolved`. If Astro resolves a config twice in one process, the
   transformer wraps itself and the `code.slice(16, -1)` runs on already
   generated JS — garbage, not an error. Verified against vite 8.3.0 that the
   slice itself is correct (`export default ${JSON.stringify(css)}` in both
   the serve and the build branch, `export default "` is exactly 16 chars),
   but assert the no-double-patch in the smoke test below rather than
   assuming it.

### Types

`packages/ui/src/vite-env.d.ts` declares `*.css?inline` as a `CSSResult`, next
to vite's own client types.

### Known cost

No HMR — a style edit triggers a full reload. Same as today with `?inline`.

## 3. Order of work

1. `postcss-breakpoints.js` + `postcss.config.js` + `postcss-import`. Nothing
   consumes them yet.
2. Rename `src/styles/variables/chrome.variables.scss` into custom properties
   (they are two `rem()` calls) and fold `typo.variables.scss` into
   `typo.component.css`. Delete `functions/`, `mixins/`, `variables/`,
   `utils.scss`.
3. Convert the three root sheets: `globals`, `fonts` (unroll the `@each`),
   `typography`. Astro imports get the new extension.
4. Convert the 11 component sheets, one commit per component, diffing the
   compiled output against the Sass output of the same file.
5. Add the lit-css transform, drop `unsafeCSS` in the same commit,
   register it in `astro.config.ts` and the wtr config, update
   `vite-env.d.ts`.
6. Remove `sass` from `packages/ui/package.json`.

## 4. Done when

- `bun run build` and `bun run --filter @kvlm/website preview` render the
  pages unchanged, and a diff of the built CSS against a build from `main`
  shows only the dropped `@supports` fallbacks and whitespace.
- The dev server renders the components styled — the serve branch of
  `vite:css-post` takes a different path than the build branch, both have to
  be seen.
- `bun run --filter @kvlm/ui test` passes with the plugin registered in the
  wtr config.
- A deliberate `@container (--from-xx)` fails the build with file and line.
- No `.scss` file and no `sass` dependency left in the repo.

## 5. Watch for

- **Specificity.** Native nesting wraps the parent in `:is()`, Sass
  concatenates. Every current case is a single-selector parent except
  `h1, h2, h3, h4, h5, h6 { ~ p, ~ ul, ~ ol { … } }` in
  `typo.component.scss`, where all six are 0-0-1 and `:is()` changes nothing.
  It is still the first place to look if something in the typography shifts.
- **Verbosity.** `rem(1.5)` becomes
  `calc(1.5 * var(--kvlm-base-size-typo))` at ~30 sites. There is no
  standards-track fix; `postcss-functions` would just be Sass again. Shorten
  the custom property names if it grates.
- **`translateX(#{math.div(7.8, 246.2) * 10 - 1%})`** in
  `navigation.component.scss:141` — Sass folds this to a constant. Compute it
  once and write the literal, do not port the arithmetic.

## Manual check list after the migration

Every breakpoint-dependent piece, at a viewport below and above `lg` (1200px)
and below and above `sm` (768px):

- navigation: burger vs. bar, the opened menu, the item stagger
  (`:nth-child(1n + 2)`), the logo mark, the footer group that only appears in
  the mobile menu
- layout: the header gradient seam against the sections, the scroll-driven
  animation (`@supports (animation-timeline: scroll())`)
- section: the wrapper padding step (`size(4)` → `size(5)`) and the
  `background-position` offset that follows the navigation height
- timeline and timeline items: the gap and the date font size step, hover and
  focus-visible
- typo: the hyphenation switch below `sm`, and the title/lead/body sizes that
  came from the placeholders
- houses: the canvas is a container itself, check it below `sm` and above `lg`
