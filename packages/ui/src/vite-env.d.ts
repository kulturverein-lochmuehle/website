/// <reference types="vite/client" />

// The component sheets carry `?inline`, which is what keeps astro from
// inlining them into the page, and `&lit`, which our own `vite-plugin-lit-css`
// picks them up by - and which keeps vite's own `*?inline` declaration, a
// plain string, from claiming them here.
declare module '*.css?inline&lit' {
  const styles: import('lit').CSSResult;
  export default styles;
}
