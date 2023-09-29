import { Component, h, Prop, Watch } from '@stencil/core';

import { PageComponent } from '../../../types/page.types';
import { Config } from '../../../utils/config.utils';
import { loadMarkdown } from '../../../utils/page.utils';

@Component({
  tag: 'kvlm-generic-page',
  styleUrl: 'generic-page.scss',
  shadow: true,
})
export class GenericPage implements PageComponent {
  private elementRef: HTMLElement;

  @Prop()
  config!: Config;

  @Prop()
  src!: string;

  @Watch('src')
  async loadMarkdown() {
    this.elementRef.innerHTML = await loadMarkdown(this.src, { config: this.config });
  }

  async componentDidLoad() {
    await this.loadMarkdown();
  }

  render() {
    return <div ref={element => (this.elementRef = element)} />;
  }
}
