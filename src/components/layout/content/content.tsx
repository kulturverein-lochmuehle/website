import { Component, ComponentInterface, h, Prop } from '@stencil/core';

@Component({
  tag: 'kvlm-content',
  styleUrl: 'content.scss',
  shadow: true
})
export class Content implements ComponentInterface {

  @Prop({ reflect: true })
  visible = false;

  render() {
    return (
      <slot/>
    );
  }

}
