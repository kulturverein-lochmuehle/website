import { component, nodes as defaults, type AstroMarkdocConfig } from '@astrojs/markdoc/config';

export const nodes: AstroMarkdocConfig['nodes'] = {
  // the sections are the outermost elements of a page, no wrapper needed
  document: {
    ...defaults.document,
    render: component('./src/components/fragment.component.astro'),
  },
  // the typography component styles by class, so every block needs one;
  // authors pick a deviating one with an annotation, e.g. `{% .lead %}`
  heading: {
    ...defaults.heading,
    attributes: { ...defaults.heading.attributes, class: { type: Object } },
    render: component('./src/components/heading.component.astro'),
  },
  paragraph: {
    ...defaults.paragraph,
    attributes: { ...defaults.paragraph.attributes, class: { type: Object } },
    render: component('./src/components/paragraph.component.astro'),
  },
  // authors write `/mitgliedsantrag`, the project page serves `/website/…`
  link: {
    ...defaults.link,
    render: component('./src/components/link.component.astro'),
  },
};
