/// <reference path="../.astro/types.d.ts" />

// set by `@lit-labs/ssr-client/lit-element-hydrate-support.js`, and called by
// hand in the base layout when `lit-element` evaluated before it
declare var litElementHydrateSupport: (options: { LitElement: unknown }) => void;
