/**
 * Named breakpoints for `@media` and `@container`, the successor of the sass
 * `media()` and `container()` mixins. A container condition takes no
 * `@custom-media` and no `var()`, only a literal length - so the two at-rules
 * are served by one plugin instead of `postcss-custom-media` plus a second
 * mechanism for containers.
 *
 * @example
 * ```css
 * @container (--from-sm) { … }            // (min-width: 768px)
 * @media (--until-lg) { … }               // (max-width: 1199px)
 * @container (--from-sm) and (--until-lg) // both, in that order
 * @container layout (--from-sm)           // named container, name untouched
 * ```
 */

// single source of the breakpoints
const BREAKPOINTS = { xs: 480, sm: 768, md: 992, lg: 1200, xl: 1600 };

const TOKEN = /\(\s*--([a-z0-9-]+)\s*\)/gi;

const expand = (params, rule) =>
  params.replace(TOKEN, (match, token) => {
    const [direction, name] = token.toLowerCase().split('-');
    const width = BREAKPOINTS[name];
    // an unresolved token would ship a query that never matches, silently
    if (width === undefined || (direction !== 'from' && direction !== 'until')) {
      throw rule.error(
        `Unknown breakpoint token "${match}". Expected (--from-<name>) or (--until-<name>) ` +
          `with <name> one of: ${Object.keys(BREAKPOINTS).join(', ')}.`,
        { word: match }
      );
    }
    return direction === 'from' ? `(min-width: ${width}px)` : `(max-width: ${width - 1}px)`;
  });

const plugin = () => ({
  postcssPlugin: 'kvlm-breakpoints',
  AtRule: {
    media: rule => void (rule.params = expand(rule.params, rule)),
    container: rule => void (rule.params = expand(rule.params, rule)),
  },
});
plugin.postcss = true;

export default plugin;
