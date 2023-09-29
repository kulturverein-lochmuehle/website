import { Component, ComponentInterface, h, Prop, Watch } from '@stencil/core';
import { matchQueryFromCustomProp } from '../../../utils/media-query.utils';

@Component({
  tag: 'kvlm-buttons',
  styleUrl: 'buttons.scss',
  shadow: true,
})
export class Buttons implements ComponentInterface {
  @Prop({ reflect: true })
  direction: 'horizontal' | 'vertical' = 'horizontal';

  @Prop({ reflect: true })
  forzeDirection?: 'horizontal' | 'vertical';

  @Watch('forzeDirection')
  updateDirection() {
    this.direction = this.forzeDirection;
  }

  componentWillLoad() {
    // set initial direction
    this.updateDirection();
    // prepare mobile listener
    matchQueryFromCustomProp('--media-query-tablet', isAboveMobile => {
      if (this.forzeDirection === undefined) {
        this.direction = !isAboveMobile ? 'vertical' : 'horizontal';
      }
    });
  }

  render() {
    return <slot />;
  }
}
