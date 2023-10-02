import { Component, ComponentInterface, h, Host, State } from '@stencil/core';
import { createRouter, href } from '@stencil/router';

import { getConfig } from '../../../utils/config.utils.js';
import { GenericPageRoute, GenericRouteContext } from '../../../utils/router.utils.js';

const { on, path, Switch } = createRouter();

@Component({
  tag: 'kvlm-root',
  styleUrl: 'root.scss',
  shadow: true,
})
export class Root implements ComponentInterface {
  @State()
  private context: GenericRouteContext;

  @State()
  private activePath = path;

  @State()
  private initialized = false;

  async componentWillLoad() {
    // resolve config and set to context
    const config = await getConfig();
    this.context = { activeRoute: path, config };

    // register route change listener
    on('change', ({ pathname }) => (this.activePath = pathname));
  }

  render() {
    return (
      <Host>
        <kvlm-header />
        <kvlm-main>
          <kvlm-content visible={this.initialized}>
            <Switch>
              <GenericPageRoute context={this.context} path="/" src="/pages/start.mdx" />
              <GenericPageRoute context={this.context} path="/impressum" src="/pages/impressum.mdx" />
              <GenericPageRoute context={this.context} path="/datenschutz" src="/pages/datenschutz.mdx" />
              <GenericPageRoute context={this.context} path="/satzung" src="/pages/satzung.mdx" />
              <GenericPageRoute context={this.context} path="/beitragsordnung" src="/pages/beitragsordnung.mdx" />
              <GenericPageRoute context={this.context} path="/protokolle" src="/pages/protokolle.mdx" />
              <GenericPageRoute context={this.context} path="/newsletter-anmeldung" src="/pages/newsletter-anmeldung.mdx" />
              <GenericPageRoute context={this.context} path="/newsletter-verifizieren" src="/pages/newsletter-verifizieren.mdx" />
              <GenericPageRoute context={this.context} path="/newsletter-abonniert" src="/pages/newsletter-abonniert.mdx" />
            </Switch>
          </kvlm-content>
        </kvlm-main>
        <kvlm-footer>
          <a {...href('/')} class={{ active: this.activePath === '/' }}>
            Kulturverein
          </a>
          <a {...href('/impressum')} class={{ active: this.activePath === '/impressum' }}>
            Impressum
          </a>
          <a {...href('/datenschutz')} class={{ active: this.activePath === '/datenschutz' }}>
            Datenschutz
          </a>
          <a {...href('/protokolle')} class={{ active: this.activePath.startsWith('/protokolle') }}>
            Protokolle
          </a>
          <a {...href('/newsletter-anmeldung')} class={{ active: this.activePath.startsWith('/newsletter-anmeldung') }}>
            Newsletter
          </a>
          <a href="https://www.facebook.com/kulturverein.lochmuehle" target="_blank">
            Facebook
          </a>
        </kvlm-footer>
        <kvlm-background preview="/assets/images/bg-sw.jpg" image="/assets/images/bg-preview.jpg" onLoaded={() => (this.initialized = true)} />
      </Host>
    );
  }
}
