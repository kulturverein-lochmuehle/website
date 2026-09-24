"""
Sort the Saab's baked faces into materials - body paint, glass, black trim,
lamps, tyres - by where they sit on the blueprint and which way they face.
The model is one solid, so the parts are told apart by place, in the
blueprint's own pixels (along, row, half width) like the model itself.

    python saab_materials.py saab.stl  -> prints the counts per material
"""

import sys

import numpy as np
import trimesh

# Blueprint pixels to mm, as in saab.py
ALONG = 4680 / 347
UP = 1425 / 108.5
ACROSS = 845 / 63

# The side windows as the blueprint draws them, the glass inside the dark rubber
# (along, row): the door glass, then the rear side glass behind the B-pillar
DOOR_GLASS = [
    (143.6, 70.8), (150.5, 59.0), (156.5, 49.5), (160.4, 42.9), (164.5, 41.4), (190.0, 41.3), (213.4, 41.2),
    (210.0, 70.3), (190.0, 70.8), (167.9, 71.0),
]
REAR_GLASS = [
    (218.0, 41.3), (240.0, 41.2), (247.5, 41.3), (254.0, 45.6), (257.0, 47.8), (260.0, 49.8), (263.0, 52.5),
    (266.5, 55.4), (269.6, 58.2), (271.8, 61.0), (272.0, 64.0), (270.4, 66.4), (265.5, 67.9),
    (245.0, 69.4), (215.2, 70.3),
]
FRAME = 1.2  # px, the black rubber round each pane
# Across the car: the windscreen's header follows the roof's edge in plan (half width px -> along)
HEADER = [(0, 146.0), (15, 147.0), (28, 149.0), (37, 152.0), (43, 155.0), (46, 157.0)]
# the rear window: its front and rear edges (along) and its sides inside the hatch's width
SPOILER_BOW = 3.0  # the rear window's lower edge curves forward towards the sides (px at the hatch's edge)
REAR_WINDOW_EDGES = (270.0, 324.0)  # to where the spoiler's deck stands out of the hatch
# the B-pillar leans back going up, as the blueprint draws it: its left and right edges by row
B_LEFT = lambda r: 213.5 - 0.125 * (r - 41.3)
B_RIGHT = lambda r: 218.0 - 0.115 * (r - 41.3)
B_PILLAR_COLS = (209.0, 218.5)
# The windscreen seen from the side: a wedge between its slanted front edge, the
# header under the roof and the A-pillar's edge
WINDSCREEN_BASE_ROW = 70.4  # the glass stops here, a strip of body left above the bonnet
WINDSCREEN = [(112.9, 69.4), (144.3, 42.9), (157.0, 44.2), (135.7, 70.8)]

MATERIALS = ["body", "glass", "trim", "tail_light", "head_light", "plate", "tyre", "hub", "indicator", "reverse", "chrome"]

