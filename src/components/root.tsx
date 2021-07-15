import {Component, ComponentInterface, h} from '@stencil/core';

@Component({
  tag: 'kvlm-root',
  shadow: true,
})
export class Root implements ComponentInterface {

  render() {
    return (
      <kvlm-terrain/>
    );
  }

}
