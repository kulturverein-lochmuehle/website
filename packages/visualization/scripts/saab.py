"""The Saab 900 combi coupé, modelled in CadQuery from its blueprint alone.

The blueprint is the-blueprints.com's "Saab 900 3_5", 1:25, with the side, top,
front and rear views and the car's length, wheelbase, width and height on it.
Every outline is traced off the sheet in its own pixels. The side and top views
share their pixels along the car, the side and front views their rows.

The body is what the views agree on: the side outline extruded across the car,
the head-on outline extruded along it and the plan extruded up through it,
intersected. Above the windows' sill the cabin's own plan, drawn inside the top
view, cuts it back: the wraparound windscreen's foot, the sills, the C-pillars
drawing in to the hatch.

Millimeters; X along the car, nose to +X, its middle at X = 0; Y across, Z up,
the road at Z = 0.

    python scripts/saab.py [out.stl]
"""

import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import cadquery as cq

# ============================================================
# PARAMETERS - the blueprint, traced in its own pixels
# ============================================================
# The measures printed on the sheet
length = 4680.0  # mm - bumper to bumper
wheelbase = 2517.0  # mm
width = 1690.0  # mm
height = 1425.0  # mm

# Side view: nose, tail, road and roof; the nose is on the left
side_nose = 14
side_tail = 361
side_ground = 141.5
side_roof = 33

# Side view: over the top, nose to tail - bumper, bonnet, windscreen, roof,
# hatch, tail; the spoiler, an add-on sitting on the hatch, left out
side_top = [
    (14, 102), (17, 102), (20, 93), (23, 88), (26, 85), (31, 83), (70, 76),
    (112, 69),
    (116, 65), (119, 63), (131, 51), (142, 40), (148, 37), (162, 34), (201, 33),
    (223, 33), (245, 33.3), (250, 33.6), (254, 34.0), (258, 34.65), (262, 35.65), (266, 36.95), (270, 38.55), (272, 39.5), (304, 54), (320, 62), (323, 62.6),
    (340, 71), (352, 77), (355, 82), (355.5, 101), (361, 102),
]
# Side view: the bonnet, rising in one slope from the nose to the A-pillars'
# foot, where the window line takes over; the windscreen's foot sits on it
side_bonnet = [
    (14, 102), (17, 102), (20, 93), (23, 88), (26, 85), (31, 83), (50, 79.7),
    (70, 77.0), (100, 74.3), (141, 72),
]
# Side view: the underside, tail back to nose
side_bottom = [
    (361, 108), (359, 113), (352, 118), (347, 120), (320, 123), (300, 125),
    (250, 127), (80, 127), (68, 123), (27, 121), (25, 114), (20, 111), (14, 108),
]
# Side view: the windows' sill, from the windscreen's foot back past the doors,
# rising a little towards the rear
side_belt = [(141, 72), (200, 71), (250, 69), (270, 68)]

# Side view: the axles' middles, the tyres' radius and the arches' round them
front_axle = 91
hub = 119.5
tyre_r_px = 22
arch_r_px = 30

# Top view: the body's plan, half width about its middle, nose to tail - behind
# the bumpers, its face flat across and its corners cut back round the lamps
plan_half = [
    (26.5, 25), (27.5, 35), (29, 42), (31, 46), (34, 51), (37, 54), (45, 57),
    (89, 62), (162, 63), (287, 63), (310, 62.5), (325, 61), (337, 59),
    (345, 56.5), (350, 53), (352.5, 48), (353.5, 42), (353.8, 35),
]
# The bumpers, slabs of their own: their plan, half width as the top view's
# dark band draws it, and their top and bottom rows in the side view
bumper_front_half = [
    (14, 20), (15.5, 30), (17, 38), (18.5, 44), (20, 48), (22, 52), (24, 55),
    (28, 57), (62, 58), (72, 58.5),
]
bumper_front_rows = (100, 112)
bumper_rear_half = [
    (296, 63.5), (305, 63), (320, 62.5), (335, 61), (345, 59), (352, 57), (357, 53),
    (359.5, 47), (360.5, 40), (361, 20),
]
bumper_rear_rows = (101, 115)
# The glasshouse, as the top view draws it: its foot on the body and its roof's
# edge, each a chain of points from the middle in front back along the side
# (along, half width), point for point the same corners - between them the
# windscreen wrapping round, the A-pillar and the side glass. It ends behind
# the side windows, where the rear takes over. A foot's half width of None
# sits on the body's waist
glass_foot = [
    (114, 0), (116, 12), (118, 24), (124, 37), (130, 44), (135, 48.5),
    (141, None), (212, None), (217, None), (240, None),
]
# How far the side glass sits in from the waist beyond the band's lean (along,
# px across): deep in the sill at the A-pillar, running out to the rear
foot_inset = [(141, 6.5), (200, 2.5), (250, 0)]
roof_edge = [
    (146, 0), (147, 15), (149, 28), (152, 37), (155, 43), (157, 46),
    (161, 47), (212, 46.2), (217, 46.1), (245, 46),
]
# The side glass as the side view draws it: its top row below the roof's
# edge (the painted rail between), the B-pillar's columns, and its rear edge
# running down and back along the C-pillar (along, row)
glass_top_row = 43.5
b_pillar = (212, 217)
glass_rear = [(264, 43.5), (269, 55), (274, 66), (275, 69)]
# Where the glasshouse ends and the rear begins - the rear side window's top
# rear corner - and where the cut crosses the roof, in pixels along
rear_start = 250
cut_start = 262
# The hatch fills the cut: across, it bulges up to the top line the side view
# draws; at the tail its lower edge runs across at the lamps' top (row), the
# panel below is the body's end. The spoiler is left out
hatch_sill_row = 86
# Where the quarter's sections straighten out towards the tail (along, from - to),
# and where the hatch flattens across from the window's curve to the deck's
tail_straight = (320, 340)
deck_flat = (320, 345)
# Behind the spoiler the boot lid is level across, its height the hatch's
# edge line as the side view draws it; the rear window's bulge runs out into
# it between `deck_flat_from` and `deck_flat_to`
deck_flat_from, deck_flat_to = 324, 331
# Behind the spoiler, where the hatch angles down to the tail, the cut is open
# again (along); the hatch is filled only from the roof to there
deck_open_from = None  # along, or None for the hatch closed all the way
# The lamps reach in from the corners to here (mm); between them the plate recess
lamp_inner_half = 345.0
lamp_rows = (86.6, 100.4)
lamp_outer_half = 700.0
lamp_split_row = 92.0  # on the corner piece the amber indicator above, red below
lamp_corner_half = 525.0  # mm - from here out the corner piece; inboard red the whole height
# seen from the side the lamp is a triangle on the quarter: its top runs from
# the corner's kink down to the bumper's top this far forward (along)
lamp_side_from = 339.0
# The tail face: (along, row) at the hatch's lower edge and at the bumper's top
tail_lean = ((351.8, 86.0), (350.3, 101))
lamp_top_row = tail_lean[0][1]  # the lamps' band and the hatch's overhang above it meet here
# The wheel wells: cut in from each flank this deep (mm), not through the body
well_depth = 320.0
# The ducktail on the hatch, as the side view draws it: a triangle - its front
# corner on the hatch at the rear window's foot, its top a flat, level deck
# climbing straight (`spoiler_rise` rows per pixel) to the sharp tip at
# `spoiler_tip`, its underside leaving the hatch at `spoiler_rear` up to that
# tip; across out to `spoiler_half`, the ends square
spoiler_base, spoiler_rear, spoiler_tip = 312, 326, 331
spoiler_rise = 4.25 / 25.5  # rows per pixel along, as drawn over the blueprint's full length
spoiler_half = 600.0  # mm
spoiler_bow = 3.0  # px - how far its ends sit forward of its middle, following the rear window's lower edge in the top view
# The mirrors: the head's extent along and in rows, how far out it reaches (mm
# from the middle), and the stalk from the A-pillar's glass
mirror_along, mirror_rows, mirror_out = (149, 155), (62, 71), 960.0
mirror_sweep = 4.0  # px - how far back the outer end leans
# How far the roof crowns from its edges to its middle, in rows, over the
# windscreen; from the A-pillars back the roof's edge over the side windows
# runs on this straight line in the side view (along, row), to the cut
crown_px = 3
roof_edge_rows = [(165, 36.6), (262, 36.0)]
# How finely the roof and the hatch are divided across
across_steps = 4

