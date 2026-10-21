"""Re-import the shipped GLB and validate runtime joint/morph contract in Blender."""
import bpy,json,sys,math
from pathlib import Path
from mathutils import Vector,Matrix,Quaternion
ROOT=Path(__file__).resolve().parents[1]
bpy.ops.wm.open_mainfile(filepath=str(ROOT/'assets/lori/lori.blend'))
rig=bpy.data.objects['LoriRig']
for obj in list(rig.children):bpy.data.objects.remove(obj,do_unlink=True)
bpy.data.objects.remove(rig,do_unlink=True)
bpy.ops.import_scene.gltf(filepath=str(ROOT/'public/models/lori/lori-rigged.glb'))
rig=next(o for o in bpy.context.scene.objects if o.type=='ARMATURE');assert len(rig.data.bones)==18
keys=set()
for o in rig.children:
 if o.type=='MESH' and o.data.shape_keys:keys.update(o.data.shape_keys.key_blocks.keys())
assert keys=={'Basis','mouthOpen','blink','smile','frown'}
# Exercise actual exported rig rather than trusting authoring-object names.
bpy.context.view_layer.update();p=rig.pose.bones['head'];rest=p.matrix.copy();p.matrix=Matrix.Translation(rest.translation)@Quaternion((0,0,1),math.radians(30)).to_matrix().to_4x4()@rest.to_3x3().to_4x4();bpy.context.view_layer.update()
assert abs((p.tail-p.head).length-rig.data.bones['head'].length)<1e-5
p.matrix=rest;bpy.context.view_layer.update()
report={'reimported_glb':True,'bones':len(rig.data.bones),'morphs':sorted(keys-{'Basis'}),'head_turn_degrees_tested':30,'rig_children':len(rig.children)}
(ROOT/'docs/lori/runtime-validation.json').write_text(json.dumps(report,indent=2))
if '--render' in sys.argv:
 s=bpy.context.scene;s.cycles.samples=80;s.render.filepath=str(ROOT/'docs/lori/runtime-portrait.png');bpy.ops.render.render(write_still=True)
print('LORI_RUNTIME_VERIFIED',report,flush=True)
