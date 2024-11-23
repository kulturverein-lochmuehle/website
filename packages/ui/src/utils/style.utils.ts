import type { CSSResult } from 'lit';

import { hashFrom } from '@/utils/crypto.utils.js';

export async function injectGlobalStyle(styles: CSSResult) {
  const hash = await hashFrom(styles.cssText);
  if (document.head.querySelector(`style[data-hash="${hash}"]`)) return;

  const style = document.createElement('style');
  style.textContent = styles.cssText;
  style.dataset.hash = hash;
  document.head.appendChild(style);
}