# The rear: the side walls rise to one hard corner on each side, the cut the
# rear is set into: from the roof's rear corner down the C-pillar beside the
# rear window and along the hatch, then at the tail lamp kinking straight down
# the side to the bumper (along, row in the side view; along, half width in
# the top view). Behind it the rear itself, for now left out; the spoiler is
# an add-on
hatch_edge_rows = [
    (250, 36.3), (258, 36.9), (263.5, 38.9), (268, 41.3), (272, 44), (276, 46.6),
    (280, 49.2), (284, 51.6), (288, 53.9), (296, 57.7), (304, 61), (318, 66.5), (335, 73.5), (343, 77), (347, 79.5),
    (350, 83.5), (351.8, 86), (355, 86.5),
]
hatch_edge_half = [
    # eased out of the roof edge over a few pixels, so the C-pillar carries no fold
    (250, 46), (264, 46), (268, 46.15), (271, 46.5), (274, 47), (277, 47.6),
    (283, 49), (292, 50), (304, 51), (353.8, 51),
]
# From above, the roof's edge runs in from 255 to meet the cut's corner at
# 268; from there on the side meets the cut directly. The cut crosses the
# roof straight at `cut_start` out to the
# first point here and swings out through these into the side edge (along,
# half width), as drawn on the top view
cut_corner = [(262, 26), (265, 39.5), (268, 43.5), (271, 46), (274, 47), (277, 48)]
# Below the hard corner the side tapers back to the tail, meeting the cut at
# the tail lamp: the plan there, half width
tail_side_half = [(320, 61.5), (332, 60), (340, 58), (346, 55.5), (350, 53.5), (353.8, 52.2), (356, 52.2)]
# The side wall runs from the crease up to the hatch's side edge and turns
# there in a clear corner; a narrow ribbon steps from the edge up to the
# hatch, in a clear corner again, and the hatch fills the rest: how far in
# and up the ribbon reaches, mm, and over how many pixels behind the
# glasshouse's end it comes in
ribbon_in = 25.0
ribbon_up = 40.0
ribbon_turn = 10

# Head-on view: the outline's half width by row, roof to road; its rows are
# the side view's
head_half = [
    (33, 24.5), (36, 40.5), (38, 46.5), (43, 49.5), (51, 53.5), (57, 56.5),
    (68, 59.5), (73, 62.5), (79, 63.5), (83, 64.5), (90, 66.5), (94, 66.5),
    (95, 65.5), (107, 65.5), (108, 64.5), (114, 64.5), (115, 63.5), (142, 63.5),
]

# Side view: the crease along the flank, from the top of the headlamps to the
# top of the tail lamps; the body's widest above the sill
side_crease = [(26, 88), (60, 86.5), (120, 85), (300, 85), (340, 86), (354, 86)]
# Behind the doors the quarter is one full, convex surface, as the photos show
# it: every section one curve from the crease to the cut, bulging out through
# the point where the doors' band and the glass would meet. At the rear door's
# edge the section is still the doors' own, band and glass with the window
# line's kink between; over `quarter_run` pixels it rounds into the curve. The
# small window in the C-pillar is left out for now
quarter_run = 15
quarter_steps = 4  # points along the section from the crease to the cut

# Head on: how far the sills tuck in under the flank, as a share of the plan's
# half width
sill_tuck = 0.95
# how far the band from the shoulder's crease to the waist leans in, in mm
# across per mm up - the same all along, so it keeps its angle on the bonnet
waist_lean = 0.19

# How closely the body is sectioned along the car, in pixels
station_step = 6

# The tyres: 195/60 R15, their outer faces flush with the flank as drawn head on
tyre_w = 195.0  # mm
rim_share = 0.62  # of the tyre's radius

