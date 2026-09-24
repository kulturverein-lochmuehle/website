import './scene.component.js';

import { expect, fixture, html, oneEvent } from '@open-wc/testing';

import type { Scene } from './scene.component.js';

/** A baked view of one triangle in front of the eye, gzipped as a bake writes it. */
async function oneTriangle(): Promise<string> {
  const header = {
    version: 1,
    kind: 'still',
    camera: {
      position: [0, 0, 5],
      target: [0, 0, 0],
      pivot: [0, 0, 0],
      fov: 90,
      near: 0.1,
      far: 100,
    },
    groups: [{ doubleSided: false, renderOrder: 0, vertices: 3, indices: 3 }],
  };
  let json = JSON.stringify(header);
  json += ' '.repeat(Math.ceil(json.length / 4) * 4 - json.length);
  const text = new TextEncoder().encode(json);
  const buffer = new ArrayBuffer(8 + text.byteLength + 36 + 12 + 8);
  const bytes = new Uint8Array(buffer);
  bytes.set(new TextEncoder().encode('KVLM'), 0);
  new DataView(buffer).setUint32(4, text.byteLength, true);
  bytes.set(text, 8);
  let offset = 8 + text.byteLength;
  new Float32Array(buffer, offset, 9).set([-1, -1, 0, 1, -1, 0, 0, 1, 0]);
  offset += 36;
  new Uint8Array(buffer, offset, 9).set([255, 0, 0, 0, 255, 0, 0, 0, 255]);
  offset += 12;
  // the indices as steps from the one before
  new Uint16Array(buffer, offset, 3).set([0, 1, 1]);
  const packed = await new Response(
    new Blob([buffer]).stream().pipeThrough(new CompressionStream('gzip'))
  ).blob();
  return URL.createObjectURL(packed);
}

describe('kvlm-scene', () => {
  it('should draw a baked view', async () => {
    const src = await oneTriangle();
    const element = await fixture<Scene>(
      html`<kvlm-scene style="width: 64px; height: 64px"></kvlm-scene>`
    );
    const rendered = oneEvent(element, 'kvlm-scene-rendered');
    element.src = src;
    const { detail } = (await rendered) as CustomEvent<{ triangles: number; groups: number }>;

    expect(detail.triangles).to.equal(1);
    expect(detail.groups).to.equal(1);
  });
});
