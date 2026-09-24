/**
 * What a house is made of, apart from its outline: the rows of openings, the
 * heights they are measured from, and the parts a facade carries. The numbers
 * themselves live with the house they belong to, one `*.building.ts` each.
 */

/** One row of openings across a facade, the way an elevation draws it. */
export interface Row {
  /**
   * Where the windows stand, in meters from the right hand end of the facade
   * as the street sees it - measured off the survey elevations, which draw the
   * bays unevenly because the house grew that way.
   */
  windows: number[];
  /** Width and height of one window, in meters. */
  size: [width: number, height: number];
  /** Height of the row's middle above the ground floor. */
  y: number;
  /** Doors standing in the same row, measured the same way. */
  doors?: number[];
  /** Width and height of one door. */
  door?: [width: number, height: number];
  /** How far the heads of this row's doors are rounded off, in meters. */
  arch?: number;
}

export interface Profile {
  /** Height of the eaves above the ground floor in meters. */
  eaves: number;
  /** Height of the ridge above the eaves in meters. */
  ridge: number;
  /** Top of the ground floor's ceiling, where the upper storey starts. */
  storey: number;
  /** The facade toward the road, which is the one the drawings call the street. */
  front: Row[];
  /** The facade toward the brook. */
  rear: Row[];
  /** The gable at the framed end of the house. */
  gable: Row[];
  /** The gable at the other end, if it carries something different. */
  farGable?: Row[];
  /** Dark buildings read as background, light ones carry the scene. */
  dark?: boolean;
  /**
   * A dark roof over light walls. The mill and the house beside it are tiled
   * alike and share the light roof; the workshop is the slated one.
   */
  darkRoof?: boolean;
  /**
   * The chimneys, each measured along the house like the openings are and given
   * its own share of the way down the street slope from the ridge. A head
   * stands the usual height off the tiles unless the stack carries its own.
   */
  chimneys?: { at: number; down: number; proud?: number }[];
  /**
   * The half timbered stretch of the long walls, measured off the elevation:
   * every post, the two rails that cross the piers between the windows, and the
   * brace in the corner. The rest of the wall is stone - on the mill that is
   * the end the wheel used to stand at. The rear is framed to match.
   */
  timbered?: {
    /**
     * Plate of the frame, above the floor. Its sill needs no number: the frame
     * stands on the stonework, on the same line as the gable's sill.
     */
    to: number;
    /** Post centres, measured like the openings. */
    posts: number[];
  };
  /** How far the finished floor stands above the yard, in meters. */
  plinth?: number;
  /** A terrace along the street facade, with stairs down to the yard. */
  terrace?: { depth: number; stairs: number };
  /**
   * The uprights of the gable's frame that stand on their own: the corners and
   * the pair around the middle. The posts either side of a window are not
   * listed - they are taken from the window, so they can never drift onto it.
   */
  gablePosts?: { storey: number[]; attic: number[] };
  /**
   * The boarded dormer band on both roof slopes. The elevation of 2014 draws
   * five windows off-centre; the roof carries seven today, evenly spread and
   * centred, so this is a count and a size rather than measured positions.
   */
  dormer?: { windows: number; size: [width: number, height: number]; share: number };
  /**
   * A gabled dormer standing off the main ridge and running down the rear
   * slope, big enough to walk into: on the workshop that is the way in from the
   * hillside behind it. Its ridge is the house's own, so the narrower it is the
   * steeper it stands - a sharp little gable rather than a piece of the roof.
   */
  crossGable?: {
    /** Middle of it along the house, measured like the openings. */
    at: number;
    /** How wide it stands across the slope. */
    width: number;
    /** How far its eaves stand above the eaves of the roof it comes through. */
    rise: number;
  };
  /**
   * The lean-to along the front, a piece of the building stepping out of the
   * wall under a single sloping roof - what makes the workshop L-shaped. Its
   * roof takes over where the main roof ends, at the edge of the overhang, so
   * the two meet in a kink rather than one starting under the other.
   */
  leanTo?: {
    /** Middle of it along the house, measured like the openings. */
    at: number;
    /** How far it runs along the facade. */
    width: number;
    /** How far it steps out of the wall. */
    depth: number;
    /** The door in its outer wall, centred on it and standing on the porch. */
    door?: [width: number, height: number];
    /**
     * A small window in the end wall that looks over the yard, halfway along
     * the depth of it - on the workshop the one the toilet is behind.
     */
    window?: { size: [width: number, height: number]; y: number };
    /**
     * The roof carried on past the outer wall, over a raised landing in front
     * of the door - so whoever stands there stands dry - with a short flight
     * coming down off it onto the yard. The landing stands in the corner the
     * extension makes with the house, and the flight turns that corner with it.
     */
    porch?: {
      /** How far the landing and the roof over it reach past the wall. */
      reach: number;
      /** How high the landing stands above the yard. */
      rise: number;
      /** How many steps come down off it. */
      steps: number;
      /** The standing area in front of the door, which the door is centred on. */
      width: number;
    };
  };
}

/** A house of the site: the way OSM names it, and the numbers it is drawn from. */
export interface House {
  /** The OpenStreetMap way the footprint comes from. */
  id: number;
  profile: Profile;
}

/** What a building falls back to when no drawing of it was ever made. */
export const DEFAULT_PROFILE: Profile = {
  eaves: 5,
  ridge: 3,
  storey: 2.8,
  front: [{ windows: [2, 6], doors: [4], door: [0.9, 2], size: [0.8, 1.1], y: 1.45 }],
  rear: [{ windows: [2, 4, 6], size: [0.8, 1.1], y: 1.45 }],
  gable: [{ windows: [2, 4], size: [0.8, 1.1], y: 1.45 }],
};