# ============================================================
# DERIVED
# ============================================================
along = length / (side_tail - side_nose)  # mm per pixel along
up = height / (side_ground - side_roof)  # mm per pixel up
across = width / 2 / 63  # the top view's widest, at the doors  # mm per pixel across
middle = (side_nose + side_tail) / 2
axles = [front_axle, front_axle + wheelbase / along]
big = 4000.0  # mm - far enough out to cut or extrude through anything


def x_mm(px):
    """Along the car from its middle, nose to +X."""
    return (middle - px) * along


def z_mm(py):
    """Up from the road."""
    return (side_ground - py) * up


def side_mm(p):
    return (x_mm(p[0]), z_mm(p[1]))


def mirrored(right):
    """A half outline drawn on round its mirror image across the middle."""
    return right + [(a, -b) for a, b in reversed(right)]


# ============================================================
# MODEL
# ============================================================
def at(line, key):
    """A traced line's value at a point along it, straight between its points, held past its ends."""
    points = sorted(line)
    if key <= points[0][0]:
        return points[0][1]
    for (a, va), (b, vb) in zip(points, points[1:]):
        if key <= b:
            return va + (vb - va) * (key - a) / ((b - a) or 1)
    return points[-1][1]


eps = 2.0  # mm - keeps a section's points apart where its levels meet
sink = 8.0  # mm - how far the glasshouse's foot sits into the body, so the two overlap


def body_top(px):
    """The body's top under the glasshouse: the bonnet, then the window line."""
    if px < side_belt[0][0]:
        return z_mm(at(side_bonnet, px))
    return z_mm(at(side_belt, px))


def waist_at(px, belt):
    """
    The waist's half width at a column, in mm: under the windows and along the
    bonnet the band from the shoulder's crease leans in at one angle.
    """
    plan = at(plan_half, px) * across
    shoulder = min(z_mm(at(side_crease, px)), belt)
    return plan - waist_lean * (belt - shoulder)


def section(px):
    """
    The body's cross section under the glasshouse at a column of the side and
    top views, its right half from the sill up: the sill tucked in, the flank
    up to the shoulder's crease, drawn in to the waist, and flat across the top
    - the bonnet, the deck under the glasshouse.
    """
    bottom = z_mm(at(side_bottom, px))
    belt = body_top(px)
    shoulder = min(z_mm(at(side_crease, px)), belt)
    plan = at(plan_half, px) * across
    right = []
    for y, z in [
        (plan * sill_tuck, bottom),
        (plan, max(bottom + 60, z_mm(hub - 2.0))),
        (plan, shoulder),
        (waist_at(px, belt), belt),
    ]:
        if right:
            z = max(z, right[-1][1] + eps)
        right.append((y, z))
    ring = right + [(0.0, right[-1][1])] + [(-y, z) for y, z in reversed(right)]
    return [cq.Vector(x_mm(px), y, z) for y, z in ring]


roof_half = max(h for _, h in roof_edge) * across


def roof_edge_half(px):
    """The roof's edge over the side windows, its half width in mm, as the top view draws it."""
    return (at(roof_edge, px) if px <= rear_start else at(hatch_edge_half, px)) * across


def crowned(px, y):
    """
    The roof's height at a column and a half width: its top line in the middle,
    crowned down to its edge. Over the windscreen the shallow crown; from the
    A-pillars back the edge is held on `roof_edge_rows`, a straight line in the
    side view right up to the cut, the roof's middle bending or not.
    """
    top = z_mm(at(side_top, px))
    shallow = crown_px * up * min(abs(y) / roof_half, 1) ** 2
    edge = roof_edge_half(px)
    deep = max(top - z_mm(at(roof_edge_rows, px)), 0.0) * min(abs(y) / (edge or 1), 1.0) ** 2
    w = min(max((px - roof_edge_rows[0][0] + 10) / 10, 0.0), 1.0)
    return top - (shallow + (deep - shallow) * w)


def wall_half(px, z):
    """
    The side wall's half width at a column and a height, mm: from the crease
    leaning in as the band under the windows does, above the window line as
    the side glass does.
    """
    plan = at(plan_half, px) * across
    shoulder = z_mm(at(side_crease, px))
    belt = z_mm(side_belt[-1][1])
    glass_lean = (waist_at(rear_start, belt) - at(hatch_edge_half, rear_start) * across) / (
        crowned(rear_start, at(hatch_edge_half, rear_start) * across) - belt
    )
    low = min(max(z, shoulder), belt) - shoulder
    high = max(z - belt, 0.0)
    return plan - waist_lean * low - glass_lean * high


def cut_at(px):
    """The side's top edge at a column: the cut, or ahead of it the roof's edge (half width, height)."""
    plan = max(at(plan_half, px), at(tail_side_half, px) if px >= 320 else 0) * across
    floor = z_mm(bumper_rear_rows[0]) - 30.0
    line_h = min(at(hatch_edge_half, px) * across, plan)
    # never above the roof's own edge, so the roof runs on flush into the line
    roof_z = crowned(px, line_h)
    below = roof_z - z_mm(at(hatch_edge_rows, px))
    # eased, so the line leaves the roof without a knee
    soft = 60.0
    # the lift that keeps the line on the roof's edge where it leaves it fades
    # out within a few `soft`, so further down the line is the drawn one
    lift = soft / 2 * math.exp(-max(below, 0.0) / soft)
    line_z = max(roof_z - (below + math.sqrt(below * below + soft * soft)) / 2 + lift, floor + 3 * eps)
    # at the tail the side's top is the hatch's lower edge; the lamps sit below it
    return line_h, max(line_z, z_mm(hatch_sill_row))


def hatch_z(px, y, edge_h, edge_z):
    """
    The hatch's height at a column and half width: over the rear window the
    roof's crown carried on, bent down at its sides to the cut's edge; behind
    the spoiler level across at the edge's height, the one running out into
    the other under the spoiler.
    """
    f = min(max((px - deck_flat_from) / (deck_flat_to - deck_flat_from), 0.0), 1.0)
    f = f * f * (3 - 2 * f)
    crown = crowned(px, y) + (edge_z - crowned(px, edge_h)) * (y / edge_h) ** 2
    return crown * (1 - f) + edge_z * f


