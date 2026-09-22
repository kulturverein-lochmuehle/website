import { getLocale } from './locale.utils.js';

/**
 * Converts a given date into a readable german date string.
 */
export function formatDate(date?: Date): string | undefined {
  return date?.toLocaleDateString(getLocale(), {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}
