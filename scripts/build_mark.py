"""Build Mark anatomical study. Blender 4.3+: blender -b --python scripts/build_mark.py -- --render
Self-contained asset inputs; no network. Standing bind pose; Y-up +Z-forward GLB.
"""
import bpy,sys,math,json,os
from pathlib import Path
from mathutils import Vector,Matrix,Quaternion
ROOT=Path(__file__).resolve().parents[1];sys.path.insert(0,str(ROOT/'scripts'))
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
from mark_face import build_face
from mark_body import build_body
from mark_hair import build_hair
build_face();build_hair()
# Seat the mature head naturally into the collar, matching the body proportions.
for obj in list(bpy.context.scene.objects):
 if obj.type in {'MESH','CURVE'}:obj.location.z-=.035
build_body()
objects=[o for o in bpy.context.scene.objects if o.type in {'MESH','CURVE'}]
# Freeze authored tailoring into editable meshes; preserve facial shape keys.
for obj in objects:
 bpy.ops.object.select_all(action='DESELECT');obj.select_set(True);bpy.context.view_layer.objects.active=obj
 if obj.type=='CURVE':obj.data.bevel_resolution=1;bpy.ops.object.convert(target='MESH')
 if obj.data.shape_keys:
  for mod in obj.modifiers:
   if mod.type=='SUBSURF':mod.levels=1;mod.render_levels=2
 if not obj.data.shape_keys:
  for mod in list(obj.modifiers):
   if mod.type=='SUBSURF':mod.levels=min(mod.levels,1)
   bpy.ops.object.modifier_apply(modifier=mod.name)
 if not obj.data.shape_keys and len(obj.data.vertices)>8000:
  budget=12000 if 'scalp coverage' in obj.name else (6000 if obj.name.startswith('Hair') else (18000 if obj.name.startswith('Jacket |') else 7500))
  dec=obj.modifiers.new('Runtime topology budget','DECIMATE');dec.ratio=min(1,budget/len(obj.data.vertices));bpy.ops.object.modifier_apply(modifier=dec.name)
 bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
head=next(o for o in objects if o.data.shape_keys)
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
bpy.ops.object.select_all(action='DESELECT');data=bpy.data.armatures.new('Mark 18 bone skeleton');rig=bpy.data.objects.new('MarkRig',data);bpy.context.collection.objects.link(rig);rig.select_set(True);bpy.context.view_layer.objects.active=rig;bpy.ops.object.mode_set(mode='EDIT')
for n,(a,b,parent) in bones.items():
 bone=data.edit_bones.new(n);bone.head=a;bone.tail=b;bone.align_roll(Vector((0,-1,0)))
 if parent:bone.parent=data.edit_bones[parent]
bpy.ops.object.mode_set(mode='OBJECT')
for p in rig.pose.bones:p.rotation_mode='QUATERNION'
rig.show_in_front=True;rig['units']='metres';rig['forward']='Blender -Y; glTF +Z';rig['left_side']='+X';rig['likeness']='Reference-guided anatomical study, not a scan or endorsement.'
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
 if name.startswith(('Mark Eye','Mark Iris','Mark Pupil','Mark Brow','Mark Teeth','Mark Hair','Hair')):return {'head':1}
 if 'anatomical face' in name.lower():return blend('neck','head',smooth(1.485,1.535,z))
 if name.startswith('Mark '):return {'head':1}
 if name.startswith(('Hand |','Watch |')):return {'hand.'+side:1}
 if name.startswith(('Loafer','Oxford','Stacked heel')):return {'foot.'+side:1}
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
report={'maximum_influences':0,'weighted_vertices':0,'stable_chest_vertices':0,'bones':list(bones)}
for obj in objects:
 obj.vertex_groups.clear();groups={n:obj.vertex_groups.new(name=n) for n in bones}
 for v in obj.data.vertices:
  w={k:v for k,v in weight(obj.name,v.co).items() if v>1e-7};total=sum(w.values());assert total>0
  report['maximum_influences']=max(report['maximum_influences'],len(w));report['weighted_vertices']+=1
  if obj.name.startswith('Jacket |') and abs(v.co.x)<.12 and v.co.z>1.1:
   assert not any(k.startswith(('upperarm','forearm','hand')) for k in w);report['stable_chest_vertices']+=1
  for k,val in w.items():groups[k].add([v.index],val/total,'REPLACE')
 mod=obj.modifiers.new('Mark skin','ARMATURE');mod.object=rig;obj.parent=rig
assert report['maximum_influences']<=4
assert report['stable_chest_vertices']>100
rig['face_usage']='Use the four face morphs with jaw neutral; do not double-apply mouthOpen and jaw.'
# Merge compatible static pieces for bounded draw calls. Do not merge facial morph topology.
groups={}
for obj in objects:
 if obj.data.shape_keys:continue
 groups.setdefault(tuple(m.name for m in obj.data.materials),[]).append(obj)
for materials,pieces in groups.items():
 if len(pieces)<2:continue
 bpy.ops.object.select_all(action='DESELECT')
 for o in pieces:o.select_set(True)
 bpy.context.view_layer.objects.active=pieces[0];bpy.ops.object.join();bpy.context.object.name='Mark | '+' + '.join(materials)
objects=[o for o in rig.children if o.type=='MESH']
scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=48;scene.cycles.use_denoising=False;scene.world.color=(.035,.044,.054);scene.view_settings.view_transform='AgX'
def mat(name,col):
 m=bpy.data.materials.new(name);m.use_nodes=True;m.node_tree.nodes.get('Principled BSDF').inputs['Base Color'].default_value=(*col,1);return m