def deck_top(px, edge_z):
    """The hatch's height in the middle: the blueprint's top line over the window, running out onto the edge's height behind the spoiler."""
    f = min(max((px - deck_flat_from) / (deck_flat_to - deck_flat_from), 0.0), 1.0)
    f = f * f * (3 - 2 * f)
    return edge_z + max(z_mm(at(side_top, px)) - edge_z, 0.0) * (1 - f)


def hatch_power(px):
    """How the hatch curves across: a parabola over the window, flat in the middle over the deck."""
    f = min(max((px - deck_flat[0]) / (deck_flat[1] - deck_flat[0]), 0.0), 1.0)
    return 2 + 2 * f * f * (3 - 2 * f)


def rear_section(px, _lines_only=False, closed=None, deck=None):
    """
    The rear's cross section at a column, its right half from the sill up: the
    sill, the flank up to the crease, the side wall straight up to the cut,
    then down inside it to a floor at the bumper's top and across - the rear
    itself left out for now. At the glasshouse's end the wall is the
    glasshouse's own.
    """
    bottom = z_mm(at(side_bottom, px))
    plan = max(at(plan_half, px), at(tail_side_half, px) if px >= 320 else 0) * across
    belt = z_mm(at(side_belt, px))
    # the opening's placeholder floor, well inside the bumper so nothing touches
    floor = z_mm(bumper_rear_rows[0]) - 30.0
    line_h, line_z = cut_at(px)
    # over the roof the cut rounds from straight across into the side edge;
    # the roof between the side edge and the cut is crowned as the roof is
    eh = min(at(cut_corner, px) * across, line_h) if px <= cut_corner[-1][0] else line_h
    lift = line_z - crowned(px, line_h)
    roof_at = lambda y: crowned(px, y) + lift * (y / line_h) ** 2
    crease = min(z_mm(at(side_crease, px)), line_z)
    # the section from the crease to the cut: at the door a band leaning as the
    # doors' do up to the window line and the glass above it; behind the door
    # the same two legs rounded into one convex curve through their kink
    cut_pt = (line_h, line_z)
    kz = min(belt, crease + (line_z - crease) * 0.6)
    kink = (min(max(plan - waist_lean * (kz - crease), line_h), plan), kz)
    # towards the tail, where the cut has come down to the lamps, the section
    # runs straight from the crease to the cut - no bulge beside the lamps
    straight = min(max((px - tail_straight[0]) / (tail_straight[1] - tail_straight[0]), 0.0), 1.0)
    straight = straight * straight * (3 - 2 * straight)
    on_line = (plan + (line_h - plan) * 0.6, crease + (line_z - crease) * 0.6)
    kink = (kink[0] + (on_line[0] - kink[0]) * straight, kink[1] + (on_line[1] - kink[1]) * straight)
    # the cut is where everything meets: only over the roof's corner does the
    # roof run on past the side's edge, rounding into the cut
    eh = min(at(cut_corner, px) * across, line_h) if px <= cut_corner[-1][0] else line_h
    if _lines_only:
        return kink, cut_pt
    run = min(max((px - rear_start) / quarter_run, 0.0), 1.0)
    run = run * run * (3 - 2 * run)
    foot = (plan, crease)

    def mix(a, b, t):
        return (a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t)

    def along_section(u):
        legs = mix(foot, kink, 2 * u) if u <= 0.5 else mix(kink, cut_pt, 2 * u - 1)
        curve = mix(mix(foot, kink, u), mix(kink, cut_pt, u), u)
        return mix(legs, curve, run)

    # towards the tail the section is one straight leg from the crease to the
    # cut: its points slide onto the cut, so no fan of slivers at the corner
    us = [k / quarter_steps + (1 - k / quarter_steps) * straight for k in range(1, quarter_steps)]
    # two more points, where the side glass's top row and its rear edge cross
    # the section, so the glass has its own edges to end on
    for z_edge in (z_mm(glass_top_row), z_mm(min(max(at(glass_rear, px), glass_top_row), 72))):
        lo, hi = 0.0, 1.0
        for _ in range(24):
            mid = (lo + hi) / 2
            lo, hi = (mid, hi) if along_section(mid)[1] < z_edge else (lo, mid)
        us.append(min(max(lo, 0.02), 0.98))
    section = [along_section(u) for u in sorted(us)]
    # the tail lamp's edges on the flank: its sloping top and its colour change
    lamp_row = lamp_rows[1] - (px - lamp_side_from) * (lamp_rows[1] - lamp_rows[0]) / (tail_lean[0][0] - lamp_side_from)
    flank = [
        (plan, min(max(z_mm(r), max(bottom + 60, z_mm(hub - 2.0)) + eps), crease - eps))
        for r in sorted((max(lamp_row, lamp_rows[0]), lamp_split_row), reverse=True)
    ]
    wall = [(plan * sill_tuck, bottom), (plan, max(bottom + 60, z_mm(hub - 2.0))), *flank, foot, *section, cut_pt]
    # the roof from the side edge in to the cut, a few points across it; ahead
    # of the cut it runs on to the middle, closed
    # the roof on the same grid across as the glasshouse's, so the two run on
    # into each other without a seam
    if closed is None:
        closed = px < cut_start
    n = across_steps - 1
    if closed:
        # the same points across as the hatch's first ring, so the quads
        # between the roof and the hatch are not twisted
        eh = min(at(cut_corner, cut_start) * across, line_h)
    if eh < line_h - eps:
        for k in range(1, n + 1):
            y = line_h + (eh - line_h) * k / n
            wall.append((y, roof_at(y)))
    else:
        # keep the section's count: the points coincide with the cut's edge
        for k in range(1, n + 1):
            wall.append((line_h, line_z))
    eh = wall[-1][0]
    if closed:
        # ahead of the cut the roof runs on over the middle, closed; the first
        # point doubles the wall's last, as the hatch's lip does
        inside = [(eh, roof_at(eh))] + [(eh * k / across_steps, roof_at(eh * k / across_steps)) for k in range(across_steps - 1, 0, -1)]
        middle = (0.0, roof_at(0.0))
    elif deck if deck is not None else (deck_open_from is not None and px >= deck_open_from):
        # behind the spoiler the cut is open down to the hatch's lower edge:
        # straight down inside and across; the tail panel below it is body
        sill = z_mm(hatch_sill_row)
        inside = [(eh, sill)] + [(eh * k / across_steps, sill) for k in range(across_steps - 1, 0, -1)]
        middle = (0.0, sill)
    else:
        # the hatch, from the cut's edge across to the middle: a lip up to its
        # lower edge where the cut is below it, then the bulge
        lip = (eh, max(wall[-1][1], z_mm(hatch_sill_row)))
        inside = [lip] + [(eh * k / across_steps, hatch_z(px, eh * k / across_steps, eh, lip[1])) for k in range(across_steps - 1, 0, -1)]
        middle = (0.0, hatch_z(px, 0.0, eh, lip[1]))
    ring = wall + inside + [middle] + [(-y, z) for y, z in reversed(wall + inside)]
    return [cq.Vector(x_mm(px), y, z) for y, z in ring]


