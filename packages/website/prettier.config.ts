import type { Config } from 'prettier';

const config: Config = {
  arrowParens: 'avoid',
  endOfLine: 'auto',
  jsxSingleQuote: false,
  printWidth: 100,
  singleQuote: true,
  tabWidth: 2,
  trailingComma: 'all',
  // prettier knows no `.mdoc` - the bodies are markdown with tags on top,
  // which the markdown parser leaves untouched
  overrides: [{ files: '*.mdoc', options: { parser: 'markdown' } }],
};

export default config;
