import { readFile } from 'fs/promises';
import { dirname, extname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { hmrPlugin, presets } from '@open-wc/dev-server-hmr';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// --watch --node-resolve --port 3500 --root-dir dist --app-index index.html
const config = {
  debug: false,
  port: 3500,
  rootDir: 'dist',
  appIndex: 'index.html',
  nodeResolve: true,
  watch: true
};

export default {
  ...config,
  plugins: [
    // https://open-wc.org/docs/development/hot-module-replacement/#lit--litelement
    hmrPlugin({
      include: ['src/**/*'],
      presets: [presets.lit]
    }),
    // https://modern-web.dev/docs/dev-server/writing-plugins/overview/#writing-plugins-overview
    {
      name: 'restore SPA on reload',
      async serve(context) {
        if (
          context.request.url !== '/' &&
          context.response.status === 404 &&
          extname(context.request.url) === ''
        ) {
          const index = resolve(__dirname, config.rootDir, config.appIndex);
          return readFile(index).then(content => content.toString());
        }
      }
    }
  ]
};
