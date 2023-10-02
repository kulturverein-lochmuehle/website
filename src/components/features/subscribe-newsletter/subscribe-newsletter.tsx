import { Component, ComponentInterface, Prop, State, h } from '@stencil/core';
import { href } from '@stencil/router';

@Component({
  tag: 'kvlm-subscribe-newsletter',
  styleUrl: 'subscribe-newsletter.scss',
  shadow: true,
})
export class SubscribeNewsletter implements ComponentInterface {
  @State()
  private _isIdle = true;

  @State()
  private _isValid = false;

  @State()
  private _isSent = false;

  @State()
  private _hasError = false;

  @Prop()
  readonly at!: string;

  private handleInput(event: InputEvent) {
    const input = event.target as HTMLInputElement;
    this._isValid = input.form?.checkValidity() ?? false;
  }

  private async handleSubmit(event: Event) {
    event.preventDefault();
    this._hasError = false;
    this._isIdle = false;
    const formData = new FormData(event.target as HTMLFormElement);
    const data = {};
    formData.forEach((value, key) => (data[key] = value));

    try {
      const response = await fetch(this.at, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      this._isSent = response.ok;
      this._hasError = !response.ok;
      this._isIdle = true;
    } catch (error) {
      this._hasError = true;
      this._isSent = false;
      this._isIdle = true;
    }
  }

  render() {
    if (!this._isSent) {
      return (
        <form name="newsletter" method="post" onInput={event => this.handleInput(event)} onSubmit={event => this.handleSubmit(event)}>
          <label hidden aria-hidden="true">
            <input type="text" name="honey" />
          </label>

          <label>
            Vorname: <input disabled={!this._isIdle} type="text" name="first_name" />
          </label>

          <label>
            Nachname: <input disabled={!this._isIdle} type="text" name="last_name" />
          </label>

          <label>
            Email-Adresse*: <input disabled={!this._isIdle} type="email" name="email" required />
          </label>

          <label class="checkbox">
            <input disabled={!this._isIdle} type="checkbox" name="consent" required />
            <span>
              Ich bin mit den <a {...href('/datenschutz')}>Datenschutzbestimmungen</a> vertraut und stimme zu.*
            </span>
          </label>

          <kvlm-button disabled={!this._isIdle || !this._isValid} type="submit">
            Zum Newsletter anmelden
          </kvlm-button>

          {this._hasError && <slot name="error" />}
        </form>
      );
    } else {
      return (
        <div class="success">
          <slot name="success" />
        </div>
      );
    }
  }
}
