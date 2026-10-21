"""Build the editable Kevin likeness study and runtime GLB with Blender 4.3+.
Run from repo root: blender -b --python scripts/build_kevin.py -- --render
Uses bundled CC0 anatomical derivative data; no network/download needed.
"""
import bpy, os, sys, math
from pathlib import Path
from mathutils import Vector
ROOT=str(Path(__file__).resolve().parents[1])
if '--rig' in sys.argv:
 import runpy
 runpy.run_path(ROOT+'/scripts/rig_kevin.py',run_name='__main__')
 raise SystemExit(0)
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
for material in list(bpy.data.materials):bpy.data.materials.remove(material)
# Facial topology stays separately editable beneath non-destructive subdivision.
exec(compile(open(ROOT+'/scripts/anatomy_core.py').read(),'anatomy_core.py','exec'))
# Short, substantial neck and realistic head-to-shoulder proportions.
for anatomy_object in list(bpy.context.scene.objects):
 if anatomy_object.type in {'MESH','CURVE'}:anatomy_object.location.z-=.043
print('HEAD_READY',flush=True)
# The body builder uses its own module scope, keeping anatomy shader helpers isolated.
import importlib.util
spec=importlib.util.spec_from_file_location('body_v2',ROOT+'/scripts/body_v2.py');body=importlib.util.module_from_spec(spec);spec.loader.exec_module(body);body.build_body()
print('BODY_READY',flush=True)
scene=bpy.context.scene
asset_objects=[o for o in scene.objects if o.type in {'MESH','CURVE'}]
COL=bpy.data.collections.new('KEVIN | editable anatomy and tailoring');scene.collection.children.link(COL)
root=bpy.data.objects.new('Kevin_OLeary_Study',None);COL.objects.link(root)
for obj in asset_objects:
 for c in list(obj.users_collection):c.objects.unlink(obj)
 COL.objects.link(obj);obj.parent=root
root['description']='Kevin OLeary likeness study; reference-guided CC0 anatomical derivative and authored tailoring, not a scan.'
root['version']='2.0';root['rig_status']='Unrigged relaxed standing pose; existing fictional cast unchanged.'
# Neutral photographic studio.
scene.render.engine='CYCLES';scene.cycles.samples=96;scene.cycles.use_denoising=False
scene.world.color=(.12,.12,.12)
def area(name,loc,energy,size,color,target=(0,-.02,1.2)):
 bpy.ops.object.light_add(type='AREA',location=loc);obj=bpy.context.object;obj.name=name;obj.data.energy=energy;obj.data.shape='DISK';obj.data.size=size;obj.data.color=color;obj.rotation_euler=(Vector(target)-obj.location).to_track_quat('-Z','Y').to_euler()
area('Large soft key',(-2,-3,3.5),300,2.1,(1,.93,.86));area('Soft fill',(2,-2,2.2),130,1.8,(.85,.9,1));area('Shoulder rim',(1,1,3),370,1.6,(.85,.92,1))
bpy.ops.mesh.primitive_plane_add(size=200);floor=bpy.context.object;floor.name='Studio floor (not exported)';fm=bpy.data.materials.new('Studio slate');fm.diffuse_color=(.035,.045,.055,1);fm.use_nodes=True;fm.node_tree.nodes.get('Principled BSDF').inputs['Base Color'].default_value=fm.diffuse_color;floor.data.materials.append(fm)
bpy.ops.object.camera_add();cam=bpy.context.object;cam.name='Review camera';scene.camera=cam
scene.render.resolution_x=1000;scene.render.resolution_y=1200;scene.render.resolution_percentage=100;scene.view_settings.view_transform='AgX';scene.render.image_settings.file_format='PNG'
def camera(loc,target,lens):
 cam.location=loc;cam.rotation_euler=(Vector(target)-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.lens=lens
# Runtime duplicates preserve source topology, named pieces and modifier stack.
EXPORT=bpy.data.collections.new('EXPORT_TEMP');scene.collection.children.link(EXPORT);bpy.ops.object.select_all(action='DESELECT');copies=[]
for obj in asset_objects:
 cp=obj.copy();cp.data=obj.data.copy();cp.parent=None;cp.matrix_world=obj.matrix_world.copy();EXPORT.objects.link(cp);cp.select_set(True);copies.append(cp)
 if obj.name.startswith(('Kevin |','Hand |')):
  for modifier in cp.modifiers:
   if modifier.type=='SUBSURF':modifier.levels=1;modifier.render_levels=1
print('EXPORT_DUPLICATES_READY',len(copies),flush=True)
bpy.context.view_layer.objects.active=copies[0];bpy.ops.object.convert(target='MESH')
print('EXPORT_CONVERTED',flush=True)
for obj in list(EXPORT.objects):
 if obj.name.startswith('Jacket |'):
  bpy.context.view_layer.objects.active=obj;reduction=obj.modifiers.new('Runtime jacket LOD','DECIMATE');reduction.ratio=.30;bpy.ops.object.modifier_apply(modifier=reduction.name)
# Join only compatible single-material pieces, preserving head vertex colors.
groups={}
for obj in list(EXPORT.objects):groups.setdefault(tuple(m.name for m in obj.data.materials),[]).append(obj)
for materials,objects in groups.items():
 bpy.ops.object.select_all(action='DESELECT')
 for obj in objects:obj.select_set(True)
 bpy.context.view_layer.objects.active=objects[0];bpy.ops.object.join();bpy.context.object.name=' + '.join(materials)
bpy.ops.object.select_all(action='DESELECT')
for obj in EXPORT.objects:obj.select_set(True)
bpy.ops.export_scene.gltf(filepath=ROOT+'/public/models/kevin/kevin.glb',use_selection=True,export_format='GLB',export_apply=True,export_yup=True,export_cameras=False,export_lights=False,export_extras=True)
for obj in list(EXPORT.objects):bpy.data.objects.remove(obj,do_unlink=True)
bpy.data.collections.remove(EXPORT)
camera((-2.5,-5.5,2.2),(0,0,.95),70)
bpy.ops.wm.save_as_mainfile(filepath=ROOT+'/assets/kevin/kevin.blend',compress=True)
if '--render' in sys.argv:
 camera((-.35,-1.2,1.78),(0,-.02,1.55),65);scene.render.filepath=ROOT+'/docs/kevin/portrait.png';bpy.ops.render.render(write_still=True)
 camera((-2.5,-5.5,2.2),(0,0,.95),70);scene.render.filepath=ROOT+'/docs/kevin/full-body.png';bpy.ops.render.render(write_still=True)
print('KEVIN_V2_BUILD_COMPLETE')
