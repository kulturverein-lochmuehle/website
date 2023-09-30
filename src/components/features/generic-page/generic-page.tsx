import { Component, h, Prop, Watch } from '@stencil/core';

import type { PageComponent } from '../../../types/page.types.js';
import { loadMarkdown } from '../../../utils/page.utils.js';
import { GenericRouteContext } from '../../../utils/router.utils.js';

@Component({
  tag: 'kvlm-generic-page',
  styleUrl: 'generic-page.scss',
  shadow: true,
})
export class GenericPage implements PageComponent {
  private elementRef: HTMLElement;

  get config() {
    return this.context.config;
  }

  @Prop()
  context!: GenericRouteContext;

  @Prop()
  src!: string;

  @Watch('src')
  async loadMarkdown() {
    this.elementRef.innerHTML = await loadMarkdown(this.src, this.context);
  }

  async componentDidLoad() {
    await this.loadMarkdown();
  }

  render() {
    return <div ref={element => (this.elementRef = element)} />;
  }
}
