// `import.meta.env.BASE_URL` is `/website` on the project page and `/` locally,
// so every absolute asset or link path has to be joined defensively.
export function withBase(path: string): string {
  const base = import.meta.env.BASE_URL.replace(/\/$/, '');
  return `${base}/${path.replace(/^\//, '')}`;
}
