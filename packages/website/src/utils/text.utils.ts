import { marked } from 'marked';

/** Frontmatter scalars may carry inline markdown, e.g. the chronicle teasers. */
export async function prepareText(md: string): Promise<string> {
  return marked(md, { breaks: true });
}
