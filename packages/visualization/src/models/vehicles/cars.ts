import { Group } from 'three';

import type { Point } from '../../data/data.js';
import { heightAt, WAY_RUNS } from '../terrain/ground.js';
import { SAAB_900 } from './saab.js';

/** What standing a car on the ground needs of it: its length, axles from the tail, and track. */
export interface CarSpec {
  length: number;
  axles: readonly [number, number];
  track: number;
}

/** The main road, and the height its surface holds - over the deck as much as cut into the ground. */
export const ROAD = WAY_RUNS.find(({ main }) => main);

/**
 * Stands a car on the ground at a plan point, heading along a plan direction:
 * pitched and rolled to where its four wheels touch. The ground is the road's
 * own surface unless said otherwise.
 */
export function standCar(
  car: Group,
  [x, y]: Point,
  [hx, hy]: Point,
  ground: (x: number, y: number) => number = ROAD?.level ?? heightAt,
  spec: CarSpec = SAAB_900
): Group {
  const [behind, ahead] = spec.axles.map(axle => axle - spec.length / 2) as [number, number];
  const across = spec.track / 2;
  const [lx, ly] = [-hy, hx];
  const at = (along: number, side: number) =>
    ground(x + hx * along + lx * side, y + hy * along + ly * side);
  const [fl, fr, rl, rr] = [
    at(ahead, across),
    at(ahead, -across),
    at(behind, across),
    at(behind, -across),
  ];
  const [front, rear] = [(fl + fr) / 2, (rl + rr) / 2];
  const pitch = Math.atan2(front - rear, ahead - behind);
  const roll = Math.atan2((fl + rl - fr - rr) / 2, across * 2);
  // the middle, between the axles where it stands
  car.position.set(x, rear + ((front - rear) * -behind) / (ahead - behind), -y);
  // plan y runs into -z, so a heading in plan turns the other way round y
  car.rotation.set(roll, Math.atan2(hy, hx), pitch, 'YZX');
  return car;
}

/** Where the cars drive: the road is empty until they are sent, so nothing stands on it. */
export function createCars(): Group {
  const group = new Group();
  group.name = 'cars';
  return group;
}
