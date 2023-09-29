import { Component, ComponentInterface, h, Host, State } from '@stencil/core';
import { createRouter, href, Route } from '@stencil/router';
import { type Config, getConfig } from '../../../utils/config.utils.js';

const { path, Switch, on } = createRouter();

@Component({
  tag: 'kvlm-root',
  styleUrl: 'root.scss',
  shadow: true,
})
export class Root implements ComponentInterface {
  @State()
  private config?: Config;

  @State()
  private activePath = path;

  @State()
  private initialized = false;

  async componentWillLoad() {
    // resolve config
    this.config = await getConfig();

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
              <Route path="/">
                <kvlm-generic-page config={this.config} src="/pages/start.mdx" />
              </Route>
              <Route path={/^\/impressum/}>
                <kvlm-generic-page config={this.config} src="/pages/impressum.mdx" />
              </Route>
              <Route path={/^\/datenschutz/}>
                <kvlm-generic-page config={this.config} src="/pages/datenschutz.mdx" />
              </Route>
              <Route path={/^\/satzung/}>
                <kvlm-generic-page config={this.config} src="/pages/satzung.mdx" />
              </Route>
              <Route path={/^\/beitragsordnung/}>
                <kvlm-generic-page config={this.config} src="/pages/beitragsordnung.mdx" />
              </Route>
              <Route path={/^\/protokolle/}>
                <kvlm-generic-page config={this.config} src="/pages/protokolle.mdx" />
              </Route>
              <Route path={/^\/newsletter/}>
                <kvlm-generic-page config={this.config} src="/pages/newsletter.mdx" />
              </Route>
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
          {/* <a {...href('/newsletter')} class={{ active: this.activePath.startsWith('/newsletter') }}>
            Newsletter
          </a> */}
          <a href="https://www.facebook.com/kulturverein.lochmuehle" target="_blank">
            Facebook
          </a>
        </kvlm-footer>
        <kvlm-background preview="/assets/images/bg-sw.jpg" image="/assets/images/bg-preview.jpg" onLoaded={() => (this.initialized = true)} />
      </Host>
    );
  }
}
