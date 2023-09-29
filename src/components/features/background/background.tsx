import { Component, ComponentInterface, Event, EventEmitter, h, Host, Prop, State } from '@stencil/core';

@Component({
  tag: 'kvlm-background',
  styleUrl: 'background.scss',
  shadow: true,
})
export class Background implements ComponentInterface {
  @Event()
  readonly loaded!: EventEmitter<string>;

  @Prop()
  image!: string;

  @Prop()
  preview!: string;

  @State()
  private _loaded?: string;

  componentDidLoad() {
    const cache = new Image();
    cache.addEventListener('load', () => {
      this._loaded = cache.src;
      this.loaded.emit(cache.src);
    });
    cache.src = this.image;
  }

  render() {
    return (
      <Host class={{ ready: !!this._loaded }}>
        <img id="loaded" src={this._loaded} alt="" />
        <img id="preview" src={this.preview} alt="" />
      </Host>
    );
  }
}
