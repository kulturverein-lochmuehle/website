import type { ComplexAttributeConverter } from 'lit';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ConverterFactory<T> = (...params: any) => Required<ComplexAttributeConverter<T>>;

export const DateConverter: ConverterFactory<Date | undefined> = () => ({
  fromAttribute: value => {
    return value === null ? undefined : new Date(value);
  },
  toAttribute: (value): string | null => {
    if (value === undefined || Number.isNaN(value.getTime())) {
      return null;
    }
    return value.toISOString().slice(0, 10);
  }
});
