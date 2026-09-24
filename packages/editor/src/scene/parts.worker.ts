/**
 * Builds parts of the model off the page's thread, one at a time as they are
 * asked for, so a layer switched on comes in while the view stays in hand.
 * Several of these run side by side; each keeps what it built, for a part that
 * needs another - the light strings hang from the railings. What comes back is
 * the part as plain arrays, handed over rather than copied.
 */

import type { PackedPart, Palette } from '@kvlm/visualization';
import { buildPart, fillFaces, packPart, seedFillFaces, thawPalette } from '@kvlm/visualization';
import type { Object3D } from 'three';

export type PartRequest =
  | { kind: 'palette'; palette: unknown }
  | { kind: 'fills'; faces: Float64Array }
  | { kind: 'part'; name: string };

export type PartReply =
  | { kind: 'part'; name: string; packed: PackedPart; fills?: Float64Array }
  | { kind: 'error'; name: string; error: string };

let palette: Palette | undefined;
const built = new Map<string, Object3D>();

self.onmessage = ({ data }: MessageEvent<PartRequest>) => {
  // the page's colours, read off its custom properties, which a worker has none of
  if (data.kind === 'palette') {
    palette = thawPalette(data.palette);
    return;
  }
  // the dumps as another worker laid them, which this one need not lay again
  if (data.kind === 'fills') {
    seedFillFaces(data.faces);
    return;
  }
  try {
    if (palette === undefined) {
      throw new Error('no palette to build with');
    }
    const { packed, transfer } = packPart(buildPart(data.name, palette, built));
    // the terrain lays the dumps, which the page and the other workers want too
    const fills = data.name === 'terrain' ? fillFaces() : undefined;
    const reply: PartReply = { kind: 'part', name: data.name, packed, ...(fills && { fills }) };
    self.postMessage(reply, {
      transfer: fills === undefined ? transfer : [...transfer, fills.buffer],
    });
  } catch (error) {
    const reply: PartReply = { kind: 'error', name: data.name, error: String(error) };
    self.postMessage(reply);
  }
};
