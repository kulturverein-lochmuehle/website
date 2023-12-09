import { html, LitElement, unsafeCSS } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { ifDefined } from 'lit/directives/if-defined.js';

import { DateConverter } from '@/utils/converter.utils.js';
import { formatDate } from '@/utils/format.utils.js';

import styles from './timeline-item.component.scss';

/**
 * Displays a single timeline item with its given title, timestamp and text.
 */
@customElement('kvlm-timeline-item')
export class TimelineItem extends LitElement {
  static override readonly styles = unsafeCSS(styles);

  @property({ reflect: true, converter: DateConverter() })
  date!: Date;

  @property({ reflect: true, type: String })
  title!: string;

  render() {
    return html`
      <time datetime="${ifDefined(this.getAttribute('date')) as string}">
        ${formatDate(this.date)}
      </time>
      <h2>${this.title}</h2>
      <slot></slot>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'kvlm-timeline-item': TimelineItem;
  }
}
