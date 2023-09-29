import { Component, ComponentInterface, h } from '@stencil/core';

@Component({
  tag: 'kvlm-icon',
  styleUrl: 'icon.scss',
  shadow: true
})
export class Icon implements ComponentInterface {

  render() {
    return (
      <slot/>
    );
  }

}
