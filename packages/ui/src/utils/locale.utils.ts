export function getLocale(): string {
  if (document.documentElement.lang !== '') {
    return document.documentElement.lang;
  }
  return navigator.language;
}
