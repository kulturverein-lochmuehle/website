/**
 * Turns the component style sheets into lit `css` tagged templates.
 *
 * They are imported with `?inline&lit`. `?inline` is what keeps them out of the
 * page - in dev astro inlines every buildable css request of a route into a
 * global `<style>`, and `isBuildableCSSRequest` skips `?raw` and `?inline`. A
 * shadow sheet in the document applies its unscoped `a`, `svg` and `path` rules
 * to every element on the page. `&lit` marks it as ours, and keeps vite's own
 * `*?inline` type declaration - a plain string - off it.
 *
 * `vite-plugin-lit-css` cannot do this: it hands ids carrying `?inline` straight
 * back untransformed, so the two requirements are mutually exclusive there.
 */

// the page styles at the root of the package carry no query and stay out
const DEFAULT_INCLUDE = /\.css\?(?:.*&)?inline&lit\b/;

const escape = css => css.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$\{/g, '\\${');

export default ({ include = DEFAULT_INCLUDE } = {}) => ({
  name: 'kvlm-lit-css',
  // after `vite:css-post`, which is what turns the sheet into `export default "…"`
  enforce: 'post',
  transform(code, id) {
    if (!include.test(id)) {
      return null;
    }

    const literal = code.trim().replace(/;$/, '').slice('export default '.length);
    if (!literal.startsWith('"')) {
      return null;
    }

    return {
      code: [
        "import { css as __css } from 'lit';",
        `export default __css\`${escape(JSON.parse(literal))}\`;`,
      ].join('\n'),
      map: null,
    };
  },
});
