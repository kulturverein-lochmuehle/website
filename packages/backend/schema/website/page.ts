import alinea from 'alinea';

export const Page = alinea.type(
  'Page',
  alinea.tabs(
    alinea.tab('Content', {
      title: alinea.text('Title', { width: 0.5 }),
      path: alinea.path('Path', { width: 0.5 }),
      sections: alinea.list('Sections', {
        schema: alinea.schema({
          section: alinea.type('Section', {
            title: alinea.text('Title', { width: 0.5 }),
            path: alinea.path('Path', { width: 0.5 }),
            text: alinea.richText('Section content')
          }),
          history: alinea.type('History', {
            title: alinea.text('Title', { width: 0.5 }),
            path: alinea.path('Path', { width: 0.5 })
          })
        })
      })
    }),
    alinea.tab('Metadata', {
      description: alinea.text('Description')
    })
  )
);
