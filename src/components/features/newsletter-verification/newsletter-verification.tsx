import { Component, ComponentInterface, Prop, State, h } from '@stencil/core';

@Component({
  tag: 'kvlm-newsletter-verification',
  styleUrl: 'newsletter-verification.scss',
  shadow: true,
})
export class NewsletterVerification implements ComponentInterface {
  @State()
  private status?: number;

  @Prop()
  readonly at!: string;

  @Prop()
  readonly token!: string;

  async componentWillLoad() {
    const url = new URL(this.at, location.origin);
    url.searchParams.append('token', this.token);
    const response = await fetch(url, { method: 'POST' });
    this.status = response.status;
  }

  render() {
    switch (this.status) {
      case 200:
        return <slot name="success" />;
      case 400:
        return <slot name="error" />;
      case 409:
        return <slot name="conflict" />;
      default:
        return <slot />;
    }
  }
}