def cap(ring):
    """
    A section's end as flat triangles: the ring is planar across the car, so
    it is clipped ear by ear in its own plane - a fan from the middle would
    fold where the ring dips in below the cut.
    """
    pts = []
    for p in ring:
        if not pts or (p - pts[-1]).Length > 1e-6:
            pts.append(p)
    if (pts[0] - pts[-1]).Length <= 1e-6:
        pts.pop()
    flat = [(p.y, p.z) for p in pts]
    # the ring's turning: positive where it winds counter clockwise in (y, z)
    area = sum(a[0] * b[1] - b[0] * a[1] for a, b in zip(flat, flat[1:] + flat[:1]))
    sign = 1 if area > 0 else -1

    def turn(a, b, c):
        return sign * ((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]))

    def inside(p, a, b, c):
        return all(turn(u, v, p) >= 0 for u, v in ((a, b), (b, c), (c, a)))

    order = list(range(len(flat)))
    tris = []
    while len(order) > 3:
        for k in range(len(order)):
            i, j, l = order[k - 1], order[k], order[(k + 1) % len(order)]
            a, b, c = flat[i], flat[j], flat[l]
            if turn(a, b, c) <= 1e-9:
                continue
            if any(inside(flat[o], a, b, c) for o in order if o not in (i, j, l)):
                continue
            tris.append((pts[i], pts[j], pts[l]))
            del order[k]
            break
        else:
            # nothing clips - a degenerate ring; take what remains as a fan
            break
    tris.append((pts[order[0]], pts[order[1]], pts[order[2]]))
    tris += [(pts[order[0]], pts[order[k - 1]], pts[order[k]]) for k in range(3, len(order))]
    return tris


def rear_polyhedron(stations):
    """
    The rear sewn from its sections as flat faces - two triangles a quad, split
    along the shorter diagonal, so a twisted strip stays a few flat facets
    instead of a tessellated ruled surface - and capped at both ends.
    """
    def ring_at(station):
        px, kind = station
        if kind == "collar":
            # buried a little inside the body ahead, so the two overlap cleanly
            ring = rear_section(rear_start)
            centre = sum(ring, cq.Vector()) / len(ring)
            return [cq.Vector(x_mm(px), p.y * (1 - 0.004), p.z) for p in ring]
        if kind in ("hatch", "open"):
            return rear_section(px, deck=kind == "open")
        return rear_section(px, closed=kind)

    rings = [ring_at(st) for st in stations]
    triangles = []
    for ring_a, ring_b in zip(rings, rings[1:]):
        n = len(ring_a)
        for i in range(n):
            j = (i + 1) % n
            a0, a1, b0, b1 = ring_a[i], ring_a[j], ring_b[i], ring_b[j]
            if (a0 - b1).Length <= (a1 - b0).Length:
                triangles += [(a0, a1, b1), (a0, b1, b0)]
            else:
                triangles += [(a0, a1, b0), (a1, b1, b0)]
    for ring, flip in ((rings[0], True), (rings[-1], False)):
        triangles += [tri[::-1] if flip else tri for tri in cap(ring)]
    return polyhedron(triangles)


def polyhedron(triangles):
    """A closed solid sewn from triangles, each three points."""
    from OCP.BRepBuilderAPI import BRepBuilderAPI_MakeSolid, BRepBuilderAPI_Sewing
    from OCP.ShapeFix import ShapeFix_Solid
    from OCP.TopoDS import TopoDS

    sewing = BRepBuilderAPI_Sewing(0.01)
    for a, b, c in triangles:
        if (b - a).cross(c - a).Length > 1e-6:
            sewing.Add(cq.Face.makeFromWires(cq.Wire.makePolygon([a, b, c], close=True)).wrapped)
    sewing.Perform()
    solid = BRepBuilderAPI_MakeSolid(TopoDS.Shell_s(sewing.SewedShape())).Solid()
    fix = ShapeFix_Solid(solid)
    fix.Perform()
    return cq.Solid(fix.Solid())


