import { backend } from '@alinea/core';
import { passwordLess } from '@alinea/auth.passwordless';
import { IcRoundInsertDriveFile } from '@alinea/ui/icons/IcRoundInsertDriveFile';
import { IcRoundPermMedia } from '@alinea/ui/icons/IcRoundPermMedia';
import { alinea, BrowserPreview, MediaSchema } from 'alinea';

import { configureBackend } from './alinea.server';
import { IcRoundPerson } from './schema/example/icons/ic-person';

import { Author, BlogContainer, BlogPost, HomePage } from './schema/example';
import { Page } from './schema/website';

const schema = alinea.schema({
  ...MediaSchema,
  // Example types
  Author,
  BlogContainer,
  BlogPost,
  HomePage,
  // Website types
  Page
});

export const config = alinea.createConfig({
  schema,
  dashboard: {
    staticFile: './public/admin.html',
    dashboardUrl: '/admin.html',
    handlerUrl: '/api/cms'
  },
  backend: backend({
    auth: passwordLess
  }).configure(configureBackend),
  workspaces: {
    example: alinea.workspace('Example', {
      source: './content/example',
      mediaDir: './public/assets',
      roots: {
        entries: alinea.root('Blog', {
          icon: IcRoundInsertDriveFile,
          contains: ['HomePage', 'BlogContainer']
        }),
        authors: alinea.root('Authors', {
          icon: IcRoundPerson,
          contains: ['Author']
        }),
        assets: alinea.root('Assets', {
          icon: IcRoundPermMedia,
          contains: ['MediaLibrary']
        })
      },
      preview({ entry, previewToken }) {
        // During dev point at running Next.js development server,
        // in production use the current domain
        const location = process.env.NODE_ENV === 'development' ? 'http://localhost:3000' : '';
        if (['Author', 'BlogContainer'].includes(entry.type)) return null;
        return (
          <BrowserPreview
            url={`${location}/api/preview?previewToken=${previewToken}`}
            // The preview pane will display this url to the user
            prettyUrl={entry.url}
          />
        );
      }
    }),

    main: alinea.workspace('Website', {
      source: './content/website',
      mediaDir: './public/assets',
      roots: {
        pages: alinea.root('Pages', {
          icon: IcRoundInsertDriveFile,
          contains: ['Page']
        })
      }
    })
  }
});
