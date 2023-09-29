import { Component, ComponentInterface, h, Host } from '@stencil/core';

@Component({
  tag: 'kvlm-main',
  styleUrl: 'main.scss',
  shadow: true
})
export class Main implements ComponentInterface {

  render() {
    return (
      <Host role="main">
        <slot/>
      </Host>
    );
  }

}
