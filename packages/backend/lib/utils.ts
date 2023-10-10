export const parseBoolean = (value: string | undefined): boolean => {
  return ['1', 'true'].includes(value);
};
