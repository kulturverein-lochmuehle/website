declare module '@astrojs/netlify/functions' {
  export { default } from '@astrojs/netlify/dist/integration-functions';
}

declare module '@astrojs/netlify/edge-functions' {
  export { default } from '@astrojs/netlify/dist/integration-edge-functions';
}

declare module 'decap-cms-widget-list' {
  import type { CmsWidgetParam } from 'decap-cms-core';
  export const DecapCmsWidgetList: CmsWidgetParam<T>;
  export default DecapCmsWidgetList;
}
