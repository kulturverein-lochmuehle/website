export const getCorsHeaders = (httpMethod: string) => ({
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': `${httpMethod}, OPTIONS`,
  'Access-Control-Allow-Headers': 'content-type, x-requested-with',
});
