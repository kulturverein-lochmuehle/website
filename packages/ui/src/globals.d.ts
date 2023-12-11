declare module '*.scss' {
  const style: string;
  export default style;
}

declare module '*.png' {
  const source: string;
  export default source;
}

declare module '*?inline' {
  const dataUrl: string;
  export default dataUrl;
}
