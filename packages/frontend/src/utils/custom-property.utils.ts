export const readCustomProperty = (target: Element, property: string): string | undefined => {
  const value = window.getComputedStyle(target).getPropertyValue(property);
  return value.trim() === '' ? undefined : value;
};
