import { Color } from 'three';

/** A custom property's value on an element, if it is set there at all. */
const readCustomProperty = (target: Element | undefined, property: string): string | undefined => {
  if (target === undefined) {
    return undefined;
  }
  const value = window.getComputedStyle(target).getPropertyValue(property);
  return value.trim() === '' ? undefined : value;
};

/** Colors the scene is painted with, all of them derived from the brand palette. */
export interface Palette {
  ground: Color;
  hills: Color;
  rim: Color;
  water: Color;
  road: Color;
  track: Color;
  wall: Color;
  wallAccent: Color;
  roof: Color;
  roofAccent: Color;
  stack: Color;
  boarding: Color;
  window: Color;
  trunk: Color;
  foliage: Color;
  /** The broadleaves' leaves as they come out, and as they turn. */
  foliageSpring: Color;
  /** Autumn's leaves: the beeches' gold and orange, the oaks' rust. */
  autumnGold: Color;
  autumnOrange: Color;
  autumnRust: Color;
  /** What lies on everything facing up in a winter. */
  snow: Color;
  light: Color;
  sky: Color;
  ambient: Color;
}

const FALLBACK = {
  '--kvlm-color-grey-dark': '#161615',
  '--kvlm-color-grey-medium': '#525252',
  '--kvlm-color-grey-light': '#eaeaea',
  '--kvlm-color-spray': '#6fbad9',
  '--kvlm-color-turquoise': '#75f0de',
  '--kvlm-color-brick': '#cf6a52',
  '--kvlm-color-autumn-gold': '#d6a032',
  '--kvlm-color-autumn-orange': '#c96a26',
  '--kvlm-color-autumn-rust': '#7e4424',
  '--kvlm-color-snow': '#f4f7f9',
} as const;

type Token = keyof typeof FALLBACK;

/**
 * Reads the brand colors off the host, so a section that recolors the page
 * recolors the mill with it. Missing properties fall back to the defaults of
 * `globals.css`, the scene must never render in three.js white - and with no
 * host at all, as when a view is baked, the defaults are the palette.
 */
export function readPalette(host?: Element): Palette {
  const color = (token: Token, mix?: { with: Token; amount: number }) => {
    const value = new Color(readCustomProperty(host, token) ?? FALLBACK[token]);
    return mix === undefined
      ? value
      : value.lerp(new Color(readCustomProperty(host, mix.with) ?? FALLBACK[mix.with]), mix.amount);
  };

  return {
    ground: color('--kvlm-color-grey-dark'),
    hills: color('--kvlm-color-grey-medium', { with: '--kvlm-color-grey-light', amount: 0.2 }),
    rim: color('--kvlm-color-grey-medium', { with: '--kvlm-color-grey-dark', amount: 0.3 }),
    water: color('--kvlm-color-spray'),
    // the main road is asphalt: a plain mid grey, lifted off the brand's medium
    // rather than the near black it used to be
    road: color('--kvlm-color-grey-medium', { with: '--kvlm-color-grey-light', amount: 0.05 }),
    track: color('--kvlm-color-grey-medium', { with: '--kvlm-color-grey-light', amount: 0.2 }),
    // the walls are limewashed, near white - the brand's blue would read as
    // painted and would fight the tiles
    wall: color('--kvlm-color-grey-light', { with: '--kvlm-color-grey-medium', amount: 0.1 }),
    wallAccent: color('--kvlm-color-grey-medium', {
      with: '--kvlm-color-grey-light',
      amount: 0.25,
    }),
    roof: color('--kvlm-color-grey-dark', { with: '--kvlm-color-grey-medium', amount: 0.35 }),
    // the mill and the house beside it are tiled in Biberschwanz, the workshop
    // is slated - which is the dark roof above
    roofAccent: color('--kvlm-color-brick', { with: '--kvlm-color-grey-dark', amount: 0.28 }),
    // the chimney stacks are brickwork gone grey with soot and weather: lighter
    // than the tiles they come through, and never the near black of the roof
    stack: color('--kvlm-color-grey-medium', { with: '--kvlm-color-grey-light', amount: 0.1 }),
    // the dormer's boards are weathered timber: a plain mid grey, between the
    // frame under them and the stonework they stand over
    boarding: color('--kvlm-color-grey-medium', { with: '--kvlm-color-grey-light', amount: 0.3 }),
    // glass is a plain dark grey against a limewashed wall, a shade off the
    // frame around it so the two do not merge
    window: color('--kvlm-color-grey-medium', { with: '--kvlm-color-grey-dark', amount: 0.35 }),
    trunk: color('--kvlm-color-grey-dark', { with: '--kvlm-color-grey-medium', amount: 0.35 }),
    foliage: color('--kvlm-color-turquoise', { with: '--kvlm-color-grey-dark', amount: 0.55 }),
    // spring's leaves are the same colour fresh, lighter and brighter
    foliageSpring: color('--kvlm-color-turquoise', {
      with: '--kvlm-color-grey-medium',
      amount: 0.45,
    }),
    // autumn's own colours, dimmed a little so they sit with the rest
    autumnGold: color('--kvlm-color-autumn-gold', { with: '--kvlm-color-grey-dark', amount: 0.15 }),
    autumnOrange: color('--kvlm-color-autumn-orange', {
      with: '--kvlm-color-grey-dark',
      amount: 0.15,
    }),
    autumnRust: color('--kvlm-color-autumn-rust', { with: '--kvlm-color-grey-dark', amount: 0.1 }),
    snow: color('--kvlm-color-snow'),
    // the lights stay close to white, a tinted sun would drag every surface
    // towards its own hue and the palette would be gone
    light: color('--kvlm-color-grey-light', { with: '--kvlm-color-turquoise', amount: 0.15 }),
    sky: color('--kvlm-color-grey-light', { with: '--kvlm-color-spray', amount: 0.4 }),
    ambient: color('--kvlm-color-grey-light', { with: '--kvlm-color-spray', amount: 0.25 }),
  };
}
