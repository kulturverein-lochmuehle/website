import 'astro';

declare module '@astrojs/netlify/functions' {
  export { default } from '@astrojs/netlify/dist/integration-functions';
}

declare module '@astrojs/netlify/edge-functions' {
  export { default } from '@astrojs/netlify/dist/integration-edge-functions';
}

declare module 'astro' {
  interface AstroClientDirectives {
    'client:slot'?: string;
  }
}
