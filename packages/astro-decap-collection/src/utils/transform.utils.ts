import type { CmsCollection } from 'decap-cms-core';
import Zod, { type ZodType } from 'zod';

import { transformFields } from '../transformers/field.transform.js';

export type TransformOptions = {
  /**
   * Defines a custom Zod instance to be used.
   */
  zod: typeof Zod;
};

/**
 * Utility type defining the result of a transformation.
 * It consists of a Zod runtime type and a string representation of the Zod schema.
 * The latter is used to generate the content of a TypeScript file.
 */
export type TransformResult = {
  runtime: ZodType;
  cptime: string;
};

/**
 * Transforms a Decap CMS collection config into an Astro collection schema.
 */
export function transformCollection(
  collection: CmsCollection,
  { zod }: Partial<TransformOptions> = { zod: Zod },
): TransformResult {
  return transformFields(collection.fields, zod);
}
