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
  /** The brook where it runs deep, and over the gravel at its edges. */
  water: Color;
  waterShallow: Color;
  road: Color;
  track: Color;
  wall: Color;
  wallAccent: Color;
  roof: Color;
  roofAccent: Color;
  stack: Color;
  boarding: Color;
  window: Color;
  /** A window with the light on behind it. */
  windowLit: Color;
  /** The street lamps' and the wall lanterns' light: more orange than a room's. */
  lantern: Color;
  trunk: Color;
  /** The Saab's paint, a metallic aubergine brown, and the red of its tail lamps. */
  saab: Color;
  tailLight: Color;
  /** The white paint of a delivery van. */
  van: Color;
  /** The road's white paint, and the granite posts beside it. */
  marking: Color;
  granite: Color;
  foliage: Color;
  /** The broadleaves' leaves as they come out, and as they turn. */
  foliageSpring: Color;
  /** The meadows' new grass in spring. */
  grassSpring: Color;
  /** Autumn's leaves: the beeches' gold and orange, the oaks' rust. */
  autumnGold: Color;
  autumnOrange: Color;
  autumnRust: Color;
  /** What lies on everything facing up in a winter. */
  snow: Color;
  /** The meadows' flowers in spring. */
  flowerYellow: Color;
  flowerViolet: Color;
  light: Color;
  sky: Color;
  /** The sky overhead, deeper than the pale blue the fill light takes. */
  skyDeep: Color;
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
  '--kvlm-color-flower-yellow': '#e9c43b',
  '--kvlm-color-flower-violet': '#8d6cc0',
  '--kvlm-color-window-lit': '#f3c66e',
  '--kvlm-color-lantern': '#f29a45',
  '--kvlm-color-water': '#2f4a4d',
  '--kvlm-color-water-shallow': '#5f7874',
  '--kvlm-color-marking': '#e9e8e2',
  '--kvlm-color-spring-leaf': '#8fc25a',
  '--kvlm-color-spring-grass': '#6d9a4c',
  '--kvlm-color-granite': '#8f8d86',
  '--kvlm-color-saab': '#5a4044',
  '--kvlm-color-tail-light': '#b8322c',
  '--kvlm-color-van': '#e9ebea',
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
    // a brook in the woods is dark, not the sky's blue: a deep slate green
    // where it runs deep, paler and greyer over the stones at its edges
    water: color('--kvlm-color-water'),
    waterShallow: color('--kvlm-color-water-shallow'),
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
    windowLit: color('--kvlm-color-window-lit'),
    lantern: color('--kvlm-color-lantern'),
    trunk: color('--kvlm-color-grey-dark', { with: '--kvlm-color-grey-medium', amount: 0.35 }),
    // the car's paint is its own: no brand colour is a Saab's
    saab: color('--kvlm-color-saab'),
    tailLight: color('--kvlm-color-tail-light'),
    van: color('--kvlm-color-van'),
    marking: color('--kvlm-color-marking'),
    granite: color('--kvlm-color-granite'),
    foliage: color('--kvlm-color-turquoise', { with: '--kvlm-color-grey-dark', amount: 0.55 }),
    // spring's leaves fresh as they come out, a yellow green of their own -
    // the brand's turquoise read as summer's, not as new leaves
    foliageSpring: color('--kvlm-color-spring-leaf'),
    grassSpring: color('--kvlm-color-spring-grass'),
    // autumn's own colours, dimmed a little so they sit with the rest
    autumnGold: color('--kvlm-color-autumn-gold', { with: '--kvlm-color-grey-dark', amount: 0.15 }),
    autumnOrange: color('--kvlm-color-autumn-orange', {
      with: '--kvlm-color-grey-dark',
      amount: 0.15,
    }),
    autumnRust: color('--kvlm-color-autumn-rust', { with: '--kvlm-color-grey-dark', amount: 0.1 }),
    snow: color('--kvlm-color-snow'),
    flowerYellow: color('--kvlm-color-flower-yellow'),
    flowerViolet: color('--kvlm-color-flower-violet'),
    // the lights stay close to white, a tinted sun would drag every surface
    // towards its own hue and the palette would be gone
    light: color('--kvlm-color-grey-light', { with: '--kvlm-color-turquoise', amount: 0.15 }),
    sky: color('--kvlm-color-grey-light', { with: '--kvlm-color-spray', amount: 0.4 }),
    skyDeep: color('--kvlm-color-spray', { with: '--kvlm-color-grey-light', amount: 0.15 }),
    ambient: color('--kvlm-color-grey-light', { with: '--kvlm-color-spray', amount: 0.25 }),
  };
}
