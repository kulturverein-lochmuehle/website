// type import should vanish in runtime
import { BuiltInParserName, format, resolveConfig } from 'prettier';

// try to load optional prettier
export async function loadPrettier(): Promise<
  | {
      format: typeof format;
      resolveConfig: typeof resolveConfig;
    }
  | undefined
> {
  try {
    const { format, resolveConfig } = await import('prettier');
    return { format, resolveConfig };
  } catch {
    console.warn('Prettier not found. Will write files without formatting.');
    return undefined;
  }
}

// format code using prettier if available
export async function formatCode(
  code: string,
  parser: BuiltInParserName = 'typescript',
  target?: string,
): Promise<string> {
  const prettier = await loadPrettier();
  if (prettier === undefined) return code;
  const options = await prettier.resolveConfig(target);
  return prettier.format(code, { ...options, parser });
}
