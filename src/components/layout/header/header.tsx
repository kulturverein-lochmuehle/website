import { Component, ComponentInterface, h } from '@stencil/core';

@Component({
  tag: 'kvlm-header',
  styleUrl: 'header.scss',
  shadow: true
})
export class Header implements ComponentInterface {

  render() {
    return (
      <h1>
        Kulturverein<br/>
        <span>Lochmühle</span>
      </h1>
    );
  }

}
