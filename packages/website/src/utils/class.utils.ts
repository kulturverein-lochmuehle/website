/** Markdoc hands class shorthands (`{% .lead %}`) over as a truthiness map. */
export type MarkdocClass = string | Record<string, boolean> | undefined;

export function classNames(...values: MarkdocClass[]): string {
  return values
    .flatMap(value => {
      if (value === undefined) return [];
      if (typeof value === 'string') return [value];
      return Object.entries(value)
        .filter(([, enabled]) => enabled)
        .map(([name]) => name);
    })
    .join(' ');
}
