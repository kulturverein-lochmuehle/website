/**
 * Bakes views for the views' test off its thread: the model built once, the
 * first time it is asked for, and each view named baked from it - as the bake
 * script does, so the test can bake several side by side.
 */

import { readPalette } from '../scene/palette.js';
import { createModel } from '../scene/scene.js';
import { bakeView, setUpView } from './prefab.js';
import type { ViewSpec } from './views.js';
import { VIEWS } from './views.js';

const palette = readPalette();
let model: ReturnType<typeof createModel>['model'] | undefined;

self.onmessage = ({ data: name }: MessageEvent<string>) => {
  model ??= createModel(palette).model;
  const view = (VIEWS as Record<string, ViewSpec>)[name] as ViewSpec;
  const buffer = bakeView(model, view, palette, setUpView(model, view, palette));
  self.postMessage({ name, buffer }, { transfer: [buffer] });
};
