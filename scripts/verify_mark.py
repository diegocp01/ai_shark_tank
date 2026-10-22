"""Re-import Mark's shipped GLB and numerically exercise the runtime contract.
Run: blender -b --python scripts/verify_mark.py [-- --render]
"""
import bpy, json, sys, math
from pathlib import Path
from mathutils import Matrix, Quaternion
ROOT = Path(__file__).resolve().parents[1]
PARENTS = {'pelvis': None, 'spine': 'pelvis', 'chest': 'spine', 'neck': 'chest', 'head': 'neck', 'jaw': 'head'}
KEYS = {'mouthOpen', 'blink', 'smile', 'frown'}
for side in ['L', 'R']:
    PARENTS.update({f'upperarm.{side}': 'chest', f'forearm.{side}': f'upperarm.{side}', f'hand.{side}': f'forearm.{side}', f'thigh.{side}': 'pelvis', f'shin.{side}': f'thigh.{side}', f'foot.{side}': f'shin.{side}'})
path = ROOT/'public/models/mark/mark-rigged.glb'
assert path.stat().st_size < 12_000_000
bpy.ops.wm.open_mainfile(filepath=str(ROOT/'assets/mark/mark.blend'))
source_rig = bpy.data.objects['MarkRig']
for obj in list(source_rig.children):
    bpy.data.objects.remove(obj, do_unlink=True)
bpy.data.objects.remove(source_rig, do_unlink=True)
bpy.ops.import_scene.gltf(filepath=str(path))
rig = next(o for o in bpy.context.scene.objects if o.type == 'ARMATURE')
bpy.context.view_layer.update()
assert set(rig.data.bones.keys()) == set(PARENTS)
for name, parent in PARENTS.items():
    bone = rig.data.bones[name]
    assert (bone.parent.name if bone.parent else None) == parent
    assert bone.use_deform
    assert all(abs(a-b) < 1e-4 for rowa, rowb in zip(rig.pose.bones[name].matrix, bone.matrix_local) for a, b in zip(rowa, rowb)), name+' not in rest pose'
faces = [o for o in rig.children if o.type == 'MESH' and o.data.shape_keys and KEYS <= set(o.data.shape_keys.key_blocks.keys())]
assert faces
face = next(o for o in faces if 'anatomical face' in o.name.lower())
keys = face.data.shape_keys.key_blocks
assert set(keys.keys()) == KEYS | {'Basis'}
morphs = {}
for name in sorted(KEYS):
    key = keys[name]
    assert key.value == 0
    distances = [(a.co-b.co).length for a,b in zip(key.data, keys['Basis'].data)]
    assert all(math.isfinite(v) for v in distances)
    affected = sum(v > 1e-7 for v in distances)
    assert affected > 10 and 1e-4 < max(distances) < .15
    key.value = 1
    bpy.context.view_layer.update()
    assert all(abs(v-(1 if i == j else 0)) < 1e-5 for i,row in enumerate(rig.pose.bones['jaw'].matrix_basis) for j,v in enumerate(row)), 'morph must not rotate jaw'
    key.value = 0
    morphs[name] = {'affected_vertices': affected, 'maximum_displacement_m': max(distances)}
# Pose the actual imported hierarchy, preserving segment lengths, then restore.
bpy.context.view_layer.update()
p = rig.pose.bones['head']
rest = p.matrix.copy()
p.matrix = Matrix.Translation(rest.translation) @ Quaternion((0,0,1), math.radians(30)).to_matrix().to_4x4() @ rest.to_3x3().to_4x4()
bpy.context.view_layer.update()
assert abs((p.tail-p.head).length-rig.data.bones['head'].length) < 1e-5
p.matrix = rest
bpy.context.view_layer.update()
report = {'reimported_glb': True, 'bytes': path.stat().st_size, 'bones': len(rig.data.bones), 'morphs': morphs, 'neutral_jaw': True, 'head_turn_degrees_tested': 30, 'rig_children': len(rig.children)}
(ROOT/'docs/mark/runtime-validation.json').write_text(json.dumps(report, indent=2)+'\n')
if '--render' in sys.argv:
    scene = bpy.context.scene
    scene.render.engine = 'CYCLES'
    scene.cycles.samples = 80
    scene.render.filepath = str(ROOT/'docs/mark/runtime-portrait.png')
    bpy.ops.render.render(write_still=True)
print('MARK_RUNTIME_VERIFIED', report, flush=True)
# Optional runtime expression proof; zero every control again after each frame.
if '--render-morphs' in sys.argv:
    scene=bpy.context.scene
    scene.render.engine='CYCLES';scene.cycles.samples=32
    scene.render.resolution_x=700;scene.render.resolution_y=800
    for name in ['mouthOpen','blink']:
        for obj in faces:
            obj.data.shape_keys.key_blocks[name].value=1
        bpy.context.view_layer.update()
        scene.render.filepath=str(ROOT/'docs/mark'/('runtime-'+name+'.png'))
        bpy.ops.render.render(write_still=True)
        for obj in faces:
            obj.data.shape_keys.key_blocks[name].value=0
