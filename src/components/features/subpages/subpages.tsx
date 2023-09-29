import {Component, ComponentInterface, h, Host, Prop, State, Watch} from '@stencil/core';
import {loadMarkdown} from '../../../utils/page.utils';

@Component({
  tag: 'kvlm-subpages',
  styleUrl: 'subpages.scss',
  shadow: true,
})
export class Subpages implements ComponentInterface {
  @State()
  private _selected?: string;

  @State()
  private _article = '';

  @State()
  private _pages: { [name: string]: string; } = {};

  @Prop()
  src!: string;

  @Watch('src')
  async componentWillLoad() {
    const pages = await fetch(this.src);
    this._pages = await pages.json();
  }

  async loadPage(src: string) {
    this._selected = src;
    this._article = await loadMarkdown(src);
  }

  render() {
    return (
      <Host>
        <nav>
          {Object.keys(this._pages).sort().reverse().map(name => (
            <a class={{active: this._pages[name] === this._selected}}
               onClick={() => this.loadPage(this._pages[name])}
            >
              {name}
            </a>
          ))}
        </nav>
        <article innerHTML={this._article} />
      </Host>
    );
  }
}
