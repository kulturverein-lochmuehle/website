import type { EntryCollection } from '@sveltia/cms';

export const chronicle: EntryCollection = {
  name: 'chronicle',
  label: 'Chronik',
  label_singular: 'Eintrag',
  description: 'Sammlung aller Veranstaltungen bisher und in Zukunft.',
  folder: 'src/content/chronicle',
  create: true,
  delete: true,
  view_groups: [{ field: 'date', label: 'Jahr' }],
  slug: "{{date | date('YYYYMMDD') }}-{{slug}}",
  summary: "{{date | date('DD.MM.YYYY')}} {{title}}",
  sortable_fields: ['date'],
  fields: [
    {
      name: 'title',
      label: 'Titel',
      widget: 'string',
    },
    {
      name: 'date',
      label: 'Datum',
      date_format: true,
      widget: 'datetime',
    },
    {
      name: 'teaser',
      label: 'Teaser',
      optional: true,
      widget: 'text',
    },
    {
      name: 'body',
      label: 'Inhalt',
      widget: 'markdown',
    },
  ],
};
