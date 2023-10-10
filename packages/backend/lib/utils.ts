export const parseBoolean = (value: string | undefined): boolean => {
  return value !== undefined ? ['1', 'true'].includes(value) : false;
};
