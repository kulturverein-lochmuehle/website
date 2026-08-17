import type { CollectionFile } from '@sveltia/cms';

export const navigation: CollectionFile = {
  name: 'navigation',
  label: 'Navigation',
  file: 'src/content/navigation/navigation.yml',
  fields: [
    {
      name: 'page',
      label: 'Seite',
      widget: 'relation',
      collection: 'pages',
      value_field: '{{slug}}',
      display_fields: ['title'],
      search_fields: ['title'],
    },
    {
      name: 'useSections',
      label: 'Abschnitte verwenden',
      widget: 'boolean',
      default: false,
      required: false,
    },
  ],
};
