/**
 * The document title is composed in two places: the head of a page, and the
 * `data-router-title` of each section, which the router adopts when it scrolls
 * to one instead of fetching a document.
 */
export const SITE_TITLE = 'Kulturverein Lochmühle e.V.';

export const documentTitle = (pageTitle?: string, siteTitle: string = SITE_TITLE) =>
  pageTitle ? `${pageTitle} | ${siteTitle}` : siteTitle;
