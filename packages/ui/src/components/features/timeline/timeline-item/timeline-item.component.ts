import { LitElement, html, unsafeCSS } from 'lit';
import { customElement, property } from 'lit/decorators.js';

import { DateConverter } from '@/utils/converter.utils';
import { getLocale } from '@/utils/locale.utils';

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

  @property({ reflect: true, type: String })
  text!: string;

  private formatDate(date: Date): string {
    return date.toLocaleDateString(getLocale(), {
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    });
  }

  render() {
    return html`
      <time datetime="${this.date}">${this.formatDate(this.date)}</time>
      <h2>${this.title}</h2>
      <p>${this.text}</p>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'kvlm-timeline-item': TimelineItem;
  }
}
