import { Component, ComponentInterface, Element, h, Prop, Watch } from '@stencil/core';
import { matchQueryFromCustomProp } from '../../../utils/media-query.utils';

@Component({
  tag: 'kvlm-button',
  styleUrl: 'button.scss',
  shadow: true,
})
export class Button implements ComponentInterface {
  @Element()
  private readonly _elementRef: HTMLKvlmButtonElement;

  @Prop({ reflect: true })
  disabled = false;

  @Prop({ reflect: true })
  block = false;

  @Prop({ reflect: true })
  forzeBlock?: boolean;

  @Prop()
  type = 'button';

  @Prop()
  download?: string;

  @Prop()
  href?: string;

  @Prop()
  target?: string;

  @Watch('forzeBlock')
  updateDirection() {
    this.block = this.forzeBlock;
  }

  private _handleClick(event: Event) {
    if (this.type !== 'button') {
      // this button wants to specifically submit a form
      // climb up the dom to see if we're in a <form>
      // and if so, then use JS to submit it
      const form = this._elementRef.closest('form');
      if (form) {
        event.preventDefault();

        const fakeButton = document.createElement('button');
        fakeButton.type = this.type;
        fakeButton.style.display = 'none';
        form.appendChild(fakeButton);
        fakeButton.click();
        fakeButton.remove();
      }
    }
  }

  componentWillLoad() {
    // set initial direction
    this.updateDirection();
    // prepare mobile listener
    matchQueryFromCustomProp('--media-query-tablet', isAboveMobile => {
      if (this.forzeBlock === undefined) {
        this.block = !isAboveMobile;
      }
    });
  }

  render() {
    if (this.download || this.href) {
      return (
        <a class="button" href={this.href} target={this.target} download={this.download}>
          <span>
            <slot />
          </span>
        </a>
      );
    } else {
      return (
        <button class="button" type="button" onClick={event => this._handleClick(event)}>
          <span>
            <slot />
          </span>
        </button>
      );
    }
  }
}
