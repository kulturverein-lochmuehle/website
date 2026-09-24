"""Bakes the 1986 BMW E30 low poly (KrStolorz, Sketchfab) for the scene.

The model is already clean - separate doors, hood and trunk, real glass - so nothing is reduced here. What
changes: the modern ("New") variant only; its interior, steering wheel, emblems, plates and wheels left out
(the scene puts on its own wheels); its textures dropped for flat materials the palette colours; and the
axes turned to the scene's (nose to +x, up on y, the car's side on z, meters, middle at the origin, tyres
on y = 0).

    python e30_bake.py <scene.gltf> <out.ts>
"""

import base64
import json
import re
import sys

import pyfqmr
import numpy as np
import trimesh

# the most faces each material keeps
BUDGET = {"body": 3600, "trim": 3600, "glass": 700}

# which of our materials each of the model's takes; the rest is left out
KIND = {
    "Paint": "body",
    # the model's "Body" is what is not paint: bumpers, sills, arch linings, window frames, mirrors, grille
    "Body": "trim",
    "Glass": "glass",
    "Rubber": "trim",
    "Black_plastic": "trim",
    "Lights_white": "head_light",
    "Lights_red": "tail_light",
    "Lights_orange": "indicator",
}
# parts of the tree that are not the car's outside
SKIP = re.compile(r"Interior|Steering|Emblem|Reg Plate|Wheel|2025_0|Old")


def cut(v, f, at, sign):
    """Triangles crossing the plane x = at are split along it, so a lamp's lit band ends on a straight line."""
    verts = [tuple(p) for p in v]
    out = []
    for tri in f:
        d = [(v[i][0] - at) * sign for i in tri]
        if all(x >= -1e-9 for x in d) or all(x <= 1e-9 for x in d):
            out.append(tuple(tri))
            continue
        # one corner alone on its side: cut off a small triangle and a quad
        for k in range(3):
            a, b, c = tri[k], tri[(k + 1) % 3], tri[(k + 2) % 3]
            da, db, dc = d[k], d[(k + 1) % 3], d[(k + 2) % 3]
            if (da > 0) != (db > 0) and (da > 0) != (dc > 0):
                def on(i, j, di, dj):
                    t = di / (di - dj)
                    verts.append(tuple(v[i] + (v[j] - v[i]) * t))
                    return len(verts) - 1
                p, q = on(a, b, da, db), on(a, c, da, dc)
                out += [(a, p, q), (p, b, c), (p, c, q)]
                break
    return np.array(verts), np.array(out, dtype=np.int64)


def packed(a):
    return base64.b64encode(a.tobytes()).decode()


