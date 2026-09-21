import { component, Markdoc, type AstroMarkdocConfig } from '@astrojs/markdoc/config';

export const tags: AstroMarkdocConfig['tags'] = {
  section: {
    render: component('./src/components/section.component.astro'),
    attributes: {
      id: { type: String, required: true },
      title: { type: String, required: true },
      theme: { type: String, default: 'dark', matches: ['light', 'dark'] },
    },
    // the page is no attribute of the tag, it arrives as a markdoc variable
    // from the route and completes the section's anchor
    transform(node, config) {
      const attributes = node.transformAttributes(config);
      const children = node.transformChildren(config);
      const render = config.tags?.['section']?.render ?? 'section';
      return new Markdoc.Tag(
        render as string,
        { ...attributes, page: config.variables?.['page'] },
        children,
      );
    },
  },
  teaser: {
    render: component('./src/components/teaser.component.astro'),
    selfClosing: true,
    attributes: {
      title: { type: String, required: true },
      scope: {
        type: String,
        required: true,
        matches: [
          'chronicle:all',
          'chronicle:next',
          'chronicle:past',
          'chronicle:upcoming',
          'events:next',
          'events:upcoming',
        ],
      },
    },
  },
};
