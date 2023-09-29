import { Component, ComponentInterface, h, Host, Prop, State } from '@stencil/core';

@Component({
  tag: 'kvlm-authenticate',
  styleUrl: 'authenticate.scss',
  shadow: true,
})
export class Authenticate implements ComponentInterface {
  @State()
  private _inputRef: HTMLInputElement

  @State()
  private _password = '';

  @State()
  private _isFaulty = false;

  @State()
  private _isAuthenticated = false;

  @State()
  private _isProcessing = false;

  @Prop()
  readonly at!: string;

  private _handleInput() {
    this._password = this._inputRef.value;
    this._isFaulty = false;
  }

  private async _handleSubmit(event: Event) {
    event.preventDefault();
    this._isProcessing = true;
    this._isAuthenticated = await this._authenticate(this._password, this.at);
    this._isProcessing = false;

    if (!this._isAuthenticated) {
      this._isFaulty = true;
      this._password = '';

      setTimeout(() => {
        this._inputRef.value = '';
        this._inputRef.focus();
      }, 50);
    }
  }

  private async _authenticate(pass: string, url: string): Promise<boolean> {
    const headers = new Headers({ 'content-type': 'application/json' });
    const body = JSON.stringify({ KVLM_PROTOCOL_TOKEN: btoa(pass) });
    return new Promise(async resolve => {
      try {
        const response = await fetch(url, { body, headers, method: 'post', redirect: 'follow' });
        const { success } = await response.json();
        resolve(success);
      } catch (error) {
        resolve(false);
      }
    });
  }

  render() {
    return (
      <Host>
        {this._isAuthenticated ? (
          <slot />
        ) : (
          <form onSubmit={event => this._handleSubmit(event)}>
            <input
              required
              name="password"
              type="password"
              placeholder="Passwort"
              disabled={this._isProcessing}
              class={{ error: this._isFaulty }}
              ref={element => this._inputRef = element}
              onInput={() => this._handleInput()}
            />
            <kvlm-button disabled={this._isProcessing || this._password.length < 1} type="submit">
              Anmelden
            </kvlm-button>
          </form>
        )}
      </Host>
    );
  }
}
