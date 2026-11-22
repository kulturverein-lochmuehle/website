"""Bakes the Saab 900 as remodelled by hand in Blender, straight out of models/saab-900.blend - run by Blender
itself, from the package's folder:

    blender -b models/saab-900.blend --python scripts/cars/saab_blend_bake.py -- src/data/saab.baked.ts

Every mesh whose material slots are named below is taken, its modifiers applied (the body is modelled as one
half under a Mirror), hidden or not - the wheel stand-ins are hidden in the file. Faces are sorted by their
slot's name into the scene's materials; the palette lays the colours on. Blender's axes (nose to +y, up on z,
the right side on +x, meters) turn into the scene's (nose to +x, up on y, the right side on +z): a pure
rotation, so the winding stays. The middle goes to the origin, the tyres' lowest point to y = 0.

Nothing is reduced: the model is low poly as drawn.
"""

import base64
import json
import sys

import bpy
import numpy as np

# which of the scene's materials each of the file's slots takes; slots not named here are left out
KIND = {
    "body": "body",
    "windows": "glass",
    "trim": "trim",
    "plastic": "trim",
    "rubber": "trim",
    "bumper": "trim",
    "underbody": "trim",
    "chrome": "chrome",
    "lights-front": "head_light",
    "lights-side-front": "head_light_dim",
    "indicators": "indicator",
    "lights-rear": "tail_light",
    "lights-rear-unused": "tail_light_dim",
    "lights-reverse": "reverse",
    "tyre": "tyre",
    "hub": "hub",
}


def packed(a):
    return base64.b64encode(a.tobytes()).decode()


def main(out):
    depsgraph = bpy.context.evaluated_depsgraph_get()
    parts = {}
    for obj in bpy.data.objects:
        if obj.type != "MESH" or not any(s.material and s.material.name in KIND for s in obj.material_slots):
            continue
        evaluated = obj.evaluated_get(depsgraph)
        mesh = evaluated.to_mesh()
        mesh.calc_loop_triangles()
        m = np.array(obj.matrix_world)
        v = np.array([vert.co[:] for vert in mesh.vertices]) @ m[:3, :3].T + m[:3, 3]
        tris = np.array([t.vertices[:] for t in mesh.loop_triangles], dtype=np.int64).reshape(-1, 3)
        mats = np.array([t.material_index for t in mesh.loop_triangles], dtype=np.int64)
        slots = [s.material.name if s.material else None for s in obj.material_slots]
        for index, name in enumerate(slots):
            if name in KIND and (mats == index).any():
                parts.setdefault(KIND[name], []).append((v, tris[mats == index]))
        evaluated.to_mesh_clear()
        print(f"{obj.name}: {len(tris)} triangles")

    # Blender's (x right, y nose, z up) to the scene's (x nose, y up, z right)
    allv = np.concatenate([v[np.unique(f)] for ps in parts.values() for v, f in ps])
    yc = (allv[:, 1].min() + allv[:, 1].max()) / 2
    xc = (allv[:, 0].min() + allv[:, 0].max()) / 2
    ground = min(v[np.unique(f)][:, 2].min() for v, f in parts.get("tyre", [])) if "tyre" in parts else allv[:, 2].min()
    to_scene = lambda v: np.stack([v[:, 1] - yc, v[:, 2] - ground, v[:, 0] - xc], 1)

    baked, total = {}, 0
    for kind, ps in parts.items():
        verts, faces, off = [], [], 0
        for v, f in ps:
            verts.append(to_scene(v))
            faces.append(f + off)
            off += len(v)
        v, f = np.concatenate(verts), np.concatenate(faces)
        # weld what the pieces share and drop what the faces do not use
        key = np.round(v / 0.0005).astype(np.int64)
        _, first, inv = np.unique(key, axis=0, return_index=True, return_inverse=True)
        f = inv.reshape(-1)[f]
        f = f[(f[:, 0] != f[:, 1]) & (f[:, 1] != f[:, 2]) & (f[:, 0] != f[:, 2])]
        v = v[first]
        used = np.unique(f)
        remap = np.zeros(len(v), np.int64)
        remap[used] = np.arange(len(used))
        v, f = v[used], remap[f]
        if len(v) > 65535:
            raise SystemExit(f"{kind}: too many vertices")
        baked[kind] = (v, f)
        total += len(f)
        print(f"{kind:15s} {len(f):5d} faces")

    body = np.concatenate([v for k, (v, _) in baked.items() if k not in ("tyre", "hub")])
    lo, hi = body.min(0), body.max(0)
    spec = {"length": round(float(hi[0] - lo[0]), 4), "width": round(float(hi[2] - lo[2]), 4), "height": round(float(hi[1]), 4)}
    if "tyre" in baked:
        # the wheels' places, from the tyres: split front from rear and left from right at the middle
        tv, tf = baked["tyre"]
        mid = tv[tf].mean(1)
        boxes = []
        for front in (False, True):
            for right in (False, True):
                pts = tv[np.unique(tf[((mid[:, 0] > 0) == front) & ((mid[:, 2] > 0) == right)])]
                boxes.append((pts.min(0), pts.max(0)))
        centres = np.array([(a + b) / 2 for a, b in boxes])
        spec["axles"] = [round(float(centres[:2, 0].mean() - lo[0]), 4), round(float(centres[2:, 0].mean() - lo[0]), 4)]
        spec["tyre"] = round(float(np.mean([(b[1] - a[1]) / 2 for a, b in boxes])), 4)
        spec["track"] = round(float(np.mean(np.abs(centres[:, 2])) * 2), 4)
    print("SPEC", json.dumps(spec))

    chunks = [
        f"  {k}: {{\n    positions:\n      '{packed(v.astype(np.float32))}',\n    indices:\n      '{packed(f.astype(np.uint16).reshape(-1))}',\n  }},"
        for k, (v, f) in baked.items()
    ]
    text = (
        "// Generated by scripts/cars/saab_blend_bake.py - do not edit by hand.\n//\n"
        f"// The Saab 900, remodelled in Blender: {total} faces in {len(baked)} materials, as little endian float32\n"
        "// x, y, z in meters (nose to +x, middle at the origin, tyres on y = 0) and 16 bit indices.\n\n"
        "export const SAAB_BAKED = {\n" + "\n".join(chunks) + "\n} as const;\n\n"
        f"export const SAAB_SPEC = {json.dumps(spec)} as const;\n"
    )
    with open(out, "w", newline="\n") as fh:
        fh.write(text)
    print(f"{total} faces, {len(text) // 1024} KB")


if __name__ == "__main__":
    main(sys.argv[sys.argv.index("--") + 1])
