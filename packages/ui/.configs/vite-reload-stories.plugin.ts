import { globSync } from 'node:fs';
import { resolve } from 'node:path';

import type { Plugin } from 'vite';

export function reloadStories(glob: string): Plugin {
  const files = globSync(glob).map(path => resolve(path));

  return {
    name: 'reload-stories',
    enforce: 'post',

    buildStart() {
      files.forEach(path => this.addWatchFile(path));
    },
    handleHotUpdate({ file, server }) {
      if (files.includes(file)) {
        server.ws.send({
          type: 'full-reload',
          path: '*',
        });
      }
    },
  };
}
