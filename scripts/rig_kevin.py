"""Create Kevin's 18-bone skin and facial morphs without modifying kevin.glb.
Blender: blender -b --python scripts/rig_kevin.py -- --render
Rest: metres, Blender Z up / -Y forward. glTF: Y up / +Z forward, .L = +X.
"""
import bpy, math, os, sys, json, hashlib, importlib.util
from pathlib import Path
from mathutils import Vector, Matrix, Quaternion
ROOT=Path(__file__).resolve().parents[1]
ORIGINAL=ROOT/'public/models/kevin/kevin.glb'
original_hash=hashlib.sha256(ORIGINAL.read_bytes()).hexdigest()
bpy.ops.wm.open_mainfile(filepath=str(ROOT/'assets/kevin/kevin.blend'))
source_root=bpy.data.objects['Kevin_OLeary_Study']
objects=[o for o in source_root.children if o.type in {'MESH','CURVE'}]
# Bake the same standing figure into a bounded runtime mesh before adding keys/skin.
for obj in objects:
 if obj.type=='CURVE':obj.data.bevel_resolution=0
 for modifier in obj.modifiers:
  if modifier.type=='SUBSURF':modifier.levels=1;modifier.render_levels=1
 bpy.ops.object.select_all(action='DESELECT');obj.select_set(True);bpy.context.view_layer.objects.active=obj
 world=obj.matrix_world.copy();obj.parent=None;obj.matrix_world=world
 bpy.ops.object.convert(target='MESH')
 bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
 if obj.name.startswith('Jacket |'):
  modifier=obj.modifiers.new('Skinning LOD','DECIMATE');modifier.ratio=.16;bpy.ops.object.modifier_apply(modifier=modifier.name)
 elif obj.name.startswith(('Oxford shoe','Oxford sole','Trousers | draped')):
  modifier=obj.modifiers.new('Skinning LOD','DECIMATE');modifier.ratio=.55;bpy.ops.object.modifier_apply(modifier=modifier.name)
 obj.vertex_groups.clear()
head=next(o for o in objects if o.name.startswith('Kevin |'))
morph_path=ROOT/'scripts/kevin_face_morphs.py'
if morph_path.exists():
 spec=importlib.util.spec_from_file_location('kevin_face_morphs',str(morph_path));morphs=importlib.util.module_from_spec(spec);spec.loader.exec_module(morphs);morph_report=morphs.add_face_morphs(head)
 (ROOT/'docs/kevin/rig-morph-validation.json').write_text(json.dumps(morph_report,indent=2))
 assert set(head.data.shape_keys.key_blocks.keys())=={'Basis','mouthOpen','blink','smile','frown'}
else:raise RuntimeError('Missing self-contained face morph helper')
# Explicit rest landmarks. All joints have local +Y along head-to-tail.
bones={
 'pelvis':((0,.025,.94),(0,.025,1.04),None),
 'spine':((0,.025,1.04),(0,.020,1.22),'pelvis'),
 'chest':((0,.020,1.22),(0,-.020,1.43),'spine'),
 'neck':((0,-.020,1.43),(0,-.025,1.50),'chest'),
 'head':((0,-.025,1.50),(0,-.025,1.72),'neck'),
 'jaw':((0,-.045,1.585),(0,-.135,1.525),'head'),
}
for s,side in [(1,'L'),(-1,'R')]:
 bones.update({f'upperarm.{side}':((s*.205,.020,1.39),(s*.273,-.002,1.105),'chest'),f'forearm.{side}':((s*.273,-.002,1.105),(s*.282,-.048,.895),f'upperarm.{side}'),f'hand.{side}':((s*.282,-.048,.895),(s*.282,-.066,.78),f'forearm.{side}'),f'thigh.{side}':((s*.095,.025,.96),(s*.097,-.002,.54),'pelvis'),f'shin.{side}':((s*.097,-.002,.54),(s*.095,.010,.14),f'thigh.{side}'),f'foot.{side}':((s*.095,.010,.14),(s*.095,-.13,.055),f'shin.{side}')})
