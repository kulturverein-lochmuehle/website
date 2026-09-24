import type { Point, SeamEdge } from '@kvlm/visualization';
import { pathOf, SEAM_PICKS, seamNetwork } from '@kvlm/visualization';
import {
  BufferGeometry,
  CanvasTexture,
  Float32BufferAttribute,
  Group,
  Line,
  LineBasicMaterial,
  LineDashedMaterial,
  LineSegments,
  Sprite,
  SpriteMaterial,
} from 'three';

// What the editor draws over the model to work on it: the seam the ground is
// cut along, the handles it is picked out between, and what has been picked.

/**
 * The seam drawn as it stands, in red over everything else. Debug only - it is
 * the line the ground is to be cut along, laid out to be looked at and argued
 * with before anything is built to it.
 */
export function createSeam(): Group {
  const group = new Group();
  group.name = 'seam';
  const seam = seamNetwork();
  const positions = seam.edges.flatMap(([from, to]) =>
    [from, to].flatMap(point => {
      const [x, y] = seam.points[point] as Point;
      return [x, (seam.heights[point] as number) + 0.05, -y];
    })
  );
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  const drawn = new LineSegments(
    geometry,
    // it is the ground to work on rather than the work: a seam traced by hand
    // has to read over it, so it stays washed out under one
    new LineBasicMaterial({
      color: '#ff00ff',
      depthTest: false,
      depthWrite: false,
      transparent: true,
      opacity: 0.35,
    })
  );
  // and drawn after the bands laid over the ground: taking no notice of depth
  // only keeps it clear of what is drawn before it
  drawn.renderOrder = 20;
  group.add(drawn);
  return group;
}

/** What each kind of handle is drawn in, and what one that is spoken for turns. */
const PICK_COLORS: Record<SeamEdge | 'traced' | 'seamed', string> = {
  top: '#ff0000',
  foot: '#0050d0',
  road: '#d08800',
  water: '#00a5a5',
  bed: '#00527a',
  point: '#a000c8',
  traced: '#0a7d2c',
  seamed: '#00727a',
};

/** A round debug dot carrying its own number, or a label as short. */
export function dot(color: string, label: number | string): CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const context = canvas.getContext('2d');
  if (context !== null) {
    context.fillStyle = color;
    context.beginPath();
    context.arc(32, 32, 26, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = '#ffffff';
    context.font = `bold ${String(label).length > 2 ? 26 : 34}px sans-serif`;
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(String(label), 32, 35);
  }
  return new CanvasTexture(canvas);
}

/**
 * The handles laid out as dots to click on. Debug only - the picked ones come
 * back out as a list of points, which is what a seam path is written from.
 */
export function createPicks(): Group {
  const group = new Group();
  group.name = 'picks';
  SEAM_PICKS.forEach(({ at, level, edge }, index) => {
    const sprite = new Sprite(
      new SpriteMaterial({ map: dot(PICK_COLORS[edge], index + 1), depthTest: false })
    );
    // the scene sizes them: a handle is measured on screen, not on the ground
    sprite.scale.setScalar(1);
    sprite.position.set(at[0], level, -at[1]);
    // over the traced line, which is itself over the seam it is drawn against
    sprite.renderOrder = 22;
    sprite.userData['pick'] = index;
    group.add(sprite);
  });
  return group;
}

/** Marks the handles being traced, those already in a seam, and the rest plain. */
export function markPicks(group: Group, trace: number[], seams: number[][]): void {
  const seamed = new Set(seams.flat());
  group.children.forEach(child => {
    const material = (child as Sprite).material;
    const index = child.userData['pick'] as number;
    const edge = SEAM_PICKS[index]?.edge ?? 'road';
    const color = trace.includes(index)
      ? PICK_COLORS.traced
      : seamed.has(index)
        ? PICK_COLORS.seamed
        : PICK_COLORS[edge];
    material.map?.dispose();
    // a handle keeps its own number whether it is picked or not: the order it
    // was picked in is the list's business, not the model's
    material.map = dot(color, index + 1);
    material.needsUpdate = true;
  });
}

/** The group the traced seams are drawn in, filled by the marking below. */
export function createTrace(): Group {
  const group = new Group();
  group.name = 'trace';
  return group;
}

/**
 * Draws what has been picked: every closed seam as a solid line, and the one
 * still being traced dashed, so that an open path can be told from a finished
 * one at a glance. Debug only.
 */
export function markTrace(group: Group, trace: number[], seams: number[][]): void {
  group.children.forEach(child => {
    const line = child as Line;
    line.geometry.dispose();
    (Array.isArray(line.material) ? line.material : [line.material]).forEach(material =>
      material.dispose()
    );
  });
  group.clear();

  const drawn = (path: number[], closed: boolean, seam?: number) => {
    const positions = pathOf(path, closed);
    if (positions.length < 6) {
      return;
    }
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
    const line = new Line(
      geometry,
      closed
        ? new LineBasicMaterial({ color: '#ff0000', depthTest: false, depthWrite: false })
        : new LineDashedMaterial({
            color: '#ff0000',
            dashSize: 0.4,
            gapSize: 0.3,
            depthTest: false,
            depthWrite: false,
          })
    );
    line.computeLineDistances();
    // over the seam it is drawn against, under the handles it is picked between
    line.renderOrder = 21;
    // a closed one knows which seam it is, so that it can be taken up again
    line.userData['seam'] = closed ? seam : undefined;
    group.add(line);
  };

  seams.forEach((seam, order) => drawn(seam, true, order));
  drawn(trace, false);
}