# Where the parts sit, in blueprint pixels (along, row) and mm across
BELT = [(141, 72), (200, 71), (250, 69), (270, 68)]  # the side windows' sill (along, row)
GLASS_TOP_ROW = 41.3  # the side glass's top; the painted rail is above
A_PILLAR = ((141, 72), (161, 36))  # the glass's front edge, (along, row) at its foot and top
B_PILLAR = (212, 217)
GLASS_REAR = [(43.5, 264), (55, 269), (66, 274), (69, 275)]  # (row, along) down the C-pillar
HEAD_UNIT_ROWS, HEAD_UNIT_REAR, HEAD_UNIT_FROM = (88.5, 99.6), (47.5, 44.2), 336.0  # the front unit: rows, rear edge at top/bottom, where it starts
HEAD_INDICATOR_FROM, HEAD_AMBER_ROW = 668.0, 95.1
# The grille, flat on the nose as the front view draws it: a chrome frame, an inner
# horizontal bar and two tilted uprights; half widths in mm (top, bottom) over its rows
GRILLE_ROWS = (88.5, 99.6)
GRILLE_OUTER = (336.0, 306.0)
GRILLE_FRAME = 14.0  # mm
GRILLE_INNER_ROWS = (89.4, 98.7)
GRILLE_BAR_ROWS = (93.3, 94.5)
GRILLE_UPRIGHTS = (((272.0, 246.0), (286.0, 260.0)),)  # (left edge, right edge), each (top, bottom)
_UNUSED_SLATS = (90.9, 93.5, 96.1)  # the grille's slats, top rows (each about one row tall)  # from here out the indicator, amber above this row
TAIL_SPLIT_ROW, TAIL_CORNER_HALF = 93.0, 525.0  # the dark stripe through all lamp pieces (row); amber above it on the outer cluster
GAP_Y, GAP_ROW = 11.0, 0.45  # the dark lines between the lamp sections: across in mm, along the colour change in rows  # the corner piece: amber above, red below; inboard red
TAIL_SIDE_FROM, TAIL_KINK = 339.0, 351.8  # the lamp's triangle on the quarter, its top from the kink down to here
WINDSCREEN_ALONG = (112, 148)
SIDE_GLASS_ALONG = (141, 250)
REAR_WINDOW_ALONG = (262, 324)
SPOILER_ALONG = (311, 332)
MIRROR_ALONG, MIRROR_ROWS = (148, 156), (61, 72)
FRONT_BUMPER_ROWS, REAR_BUMPER_ROWS = (100, 112), (101, 115)
TAIL_LIGHT_ROWS = (86, 101)
HEAD_LIGHT_ROWS = (88, 100)
LAMP_INNER_HALF = 345.0  # mm - inside this the rear carries the plate recess, the front the grille
HUB_SHARE = 0.62  # of the tyre's radius, the rim
AXLES = (91, 91 + 2517 / ALONG)
HUB_ROW, TYRE_R = 119.5, 22 * ALONG
ARCH_R = 30 * ALONG  # the wheel wells' radius


def offset_polygon(poly, d):
    """The polygon grown outwards by d (its vertices moved along their mean edge normals)."""
    pts = np.array(poly, float)
    area = 0.5 * np.sum(pts[:, 0] * np.roll(pts[:, 1], -1) - np.roll(pts[:, 0], -1) * pts[:, 1])
    sign = 1.0 if area < 0 else -1.0
    out = []
    for i in range(len(pts)):
        a, b, c = pts[i - 1], pts[i], pts[(i + 1) % len(pts)]
        n = np.zeros(2)
        for u, w in ((a, b), (b, c)):
            e = w - u
            n += sign * np.array([e[1], -e[0]]) / (np.linalg.norm(e) or 1)
        out.append(b + d * n / (np.linalg.norm(n) or 1))
    return out


def in_polygon(pts, poly):
    """Which of the points (N, 2) lie inside the polygon (even-odd rule)."""
    x, y = pts[:, 0], pts[:, 1]
    inside = np.zeros(len(pts), bool)
    P = np.array(poly, float)
    for i in range(len(P)):
        (x0, y0), (x1, y1) = P[i], P[(i + 1) % len(P)]
        cross = ((y0 > y) != (y1 > y)) & (x < (x1 - x0) * (y - y0) / ((y1 - y0) or 1e-9) + x0)
        inside ^= cross
    return inside


def to_world(px, row):
    return np.array([(187.5 - px) * ALONG, 0.0, (141.5 - row) * UP])


def clip_triangles(tris, origin, normal):
    """Every triangle that crosses the plane cut into two or three along it; the others kept as they are."""
    out = []
    for tri in tris:
        d = (tri - origin) @ normal
        if (d >= -1e-6).all() or (d <= 1e-6).all():
            out.append(tri)
            continue
        # walk the triangle's edges, collecting the polygon on each side
        sides = ([], [])
        for i in range(3):
            a, b = tri[i], tri[(i + 1) % 3]
            da, db = d[i], d[(i + 1) % 3]
            if abs(da) < 1e-9:
                # a corner on the plane belongs to both pieces
                sides[0].append(a)
                sides[1].append(a)
            else:
                sides[0 if da > 0 else 1].append(a)
            if (da > 1e-9 and db < -1e-9) or (da < -1e-9 and db > 1e-9):
                p = a + (b - a) * (da / (da - db))
                sides[0].append(p)
                sides[1].append(p)
        n0 = np.cross(tri[1] - tri[0], tri[2] - tri[0])
        for poly in sides:
            for k in range(1, len(poly) - 1):
                piece = np.array([poly[0], poly[k], poly[k + 1]])
                # a sliver can come out turned the wrong way by rounding: keep the original's facing
                if np.dot(np.cross(piece[1] - piece[0], piece[2] - piece[0]), n0) < 0:
                    piece = piece[::-1]
                out.append(piece)
    return np.array(out)


