// .tina/config.ts
import { defineConfig } from "tinacms";
var branch = process.env.HEAD || "main";
var config_default = defineConfig({
  branch,
  clientId: null,
  // Get this from tina.io
  token: null,
  // Get this from tina.io
  build: {
    outputFolder: "admin",
    publicFolder: "public"
  },
  media: {
    tina: {
      mediaRoot: "images",
      publicFolder: "public"
    }
  },
  schema: {
    collections: [
      {
        name: "pages",
        label: "Pages",
        path: "src/pages",
        ui: {
          router(args) {
            console.log(args);
            return "/index.page/index.html";
          }
        },
        fields: [
          {
            type: "string",
            name: "lang",
            label: "Language",
            required: true
          },
          {
            type: "string",
            name: "title",
            label: "Title",
            isTitle: true,
            required: true
          },
          {
            type: "rich-text",
            name: "body",
            label: "Body",
            isBody: true
          }
        ]
      }
    ]
  }
});
export {
  config_default as default
};