bpy.ops.object.select_all(action='DESELECT');data=bpy.data.armatures.new('Kevin exact 18-bone rig');rig=bpy.data.objects.new('KevinRig',data);bpy.context.scene.collection.objects.link(rig);rig.select_set(True);bpy.context.view_layer.objects.active=rig;bpy.ops.object.mode_set(mode='EDIT')
for name,(a,b,parent) in bones.items():
 bone=data.edit_bones.new(name);bone.head=a;bone.tail=b;bone.align_roll(Vector((0,-1,0)))
 if parent:bone.parent=data.edit_bones[parent]
 bone.use_deform=True
bpy.ops.object.mode_set(mode='OBJECT');rig.show_in_front=True
for p in rig.pose.bones:p.rotation_mode='QUATERNION'
rig['units']='metres';rig['forward']='Blender -Y; glTF +Z';rig['left_side']='+X';rig['bone_contract']='exactly 18 deform bones; pelvis sole root'
def smooth(a,b,x):
 t=max(0,min(1,(x-a)/(b-a)));return t*t*(3-2*t)
def blend(a,b,t):return {a:1-t,b:t}
def torso_weights(x,y,z,hem=True):
 if hem and z<1.07 and y<.06:
  follow=(1-smooth(.895,1.065,z))*(1-smooth(.005,.065,y))
  if follow>0:return {'pelvis':1-follow,'thigh.L' if x>=0 else 'thigh.R':follow}
 if z<1.09:return blend('pelvis','spine',smooth(1.00,1.09,z))
 return blend('spine','chest',smooth(1.13,1.30,z))
def arm_weights(side,z):
 if z<.94:return blend('hand.'+side,'forearm.'+side,smooth(.895,.945,z))
 return blend('forearm.'+side,'upperarm.'+side,smooth(1.055,1.155,z))
def weight(name,p):
 x,y,z=p;side='L' if x>=0 else 'R'
 if name.startswith(('helper-','Iris','Pupil','Brow','Temple','Fine forehead')):return {'head':1}
 if name.startswith('Kevin |'):
  neck=1-smooth(1.485,1.535,z)
  jaw=(1-smooth(1.55,1.59,z))*smooth(-.055,-.10,y)*(1-smooth(.05,.075,abs(x)))*(1-neck)
  return {'neck':neck,'jaw':jaw*.85,'head':1-neck-jaw*.85}
 if name.startswith(('Hand |','Watch |')):return {'hand.'+side:1}
 if name.startswith(('Oxford','Stacked heel')):return {'foot.'+side:1}
 if name.startswith('Trousers'):
  if z<.64:return blend('shin.'+side,'thigh.'+side,smooth(.485,.595,z))
  return blend('thigh.'+side,'pelvis',smooth(.94,1.04,z))
 if name.startswith(('Shirt cuff','Sleeve kissing')):return arm_weights(side,z)
 if name.startswith('Jacket |'):
  # Restrict sleeve influence to the arm-side shell. The chest/front stays stable.
  threshold=.193 if z<1.32 else .185
  sleeve=smooth(threshold,threshold+.045,abs(x))*smooth(.86,.96,z)
  if z>1.38:sleeve*=1-smooth(1.38,1.46,z)
  result={k:v*(1-sleeve) for k,v in torso_weights(x,y,z).items()}
  for k,v in arm_weights(side,z).items():result[k]=result.get(k,0)+v*sleeve
  return result
 return torso_weights(x,y,z,hem=name.startswith(('Jacket','Horn button')))
# Normalized local weights, max four influences. No automatic heat leakage into chest.
for obj in objects:
 groups={n:obj.vertex_groups.new(name=n) for n in bones}
 for vertex in obj.data.vertices:
  weights={k:max(0,v) for k,v in weight(obj.name,vertex.co).items() if v>1e-7};total=sum(weights.values())
  assert total>0
  for k,v in weights.items():groups[k].add([vertex.index],v/total,'REPLACE')
 modifier=obj.modifiers.new('Kevin skin','ARMATURE');modifier.object=rig;modifier.use_deform_preserve_volume=False
 obj.parent=rig
