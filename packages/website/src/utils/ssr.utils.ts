import { LitElementRenderer } from '@lit-labs/ssr/lib/lit-element-renderer.js';
import { collectResult } from '@lit-labs/ssr/lib/render-result.js';
import { render } from '@lit-labs/ssr';
import { Typo } from '@kvlm/ui';
import type { TemplateResult } from 'lit';

/** Components rendering into the light DOM, a shadow root would hide their children. */
const LIGHT_DOM: unknown[] = [Typo];

class LightDomRenderer extends LitElementRenderer {
  static override matchesClass(ctor: typeof HTMLElement): boolean {
    return LIGHT_DOM.includes(ctor);
  }

  override renderShadow(): undefined {
    return undefined;
  }
}

/**
 * Renders a tree of components into declarative shadow roots, styles and all,
 * so a page arrives painted instead of waiting for the module defining them -
 * which then upgrades the elements and takes the markup over.
 *
 * One render at the top covers the whole page: the components below are plain
 * markup and are rendered on the way. Rendering them twice, nested, would give
 * every one of them two shadow roots.
 */
export async function renderShadow(template: TemplateResult): Promise<string> {
  const renderers = [LightDomRenderer, LitElementRenderer];
  return collectResult(render(template, { elementRenderers: renderers }));
}
