import { DateIsoConverter } from '@enke.dev/lit-utils/lib/converters/date-iso.converter.js';
import { html, LitElement } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { ifDefined } from 'lit/directives/if-defined.js';

import { formatDate } from '../../../../utils/format.utils.js';
import styles from './timeline-item.component.css?inline&lit';

/**
 * Displays a single timeline item with its given title, timestamp and text.
 * With an `href` the whole item becomes the link to its own page.
 */
@customElement('kvlm-timeline-item')
export class TimelineItem extends LitElement {
  static override readonly styles = styles;

  @property({ type: String, reflect: true })
  override readonly role = 'listitem';

  @property({ reflect: true, type: Boolean })
  trailing = false;

  @property({ reflect: true, type: Boolean })
  leading = false;

  @property({ reflect: true, converter: DateIsoConverter(true) })
  date!: Date;

  @property({ reflect: true, type: String, attribute: 'aria-label' })
  readonly label!: string;

  /**
   * Page of the item, if it has one of its own.
   */
  @property({ reflect: true, type: String })
  readonly href?: string;

  override render() {
    const contents = html`
      <time datetime="${ifDefined(this.getAttribute('date')) as string}">
        ${formatDate(this.date)}
      </time>
      <h2>${this.label}</h2>
      <slot></slot>
    `;

    if (this.href === undefined) {
      return contents;
    }

    return html`<a href="${this.href}">${contents}</a>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'kvlm-timeline-item': TimelineItem;
  }
}
