"""
Fewer triangles for the classified Saab: flat neighbours of one material are
merged into one polygon, its collinear corners dropped, and the polygon cut
into triangles again. The long thin triangles the CAD kernel leaves between
the body's rings, and the slivers the material cuts add, collapse this way.

    reduce_mesh(mesh, ids) -> (mesh, ids)
"""

from collections import defaultdict

import numpy as np
import trimesh

FLAT_DEG = 0.6  # neighbours within this angle count as one plane
STRAIGHT_DEG = 0.8  # a corner turning less than this is dropped
PLANE_MM = 0.8  # and the plane may not wander further than this


def _components(mesh, ids):
    """Faces of one material, connected over flat edges: lists of face indices."""
    adj = mesh.face_adjacency
    ang = mesh.face_adjacency_angles
    ok = (ang < np.radians(FLAT_DEG)) & (ids[adj[:, 0]] == ids[adj[:, 1]])
    parent = np.arange(len(mesh.faces))

    def find(a):
        while parent[a] != a:
            parent[a] = parent[parent[a]]
            a = parent[a]
        return a

    for a, b in adj[ok]:
        ra, rb = find(a), find(b)
        if ra != rb:
            parent[ra] = rb
    groups = defaultdict(list)
    for f in range(len(mesh.faces)):
        groups[find(f)].append(f)
    return list(groups.values())


def _boundary_loops(faces):
    """The boundary of a patch as ordered vertex loops, or None if it does not close into simple loops."""
    count = defaultdict(int)
    for f in faces:
        for i in range(3):
            a, b = f[i], f[(i + 1) % 3]
            count[(a, b)] += 1
    nxt = {}
    for (a, b), c in count.items():
        if (b, a) in count and count[(b, a)] > 0:
            continue
        if a in nxt:
            return None  # a corner touching itself
        nxt[a] = b
    loops, seen = [], set()
    for start in nxt:
        if start in seen:
            continue
        loop, cur = [], start
        while cur not in seen:
            seen.add(cur)
            loop.append(cur)
            cur = nxt.get(cur)
            if cur is None:
                return None
        if cur != start:
            return None
        loops.append(loop)
    return loops


def _ear_clip(points, normal):
    """Triangles (index triples into points) of a simple polygon in 3D, by clipping ears."""
    n = len(points)
    if n < 3:
        return []
    helper = np.array([1.0, 0, 0]) if abs(normal[0]) < 0.9 else np.array([0, 1.0, 0])
    u = np.cross(normal, helper)
    u /= np.linalg.norm(u)
    w = np.cross(normal, u)
    p2 = np.stack([points @ u, points @ w], axis=1)
    order = list(range(n))
    tris = []

    def turn(a, b, c):
        return (p2[b][0] - p2[a][0]) * (p2[c][1] - p2[a][1]) - (p2[b][1] - p2[a][1]) * (p2[c][0] - p2[a][0])

    def inside(p, a, b, c):
        return turn(a, b, p) >= -1e-9 and turn(b, c, p) >= -1e-9 and turn(c, a, p) >= -1e-9

    guard = 0
    while len(order) > 3 and guard < 10 * n * n:
        guard += 1
        for k in range(len(order)):
            i, j, l = order[k - 1], order[k], order[(k + 1) % len(order)]
            if turn(i, j, l) <= 1e-9:
                continue
            if any(inside(o, i, j, l) for o in order if o not in (i, j, l)):
                continue
            tris.append((i, j, l))
            del order[k]
            break
        else:
            return None
    tris.append(tuple(order))
    return tris


def reduce_mesh(mesh, ids):
    verts = mesh.vertices
    faces = mesh.faces
    out_faces, out_ids = [], []
    kept = np.zeros(len(faces), bool)
    for comp in _components(mesh, ids):
        if len(comp) < 3:
            continue
        loops = _boundary_loops(faces[comp])
        if loops is None or len(loops) != 1:
            continue
        loop = loops[0]
        pts = verts[loop]
        nrm = mesh.face_normals[comp].mean(axis=0)
        nrm /= np.linalg.norm(nrm) or 1
        # the patch must be flat to within PLANE_MM
        if np.abs((pts - pts[0]) @ nrm).max() > PLANE_MM:
            continue
        # drop collinear corners
        keep = []
        for i in range(len(loop)):
            a, b, c = pts[i - 1], pts[i], pts[(i + 1) % len(loop)]
            e1, e2 = b - a, c - b
            cosang = np.dot(e1, e2) / ((np.linalg.norm(e1) * np.linalg.norm(e2)) or 1)
            if np.degrees(np.arccos(np.clip(cosang, -1, 1))) > STRAIGHT_DEG:
                keep.append(i)
        if len(keep) < 3:
            continue
        poly = pts[keep]
        tris = _ear_clip(poly, nrm)
        if tris is None or len(tris) >= len(comp):
            continue
        # the new triangles must cover what the patch covered
        area_new = sum(0.5 * np.linalg.norm(np.cross(poly[b] - poly[a], poly[c] - poly[a])) for a, b, c in tris)
        area_old = mesh.area_faces[comp].sum()
        if abs(area_new - area_old) > 0.01 * area_old + 1.0:
            continue
        idx = [loop[k] for k in keep]
        for a, b, c in tris:
            out_faces.append((idx[a], idx[b], idx[c]))
            out_ids.append(ids[comp[0]])
        kept[comp] = True
    rest = np.where(~kept)[0]
    all_faces = np.concatenate([faces[rest], np.array(out_faces, dtype=faces.dtype).reshape(-1, 3)])
    all_ids = np.concatenate([ids[rest], np.array(out_ids, dtype=ids.dtype)])
    new = trimesh.Trimesh(vertices=verts, faces=all_faces, process=False)
    # no zero-area or repeated-corner triangles
    good = (new.area_faces > 1e-4) & (all_faces[:, 0] != all_faces[:, 1]) & (all_faces[:, 1] != all_faces[:, 2]) & (all_faces[:, 0] != all_faces[:, 2])
    new = trimesh.Trimesh(vertices=verts, faces=all_faces[good], process=False)
    new.remove_unreferenced_vertices()
    return new, all_ids[good]