def glasshouse():
    """
    The glasshouse, panel by panel between its foot and its roof's edge, the
    roof crowned over a grid inside its edge, closed across where the rear
    takes over and underneath inside the body.
    """
    base_z = z_mm(at(side_crease, rear_start))
    end_h = at(hatch_edge_half, rear_start)
    steps = [k / across_steps for k in range(across_steps, -1, -1)]
    feet = [(x, h, 1.0) for x, h in glass_foot] + [(rear_start, None, k) for k in steps]
    edges = roof_edge + [(rear_start, end_h * k) for k in steps]
    foot, edge, base, dlo = [], [], [], []
    for (fx, fh, share), (rx, rh) in zip(feet, edges):
        fh = (waist_at(fx, body_top(fx)) - at(foot_inset, fx) * across) * share if fh is None else fh * across
        foot.append((fx, fh, body_top(fx) - sink))
        edge.append((rx, rh * across, crowned(rx, rh * across)))
        base.append((fx, fh, base_z))
        # the glass's top edge, on the panel between its foot and the roof's edge
        t = min(max((z_mm(glass_top_row) - foot[-1][2]) / ((edge[-1][2] - foot[-1][2]) or 1), 0.05), 0.95)
        dlo.append(tuple(f + (e - f) * t for f, e in zip(foot[-1], edge[-1])))

    def v(p, side=1):
        return cq.Vector(x_mm(p[0]), side * p[1], p[2])

    triangles = []
    for side in (1, -1):
        for chain_a, chain_b in ((base, foot), (foot, dlo), (dlo, edge)):
            for i in range(len(chain_a) - 1):
                a, b = v(chain_a[i], side), v(chain_a[i + 1], side)
                c, d = v(chain_b[i + 1], side), v(chain_b[i], side)
                triangles += [(a, b, c), (a, c, d)]
    # the roof: a grid over its outline, on every column its edge turns at
    outline = roof_edge + [(rear_start, end_h)]

    def row(x):
        h = at(outline, x) * across
        return [
            v((x, h * k / across_steps, crowned(x, h * k / across_steps)))
            for k in range(-across_steps, across_steps + 1)
        ]

    grid = [row(x) for x in sorted({x for x, _ in outline})]
    for row_a, row_b in zip(grid, grid[1:]):
        for k in range(len(row_a) - 1):
            triangles += [(row_a[k], row_a[k + 1], row_b[k + 1]), (row_a[k], row_b[k + 1], row_b[k])]
    # the floor, flat inside the body: a fan from its middle
    ring = [v(p) for p in base] + [v(p, -1) for p in reversed(base[1:-1])]
    centre = sum(ring, cq.Vector()) / len(ring)
    triangles += [(centre, ring[i], ring[(i + 1) % len(ring)]) for i in range(len(ring))]
    return polyhedron(triangles)


def stations_between(start, end, lines):
    """Columns from start to end, on every point the lines turn at and closely between them."""
    picks = {start, end} | {p[0] for line in lines for p in line} | {
        start + i * station_step for i in range(int((end - start) / station_step) + 1)
    }
    return sorted(x for x in picks if start <= x <= end)


# The body under the glasshouse from its face behind the front bumper to where
# the rear takes over, and the rear from there to its face over the rear bumper
# The body ends where the cutout's rear line drops to the bumper: the lamps'
# face. What the blueprint draws behind it is the hatch's lower panel
body_end = 355.0
face, tail = plan_half[0][0], body_end
front_wires = [
    cq.Wire.makePolygon(section(x), close=True)
    for x in stations_between(face, rear_start, (side_bonnet, side_top, side_bottom, side_belt, plan_half, glass_foot))
]
# the rear's stations: the drawn lines' own points and a coarse grid between
rear_xs = sorted(
    set(stations_between(rear_start, tail, (side_top, side_bottom, plan_half, hatch_edge_rows, hatch_edge_half)))
    # on the drawn lines' own points, as the front is, no denser
    | {x for x, _ in cut_corner} | {x for x, _ in roof_edge_rows} | {cut_start, rear_start + quarter_run}
)
rear_xs = [x for x in rear_xs if rear_start <= x <= tail]


def thinned(stations, must, keep, apart=3.0):
    """
    Stations no closer than `apart` pixels: the corners every line turns on
    come first, then the lines' other points, grid points fill in.
    """
    kept = sorted(must)
    for x in sorted(keep) + sorted(stations):
        if all(abs(x - k) >= apart for k in kept):
            kept.append(x)
    return sorted(kept)


rear_xs = thinned(
    rear_xs,
    {rear_start, cut_start, tail, cut_corner[-1][0], deck_flat_from, deck_flat_to, (deck_flat_from + deck_flat_to) / 2, tail_lean[0][0], lamp_side_from}
    | ({deck_open_from} if deck_open_from else set()),
    {x for x, _ in cut_corner} | {x for x, _ in hatch_edge_rows} | {x for x, _ in hatch_edge_half},
)
# the stations with the roof closed or open: the cut's front face is the step
# between two sections at the cut itself; a pixel ahead of the glasshouse's end
# a collar buried inside it, so the two overlap rather than touch face to face
# at the opening's front the hatch ends in a wall: the same station twice
rear_stations = [(rear_start - 2, "collar")] + [
    st for x in rear_xs for st in ([(x, "hatch"), (x, "open")] if x == deck_open_from else [(x, None)])
]
body = (
    cq.Workplane("XY")
    .add(cq.Solid.makeLoft(front_wires, True))
    .union(glasshouse())
    .union(rear_polyhedron(rear_stations))
)

# The head-on outline, both halves, extruded along the whole car
head_right = [(z_mm(r), h * across) for r, h in reversed(head_half)]
head = (
    cq.Workplane("YZ")
    .polyline([(y, z) for z, y in mirrored(head_right)])
    .close()
    .extrude(big, both=True)
)


def bumper(half, rows):
    """A bumper: its plan extruded between its rows, cut to the head-on outline."""
    top, bottom = rows
    return (
        cq.Workplane("XY", origin=(0, 0, z_mm(bottom)))
        .polyline(mirrored([(x_mm(x), h * across) for x, h in half]))
        .close()
        .extrude(z_mm(top) - z_mm(bottom))
        .intersect(head)
    )


# The rear: the body ends on the cutout's rear line. In plan it rounds in from
# the side to the lamps' face (`tail_plan`, along and half width px); in height
# the edge is where the cutout line is at that column, so the lid and the
# quarters meet the lamps' ribbon on one line; below it the ribbon leans in
# going down as the side view draws it (`tail_lean`)
tail_plan = [(345, 58.4), (350, 55.9), (351.8, 52.9), (351.8, lamp_corner_half / across), (351.8, lamp_inner_half / across), (351.8, 0)]
lean = (x_mm(tail_lean[1][0]) - x_mm(tail_lean[0][0])) / (z_mm(tail_lean[0][1]) - z_mm(tail_lean[1][1]))
outline = [(tail_plan[0][0], 70.0)] + list(tail_plan)
outline = outline + [(x, -h) for x, h in reversed(outline) if h > 0]
z_low = z_mm(side_bottom[0][1]) - 200.0
z_top = z_mm(0) + 500.0
far = x_mm(tail) - big


