import { Component, ComponentInterface, h } from '@stencil/core';

@Component({
  tag: 'kvlm-footer',
  styleUrl: 'footer.scss',
  shadow: true,
})
export class Footer implements ComponentInterface {
  render() {
    return (
      <kvlm-buttons>
        <slot />
      </kvlm-buttons>
    );
  }
}
