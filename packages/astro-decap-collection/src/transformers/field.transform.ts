import type * as Decap from 'decap-cms-core';
import type * as Zod from 'zod';

import { DecapWidgetType } from '../utils/decap.utils.js';
import type { TransformResult } from '../utils/transform.utils.js';

export function transformFields(fields: Decap.CmsField[], z: typeof Zod): TransformResult {
  const results = fields.map(field => [field.name, transformField(field, z)] as const);
  const runtime = z.object(Object.fromEntries(results.map(([name, r]) => [name, r.runtime])));
  const cptime = `z.object({${results.map(([name, r]) => `${name}: ${r.cptime}`).join(',')}})`;
  return { runtime, cptime };
}

export function transformField(field: Decap.CmsField, z: typeof Zod): TransformResult {
  const knownWidgets = field.widget as DecapWidgetType;
  let runtime: Zod.ZodType;
  let cptime: string;
  switch (knownWidgets) {
    // these are quite similar
    case 'text': // https://decapcms.org/docs/widgets/#text
    case 'string': // https://decapcms.org/docs/widgets/#string
    case 'color': // https://decapcms.org/docs/widgets/#color
    case 'markdown': // https://decapcms.org/docs/widgets/#markdown
    // these might be treated differently...
    case 'file': // https://decapcms.org/docs/widgets/#file
    case 'image': // https://decapcms.org/docs/widgets/#image
      runtime = z.string();
      cptime = 'z.string()';
      break;

    // ... like this one
    // https://decapcms.org/docs/widgets/#datetime
    case 'datetime':
      // Decap does not store seconds, but we can just articulate 'no milliseconds'
      // https://zod.dev/?id=datetimes
      runtime = z.string().datetime({ precision: 0 });
      cptime = 'z.string().datetime({ precision: 0 })';
      break;

    // https://decapcms.org/docs/widgets/#code
    case 'code':
      const { output_code_only: flat } = field as Decap.CmsFieldCode;
      runtime = flat ? z.string() : z.object({ code: z.string(), language: z.string() });
      cptime = flat ? 'z.string()' : 'z.object({ code: z.string(), language: z.string() })';
      break;

    // https://decapcms.org/docs/widgets/#hidden
    case 'hidden':
      // TODO: what the heck are "valid" types?
      // → https://zod.dev/?id=json-type
      runtime = z.string().or(z.number()).or(z.boolean());
      cptime = 'z.string().or(z.number()).or(z.boolean())';
      break;

    // https://decapcms.org/docs/widgets/#map
    case 'map':
      // TODO handle the parsed result of '{"type":"Point","coordinates":[13.74717,51.0544007]}'
      // → https://zod.dev/?id=custom-schemas
      // runtime = z.object({
      //   lat: z.number().finite(),
      //   lng: z.number().finite(),
      // });
      runtime = z.string();
      cptime = 'z.string()';
      break;

    // TODO implement transform relations
    // https://decapcms.org/docs/widgets/#relation
    case 'relation':
      runtime = z.string();
      cptime = 'z.string()';
      break;

    // numbers can be float or int, can have min/max values
    // https://decapcms.org/docs/widgets/#number
    case 'number': {
      const { max, min, value_type = 'int' } = field as Decap.CmsFieldNumber;
      const transformed = {
        runtime: z.number().finite(),
        cptime: 'z.number().finite()',
      };

      if (value_type === 'int') {
        transformed.runtime = transformed.runtime.int();
        transformed.cptime = `${transformed.cptime}.int()`;
      }
      if (min !== undefined) {
        transformed.runtime = transformed.runtime.min(min);
        transformed.cptime = `${transformed.cptime}.min(${min})`;
      }
      if (max !== undefined) {
        transformed.runtime = transformed.runtime.max(max);
        transformed.cptime = `${transformed.cptime}.max(${max})`;
      }

      runtime = transformed.runtime;
      cptime = transformed.cptime;

      break;
    }

    case 'boolean':
      runtime = z.boolean();
      cptime = 'z.boolean()';
      break;

    case 'object':
      const { fields } = field as Decap.CmsFieldObject;
      const transformed = transformFields(fields, z);
      runtime = transformed.runtime;
      cptime = transformed.cptime;
      break;

    case 'select':
      const { options } = field as Decap.CmsFieldSelect;
      const items = options.map(option => (typeof option === 'string' ? option : option.value));
      runtime = z.enum(items as [string, ...string[]]);
      cptime = `z.enum([${items.map(i => `'${i}'`).join(',')}])`;
      break;

    case 'list': {
      const { types } = field as Decap.CmsFieldList;
      const transformed = types.map(({ fields, name }): TransformResult => {
        // transform first
        const item = transformFields(fields, z);
        // extend with type discriminator
        return {
          runtime: (item.runtime as Zod.ZodObject<any>).extend({ type: z.literal(name) }),
          cptime: `${item.cptime}.extend({type: z.literal('${name}')})`,
        };
      });
      runtime = z.array(
        z.discriminatedUnion('type', transformed.map(t => t.runtime) as [any, any, ...any[]]),
      );
      cptime = `z.array(z.discriminatedUnion('type', [${transformed.map(t => t.cptime).join(',')}]))`;
      break;
    }

    default:
      (_exhaustiveCheck: never = knownWidgets) => null;
      runtime = z.never();
      cptime = 'z.never()';
      break;
  }

  // flag field as optional - it should be explicitly `optional()` or `nullable()`,
  // but for me it's not quite clear right now what is specified on the Decap side
  // fyi: https://gist.github.com/ciiqr/ee19e9ff3bb603f8c42b00f5ad8c551e
  if (field.required === false) {
    runtime = runtime.nullish();
    cptime = `${cptime}.nullish()`;
  }

  // set a default value
  const { default: def } = field as Decap.CmsFieldStringOrText;
  if (def !== undefined) {
    runtime = runtime.default(def);
    cptime = `${cptime}.default(${JSON.stringify(def)})`;
  }

  // add a description
  const description = field.hint ?? field.label ?? field.name;
  runtime = runtime.describe(description);
  cptime = `${cptime}.describe('${description}')`;

  return { runtime, cptime };
}
