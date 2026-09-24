/**
 * Works out the editor's heavy overlays off the page's thread, so switching
 * one on never freezes it: the seam's network, which takes seconds to cut
 * out of every line, and the places, laid on the surfaces the page sends.
 * What comes back are plain arrays, handed over rather than copied; the page
 * only draws them.
 */

import type { Point } from '@kvlm/visualization';
import { seamNetwork } from '@kvlm/visualization';

import type { PlaceLaid } from './editor.places.js';
import { placesLaid } from './editor.places.js';

export type OverlayRequest = { kind: 'seam' } | { kind: 'places'; triangles: Float32Array };

export type OverlayReply =
  | { kind: 'progress'; layer: 'seam' | 'places'; share?: number; step: string }
  | { kind: 'seam'; positions: Float32Array }
  | { kind: 'places'; places: PlaceLaid[] }
  | { kind: 'error'; error: string };

self.onmessage = ({ data }: MessageEvent<OverlayRequest>) => {
  try {
    const say = (reply: OverlayReply) => self.postMessage(reply);
    if (data.kind === 'seam') {
      // one piece of work, cut out of every line at once: no share to say
      say({ kind: 'progress', layer: 'seam', step: 'cutting the network' });
      const seam = seamNetwork();
      const positions = Float32Array.from(
        seam.edges.flatMap(([from, to]) =>
          [from, to].flatMap(point => {
            const [x, y] = seam.points[point] as Point;
            return [x, (seam.heights[point] as number) + 0.05, -y];
          })
        )
      );
      const reply: OverlayReply = { kind: 'seam', positions };
      self.postMessage(reply, { transfer: [positions.buffer] });
      return;
    }
    const places = placesLaid(data.triangles, (share, step) =>
      say({ kind: 'progress', layer: 'places', share, step })
    );
    const reply: OverlayReply = { kind: 'places', places };
    self.postMessage(reply, {
      transfer: places.flatMap(({ positions, triangles }) => [positions.buffer, triangles.buffer]),
    });
  } catch (error) {
    const reply: OverlayReply = { kind: 'error', error: String(error) };
    self.postMessage(reply);
  }
};