def symmetrize(mesh):
    """
    The mesh made exactly symmetric: the +y half is kept, cut cleanly at the
    centre plane, and mirrored. The CAD kernel triangulates the two flanks
    differently, which shows as lopsided facets.
    """
    tris = clip_triangles(mesh.triangles.copy(), np.zeros(3), np.array([0.0, 1.0, 0.0]))
    keep = tris[tris[:, :, 1].mean(axis=1) >= 0]
    mirrored = keep * np.array([1.0, -1.0, 1.0])
    mirrored = mirrored[:, ::-1]  # the mirror image winds the other way round
    allt = np.concatenate([keep, mirrored])
    out = trimesh.Trimesh(vertices=allt.reshape(-1, 3), faces=np.arange(len(allt) * 3).reshape(-1, 3), process=False)
    out.merge_vertices()
    return out


def cut_sill(mesh):
    """The flanks cut along the line through the wheel centres, so the dark lower panel starts on an edge."""
    c = mesh.triangles_center
    n = mesh.face_normals
    px = 187.5 - c[:, 0] / ALONG
    reg = (px > 40) & (px < 305) & (np.abs(n[:, 1]) > 0.5) & (c[:, 2] < (141.5 - 100) * UP)
    keep = mesh.submesh([np.where(~reg)[0]], append=True)
    tris = mesh.submesh([np.where(reg)[0]], append=True).triangles.copy()
    tris = clip_triangles(tris, np.array([0.0, 0.0, (141.5 - HUB_ROW) * UP]), np.array([0.0, 0.0, 1.0]))
    sub = trimesh.Trimesh(vertices=tris.reshape(-1, 3), faces=np.arange(len(tris) * 3).reshape(-1, 3), process=False)
    out = trimesh.util.concatenate([keep, sub])
    out.merge_vertices()
    return out


def cut_front(mesh):
    """The nose's lamp unit cut along its edges, so the lamp, the indicator and the grille end on real edges."""
    c = mesh.triangles_center
    px = 187.5 - c[:, 0] / ALONG
    reg = (px < 52) & (c[:, 2] > (141.5 - 101) * UP) & (c[:, 2] < (141.5 - 87) * UP)
    keep = mesh.submesh([np.where(~reg)[0]], append=True)
    tris = mesh.submesh([np.where(reg)[0]], append=True).triangles.copy()
    planes = []
    for sgn in (1, -1):
        for yv in (HEAD_UNIT_FROM, HEAD_INDICATOR_FROM):
            planes.append(((0, sgn * yv, 0), (0, 1, 0)))
    for r in (HEAD_UNIT_ROWS[0], HEAD_AMBER_ROW - 0.2, HEAD_AMBER_ROW + 0.2, HEAD_UNIT_ROWS[1]):
        planes.append(((0, 0, (141.5 - r) * UP), (0, 0, 1)))
    # the grille's lines: frame, bar and uprights, on both sides of the middle
    def line(y0, r0, y1, r1, sgn):
        a_ = np.array([0.0, sgn * y0, (141.5 - r0) * UP])
        d_ = np.array([0.0, sgn * y1, (141.5 - r1) * UP]) - a_
        n_ = np.array([0.0, -d_[2], d_[1]])
        return (tuple(a_), tuple(n_ / np.linalg.norm(n_)))

    r0, r1 = GRILLE_ROWS
    for sgn in (1, -1):
        planes.append(line(GRILLE_OUTER[0], r0, GRILLE_OUTER[1], r1, sgn))
        planes.append(line(GRILLE_OUTER[0] - GRILLE_FRAME, r0, GRILLE_OUTER[1] - GRILLE_FRAME, r1, sgn))
        for (t0, b0), (t1, b1) in GRILLE_UPRIGHTS:
            planes.append(line(t0, r0, b0, r1, sgn))
            planes.append(line(t1, r0, b1, r1, sgn))
    for r in GRILLE_INNER_ROWS + GRILLE_BAR_ROWS:
        planes.append(((0, 0, (141.5 - r) * UP), (0, 0, 1)))
    a, b = to_world(HEAD_UNIT_REAR[0], HEAD_UNIT_ROWS[0]), to_world(HEAD_UNIT_REAR[1], HEAD_UNIT_ROWS[1])
    d = b - a
    nrm = np.array([-d[2], 0.0, d[0]])
    planes.append((tuple(a), tuple(nrm / np.linalg.norm(nrm))))
    for origin, normal in planes:
        tris = clip_triangles(tris, np.asarray(origin, float), np.asarray(normal, float))
    sub = trimesh.Trimesh(vertices=tris.reshape(-1, 3), faces=np.arange(len(tris) * 3).reshape(-1, 3), process=False)
    out = trimesh.util.concatenate([keep, sub])
    out.merge_vertices()
    return out