# Contract checks on localized garment and rigid facial-feature weights.
weight_report={'rigid_head_vertices':0,'sleeve_vertices':0,'stable_chest_vertices':0,'front_hem_vertices':0,'maximum_influences':0}
for obj in objects:
 names={g.index:g.name for g in obj.vertex_groups}
 for vertex in obj.data.vertices:
  w={names[g.group]:g.weight for g in vertex.groups if g.weight>1e-7};x,y,z=vertex.co
  weight_report['maximum_influences']=max(weight_report['maximum_influences'],len(w))
  assert abs(sum(w.values())-1)<1e-5
  if obj.name.startswith(('helper-','Iris','Pupil','Brow','Temple','Fine forehead')):
   assert w=={'head':1};weight_report['rigid_head_vertices']+=1
  if obj.name.startswith('Jacket |'):
   arm=sum(v for k,v in w.items() if k.startswith(('upperarm.','forearm.','hand.')))
   if abs(x)<.15 and z>1.10 and y<0:assert arm==0;weight_report['stable_chest_vertices']+=1
   if abs(x)>.25 and .97<z<1.20:assert arm>.999;weight_report['sleeve_vertices']+=1
   if z<.90 and y<-.04:assert sum(v for k,v in w.items() if k.startswith('thigh.'))>.99;weight_report['front_hem_vertices']+=1
assert weight_report['maximum_influences']<=4
(ROOT/'docs/kevin/rig-weight-validation.json').write_text(json.dumps(weight_report,indent=2))
# Join compatible non-morph pieces to contain draw calls; groups/weights survive joins.
by_material={}
for obj in objects:
 if obj==head:continue
 by_material.setdefault(tuple(m.name for m in obj.data.materials),[]).append(obj)
for materials,pieces in by_material.items():
 if len(pieces)<2:continue
 bpy.ops.object.select_all(action='DESELECT')
 for obj in pieces:obj.select_set(True)
 bpy.context.view_layer.objects.active=pieces[0];bpy.ops.object.join();bpy.context.object.name='Kevin skin | '+' + '.join(materials)
objects=[o for o in rig.children if o.type=='MESH']
# Save the reusable source in standing rest pose, with shape keys and armature.
bpy.data.objects.remove(source_root,do_unlink=True)
rig['original_glb_sha256']=original_hash
rig['face_usage']='Shape keys are independent controls with neutral jaw bone; avoid double-applying jaw bone rotation and mouthOpen.'
# Rest orientation note is machine-readable as well as documented.
orient={n:{'parent':b.parent.name if b.parent else None,'head_blender':list(b.head_local),'tail_blender':list(b.tail_local),'matrix_local':[list(row) for row in b.matrix_local]} for n,b in rig.data.bones.items()}
(ROOT/'docs/kevin/rig-rest-orientations.json').write_text(json.dumps(orient,indent=2))
bpy.ops.object.select_all(action='DESELECT');rig.select_set(True)
for obj in objects:obj.select_set(True)
bpy.context.view_layer.objects.active=rig
bpy.ops.export_scene.gltf(filepath=str(ROOT/'public/models/kevin/kevin-rigged.glb'),use_selection=True,export_format='GLB',export_yup=True,export_skins=True,export_morph=True,export_morph_normal=False,export_morph_tangent=False,export_animations=False,export_apply=False,export_cameras=False,export_lights=False,export_extras=True)
assert hashlib.sha256(ORIGINAL.read_bytes()).hexdigest()==original_hash,'Original GLB changed!'
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'assets/kevin/kevin-rigged.blend'),compress=True)
print('KEVIN_RIG_SAVED',len(rig.data.bones),os.path.getsize(ROOT/'public/models/kevin/kevin-rigged.glb'),flush=True)
# Deterministic seated validation pose, not baked into the exported bind/rest pose.
def set_world_direction(name,head_position,direction):
 bone=rig.data.bones[name];rest=bone.matrix_local.to_3x3();q=rest.col[1].normalized().rotation_difference(Vector(direction).normalized());rot=q.to_matrix()@rest
 rig.pose.bones[name].matrix=Matrix.Translation(Vector(head_position))@rot.to_4x4();bpy.context.view_layer.update()
