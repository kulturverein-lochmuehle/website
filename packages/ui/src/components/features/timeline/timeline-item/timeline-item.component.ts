import { DateIsoConverter } from '@enke.dev/lit-utils/lib/converters/date-iso.converter.js';
import { html, LitElement, unsafeCSS } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { ifDefined } from 'lit/directives/if-defined.js';

import { formatDate } from '@/utils/format.utils.js';

import styles from './timeline-item.component.scss?inline';

/**
 * Displays a single timeline item with its given title, timestamp and text.
 */
@customElement('kvlm-timeline-item')
export class TimelineItem extends LitElement {
  static override readonly styles = unsafeCSS(styles);

  @property({ type: String, reflect: true })
  readonly role = 'listitem';

  @property({ reflect: true, type: Boolean })
  trailing = false;

  @property({ reflect: true, type: Boolean })
  leading = false;

  @property({ reflect: true, converter: DateIsoConverter(true) })
  date!: Date;

  @property({ reflect: true, type: String, attribute: 'aria-label' })
  readonly label!: string;

  render() {
    return html`
      <time datetime="${ifDefined(this.getAttribute('date')) as string}">
        ${formatDate(this.date)}
      </time>
      <h2>${this.label}</h2>
      <slot></slot>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'kvlm-timeline-item': TimelineItem;
  }
}