def cut_windows(mesh):
    """The side-facing triangles of the glasshouse cut along the panes' outlines and their frames."""
    c = mesh.triangles_center
    n = mesh.face_normals
    px = 187.5 - c[:, 0] / ALONG
    row = 141.5 - c[:, 2] / UP
    region = ((px > 135) & (px < 290) & (row > 33) & (row < 77) & (np.abs(n[:, 1]) > 0.35)) | (
        (px > 105) & (px < 170) & (row > 30) & (row < 75) & (n[:, 0] > -0.2) & (np.abs(c[:, 1]) < 700)
    )
    tris = mesh.submesh([np.where(region)[0]], append=True).triangles.copy()
    for poly in (DOOR_GLASS, REAR_GLASS):
        for ring in (poly,):
            for i in range(len(ring)):
                a, b = to_world(*ring[i]), to_world(*ring[(i + 1) % len(ring)])
                d = b - a
                normal = np.array([-d[2], 0.0, d[0]])
                if np.linalg.norm(normal) > 1e-9:
                    tris = clip_near(tris, a, normal / np.linalg.norm(normal), a[[0, 2]], b[[0, 2]], 40.0)
    # across the car: the header, and the rear window's edges, as planes standing on the plan
    def plan_plane(tris, p0, p1):
        a = np.array([(187.5 - p0[0]) * ALONG, p0[1] * ACROSS, 0.0])
        b = np.array([(187.5 - p1[0]) * ALONG, p1[1] * ACROSS, 0.0])
        d = b - a
        nrm = np.array([-d[1], d[0], 0.0])
        return clip_triangles(tris, a, nrm / np.linalg.norm(nrm)) if np.linalg.norm(nrm) > 1e-9 else tris

    for side in (1, -1):
        for off in (0.0,):
            pts = [(x + off, side * hw) for hw, x in HEADER]
            for i in range(len(pts) - 1):
                tris = plan_plane(tris, pts[i], pts[i + 1])
    # the windscreen's top edge: the header row, so the glass stops under the roof's front
    tris = clip_triangles(tris, np.array([0.0, 0.0, (141.5 - GLASS_TOP_ROW) * UP]), np.array([0.0, 0.0, 1.0]))
    tris = clip_triangles(tris, np.array([0.0, 0.0, (141.5 - WINDSCREEN_BASE_ROW) * UP]), np.array([0.0, 0.0, 1.0]))
    sub = trimesh.Trimesh(vertices=tris.reshape(-1, 3), faces=np.arange(len(tris) * 3).reshape(-1, 3), process=False)
    # the rear window's region, cut along its frame's edges too
    c2 = mesh.triangles_center
    n2 = mesh.face_normals
    px2 = 187.5 - c2[:, 0] / ALONG
    rw = (px2 > 256) & (px2 < 336) & (n2[:, 2] > 0.2) & (c2[:, 2] > (141.5 - 72) * UP) & ~region
    rw_tris = mesh.submesh([np.where(rw)[0]], append=True).triangles.copy()
    keep = mesh.submesh([np.where(~region & ~rw)[0]], append=True)
    xs = [x for x, _ in _HATCH_HALF]
    rw_tris = clip_triangles(rw_tris, to_world(REAR_WINDOW_EDGES[0], 0), np.array([1.0, 0.0, 0.0]))
    # the lower edge: a curve in plan, as a few straight pieces
    edge_pts = [(REAR_WINDOW_EDGES[1] - SPOILER_BOW * (h / 45.0) ** 2, h) for h in (0, 15, 30, 45, 60)]
    for side in (1, -1):
        for i in range(len(edge_pts) - 1):
            p0, p1 = edge_pts[i], edge_pts[i + 1]
            rw_tris = plan_plane(rw_tris, (p0[0], side * p0[1]), (p1[0], side * p1[1]))
    for side in (1, -1):
        pts = [(x, side * (h * ACROSS - REAR_FRAME_MM) / ACROSS) for x, h in _HATCH_HALF]
        for i in range(len(pts) - 1):
            rw_tris = plan_plane(rw_tris, pts[i], pts[i + 1])
    rwm = trimesh.Trimesh(vertices=rw_tris.reshape(-1, 3), faces=np.arange(len(rw_tris) * 3).reshape(-1, 3), process=False)
    out = trimesh.util.concatenate([keep, sub, rwm])
    out.merge_vertices()
    return out