def area(name,loc,energy,size,color):
 bpy.ops.object.light_add(type='AREA',location=loc);o=bpy.context.object;o.name=name;o.data.energy=energy;o.data.shape='DISK';o.data.size=size;o.data.color=color;o.rotation_euler=(Vector((0,0,1.3))-o.location).to_track_quat('-Z','Y').to_euler()
area('Studio warm key',(-2,-3,3),260,2,(1,.94,.88));area('Studio fill',(2,-2,2),180,2,(.90,.94,1));area('Hair rim',(1,1,3),280,1.6,(1,.94,.84))
bpy.ops.mesh.primitive_plane_add(size=200);floor=bpy.context.object;floor.name='QA floor';floor.data.materials.append(mat('Backdrop',(.035,.044,.054)))
bpy.ops.mesh.primitive_plane_add(size=200,location=(0,2,2),rotation=(math.pi/2,0,0));wall=bpy.context.object;wall.name='QA seamless backdrop';wall.data.materials.append(floor.data.materials[0])
bpy.ops.object.camera_add();cam=bpy.context.object;scene.camera=cam
scene.render.resolution_x=900;scene.render.resolution_y=1100;scene.render.resolution_percentage=100;scene.render.image_settings.file_format='PNG'
def camera(loc,target,lens=70):cam.location=loc;cam.rotation_euler=(Vector(target)-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.lens=lens
camera((-.18,-1.25,1.70),(0,-.02,1.60),65)
bpy.ops.object.select_all(action='DESELECT');rig.select_set(True)
for o in objects:o.select_set(True)
bpy.context.view_layer.objects.active=rig
bpy.ops.export_scene.gltf(filepath=str(ROOT/'public/models/mark/mark-rigged.glb'),use_selection=True,export_format='GLB',export_yup=True,export_skins=True,export_morph=True,export_morph_normal=False,export_morph_tangent=False,export_animations=False,export_apply=False,export_cameras=False,export_lights=False,export_extras=True)
report['glb_bytes']=(ROOT/'public/models/mark/mark-rigged.glb').stat().st_size;assert report['glb_bytes']<12_000_000
(ROOT/'docs/mark/rig-validation.json').write_text(json.dumps(report,indent=2));bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'assets/mark/mark.blend'),compress=True)
if '--render' in sys.argv:
 scene.render.filepath=str(ROOT/'docs/mark/portrait.png');bpy.ops.render.render(write_still=True)
 camera((-.9,-3.7,1.8),(0,0,.90),65);scene.render.filepath=str(ROOT/'docs/mark/standing.png');bpy.ops.render.render(write_still=True)
 if '--render' in sys.argv:
  camera((-.18,-.70,2.10),(0,.005,1.76),65);scene.render.resolution_x=900;scene.render.resolution_y=900;scene.render.filepath=str(ROOT/'docs/mark/crown.png');bpy.ops.render.render(write_still=True)
# Seated QA uses actual skeleton, not baked sculpt.
def direction(n,pos,vec):
 rest=rig.data.bones[n].matrix_local.to_3x3();q=rest.col[1].normalized().rotation_difference(Vector(vec).normalized());rig.pose.bones[n].matrix=Matrix.Translation(Vector(pos))@(q.to_matrix()@rest).to_4x4();bpy.context.view_layer.update()
rig.pose.bones['pelvis'].matrix=Matrix.Translation((0,0,-.42))@rig.data.bones['pelvis'].matrix_local;bpy.context.view_layer.update()
for side in ['L','R']:
 t=rig.pose.bones['thigh.'+side];direction(t.name,t.head,(0,-1,0));s=rig.pose.bones['shin.'+side];direction(s.name,t.tail,(0,0,-1));f=rig.pose.bones['foot.'+side];direction(f.name,s.tail,rig.data.bones[f.name].matrix_local.to_3x3().col[1]);fore=rig.pose.bones['forearm.'+side];direction(fore.name,fore.head,(0,-1,0));hand=rig.pose.bones['hand.'+side];direction(hand.name,fore.tail,(0,-1,0));assert abs(math.degrees((t.tail-t.head).angle(s.tail-s.head))-90)<.01
chairmat=mat('QA ivory upholstery',(.40,.36,.30));wood=mat('QA walnut',(.025,.015,.008))
def box(name,loc,scale,m):
 bpy.ops.mesh.primitive_cube_add(size=1,location=loc);o=bpy.context.object;o.name=name;o.scale=scale;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);o.data.materials.append(m);b=o.modifiers.new('Soft edges','BEVEL');b.width=.025;b.segments=4
box('QA seat',(0,.025,.43),(.74,.62,.12),chairmat);box('QA back',(0,.28,.77),(.74,.12,.61),chairmat)
for s in [-1,1]:
 box('QA armrest',(s*.310,-.01,.62),(.13,.58,.10),chairmat)
 for y in [-.18,.23]:box('QA chair leg',(s*.27,y,.20),(.05,.05,.40),wood)
camera((-1.05,-2.95,1.50),(0,-.03,.69),65)
if '--render' in sys.argv:scene.render.filepath=str(ROOT/'docs/mark/seated.png');bpy.ops.render.render(write_still=True)
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'assets/mark/mark-seated-validation.blend'),compress=True)
print('MARK_BUILD_COMPLETE',report,flush=True)
