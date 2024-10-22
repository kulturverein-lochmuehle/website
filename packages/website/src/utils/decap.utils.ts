import { DecapCmsLibWidgets } from 'decap-cms-lib-widgets/src/index.js';

export function registerStringTemplateFilter() {
  const { stringTemplate } = DecapCmsLibWidgets;
  const { compileStringTemplate } = stringTemplate;

  console.log('registerStringTemplateFilter');
  DecapCmsLibWidgets.stringTemplate = {
    ...stringTemplate,
    compileStringTemplate: function (...args: Parameters<typeof compileStringTemplate>) {
      console.log('compileStringTemplate', { args });
      return compileStringTemplate.call(DecapCmsLibWidgets.stringTemplate, ...args);
    },
  };
}
