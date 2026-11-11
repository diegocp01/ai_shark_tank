"""Bake the authored facial subdivision into every expression before GLB export.

glTF does not retain Blender's subdivision modifier. Evaluating only Basis would
also destroy expression topology, so every shape is sampled on the same cage.
"""
import bpy


def bake_face_subdivision(head):
    sub = next((m for m in head.modifiers if m.type == 'SUBSURF'), None)
    if sub is None:
        return
    sub.levels = 1
    keys = head.data.shape_keys.key_blocks
    names = [k.name for k in keys][1:]
    for key in keys:
        key.value = 0
    # Sampling a rest mesh must not bake an armature pose into the facial cage.
    armatures = [m for m in head.modifiers if m.type == 'ARMATURE']
    visibility = [(m, m.show_viewport) for m in armatures]
    for m, _ in visibility:
        m.show_viewport = False
    bpy.context.view_layer.update()
    deps = bpy.context.evaluated_depsgraph_get()
    base = bpy.data.meshes.new_from_object(head.evaluated_get(deps), preserve_all_data_layers=True, depsgraph=deps)
    shapes = {}
    for name in names:
        keys[name].value = 1
        bpy.context.view_layer.update()
        evaluated = head.evaluated_get(deps)
        mesh = evaluated.to_mesh()
        shapes[name] = [tuple(v.co) for v in mesh.vertices]
        assert len(shapes[name]) == len(base.vertices)
        evaluated.to_mesh_clear()
        keys[name].value = 0
    head.modifiers.remove(sub)
    head.data = base
    head.shape_key_add(name='Basis', from_mix=False)
    for name, coords in shapes.items():
        key = head.shape_key_add(name=name, from_mix=False)
        key.value = 0
        for vertex, point in zip(key.data, coords):
            vertex.co = point
    for m, visible in visibility:
        m.show_viewport = visible
    bpy.context.view_layer.update()
    head['runtime_subdivision_baked'] = 1