def main(src, out):
    sc = trimesh.load(src, force="scene")
    g = sc.graph
    parts = {}
    for node in g.nodes_geometry:
        T, geo = g[node]
        path, n = [], node
        while n is not None and n != g.base_frame:
            path.append(n)
            n = g.transforms.parents.get(n)
        names = " / ".join(reversed(path))
        mesh = sc.geometry[geo]
        mat = getattr(mesh.visual, "material", None)
        mname = getattr(mat, "name", None)
        if "New" not in names or SKIP.search(names) or mname not in KIND:
            continue
        v = np.asarray(mesh.vertices) @ T[:3, :3].T + T[:3, 3]
        f = np.asarray(mesh.faces)
        if mname == "Lights_white":
            # the model's z runs along the car, nose at +z: the white at the nose's low corners are the
            # indicators in the bumper, the white at the tail the reversing lamps - red here, as the Saab's
            mid = v[f].mean(1)
            front = mid[:, 2] > 0
            low = mid[:, 1] < 0.52
            for kind, pick in (("indicator", front & low), ("head_light", front & ~low), ("tail_light", ~front)):
                if pick.any():
                    parts.setdefault(kind, []).append((v, f[pick]))
            continue
        if mname == "Paint":
            # the paint strips set into the bumpers are the bumpers': dark, as the Saab's are
            mid = v[f].mean(1)
            bumper = (np.abs(mid[:, 2] - 0.0) > 1.6) & (mid[:, 1] < 0.6) & (np.abs(mid[:, 2]) > 0)
            if bumper.any():
                parts.setdefault("trim", []).append((v, f[bumper]))
            parts.setdefault("body", []).append((v, f[~bumper]))
            continue
        parts.setdefault(KIND[mname], []).append((v, f))

    # the model's axes: x across, y up, z along with the nose at +z
    allv = np.concatenate([v for ps in parts.values() for v, _ in ps])
    xc = (allv[:, 0].min() + allv[:, 0].max()) / 2
    zc = (allv[:, 2].min() + allv[:, 2].max()) / 2
    # only some of the lamps shine at night: the headlamps' outer pair, and the tail lamps' band next to the
    # indicators. The rest stay as dark glass, in the same colour
    for kind, limit in (("head_light", 0.5), ("tail_light", 0.527)):
        lit, dim = [], []
        for v, f in parts.get(kind, []):
            for sign in (-1, 1):
                v, f = cut(v, f, xc + sign * limit, sign)
            across = np.abs(v[f].mean(1)[:, 0] - xc)
            lit.append((v, f[across > limit - 1e-6]))
            dim.append((v, f[across <= limit - 1e-6]))
        parts[kind] = lit
        parts[kind + "_dim"] = dim
    to_scene = lambda v: np.stack([v[:, 2] - zc, v[:, 1], -(v[:, 0] - xc)], 1)

    baked, total = {}, 0
    for kind, ps in parts.items():
        verts, faces, off = [], [], 0
        for v, f in ps:
            verts.append(to_scene(v))
            faces.append(f + off)
            off += len(v)
        v, f = np.concatenate(verts), np.concatenate(faces)
        # weld what the pieces share, so a seam has one vertex
        key = np.round(v / 0.001).astype(np.int64)
        _, first, inv = np.unique(key, axis=0, return_index=True, return_inverse=True)
        f = inv.reshape(-1)[f]
        f = f[(f[:, 0] != f[:, 1]) & (f[:, 1] != f[:, 2]) & (f[:, 0] != f[:, 2])]
        v = v[first]
        used = np.unique(f)
        remap = np.zeros(len(v), np.int64)
        remap[used] = np.arange(len(used))
        v, f = v[used], remap[f]
        if kind in BUDGET and len(f) > BUDGET[kind]:
            # reduced with its open border held fixed: the paint, the trim and the glass meet along edges that
            # have to stay where they are, or the seams between them open
            q = pyfqmr.Simplify()
            q.setMesh(v, f.astype(np.int32))
            q.simplify_mesh(target_count=BUDGET[kind], aggressiveness=5.5, preserve_border=True, verbose=False)
            v, f, _ = q.getMesh()
            v, f = v.astype(np.float64), f.astype(np.int64)
        if len(v) > 65535:
            raise SystemExit(f"{kind}: too many vertices")
        baked[kind] = (v, f)
        total += len(f)
        print(f"{kind:11s} {len(f):5d} faces")

    allp = np.concatenate([v for v, _ in baked.values()])
    lo, hi = allp.min(0), allp.max(0)
    # the wheels' places, from the model's own: the tyres' extents of the four wheel nodes
    wheels = []
    for node in g.nodes_geometry:
        T, geo = g[node]
        names = node
        n, path = node, []
        while n is not None and n != g.base_frame:
            path.append(n)
            n = g.transforms.parents.get(n)
        full = " / ".join(reversed(path))
        mesh = sc.geometry[geo]
        if "New" in full and getattr(getattr(mesh.visual, "material", None), "name", None) == "Wheel":
            v = to_scene(np.asarray(mesh.vertices) @ T[:3, :3].T + T[:3, 3])
            wheels.append((v.min(0), v.max(0)))
    axles = sorted({round(float((a[0] + b[0]) / 2), 3) for a, b in wheels})
    radius = float(np.mean([(b[1] - a[1]) / 2 for a, b in wheels]))
    track = float(np.mean([abs((a[2] + b[2]) / 2) for a, b in wheels]) * 2)
    heads = baked["head_light"][0]
    spec = {
        "length": round(float(hi[0] - lo[0]), 3),
        "width": round(float(hi[2] - lo[2]), 3),
        "height": round(float(hi[1]), 3),
        "axles": [round(axles[0] - float(lo[0]), 3), round(axles[-1] - float(lo[0]), 3)],
        "tyre": round(radius, 3),
        "tyreWidth": 0.2,
        "track": round(track, 3),
        "lamps": {"nose": round(float(hi[0]) - 0.1, 3), "apart": round(float(np.median(np.abs(heads[heads[:, 0] > 1.0, 2]))), 3)},
        "paint": "#a8211c",
    }
    print(json.dumps(spec), "ground", round(float(lo[1]), 3))
    chunks = [
        f"  {k}: {{\n    positions:\n      '{packed(v.astype(np.float32))}',\n    indices:\n      '{packed(f.astype(np.uint16).reshape(-1))}',\n  }},"
        for k, (v, f) in baked.items()
    ]
    text = (
        "// Generated by scripts/cars/e30_bake.py - do not edit by hand.\n//\n"
        f"// The 1986 BMW E30: {total} faces in {len(baked)} materials, as little endian float32 x, y, z in meters\n"
        "// (nose to +x, middle at the origin, tyres on y = 0) and 16 bit indices. No wheels: the scene puts on its own.\n"
        "// Model: 1986 BMW E30 (FL, LP) by KrStolorz, sketchfab.com/3d-models/1986-bmw-e30-fl-lp-e453bdae0ee1423ea79f1322db1c7459\n"
        "// (Sketchfab Standard licence: see CREDITS.md before showing it publicly).\n\n"
        "export const E30_BAKED = {\n" + "\n".join(chunks) + "\n} as const;\n\n"
        f"export const E30_SPEC = {json.dumps(spec)} as const;\n"
    )
    open(out, "w").write(text)
    print(f"{total} faces, {len(text) // 1024} KB")


if __name__ == "__main__":
    main(*sys.argv[1:])
