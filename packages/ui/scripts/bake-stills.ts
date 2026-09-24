/**
 * Bakes the first frame of every baked view to an image - `views/<name>.still.webp`
 * beside the view's own file - for the scene component to show as its poster
 * while the view itself is still on its way. Each view is drawn by the very
 * component the site uses, in a headless browser with software WebGL, at the
 * width a wide screen gives it; with less motion asked for, so nothing drifts,
 * flies or flickers, and the frame is the one the view starts on.
 *
 * Run with `npm run data:stills` after baking the views. Given names - `npm run
 * data:stills -- street-still` - only the views whose names hold one of them
 * are drawn again.
 */

import { readFile, writeFile } from 'node:fs/promises';
import type { AddressInfo } from 'node:net';
import { fileURLToPath } from 'node:url';

import { chromium } from 'playwright';
import type { Plugin } from 'vite';
import { createServer } from 'vite';

import litCss from './vite-plugin-lit-css.js';

/** Where the baked views are, and the stills are written to. */
const VIEWS = new URL('../../visualization/views/', import.meta.url);

/** How wide a still is, and how tall: the shape the demo shows a view in. */
const SIZE = { width: 1600, height: 900 };

/** How good the image is, in percent. */
const QUALITY = 70;

// one scene filling the page, given the view to draw by the address
const PAGE = `<!doctype html>
<html>
  <body style="margin: 0">
    <kvlm-scene style="display: block; height: 100vh; width: 100vw"></kvlm-scene>
    <script type="module">
      import '/src/components/ui/scene/scene.component.ts';
      const scene = document.querySelector('kvlm-scene');
      scene.addEventListener('kvlm-scene-rendered', () => (window.drawn = true));
      scene.addEventListener('kvlm-scene-failed', event => (window.failed = String(event.detail)));
      scene.src = new URLSearchParams(location.search).get('src');
    </script>
  </body>
</html>`;

const root = fileURLToPath(new URL('..', import.meta.url));
const server = await createServer({
  root,
  logLevel: 'error',
  plugins: [
    litCss() as Plugin,
    {
      name: 'stage',
      configureServer: stage => {
        stage.middlewares.use(async (request, response, next) => {
          if (request.url?.split('?')[0] !== '/') {
            return next();
          }
          response.setHeader('Content-Type', 'text/html');
          response.end(await stage.transformIndexHtml('/', PAGE));
        });
      },
    },
  ],
  // the views lie in the model's package, beside this one
  server: {
    host: '127.0.0.1',
    port: 0,
    fs: { allow: [fileURLToPath(new URL('../..', import.meta.url))], strict: true, deny: [] },
  },
});
await server.listen();
const { port } = server.httpServer?.address() as AddressInfo;

const only = process.argv.slice(2);
const listed = (
  JSON.parse(await readFile(new URL('manifest.json', VIEWS), 'utf8')) as {
    name: string;
    file: string;
  }[]
).filter(({ name }) => only.length === 0 || only.some(part => name.includes(part)));

const browser = await chromium.launch({
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const context = await browser.newContext({
  viewport: SIZE,
  deviceScaleFactor: 1,
  reducedMotion: 'reduce',
});

// one after the other: software WebGL takes every core it can get
for (const { name, file } of listed) {
  const page = await context.newPage();
  const src = `/@fs/${fileURLToPath(new URL(file, VIEWS))}`;
  await page.goto(`http://127.0.0.1:${port}/?src=${encodeURIComponent(src)}`);
  await page.waitForFunction(() => 'drawn' in window || 'failed' in window, undefined, {
    timeout: 120_000,
  });
  const failed = await page.evaluate(() => (window as { failed?: string }).failed);
  if (failed !== undefined) {
    throw new Error(`${name}: ${failed}`);
  }
  // a frame more, for the canvas to have been handed on to the screen
  await page.evaluate(
    () => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))
  );
  const png = await page.locator('kvlm-scene').screenshot({ type: 'png' });
  // the browser writes the webp itself, no library needed
  const encoded = await page.evaluate(
    async ([data, quality]) => {
      const bitmap = await createImageBitmap(
        await (await fetch(`data:image/png;base64,${data}`)).blob()
      );
      const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
      canvas.getContext('2d')?.drawImage(bitmap, 0, 0);
      const blob = await canvas.convertToBlob({
        type: 'image/webp',
        quality: Number(quality) / 100,
      });
      const url = await new Promise<string>(resolve => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.readAsDataURL(blob);
      });
      return url.slice(url.indexOf(',') + 1);
    },
    [png.toString('base64'), String(QUALITY)] as const
  );
  const webp = Buffer.from(encoded, 'base64');
  await writeFile(new URL(`${name}.still.webp`, VIEWS), webp);
  console.log(`${name}: ${Math.round(webp.byteLength / 1024)} KiB`);
  await page.close();
}

await browser.close();
await server.close();
