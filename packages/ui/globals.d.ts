declare interface Window {
  kvlm: {
    breakpoints: Record<string, number>;
    version: string;
  };
}

declare module 'eslint-plugin-import' {
  export default { flatConfigs: { recommended: any, typescript: any } };
}
declare module 'eslint-plugin-lit-a11y' {}
declare module 'eslint-plugin-file-extension-in-import-ts' {}
