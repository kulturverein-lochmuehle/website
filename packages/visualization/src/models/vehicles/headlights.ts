import { Color, Object3D, SpotLight } from 'three';

import type { Palette } from '../../scene/palette.js';

/** Where a car's lamps are: how far its nose is from its middle, how far apart the lamps stand, how high. */
export interface Lamps {
  nose: number;
  apart: number;
}

/**
 * What a headlamp throws: how high it sits, how far it reaches, how wide it
 * opens - the half angle of the cone, and how softly its edge fades - and how
 * strong it is, for the scene's lights and for the site's baked views.
 */
export const HEADLAMP = {
  height: 0.65,
  reach: 24,
  angle: 0.42,
  penumbra: 0.75,
  /** A little down, so the light lies on the road ahead. */
  dip: 0.09,
  intensity: 45,
  /** The light in the baked views, laid on what is lit: its share of the surface's own colour at a meter. */
  baked: 12,
} as const;

/** The light's colour: the lamps' white, warmed. */
export function headlampColor(palette: Palette): Color {
  return new Color(palette.snow).lerp(new Color('#ffdf9a'), 0.45);
}

/** A pair of headlamps, lights of the scene's own, off until they are lit on a car. */
export interface Headlamps {
  lights: [SpotLight, SpotLight];
  /** Puts them on a car - its nose forward along x - or back where they are kept. */
  mount: (car: Object3D | undefined, lamps?: Lamps) => void;
  /** Lights them, or puts them out. */
  light: (on: boolean) => void;
}

/** The headlamps, kept on `home` while no car wears them. */
export function createHeadlamps(palette: Palette, home: Object3D): Headlamps {
  const color = headlampColor(palette);
  const lights = [0, 1].map(() => {
    const lamp = new SpotLight(color, 0, HEADLAMP.reach, HEADLAMP.angle, HEADLAMP.penumbra, 2);
    lamp.castShadow = false;
    // the aim is a point ahead of the lamp, which sits along it with the car
    lamp.target.position.set(10, -HEADLAMP.dip * 10, 0);
    lamp.add(lamp.target);
    return lamp;
  }) as [SpotLight, SpotLight];
  return {
    lights,
    mount: (car, lamps) => {
      lights.forEach((lamp, index) => {
        if (car !== undefined && lamps !== undefined) {
          lamp.position.set(lamps.nose, HEADLAMP.height, (index === 0 ? 1 : -1) * lamps.apart);
          car.add(lamp);
        } else {
          lamp.position.set(0, 0, 0);
          home.add(lamp);
        }
      });
    },
    light: on => lights.forEach(lamp => (lamp.intensity = on ? HEADLAMP.intensity : 0)),
  };
}