def seated_pose():
 rig.pose.bones['pelvis'].location=(0,0,0)
 # Pelvis local axis is vertical, so use the armature-space pose matrix.
 rig.pose.bones['pelvis'].matrix=Matrix.Translation((0,0,-.42))@rig.data.bones['pelvis'].matrix_local;bpy.context.view_layer.update()
 for side in ['L','R']:
  thigh=rig.pose.bones['thigh.'+side];start=thigh.head.copy();set_world_direction(thigh.name,start,(0,-1,0))
  shin=rig.pose.bones['shin.'+side];start=rig.pose.bones[thigh.name].tail.copy();set_world_direction(shin.name,start,(0,0,-1))
  foot=rig.pose.bones['foot.'+side];start=rig.pose.bones[shin.name].tail.copy();set_world_direction(foot.name,start,rig.data.bones[foot.name].matrix_local.to_3x3().col[1])
  fore=rig.pose.bones['forearm.'+side];start=fore.head.copy();set_world_direction(fore.name,start,(0,-1,0))
  hand=rig.pose.bones['hand.'+side];start=rig.pose.bones[fore.name].tail.copy();set_world_direction(hand.name,start,(0,-1,0))
 head_bone=rig.pose.bones['head'];matrix=head_bone.matrix.copy();head_bone.matrix=Matrix.Translation(matrix.translation)@Quaternion((0,0,1),math.radians(30)).to_matrix().to_4x4()@matrix.to_3x3().to_4x4();bpy.context.view_layer.update()
 for bone in rig.pose.bones:
  bone.keyframe_insert(data_path='location',frame=1);bone.keyframe_insert(data_path='rotation_quaternion',frame=1);bone.keyframe_insert(data_path='scale',frame=1)
 if rig.animation_data and rig.animation_data.action:rig.animation_data.action.name='QA_Seated_Armchair_NotExported'
seated_pose()
# Assert requested pose geometry in armature space, not just a plausible camera view.
pose_report={}
for side in ['L','R']:
 t=rig.pose.bones['thigh.'+side];s=rig.pose.bones['shin.'+side];f=rig.pose.bones['forearm.'+side]
 angle=math.degrees((t.tail-t.head).angle(s.tail-s.head));print('POSE_ANGLE',side,angle,tuple(t.head),tuple(t.tail),tuple(s.head),tuple(s.tail),flush=True);assert abs(angle-90)<.01
 assert abs(t.tail.z-t.head.z)<1e-5 and abs(f.tail.z-f.head.z)<1e-5
 pose_report[side]={'knee_degrees':angle,'thigh_head':list(t.head),'thigh_tail':list(t.tail),'forearm_head':list(f.head),'forearm_tail':list(f.tail)}
head_delta=rig.pose.bones['head'].matrix.to_3x3()@rig.data.bones['head'].matrix_local.to_3x3().inverted()
head_angle=math.degrees(math.atan2(head_delta[1][0],head_delta[0][0]));assert abs(head_angle-30)<.01
pose_report['head_turn_degrees']=head_angle
(ROOT/'docs/kevin/rig-seated-validation.json').write_text(json.dumps(pose_report,indent=2))
if '--render' in sys.argv:
 def material(name,c):
  m=bpy.data.materials.new(name);m.use_nodes=True;m.node_tree.nodes.get('Principled BSDF').inputs['Base Color'].default_value=(*c,1);m.node_tree.nodes.get('Principled BSDF').inputs['Roughness'].default_value=.65;return m
 upholstery=material('QA chair ivory leather',(.35,.32,.27));wood=material('QA chair dark wood',(.025,.018,.014))
 def box(name,loc,size,mat):
  bpy.ops.mesh.primitive_cube_add(size=1,location=loc);o=bpy.context.object;o.name=name;o.scale=size;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);o.data.materials.append(mat);b=o.modifiers.new('Upholstery edge','BEVEL');b.width=.025;b.segments=5
  for p in o.data.polygons:p.use_smooth=True
 box('QA armchair seat',(0,.03,.43),(.74,.62,.12),upholstery)
 box('QA armchair back',(0,.30,.79),(.74,.13,.64),upholstery)
 for side in [-1,1]:
  box('QA armrest',(side*.310,-.015,.59),(.16,.62,.10),upholstery)
  for y in [-.18,.24]:box('QA chair leg',(side*.29,y,.205),(.065,.065,.41),wood)
 scene=bpy.context.scene;scene.cycles.samples=80;scene.cycles.use_denoising=False;scene.render.resolution_x=1200;scene.render.resolution_y=1200
 camera=scene.camera;camera.location=(-2.0,-3.5,1.95);camera.rotation_euler=(Vector((0,-.09,.72))-camera.location).to_track_quat('-Z','Y').to_euler();camera.data.lens=70
 scene.render.filepath=str(ROOT/'docs/kevin/seated-rig.png');bpy.ops.render.render(write_still=True)
 bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'assets/kevin/kevin-seated-validation.blend'),compress=True)
print('KEVIN_RIG_VALIDATED',flush=True)