def rear_rings():
    top, mid, split, bot = [], [], [], []
    zs = z_mm(lamp_split_row)
    for x, h in outline:
        y = h * across
        zm = cut_at(x)[1]
        top.append(cq.Vector(x_mm(x), y, z_top))
        mid.append(cq.Vector(x_mm(x), y, zm))
        # a ring where the lamps change colour, so the corners' faces split there
        split.append(cq.Vector(x_mm(x) + lean * (zm - zs), y, zs) if zs < zm - 1 else mid[-1])
        bot.append(cq.Vector(x_mm(x) + lean * (zm - z_low), y, z_low))
    return top, mid, split, bot


def rear_cutter():
    top, mid, split, bot = rear_rings()
    tris = []
    for ring_a, ring_b in ((top, mid), (mid, split), (split, bot)):
        for i in range(len(ring_a) - 1):
            a0, a1, b0, b1 = ring_a[i], ring_a[i + 1], ring_b[i], ring_b[i + 1]
            tris += [(a0, a1, b1), (a0, b1, b0)]
    y0, y1 = top[0].y, top[-1].y
    back_top = [cq.Vector(far, y0, z_top), cq.Vector(far, y1, z_top)]
    back_bot = [cq.Vector(far, y0, z_low), cq.Vector(far, y1, z_low)]
    # the caps above and below, fanned from a point far behind
    c_top, c_bot = cq.Vector(far, 0, z_top), cq.Vector(far, 0, z_low)
    poly_top = top + [back_top[1], back_top[0]]
    poly_bot = bot + [back_bot[1], back_bot[0]]
    tris += [(c_top, poly_top[i], poly_top[(i + 1) % len(poly_top)]) for i in range(len(poly_top))]
    tris += [(c_bot, poly_bot[(i + 1) % len(poly_bot)], poly_bot[i]) for i in range(len(poly_bot))]
    # the back and the two sides
    tris += [(back_top[0], back_bot[0], back_bot[1]), (back_top[0], back_bot[1], back_top[1])]
    for side, (t, m, bt, bk_t, bk_b) in enumerate(((top[0], mid[0], bot[0], back_top[0], back_bot[0]), (top[-1], mid[-1], bot[-1], back_top[1], back_bot[1]))):
        poly = [t, m, bt, bk_b, bk_t]
        tris += [(poly[0], poly[i], poly[i + 1]) for i in range(1, len(poly) - 1)]
    return cq.Workplane("XY").add(polyhedron(tris))


body = body.cut(rear_cutter())



wheel_sides = 20  # corners round a tyre


def prism(cx, cy, cz, radius, half_width, sides=None):
    """A low-poly cylinder on an axis along y: `sides` flat faces round, two flat ends."""
    sides = sides or wheel_sides
    ring = [
        (cx + radius * math.cos(2 * math.pi * k / sides), cz + radius * math.sin(2 * math.pi * k / sides))
        for k in range(sides)
    ]
    near = [cq.Vector(x, cy - half_width, z) for x, z in ring]
    far = [cq.Vector(x, cy + half_width, z) for x, z in ring]
    middle_near, middle_far = cq.Vector(cx, cy - half_width, cz), cq.Vector(cx, cy + half_width, cz)
    tris = []
    for k in range(sides):
        j = (k + 1) % sides
        tris += [(near[k], far[k], far[j]), (near[k], far[j], near[j])]
        tris.append((middle_far, far[j], far[k]))
        tris.append((middle_near, near[k], near[j]))
    return polyhedron(tris)


arch_sides = 16  # corners round a wheel arch

# The bumpers protrude from the body as the side view draws them: the body is
# cut away over their rows and the bumpers' own plan forms the surface there
for (x0, x1), (r_top, r_bottom) in (((0, 73), bumper_front_rows), ((296, 365), bumper_rear_rows)):
    zone = (
        cq.Workplane("XY")
        .box(x_mm(x0) - x_mm(x1), 2 * big, z_mm(r_top) - z_mm(r_bottom), centered=(False, True, False))
        .translate((x_mm(x1), 0, z_mm(r_bottom)))
    )
    body = body.cut(zone)
bumpers = bumper(bumper_front_half, bumper_front_rows).union(bumper(bumper_rear_half, bumper_rear_rows))
# the bumpers end on the wheel arches' curve: the arch circle, through the full width, is cut out of them
for x in axles:
    inner = at(plan_half, x) * across - well_depth
    arch = cq.Workplane("XY").add(prism(x_mm(x), inner + big / 2, z_mm(hub), arch_r_px * along, big / 2, arch_sides))
    bumpers = bumpers.cut(arch).cut(arch.mirror("XZ"))
body = body.union(bumpers)

# The head lamps: the nose's own skin between the bonnet's edge and the bumper,
# from the grille out round the corner, cut out and set a little proud (the
# outer end is the amber indicator); a gap between keeps the two apart
# One lamp unit each side, the nose's own skin set a little proud: it starts at
# the grille (|y| 335), follows the nose's diagonal round the corner and ends on
# the flank in a leaning edge - seen from the side a tilted rectangle between
# the bonnet's edge and the bumper (along, row)
head_unit = ((6.0, 88.5), (47.5, 88.5), (44.2, 99.6), (6.0, 99.6))
head_unit_from = 336.0  # mm - the lamp's inner edge at its top, slanting in at the bottom with the grille
head_unit_slant = 306.0  # mm at the bottom
head_lamp_scale = 1.0025
nose = cq.Workplane("XY").add(cq.Solid.makeLoft(front_wires, True))


def side_prism(poly, y0, y1, sign):
    """A prism across the car between y0 and y1, its outline drawn in the side view (along, row)."""
    pts = [(x_mm(x), z_mm(r)) for x, r in poly]
    return cq.Workplane("XZ", origin=(0, sign * y0, 0)).polyline(pts).close().extrude(-(y1 - y0) if sign > 0 else (y1 - y0))


head_amber = (95.3, 95.1)  # the indicator's amber above this row, clear below (they overlap a hair)
head_indicator_from = 668.0  # mm - from here out the unit is the indicator


