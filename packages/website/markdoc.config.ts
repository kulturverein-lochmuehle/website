import { defineMarkdocConfig } from '@astrojs/markdoc/config';

import { nodes } from './src/markdoc/nodes.js';
import { tags } from './src/markdoc/tags.js';

export default defineMarkdocConfig({ nodes, tags });
