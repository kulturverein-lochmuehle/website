/**
 * A constrained Delaunay triangulation: points, the edges the result has to
 * hold, and back come the triangles as triples of point indices. The package
 * ships no types of its own.
 */
declare module 'cdt2d' {
  export default function cdt2d(
    points: [number, number][],
    edges?: [number, number][],
    options?: { delaunay?: boolean; interior?: boolean; exterior?: boolean; infinity?: boolean }
  ): [number, number, number][];
}
