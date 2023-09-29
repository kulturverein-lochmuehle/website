import { Component, ComponentInterface, State, h } from '@stencil/core';
import { href } from '@stencil/router';

@Component({
  tag: 'kvlm-newsletter',
  styleUrl: 'newsletter.scss',
  shadow: true,
})
export class Newsletter implements ComponentInterface {
  @State()
  private _isIdle = true;

  @State()
  private _isValid = false;

  @State()
  private _isSent = false;

  private handleInput(event: InputEvent) {
    const input = event.target as HTMLInputElement;
    this._isValid = input.form?.checkValidity() ?? false;
  }

  private async handleSubmit(event: Event) {
    event.preventDefault();
    this._isIdle = false;
    const form = event.target as HTMLFormElement;
    const body = new FormData(form);
    body.append('form-name', form.name);

    await fetch('/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });
    this._isSent = true; // response.ok;
    this._isIdle = true;
  }

  render() {
    if (!this._isSent) {
      return (
        <form
          data-netlify="true"
          netlify-honeypot="bot-field"
          name="newsletter"
          method="post"
          onInput={event => this.handleInput(event)}
          onSubmit={event => this.handleSubmit(event)}
        >
          <label hidden aria-hidden="true">
            <input name="bot-field" />
          </label>

          <label>
            Vorname: <input disabled={!this._isIdle} type="text" name="firstname" />
          </label>

          <label>
            Nachname: <input disabled={!this._isIdle} type="text" name="lastname" />
          </label>

          <label>
            Email-Adresse: <input disabled={!this._isIdle} type="email" name="email" required />
          </label>

          <label class="checkbox">
            <input disabled={!this._isIdle} type="checkbox" name="consent" required />
            <span>
              Ich bin mit den <a {...href('/datenschutz')}>Datenschutzbestimmungen</a> vertraut und stimme zu.
            </span>
          </label>

          <kvlm-button disabled={!this._isIdle || !this._isValid} type="submit">
            Zum Newsletter anmelden
          </kvlm-button>
        </form>
      );
    } else {
      return (
        <div class="success">
          <h3>Fast geschafft!</h3>
          <p>
            Eine Bestätigungsmail wurde an die angegebene Adresse versendet.
            <br />
            Sobald diese verifiziert wurde, liefern wir Aktuelles.
          </p>
        </div>
      );
    }
  }
}
