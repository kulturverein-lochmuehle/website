import type { Group, Mesh, MeshLambertMaterial, SpotLight } from 'three';

import type { Point } from '../../data/data.js';
import type { Palette } from '../../scene/palette.js';
import type { CarSpec } from './cars.js';
import { standCar } from './cars.js';
import { createE30, E30_PAINTS, E30_SPEC } from './e30.js';
import type { Lamps } from './headlights.js';
import { createHeadlamps } from './headlights.js';
import { driveRoute, onAxles, TRAFFIC } from './route.js';
import { createSaab, SAAB_900, SAAB_PAINTS } from './saab.js';

/** The cars that drive through: what they are, how they stand on the road and where their lamps are. */
export const DRIVERS: readonly {
  make: (palette: Palette) => Group;
  spec: CarSpec;
  lamps: Lamps;
}[] = [
  // each car in each of its paints: a driver of its own, so a trip picks the paint too
  ...[undefined, ...SAAB_PAINTS].map((paint, k) => ({
    make: (palette: Palette) => createSaab(palette, paint, k === 0 ? 'saab-900' : `saab-900-${k}`),
    spec: SAAB_900,
    lamps: { nose: SAAB_900.length / 2 - 0.1, apart: 0.55 },
  })),
  ...[E30_SPEC.paint, ...E30_PAINTS].map((paint, k) => ({
    make: (palette: Palette) => createE30(palette, paint, k === 0 ? 'bmw-e30' : `bmw-e30-${k}`),
    spec: E30_SPEC,
    lamps: E30_SPEC.lamps,
  })),
];

/** How far the front wheels turn at most, in radians. */
const STEER_MOST = 0.6;

interface Driver {
  car: Group;
  spec: CarSpec;
  lamps: Lamps;
  wheels: Group[];
  glow: (on: boolean) => void;
}

/** A material of the car that glows when its lamps are lit. */
function glowing(car: Group, name: string, color: string): (on: boolean) => void {
  const material = (car.getObjectByName(name) as Mesh | undefined)?.material as
    MeshLambertMaterial | undefined;
  return on => material?.emissive.set(on ? color : '#000000');
}

/**
 * The cars that drive through the mill's road, one at a time: each is sent
 * - a random one of them, along the road in a random direction - enters at
 * one end, drives it to the other, and is gone. Nothing drives by itself. The
 * lamps of the car on the move are lights of the scene's own, a pair
 * that hops from car to car. A car on the move casts no shadow, the sun's
 * map being kept as it was drawn.
 */
export class Traffic {
  readonly #drivers: Driver[];
  readonly #wake: () => void;
  readonly #lamps;
  #route: Point[] = [];
  #driving: Driver | undefined;
  #progress = 0;
  /** Where the rear axle was, and how far the car had got: it is drawn on from there. */
  #rear: { s: number; rear: Point } | undefined;
  #lit = false;
  /** Whether a car's shadow in the sun's map needs drawing again: it left or arrived. */
  dirty = false;

  constructor(parent: Group, palette: Palette, wake: () => void) {
    this.#wake = wake;
    this.#lamps = createHeadlamps(palette, parent);
    // the lights are in the scene from the start, dark: one more or less
    // would have every shader made again
    this.#lamps.mount(undefined);
    this.#drivers = DRIVERS.map(({ make, spec, lamps }) => {
      const car = make(palette);
      car.visible = false;
      car.traverse(object => {
        object.castShadow = false;
      });
      parent.add(car);
      const [heads, tails] = [
        glowing(car, 'head_light', '#fff2c0'),
        glowing(car, 'tail_light', '#ff2a1a'),
      ];
      return {
        car,
        spec,
        lamps,
        wheels: car.children.filter(child => child.userData['steer'] !== undefined) as Group[],
        glow: on => {
          heads(on);
          tails(on);
        },
      };
    });
  }

  /** The lights of the lamps, for the scene to know them. */
  get lights(): SpotLight[] {
    return this.#lamps.lights;
  }

  /** Whether a car is on the move, and the scene wants drawing frame by frame. */
  get driving(): boolean {
    return this.#driving !== undefined;
  }

  /** Lights the lamps, or puts them out. */
  setLights(on: boolean): void {
    this.#lit = on;
    this.#drivers.forEach(({ glow }) => glow(on));
    this.#lamps.light(on && this.#driving !== undefined);
  }

  dispose(): void {
    this.#lamps.mount(undefined);
  }

  /** Sends a car - a random one - down the road or up it, unless one is on it still. */
  send(): void {
    if (this.#driving !== undefined) {
      return;
    }
    const dir = Math.random() < 0.5 ? 1 : -1;
    this.#route = driveRoute(dir);
    this.#driving = this.#drivers[Math.floor(Math.random() * this.#drivers.length)];
    this.#progress = 0;
    this.#rear = undefined;
    this.dirty = true;
    if (this.#driving !== undefined) {
      this.#lamps.mount(this.#driving.car, this.#driving.lamps);
      this.#driving.glow(this.#lit);
      this.#lamps.light(this.#lit);
    }
    this.#wake();
    this.tick(0);
  }

  /** Drives on by a time, in seconds. */
  tick(seconds: number): void {
    const driver = this.#driving;
    if (driver === undefined) {
      return;
    }
    this.#progress += TRAFFIC.speed * seconds;
    if (this.#progress >= this.#route.length - 1) {
      // gone beyond the road's end
      driver.car.visible = false;
      this.#driving = undefined;
      this.#lamps.mount(undefined);
      this.#lamps.light(false);
      this.dirty = true;
      return;
    }
    // the front axle on the line, the rear drawn after it, the front wheels turned to the road under them
    const [behind, ahead] = driver.spec.axles.map(axle => axle - driver.spec.length / 2) as [
      number,
      number,
    ];
    const {
      at,
      heading,
      steer: turn,
      rear,
    } = onAxles(this.#route, this.#progress, behind, ahead, this.#rear);
    this.#rear = { s: this.#progress, rear };
    standCar(driver.car, at, heading, undefined, driver.spec);
    driver.car.visible = true;
    const steer = Math.max(-STEER_MOST, Math.min(STEER_MOST, turn));
    driver.wheels.forEach(wheel => (wheel.rotation.y = steer));
  }
}
