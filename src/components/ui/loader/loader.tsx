import { Component, ComponentInterface, h } from '@stencil/core';

@Component({
  tag: 'kvlm-loader',
  styleUrl: 'loader.scss',
  shadow: true
})
export class Loader implements ComponentInterface {

  render() {
    return (
      <div class="spinner"/>
    );
  }

}