def unit_poly(r0, r1):
    """The unit's side outline between two rows, its rear edge leaning as drawn."""
    (xt, rt), (xb, rb) = head_unit[1], head_unit[2]
    edge = lambda r: xt + (xb - xt) * (r - rt) / (rb - rt)
    return ((6.0, r0), (edge(r0), r0), (edge(r1), r1), (6.0, r1))


for sign in (1, -1):
    for rows, (y0, y1) in (
        ((head_unit[0][1], head_amber[0]), (head_unit_from, head_indicator_from + 0.3)),
        ((head_unit[0][1], head_amber[0]), (head_indicator_from - 0.3, 1000.0)),
        ((head_amber[1], head_unit[3][1]), (head_unit_from, 1000.0)),
    ):
        # the grille side of the unit is slanted in the front view: a prism along the car cuts it
        slant = (
            cq.Workplane("YZ", origin=(x_mm(70), 0, 0))
            .polyline([
                (sign * head_unit_from, z_mm(head_unit[0][1])), (sign * 1000.0, z_mm(head_unit[0][1])),
                (sign * 1000.0, z_mm(head_unit[3][1])), (sign * head_unit_slant, z_mm(head_unit[3][1])),
            ])
            .close()
            .extrude(x_mm(6) - x_mm(70))
        )
        chunk = nose.intersect(side_prism(unit_poly(*rows), y0, y1, sign)).intersect(slant).val().scale(head_lamp_scale)
        body = body.union(cq.Workplane("XY").add(chunk))

# The wheel wells, cut in from each flank, the body solid between them
for x in axles:
    inner = at(plan_half, x) * across - well_depth
    # one well, and its mirror image, so both flanks are cut identically
    well = cq.Workplane("XY").add(prism(x_mm(x), inner + big / 2, z_mm(hub), arch_r_px * along, big / 2, arch_sides))
    body = body.cut(well).cut(well.mirror("XZ"))

# The wheels, plain discs on their axles
tyre_r = tyre_r_px * along
flank = head_half[-1][1] * across
track = 2 * flank - tyre_w
wheels = None
for x in axles:
    for sign in (1, -1):
        cy = sign * track / 2
        disc = cq.Workplane("XY").add(prism(x_mm(x), cy, z_mm(hub), tyre_r, tyre_w / 2)).union(
            # the rim, standing a little proud of the tyre's wall
            cq.Workplane("XY").add(prism(x_mm(x), cy, z_mm(hub), rim_share * tyre_r, tyre_w / 2 + 4.0))
        )
        wheels = disc if wheels is None else wheels.union(disc)



def hatch_at(px, y):
    """The hatch's height at a column and half width - the same curve the rear's sections draw."""
    line_h, line_z = cut_at(px)
    return hatch_z(px, min(abs(y), line_h), line_h, max(line_z, z_mm(hatch_sill_row)))


def spoiler():
    """The ducktail: see the parameters."""
    ys = [spoiler_half * k / 8 for k in range(-8, 9)]
    rings = []
    for y in ys:
        # the whole profile slides forward towards the ends, along the window's curved lower edge
        bow = spoiler_bow * (y / spoiler_half) ** 2
        x0, x1, x2 = spoiler_base - bow, spoiler_rear - bow, spoiler_tip - bow
        h0, h1 = hatch_at(x0, y), hatch_at(x1, y)
        # a triangle in section, its top one flat, level plane: flush with the
        # hatch at the window's foot at its ends (sunk into it in the middle,
        # where the hatch bulges), straight up to the sharp tip; the underside
        # from the hatch up to that tip; the ends cut square
        front = hatch_at(spoiler_base - spoiler_bow, spoiler_half)
        tip = front + spoiler_rise * (spoiler_tip - spoiler_base) * up
        rings.append([
            cq.Vector(x_mm(x0), y, h0 - 40.0),
            cq.Vector(x_mm(x1), y, h1 - 40.0),
            cq.Vector(x_mm(x1), y, h1),
            cq.Vector(x_mm(x2), y, tip),
            cq.Vector(x_mm(x0), y, front),
        ])
    triangles = []
    n = len(rings[0])
    for a, b in zip(rings, rings[1:]):
        for i in range(n):
            j = (i + 1) % n
            triangles += [(a[i], a[j], b[j]), (a[i], b[j], b[i])]
    for ring, flip in ((rings[0], True), (rings[-1], False)):
        for i in range(1, n - 1):
            tri = (ring[0], ring[i], ring[i + 1])
            triangles.append(tri[::-1] if flip else tri)
    return polyhedron(triangles)


def mirrors():
    """The mirrors: one-piece wedge housings on the A-pillar's foot, as the photos show them."""
    (x0, x1), (r0, r1), out = mirror_along, mirror_rows, mirror_out
    inner = 700.0  # mm - well inside the glass, so the housing grows out of the pillar
    parts = None
    for sign in (1, -1):
        housing = (
            cq.Workplane("XY", origin=(0, 0, z_mm(r1)))
            .polyline([(x_mm(x0), sign * inner), (x_mm(x1 + 1.5), sign * inner), (x_mm(x1 + mirror_sweep), sign * out), (x_mm(x0 + 2 + mirror_sweep), sign * out)])
            .close()
            .extrude(z_mm(r0) - z_mm(r1))
        )
        parts = housing if parts is None else parts.union(housing)
    return parts


addons = spoiler()
assert addons.isValid(), "spoiler solid invalid"
result = body.union(addons).union(mirrors()).union(wheels)

# ============================================================
# EXPORT
# ============================================================
out = sys.argv[1] if len(sys.argv) > 1 else "saab.stl"
cq.exporters.export(result, out, tolerance=0.5, angularTolerance=0.1)

# The bumpers alone, so the faces on their surface can be told from the body's
cq.exporters.export(bumpers, out.replace(".stl", "_bumpers.stl"), tolerance=0.5, angularTolerance=0.1)

# Both flanks exactly alike: the kernel's own triangulation is lopsided
import trimesh  # noqa: E402
from saab_materials import symmetrize  # noqa: E402

symmetrize(trimesh.load(out)).export(out)
bb = result.val().BoundingBox()
print(f"Exported {out}: {bb.xlen:.0f} x {bb.ylen:.0f} x {bb.zlen:.0f} mm")
