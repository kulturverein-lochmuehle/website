import type { Point, SeamHandle, Stroke } from '@kvlm/visualization';
import { direction, dispose, heightAt, HousesScene, SEAM_PICKS } from '@kvlm/visualization';
import {
  BufferGeometry,
  CanvasTexture,
  Float32BufferAttribute,
  Group,
  Line,
  LineBasicMaterial,
  LineLoop,
  LineSegments,
  Raycaster,
  Sprite,
  SpriteMaterial,
  Vector2,
  Vector3,
} from 'three';

import {
  createPicks,
  createSeam,
  createTrace,
  dot,
  markPicks,
  markTrace,
} from './editor.overlays.js';

/** A handle that was picked, with the number it carries in the scene. */
export type PickedHandle = SeamHandle & { index: number };

/** The parts of the scene that can be hidden, the seam's overlay among them. */
export type EditorLayer = 'trees' | 'roads' | 'walls' | 'decks' | 'houses' | 'seam' | 'terrain';

/**
 * How wide a seam handle is drawn on screen in pixels, and how far it may grow
 * or shrink on the ground to keep to it: a dot that tracked the zoom all the
 * way would swallow the crossing it stands on.
 */
const DOT = { pixels: 13, min: 0.22, max: 0.6 };

/**
 * The point tool's rulers: how far they reach and how finely they are laid,
 * in meters - all the way, or a piece out far bridges a hollow or cuts into
 * a ridge - and the colour of the level ones.
 */
const RULER = { reach: 30, step: 0.2, level: '#00c8e0' };

/** The ghost of a reference point: its label's canvas, and where on it the dot is. */
const GHOST = {
  width: 256,
  height: 64,
  dot: 32,
  scale: 1.6,
  /** How far the ring around it reaches, in handles. */
  reach: 4,
};

/** A see-through dot with how far it is lifted written beside it. */
function ghostLabel(text: string): CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = GHOST.width;
  canvas.height = GHOST.height;
  const context = canvas.getContext('2d');
  if (context !== null) {
    context.fillStyle = 'rgb(224 0 122 / 0.55)';
    context.beginPath();
    context.arc(GHOST.dot, GHOST.height / 2, 22, 0, Math.PI * 2);
    context.fill();
    context.font = 'bold 30px sans-serif';
    context.textBaseline = 'middle';
    context.lineWidth = 6;
    context.strokeStyle = '#ffffff';
    context.strokeText(text, GHOST.dot * 2 + 4, GHOST.height / 2 + 2);
    context.fillStyle = '#e0007a';
    context.fillText(text, GHOST.dot * 2 + 4, GHOST.height / 2 + 2);
  }
  return new CanvasTexture(canvas);
}

/** How many points the brush's ring is drawn with, and how far over the ground. */
const RING = { points: 64, over: 0.04 };

/**
 * The model as the editor works on it: the scene, and over it the seam and
 * the handles it is picked out between, what has been picked, the reference
 * points set and the one about to be, the brush's reach - and what lies under
 * a point of the canvas, which is what every tool starts from.
 */
export class EditorScene extends HousesScene {
  /** The dots a seam is picked out between, the seams themselves, and the one
   * still being traced between them. */
  readonly #picks = createPicks();
  readonly #trace = createTrace();
  #chosen: number[] = [];
  #seams: number[][] = [];
  /** The brush's ring. */
  readonly #ring = this.#createRing();
  /** The reference points set on the bench and not written into the source yet. */
  readonly #points = Object.assign(new Group(), { name: 'points' });
  /** Where the next one would be set, with a line down to what it stands over. */
  readonly #ghost = this.#createGhost();

  constructor(canvas: HTMLCanvasElement, host: Element) {
    super(canvas, host);
    this.add(createSeam(), this.#trace, this.#picks, this.#points, this.#ghost, this.#ring);
    this.setView({});
  }

  protected override get layers(): Record<string, string[]> {
    return {
      ...super.layers,
      // the point tool's ghost is not among them: whether it shows is the
      // tool's to say, and switching the layer on again would bring it back
      seam: ['seam', 'picks', 'trace', 'points'],
    };
  }

  #createRing(): LineLoop {
    const ring = new LineLoop(
      new BufferGeometry(),
      new LineBasicMaterial({ color: '#ff00aa', depthTest: false, transparent: true })
    );
    ring.name = 'brush';
    ring.renderOrder = 30;
    ring.visible = false;
    return ring;
  }

