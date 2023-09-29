import { compile } from 'handlebars';
import { marked } from 'marked';

export async function loadMarkdown(src: string, inject?: object): Promise<string> {
  // load content and compile
  const response = await fetch(src);
  const markdown = await response.text();
  const template = compile(markdown);

  // parse and apply
  return marked(template(inject), {});
}
