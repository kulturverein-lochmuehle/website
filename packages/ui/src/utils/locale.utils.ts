import { isServer } from 'lit';

/** The language the page is written in, german unless a document says else. */
export function getLocale(): string {
  if (isServer) {
    return 'de';
  }

  if (document.documentElement.lang !== '') {
    return document.documentElement.lang;
  }
  return navigator.language;
}
