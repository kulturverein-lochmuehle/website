/// <reference types="@types/node" />

import { defineConfig } from 'tinacms';

// Your hosting provider likely exposes this as an environment variable
const branch = process.env.HEAD || 'main';

// https://tina.io/docs/reference/config/
export default defineConfig({
  branch,
  clientId: null, // Get this from tina.io
  token: null, // Get this from tina.io
  build: {
    outputFolder: 'admin',
    publicFolder: 'public'
  },
  media: {
    tina: {
      mediaRoot: 'images',
      publicFolder: 'public'
    }
  },
  schema: {
    collections: [
      {
        name: 'pages',
        label: 'Pages',
        path: 'src/pages',
        ui: {
          router(args) {
            console.log(args);
            return '/index.page/index.html';
            // return `/pages/${args.slug}`;
          }
        },
        fields: [
          {
            type: 'string',
            name: 'lang',
            label: 'Language',
            required: true
          },
          {
            type: 'string',
            name: 'title',
            label: 'Title',
            isTitle: true,
            required: true
          },
          {
            type: 'rich-text',
            name: 'body',
            label: 'Body',
            isBody: true
          }
        ]
      }
    ]
  }
});
