import type { Section, Typo } from '@kvlm/ui';

declare global {
  import type { Section, Typo } from '@kvlm/ui';
  type IntrinsicElement<E> = React.DetailedHTMLProps<React.HTMLAttributes<E>, E>;
  namespace JSX {
    interface IntrinsicElements {
      'kvlm-section': IntrinsicElement<typeof Section>;
      'kvlm-typo': IntrinsicElement<typeof Typo>;
    }
  }
}
