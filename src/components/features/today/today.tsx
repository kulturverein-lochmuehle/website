import { Component, ComponentInterface } from '@stencil/core';

@Component({
  tag: 'kvlm-today',
  styleUrl: 'today.scss',
  shadow: true,
})
export class Today implements ComponentInterface {
  render() {
    return new Date().toLocaleDateString();
  }
}
