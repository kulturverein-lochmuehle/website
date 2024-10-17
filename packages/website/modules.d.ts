declare module '@astrojs/netlify/functions' {
  export { default } from '@astrojs/netlify/dist/integration-functions';
}

declare module '@astrojs/netlify/edge-functions' {
  export { default } from '@astrojs/netlify/dist/integration-edge-functions';
}

declare module 'decap-cms-core/dist/esm/actions/config.js' {
  export declare function parseConfig<C>(config: C): C;
  export declare function normalizeConfig<C>(config: C): C;
}

declare module 'decap-cms-app' {
  import type { CMS } from 'decap-cms-core';
  export default {} as CMS;
}
