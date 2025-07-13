import type { AstroIntegration } from 'astro';

export function clientSlot(): AstroIntegration {
  const url = new URL('./client-slot.directive.js', import.meta.url);
  return {
    name: 'client:slot',
    hooks: {
      'astro:config:setup': ({ addClientDirective }) => {
        addClientDirective({ name: 'slot', entrypoint: url.pathname });
      },
    },
  };
}