  /**
   * Shows the reference points set on the bench, each at its own height and
   * labelled the way the bench lists them. The ones written into the source
   * are handles, and among the rest.
   */
  setPoints(points: [x: number, y: number, level: number][]): void {
    dispose(this.#points);
    this.#points.clear();
    points.forEach(([x, y, level], index) => {
      const sprite = new Sprite(
        new SpriteMaterial({ map: dot('#e0007a', `P${index + 1}`), depthTest: false })
      );
      sprite.position.set(x, level, -y);
      sprite.renderOrder = 23;
      this.#points.add(sprite);
    });
    this.setView({});
  }

  #createGhost(): Group {
    const ghost = new Group();
    ghost.name = 'ghost';
    ghost.visible = false;
    const sprite = new Sprite(new SpriteMaterial({ depthTest: false, transparent: true }));
    // the dot is at the left of its label, and the dot is what stands on the point
    sprite.center.set(GHOST.dot / GHOST.width, 0.5);
    sprite.renderOrder = 24;
    const line = new Line(
      new BufferGeometry(),
      new LineBasicMaterial({ color: '#e0007a', depthTest: false, transparent: true })
    );
    line.renderOrder = 24;
    // and the ring and cross laid over the ground around it, which bend with
    // it - that is what shows the lie of the ground a point is set on
    const draped = new LineBasicMaterial({ color: '#e0007a', depthTest: false, transparent: true });
    const ring = new LineLoop(new BufferGeometry(), draped);
    // and rulers from it over the ground, the compass's and those between,
    // all alike, and - lifted - the same again level at the point's height,
    // in a colour of their own
    const cross = new LineSegments(new BufferGeometry(), draped);
    const between = new LineSegments(new BufferGeometry(), draped);
    const level = new LineBasicMaterial({
      color: RULER.level,
      depthTest: false,
      transparent: true,
    });
    const flat = new LineSegments(new BufferGeometry(), level);
    const flatBetween = new LineSegments(new BufferGeometry(), level);
    [ring, cross, between, flat, flatBetween].forEach(drawn => (drawn.renderOrder = 24));
    ghost.add(sprite, line, ring, cross, between, flat, flatBetween);
    return ghost;
  }

