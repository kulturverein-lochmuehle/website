import type { CSSResult } from 'lit';
import { isServer } from 'lit';

import { hashFrom } from './crypto.utils.js';

export async function injectGlobalStyle(styles: CSSResult) {
  // server rendering has no document to inject into, the component ships
  // its styles with its shadow root there
  if (isServer) {
    return;
  }

  const hash = await hashFrom(styles.cssText);
  if (document.head.querySelector(`style[data-hash="${hash}"]`)) {
    return;
  }

  const style = document.createElement('style');
  style.textContent = styles.cssText;
  style.dataset['hash'] = hash;
  document.head.appendChild(style);
}