def clip_near(tris, origin, normal, p0, p1, pad):
    """Clip only the triangles near the segment p0-p1 (world x,z): its plane would otherwise cut the whole car."""
    lo = np.minimum(p0, p1) - pad
    hi = np.maximum(p0, p1) + pad
    bmin = tris[:, :, [0, 2]].min(axis=1)
    bmax = tris[:, :, [0, 2]].max(axis=1)
    near = ((bmax >= lo) & (bmin <= hi)).all(axis=1)
    if not near.any():
        return tris
    return np.concatenate([tris[~near], clip_triangles(tris[near], origin, normal)])


def split_for_materials(mesh):
    """
    The mesh with its triangles cut along the lamps' edges at the tail: the CAD
    kernel merges coplanar faces, so the rear's one flat face has to be split
    where the lamp, the indicator and the plate meet.
    """
    c = mesh.triangles_center
    px = 187.5 - c[:, 0] / ALONG
    rear = px > 340
    parts = [mesh.submesh([np.where(~rear)[0]], append=True)]
    sub = mesh.submesh([np.where(rear)[0]], append=True)
    ys = [-TAIL_CORNER_HALF - GAP_Y, -TAIL_CORNER_HALF + GAP_Y, -LAMP_INNER_HALF, LAMP_INNER_HALF, TAIL_CORNER_HALF - GAP_Y, TAIL_CORNER_HALF + GAP_Y]
    planes = [((0, y, 0), (0, 1, 0)) for y in ys]
    # the lamp's triangle on the quarter: the plane through the line from the kink to the bumper
    k = np.array([-(TAIL_KINK - 187.5) * ALONG, 0, (141.5 - TAIL_LIGHT_ROWS[0]) * UP])
    b = np.array([-(TAIL_SIDE_FROM - 187.5) * ALONG, 0, (141.5 - TAIL_LIGHT_ROWS[1]) * UP])
    d = k - b
    nrm = np.array([-d[2], 0.0, d[0]])
    nrm = nrm / np.linalg.norm(nrm)
    # the lamp's top edge, and the amber stripe's lower edge with its seam, all parallel to it
    planes.append((tuple(k), tuple(nrm)))
    # the dark stripe through every lamp piece: horizontal
    for dr in (-GAP_ROW, GAP_ROW):
        planes.append(((0, 0, (141.5 - TAIL_SPLIT_ROW - dr) * UP), (0, 0, 1)))
    tris = sub.triangles.copy()
    for origin, normal in planes:
        tris = clip_triangles(tris, np.asarray(origin, float), np.asarray(normal, float))
    sub = trimesh.Trimesh(vertices=tris.reshape(-1, 3), faces=np.arange(len(tris) * 3).reshape(-1, 3), process=False)
    parts.append(sub)
    out = trimesh.util.concatenate(parts)
    out = cut_front(cut_windows(out))
    # the clips leave zero-area triangles; they carry no normal and break smooth shading
    out.update_faces(out.area_faces > 1e-3)
    out.remove_unreferenced_vertices()
    out.merge_vertices()
    return out