  /**
   * A ruler from a point out to `RULER.reach`, in pieces fine near it and
   * coarser out: laid over the ground, and broken where there is none to lay
   * it on, over a way - or, given a height, level at it until the ground comes
   * up to it and on the ground from there, as a levelled laser's line lies.
   */
  #ruler([x, y]: Point, [dx, dy]: Point, level?: number): number[] {
    const positions: number[] = [];
    let previous: number[] | undefined;
    for (let by = 0; by <= RULER.reach; by += RULER.step) {
      const [px, py] = [x + dx * by, y + dy * by];
      const ground = this.landfill.heightAt(px, py);
      // level, a laser's line: flat until the ground comes up to it, then on it
      const height = level === undefined ? ground : Math.max(level, ground ?? -Infinity);
      const here = height === undefined ? undefined : [px, height + RING.over, -py];
      if (previous !== undefined && here !== undefined) {
        positions.push(...previous, ...here);
      }
      previous = here;
    }
    return positions;
  }

  /** The ground's height at a point of the plan, landfill and all, a hair over it. */
  #draped(x: number, y: number): number {
    return (this.landfill.heightAt(x, y) ?? heightAt(x, y)) + RING.over;
  }

  /**
   * Shows where a reference point would be set, how far over or under the
   * surface it stands over, and a line down to it - or hides it all.
   */
  showGhost(ghost: { at: Point; surface: number; level: number } | undefined): void {
    this.#ghost.visible = ghost !== undefined;
    if (ghost === undefined) {
      return;
    }
    const [sprite, line, ring, cross, between, flat, flatBetween] = this.#ghost.children as [
      Sprite,
      Line,
      LineLoop,
      LineSegments,
      LineSegments,
      LineSegments,
      LineSegments,
    ];
    const { at, surface, level } = ghost;
    const lift = level - surface;
    const lifted = Math.abs(lift) >= 0.005;
    const label = lifted ? `${lift > 0 ? '+' : ''}${lift.toFixed(2)} m` : '';
    // the dot and its height only once it stands off the ground: on it, the
    // cross says where it is, its arms meeting on the spot
    sprite.visible = lifted;
    line.visible = lifted;
    const reach = this.#dotSize() * GHOST.reach;
    const [x, y] = at;
    const around = Array.from({ length: RING.points }, (_, step) => {
      const angle = (step / RING.points) * Math.PI * 2;
      const [px, py] = [x + Math.cos(angle) * reach, y + Math.sin(angle) * reach];
      return [px, this.#draped(px, py), -py];
    }).flat();
    // the rulers from the spot out over the ground, which stay on it with the
    // ring, and - lifted - the same level at the point's height
    const rulers = (angles: number[], height?: number) =>
      angles.flatMap(angle => this.#ruler(at, [Math.sin(angle), Math.cos(angle)], height));
    const compass = [0, 1, 2, 3].map(quarter => (quarter * Math.PI) / 2);
    [
      [ring, around],
      [cross, rulers(compass)],
      [between, rulers(compass.map(angle => angle + Math.PI / 4))],
      [flat, lifted ? rulers(compass, level) : []],
      [
        flatBetween,
        lifted
          ? rulers(
              compass.map(angle => angle + Math.PI / 4),
              level
            )
          : [],
      ],
    ].forEach(([object, positions]) => {
      const drawn = object as LineLoop;
      drawn.geometry.dispose();
      drawn.geometry = new BufferGeometry();
      drawn.geometry.setAttribute('position', new Float32BufferAttribute(positions as number[], 3));
    });
    if (sprite.userData['label'] !== label) {
      sprite.material.map?.dispose();
      sprite.material.map = ghostLabel(label);
      sprite.material.needsUpdate = true;
      sprite.userData['label'] = label;
    }
    sprite.position.set(at[0], level, -at[1]);
    line.geometry.dispose();
    line.geometry = new BufferGeometry();
    line.geometry.setAttribute(
      'position',
      new Float32BufferAttribute([at[0], surface, -at[1], at[0], level, -at[1]], 3)
    );
    this.setView({});
  }

  /** Lays more dabs on, over what is there. */
  addStrokes(strokes: Stroke[]): void {
    strokes.forEach(stroke => this.landfill.dab(stroke));
    this.redrawLandfill();
  }

  /** The point of the ground under a point of the canvas, if the ground is there. */
  groundUnder(x: number, y: number): { at: Point; level: number } | undefined {
    if (!this.terrain.visible) {
      return undefined;
    }
    this.camera.updateMatrixWorld();
    const ray = new Raycaster();
    ray.setFromCamera(new Vector2(x, y), this.camera);
    const hit = ray.intersectObject(this.terrain, true)[0];
    if (hit === undefined) {
      return undefined;
    }
    const at: Point = [hit.point.x, -hit.point.z];
    return { at, level: this.landfill.heightAt(...at) ?? hit.point.y };
  }

  /**
   * The point of whatever surface is under a point of the canvas - the ground,
   * a way, a wall, a deck - which is what a reference point can be set on.
   * The trees are looked through, and the debug layers are no surface.
   */
  surfaceUnder(x: number, y: number): { at: Point; level: number } | undefined {
    this.camera.updateMatrixWorld();
    const ray = new Raycaster();
    ray.setFromCamera(new Vector2(x, y), this.camera);
    const skipped = new Set([
      'trees',
      'seam',
      'picks',
      'trace',
      'points',
      'ghost',
      'brush',
      'lights',
    ]);
    const surfaces = this.scene.children.filter(child => child.visible && !skipped.has(child.name));
    const hit = ray
      .intersectObjects(surfaces, true)
      .find(({ object }) => object.type === 'Mesh' && object.visible);
    return hit === undefined ? undefined : { at: [hit.point.x, -hit.point.z], level: hit.point.y };
  }

  /** Shows the brush's reach on the ground around a point, or hides it. */
  showBrush(at: Point | undefined, radius: number): void {
    this.#ring.visible = at !== undefined;
    if (at === undefined) {
      return;
    }
    const positions = Array.from({ length: RING.points }, (_, step) => {
      const angle = (step / RING.points) * Math.PI * 2;
      const [x, y] = [at[0] + Math.cos(angle) * radius, at[1] + Math.sin(angle) * radius];
      return [x, (this.landfill.heightAt(x, y) ?? heightAt(x, y)) + RING.over, -y];
    }).flat();
    this.#ring.geometry.dispose();
    this.#ring.geometry = new BufferGeometry();
    this.#ring.geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  }

  /** The handles of the seam being traced, in the order they were picked. */
  get chosen(): number[] {
    return [...this.#chosen];
  }

  /** And the seams that are closed and done with. */
  get seams(): number[][] {
    return this.#seams.map(seam => [...seam]);
  }

  /** Every handle spoken for, in full, which is what a seam is written from. */
  get chosenHandles(): PickedHandle[] {
    return [...new Set([...this.#seams.flat(), ...this.#chosen])].flatMap(index => {
      const handle = SEAM_PICKS[index];
      return handle === undefined ? [] : [{ ...handle, at: [...handle.at] as Point, index }];
    });
  }

  /**
   * What lies under a point of the canvas: a handle to pick, or a seam already
   * closed, which is how a finished one is taken up for editing again.
   */
  #under(x: number, y: number): { pick?: number; seam?: number } {
    // hidden handles are not there to be clicked, and the camera has only been
    // pointed, not walked through the scene graph, since the view last changed
    if (!this.#picks.visible) {
      return {};
    }
    this.camera.updateMatrixWorld();
    const ray = new Raycaster();
    // a line is a line: what counts as hitting it has to grow with the view
    ray.params.Line = { threshold: this.view.span * 0.01 };
    ray.setFromCamera(new Vector2(x, y), this.camera);

    const pick = ray.intersectObjects(this.#picks.children, false)[0]?.object.userData['pick'];
    if (typeof pick === 'number') {
      return { pick };
    }
    const seam = ray.intersectObjects(this.#trace.children, false)[0]?.object.userData['seam'];
    return typeof seam === 'number' ? { seam } : {};
  }

  /** Whether a click here would do anything, which is what a cursor is after. */
  hoverAt(x: number, y: number): boolean {
    const { pick, seam } = this.#under(x, y);
    return pick !== undefined || seam !== undefined;
  }

  /** Picks the handle under a point of the canvas, or lets go of it if it was picked. */
  pickAt(x: number, y: number): boolean {
    const { pick: index, seam } = this.#under(x, y);
    // a closed seam is taken up again as the path being traced, so that it can
    // be added to or cut back - but only with nothing else half drawn
    if (seam !== undefined) {
      if (this.#chosen.length > 0) {
        return false;
      }
      this.setPicked(
        this.#seams[seam] ?? [],
        this.#seams.filter((_, order) => order !== seam)
      );
      return true;
    }
    if (index === undefined) {
      return false;
    }
    // back on the handle it started from, a path closes and the seam is done;
    // on one it already holds, that handle is let go of again
    if (index === this.#chosen[0] && this.#chosen.length > 2) {
      this.setPicked([], [...this.#seams, this.#chosen]);
    } else if (this.#chosen.includes(index)) {
      this.setPicked(
        this.#chosen.filter(picked => picked !== index),
        this.#seams
      );
    } else {
      this.setPicked([...this.#chosen, index], this.#seams);
    }
    return true;
  }

  /** Puts the seams and the open path back the way they were, after a reload say. */
  setPicked(trace: number[], seams: number[][]): void {
    const known = (path: number[]) => path.filter(index => SEAM_PICKS[index] !== undefined);
    this.#chosen = known(trace);
    this.#seams = seams.map(known).filter(seam => seam.length > 2);
    markPicks(this.#picks, this.#chosen, this.#seams);
    markTrace(this.#trace, this.#chosen, this.#seams);
  }

  /**
   * Moves the point the view is centred on, across the ground and in the frame
   * the camera sees: forward runs away from it, right lies to its right. Debug
   * only - it is how a part of the valley other than the mill is looked at.
   */
  panBy(right: number, forward: number): void {
    // the camera stands off the target along this, so away from it is the other
    // way round, and flattening it keeps the move on the ground
    const heading = direction(this.view.azimuth, 0).setY(0).normalize();
    // the camera's own right hand: the way it looks is the heading turned round,
    // and this is that crossed with up
    const side = new Vector3(heading.z, 0, -heading.x);
    const moved = new Vector3()
      .copy(this.target)
      .addScaledVector(heading, -forward)
      .addScaledVector(side, right);
    this.setView({ center: [moved.x, -moved.z] });
  }

  protected override viewChanged(): void {
    const dots = this.#dotSize();
    [...this.#picks.children, ...this.#points.children].forEach(child =>
      child.scale.setScalar(dots)
    );
    // the ghost is read as well as clicked by, so it is drawn a size up
    const ghost = dots * GHOST.scale;
    this.#ghost.children[0]?.scale.set((ghost * GHOST.width) / GHOST.height, ghost, 1);
  }

  /**
   * How big a handle is drawn on the ground: they are there to be clicked,
   * not to cover the model, so they keep the same size on screen whatever
   * width of ground the view takes in.
   */
  #dotSize(): number {
    const wide = (DOT.pixels * this.view.span) / this.size.width;
    return Math.min(Math.max(wide, DOT.min), DOT.max);
  }
}