REAR_FRAME_MM = 85.0  # the body's border round the rear window, as the top view draws it
_HATCH_HALF = [(262, 40), (268, 43.5), (274, 47), (283, 49), (292, 50), (304, 51), (312, 51)]  # half width, px


def rear_glass_half(px):
    """The hatch's half width at a column, mm - the rear window sits inside it."""
    return np.interp(px, [x for x, _ in _HATCH_HALF], [h for _, h in _HATCH_HALF]) * ACROSS


_BUMPER_POINTS = None


def set_bumpers(path):
    """Use the bumper solids exported next to the model: faces lying on their surface are bumper."""
    global _BUMPER_POINTS
    from scipy.spatial import cKDTree

    b = trimesh.load(path)
    pts, _ = trimesh.sample.sample_surface(b, 400000)
    _BUMPER_POINTS = cKDTree(pts)


def classify(mesh):
    """One material index per face, see MATERIALS."""
    c = mesh.triangles_center
    n = mesh.face_normals
    px = 187.5 - c[:, 0] / ALONG
    row = 141.5 - c[:, 2] / UP
    y = np.abs(c[:, 1])
    out = np.zeros(len(c), dtype=np.int8)
    tri = mesh.triangles
    vpx = 187.5 - tri[:, :, 0] / ALONG
    vrow = 141.5 - tri[:, :, 2] / UP

    def between(v, lo_hi):
        return (v >= lo_hi[0]) & (v <= lo_hi[1])

    def interp(v, line):
        xs, ys = zip(*line)
        return np.interp(v, xs, ys)

    def a_pillar(r):
        (x0, r0), (x1, r1) = A_PILLAR
        return x0 + (x1 - x0) * (r0 - r) / (r0 - r1)

    # the wheels: anything within a tyre's radius of an axle, outboard
    wheel = np.zeros(len(c), bool)
    for ax in AXLES:
        d = np.hypot((px - ax) * ALONG, (row - HUB_ROW) * UP)
        wheel |= (d <= TYRE_R + 2) & (y > 640)
        # the rim: the raised disc and its rim wall
        rim = (d <= HUB_SHARE * TYRE_R + 1) & (y > 640) & ((np.abs(n[:, 1]) > 0.9) | (y > 760))
        out[rim] = MATERIALS.index("hub")
    out[wheel & (out == 0)] = MATERIALS.index("tyre")
    body = ~wheel

    # the wheel wells' insides: the arch's wall and its inner face, every face lying wholly inside the arch circle
    liner = np.zeros(len(c), bool)
    for ax in AXLES:
        d = np.hypot((vpx - ax) * ALONG, (vrow - HUB_ROW) * UP)
        liner |= body & (d <= ARCH_R + 4.0).all(axis=1) & (np.abs(tri[:, :, 1]).min(axis=1) > 400)
    # the floor: faces looking straight down
    liner |= body & (n[:, 2] < -0.7)
    trim = liner | body & (between(px, (145.0, 164.0)) & between(row, (58.5, 73.5)) & (y > 740) & (np.abs(tri[:, :, 1]).max(axis=1) > 880) & (n[:, 2] > -0.95))
    # under each bumper the valance down to the floor is bumper too
    for (x0, x1), r1 in (((0.0, 73.0), FRONT_BUMPER_ROWS[1]), ((296.0, 365.0), REAR_BUMPER_ROWS[1])):
        trim |= body & (vrow >= r1 - 0.2).all(axis=1) & (vpx >= x0).all(axis=1) & (vpx <= x1).all(axis=1)
    # the bumpers: over their rows the body is cut away, so every face lying in their zone is the bumper's
    for (x0, x1), (r0, r1) in (((0.0, 73.0), FRONT_BUMPER_ROWS), ((296.0, 365.0), REAR_BUMPER_ROWS)):
        trim |= body & (vrow >= r0 - 0.2).all(axis=1) & (vrow <= r1 + 0.2).all(axis=1) & (vpx >= x0).all(axis=1) & (vpx <= x1).all(axis=1)
    # the spoiler: its deck rises towards the rear (facing up and forward), its
    # underside faces down and back, its ends sideways - the hatch beneath it
    # slopes the other way
    trim |= body & between(px, SPOILER_ALONG) & (row < 70) & (y < 620) & (
        ((n[:, 2] > 0.5) & (n[:, 0] > 0.02)) | ((n[:, 2] < 0.1) & (n[:, 0] < -0.3)) | (np.abs(n[:, 1]) > 0.9)
    )
    # the B-pillar, black between the door windows
    trim |= body & between(px, B_PILLAR) & (row > GLASS_TOP_ROW) & (row < interp(px, BELT)) & (np.abs(n[:, 1]) > 0.5)
    out[trim] = MATERIALS.index("trim")

    # the side windows: glass inside each outline, black rubber in the frame round it
    side = body & ~trim & (np.abs(n[:, 1]) > 0.35)
    pts = np.stack([px, row], axis=1)
    glass = np.zeros(len(c), bool)
    frame = np.zeros(len(c), bool)
    for poly in (DOOR_GLASS, REAR_GLASS):
        inner = in_polygon(pts, poly)
        glass |= side & inner
    pillar = side & (px >= B_LEFT(row) - 0.3) & (px <= B_RIGHT(row) + 0.3) & (row > 40.5) & (row < 71.0) & (np.abs(n[:, 2]) < 0.85)
    out[pillar & ~glass] = MATERIALS.index("trim")
    # the windscreen: the steep forward-facing faces behind the bonnet, in front of the
    # header (its edge in plan, following the roof's edge), the rubber round them
    steep = body & ~trim & (n[:, 0] > 0.3) & (n[:, 2] > 0.2) & (px > 112.0)
    header = np.interp(np.abs(y) / ACROSS, [h for h, _ in HEADER], [x for _, x in HEADER])
    glass |= steep & (px < header) & (vrow >= GLASS_TOP_ROW - 0.05).all(axis=1) & (vrow <= WINDSCREEN_BASE_ROW + 0.05).all(axis=1)
    # the rear window: the hatch facing up and back between its rubber frame
    glass |= (
        body & ~trim & (n[:, 2] > 0.3) & (n[:, 0] < 0.1) & (np.abs(n[:, 1]) < 0.6)
        & between(px, REAR_WINDOW_ALONG) & (row < 70) & (y < rear_glass_half(px) - REAR_FRAME_MM) & (px > REAR_WINDOW_EDGES[0]) & (px < REAR_WINDOW_EDGES[1] - SPOILER_BOW * (y / (45.0 * ACROSS)) ** 2)
    )
    out[glass] = MATERIALS.index("glass")

    # the rear lamp: one triangle seen from the side - a vertical rear edge, a
    # top edge sloping down and forward from the kink, the bumper as its base;
    # round the rounded corner and across the rear face the same lamp. Amber is
    # the stripe along the sloping top edge, red below it
    rear_face = body & ~trim & (n[:, 0] < -0.5) & between(row, TAIL_LIGHT_ROWS) & (px > 345)
    out[rear_face & (y < LAMP_INNER_HALF)] = MATERIALS.index("plate")
    line = TAIL_LIGHT_ROWS[1] - (vpx - TAIL_SIDE_FROM) * (TAIL_LIGHT_ROWS[1] - TAIL_LIGHT_ROWS[0]) / (TAIL_KINK - TAIL_SIDE_FROM)
    rel = vrow - line
    lamps = (
        body & ~trim & (px > TAIL_SIDE_FROM - 0.2) & (y >= LAMP_INNER_HALF - 5)
        & ((n[:, 0] < -0.3) | (np.abs(n[:, 1]) > 0.5))
        & (rel >= -0.35).all(axis=1) & (vrow <= TAIL_LIGHT_ROWS[1] + 0.9).all(axis=1) & (vrow >= TAIL_LIGHT_ROWS[0] - 0.4).all(axis=1)
    )
    out[lamps] = MATERIALS.index("tail_light")
    amber_zone = (y > TAIL_CORNER_HALF) | (np.abs(n[:, 1]) > 0.5)
    out[lamps & (vrow <= TAIL_SPLIT_ROW - GAP_ROW + 0.05).all(axis=1) & amber_zone] = MATERIALS.index("indicator")
    # the dark lines: the horizontal stripe through all pieces, the vertical one between the clusters
    seam = lamps & (vrow >= TAIL_SPLIT_ROW - GAP_ROW - 0.05).all(axis=1) & (vrow <= TAIL_SPLIT_ROW + GAP_ROW + 0.05).all(axis=1)
    seam |= lamps & (np.abs(y - TAIL_CORNER_HALF) < GAP_Y) & (np.abs(n[:, 1]) < 0.5)
    out[seam] = MATERIALS.index("plate")

    # the front, as the front view and the nose side view draw it: the grille's
    # dark trapezoid between the lamps; each lamp unit from there round the corner
    # to its leaning edge, a clear lamp with the amber indicator at the outer end
    front_face = body & ~trim & (n[:, 0] > 0.5) & (px < 30) & (np.abs(tri[:, :, 1]).mean(axis=1) < GRILLE_OUTER[0] + (GRILLE_OUTER[1] - GRILLE_OUTER[0]) * np.clip((row - GRILLE_ROWS[0]) / (GRILLE_ROWS[1] - GRILLE_ROWS[0]), 0, 1) - 1.0) & between(row, HEAD_LIGHT_ROWS)
    out[front_face] = MATERIALS.index("plate")
    # the grille: dark field, chrome frame, inner bar and tilted uprights, judged at each face's middle
    f = (row - GRILLE_ROWS[0]) / (GRILLE_ROWS[1] - GRILLE_ROWS[0])
    ay = y
    half = GRILLE_OUTER[0] + (GRILLE_OUTER[1] - GRILLE_OUTER[0]) * f
    ay = np.abs(tri[:, :, 1]).mean(axis=1)
    on = front_face & (row >= GRILLE_ROWS[0] - 0.05) & (row <= GRILLE_ROWS[1] + 0.05) & (ay <= half + 0.5)
    chrome = on & ((ay >= half - GRILLE_FRAME) | (row < GRILLE_INNER_ROWS[0]) | (row > GRILLE_INNER_ROWS[1]))
    bar_end = GRILLE_UPRIGHTS[0][0][0] + (GRILLE_UPRIGHTS[0][0][1] - GRILLE_UPRIGHTS[0][0][0]) * f
    chrome |= on & between(row, GRILLE_BAR_ROWS) & (ay <= bar_end + 0.5)  # the bar ends at the uprights
    for (t0, b0), (t1, b1) in GRILLE_UPRIGHTS:
        lo = t0 + (b0 - t0) * f
        hi = t1 + (b1 - t1) * f
        chrome |= on & (ay >= lo) & (ay <= hi)
    out[chrome] = MATERIALS.index("chrome")
    edge = HEAD_UNIT_REAR[0] + (HEAD_UNIT_REAR[1] - HEAD_UNIT_REAR[0]) * (vrow - HEAD_UNIT_ROWS[0]) / (HEAD_UNIT_ROWS[1] - HEAD_UNIT_ROWS[0])
    unit = (
        body & ~trim & (n[:, 0] > -0.3) & (out == 0)
        & (np.abs(tri[:, :, 1]).mean(axis=1) > GRILLE_OUTER[0] + (GRILLE_OUTER[1] - GRILLE_OUTER[0]) * np.clip((row - GRILLE_ROWS[0]) / (GRILLE_ROWS[1] - GRILLE_ROWS[0]), 0, 1) - 1.0) & (vrow >= HEAD_UNIT_ROWS[0] - 0.15).all(axis=1) & (vrow <= HEAD_UNIT_ROWS[1] + 0.15).all(axis=1)
        & (vpx <= edge + 0.3).all(axis=1)
    )
    out[unit] = MATERIALS.index("head_light")
    # amber: on the front at the outer end, and on the flank behind the corner; between them the lamp stays clear
    amber = unit & (y > HEAD_INDICATOR_FROM - 3) & (vrow <= HEAD_AMBER_ROW + 0.25).all(axis=1)
    out[amber] = MATERIALS.index("indicator")
    return out


if __name__ == "__main__":
    m = trimesh.load(sys.argv[1])
    import os
    if os.path.exists(sys.argv[1].replace(".stl", "_bumpers.stl")):
        set_bumpers(sys.argv[1].replace(".stl", "_bumpers.stl"))
    ids = classify(m)
    for i, name in enumerate(MATERIALS):
        print(f"{name:11s} {int((ids == i).sum()):5d} faces")
