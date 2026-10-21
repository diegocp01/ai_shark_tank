"""Build Barbara anatomical study. Blender 5.2+: blender -b --python scripts/build_barbara.py -- --render
Self-contained asset inputs; no network. Standing bind pose; Y-up +Z-forward GLB.
"""
import bpy,sys,math,json
from pathlib import Path
from mathutils import Vector,Matrix
ROOT=Path(__file__).resolve().parents[1];sys.path.insert(0,str(ROOT/'scripts'))
for folder in ['assets/barbara','public/models/barbara','docs/barbara']:(ROOT/folder).mkdir(parents=True,exist_ok=True)
# Build in a dedicated new scene; preserve any scene already open in the MCP session.
scene=bpy.data.scenes.new('Barbara Character Study');bpy.context.window.scene=scene
scene.world=bpy.data.worlds.new('Barbara studio world')
from barbara_character import build_face, build_body, build_hair
build_face();build_body();build_hair()
objects=[o for o in bpy.context.scene.objects if o.type in {'MESH','CURVE'}]
# Neutralize every facial piece, including the independently keyed lower teeth.
for obj in objects:
 if obj.type=='MESH' and obj.data.shape_keys:
  for key in obj.data.shape_keys.key_blocks:key.value=0
# Freeze authored tailoring into editable meshes; preserve facial shape keys.
for obj in objects:
 bpy.ops.object.select_all(action='DESELECT');obj.select_set(True);bpy.context.view_layer.objects.active=obj
 if obj.type=='CURVE':obj.data.bevel_resolution=1;bpy.ops.object.convert(target='MESH')
 if not obj.data.shape_keys:
  for mod in list(obj.modifiers):
   if mod.type=='SUBSURF':mod.levels=min(mod.levels,1)
   bpy.ops.object.modifier_apply(modifier=mod.name)
 if not obj.data.shape_keys and len(obj.data.vertices)>3000:
  budget=3000 if obj.name.startswith('Pump |') else (18000 if obj.name.startswith('Dress | Barbara wrap') else 9000)
  dec=obj.modifiers.new('Runtime topology budget','DECIMATE');dec.ratio=min(1,budget/len(obj.data.vertices));bpy.ops.object.modifier_apply(modifier=dec.name)
 bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
# Bake one facial subdivision consistently for Basis and all expressions so the
# shipped GLB retains the sculpt's eyelids, lips, pigment and smooth silhouette.
head=next(o for o in objects if 'anatomical face' in o.name)
sub=next(m for m in head.modifiers if m.type=='SUBSURF');sub.levels=1
keys=head.data.shape_keys.key_blocks;names=[k.name for k in keys][1:]
for k in keys:k.value=0
bpy.context.view_layer.update();deps=bpy.context.evaluated_depsgraph_get()
base=bpy.data.meshes.new_from_object(head.evaluated_get(deps),preserve_all_data_layers=True,depsgraph=deps)
shapes={}
for name in names:
 keys[name].value=1;bpy.context.view_layer.update()
 evaluated=head.evaluated_get(deps);mesh=evaluated.to_mesh()
 shapes[name]=[tuple(v.co) for v in mesh.vertices];evaluated.to_mesh_clear();keys[name].value=0
head.modifiers.remove(sub);head.data=base
head.shape_key_add(name='Basis',from_mix=False).value=0
for name,coords in shapes.items():
 k=head.shape_key_add(name=name,from_mix=False);k.value=0
 for v,p in zip(k.data,coords):v.co=p
bones={'pelvis':((0,.02,.89),(0,.02,.99),None),'spine':((0,.02,.99),(0,.015,1.18),'pelvis'),'chest':((0,.015,1.18),(0,-.012,1.36),'spine'),'neck':((0,-.012,1.36),(0,-.012,1.46),'chest'),'head':((0,-.012,1.46),(0,-.012,1.69),'neck'),'jaw':((0,-.04,1.55),(0,-.10,1.49),'head')}
for s,side in [(1,'L'),(-1,'R')]:
 bones.update({f'upperarm.{side}':((s*.175,.02,1.36),(s*.235,-.002,1.09),'chest'),f'forearm.{side}':((s*.235,-.002,1.09),(s*.245,-.04,.89),f'upperarm.{side}'),f'hand.{side}':((s*.245,-.04,.89),(s*.245,-.058,.77),f'forearm.{side}'),f'thigh.{side}':((s*.085,.02,.90),(s*.085,-.002,.49),'pelvis'),f'shin.{side}':((s*.085,-.002,.49),(s*.085,.01,.10),f'thigh.{side}'),f'foot.{side}':((s*.085,.01,.10),(s*.085,-.12,.04),f'shin.{side}')})
bpy.ops.object.select_all(action='DESELECT');data=bpy.data.armatures.new('Barbara 18 bone skeleton');rig=bpy.data.objects.new('BarbaraRig',data);bpy.context.collection.objects.link(rig);rig.select_set(True);bpy.context.view_layer.objects.active=rig;bpy.ops.object.mode_set(mode='EDIT')
for n,(a,b,parent) in bones.items():
 bone=data.edit_bones.new(n);bone.head=a;bone.tail=b;bone.align_roll(Vector((0,-1,0)))
 if parent:bone.parent=data.edit_bones[parent]
bpy.ops.object.mode_set(mode='OBJECT')
for p in rig.pose.bones:p.rotation_mode='QUATERNION'
rig.show_in_front=True;rig['units']='metres';rig['forward']='Blender -Y; glTF +Z';rig['left_side']='+X';rig['likeness']='Reference-guided anatomical study, not a scan or endorsement.'
def sm(a,b,x):
 t=max(0,min(1,(x-a)/(b-a)));return t*t*(3-2*t)
def mix(a,b,t):return {a:1-t,b:t}
def torso(x,y,z):
 if z<.99:return mix('pelvis','spine',sm(.90,1.01,z))
 return mix('spine','chest',sm(1.08,1.25,z))
def arm(side,z):
 if z<.94:return mix('hand.'+side,'forearm.'+side,sm(.88,.93,z))
 return mix('forearm.'+side,'upperarm.'+side,sm(1.04,1.14,z))
def weight(o,p):
 x,y,z=p;side='L' if x>=0 else 'R';n=o.name.lower()
 if o==head:return mix('neck','head',sm(1.42,1.49,z))
 if n.startswith('hair'):
  # Cropped hair follows the head rigidly.
  return {'head':1}
 if any(s in n for s in ['eye','iris','pupil','brow','lash','lip','teeth','tongue']):return {'head':1}
 if 'earring' in n:return {'head':1}
 if 'necklace' in n:return {'chest':1}
 if 'bracelet' in n:return {'forearm.L':1}
 if n.startswith('skirt'):
  t=sm(.88,1.025,z);left=sm(-.075,.075,x)
  return {'pelvis':t,'thigh.L':(1-t)*left,'thigh.R':(1-t)*(1-left)}
 if n.startswith('leg |'):
  return mix('shin.'+side,'thigh.'+side,sm(.44,.54,z))
 if 'hand' in n:return {'hand.'+side:1}
 if any(s in n for s in ['pump','heel','sole','shoe']):return {'foot.'+side:1}
 if n.startswith('sleeve |'):return arm(side,z)
 if z<1.39 and abs(x)>.17:
  t=sm(.17,.215,abs(x))*(1-sm(1.32,1.40,z));w={k:v*(1-t) for k,v in torso(x,y,z).items()}
  for k,v in arm(side,z).items():w[k]=w.get(k,0)+v*t
  return w
 if z>1.36:return mix('chest','neck',sm(1.36,1.44,z))
 return torso(x,y,z)
report={'maximum_influences':0,'weighted_vertices':0,'stable_chest_vertices':0,'bones':list(bones)}
for obj in objects:
 obj.vertex_groups.clear();groups={n:obj.vertex_groups.new(name=n) for n in bones}
 for v in obj.data.vertices:
  w={k:v for k,v in weight(obj,v.co).items() if v>1e-7};total=sum(w.values());assert total>0
  report['maximum_influences']=max(report['maximum_influences'],len(w));report['weighted_vertices']+=1
  if obj.name.startswith('Dress | Barbara wrap') and abs(v.co.x)<.12 and v.co.z>1.1:
   assert not any(k.startswith(('upperarm','forearm','hand')) for k in w);report['stable_chest_vertices']+=1
  for k,val in w.items():groups[k].add([v.index],val/total,'REPLACE')
 mod=obj.modifiers.new('Barbara skin','ARMATURE');mod.object=rig;obj.parent=rig
assert report['maximum_influences']<=4
assert report['stable_chest_vertices']>100
# Merge compatible static pieces for bounded draw calls. Do not merge facial morph topology.
groups={}
for obj in objects:
 if obj.data.shape_keys:continue
 groups.setdefault(tuple(m.name for m in obj.data.materials),[]).append(obj)
for materials,pieces in groups.items():
 if len(pieces)<2:continue
 bpy.ops.object.select_all(action='DESELECT')
 for o in pieces:o.select_set(True)
 bpy.context.view_layer.objects.active=pieces[0];bpy.ops.object.join();bpy.context.object.name='Barbara | '+' + '.join(materials)
objects=[o for o in rig.children if o.type=='MESH']
scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=48;scene.cycles.use_denoising=True;scene.world.color=(.035,.044,.054);scene.view_settings.view_transform='AgX';scene.view_settings.look='AgX - Medium High Contrast';scene.view_settings.exposure=-.25
def mat(name,col):
 m=bpy.data.materials.new(name);m.use_nodes=True;m.node_tree.nodes.get('Principled BSDF').inputs['Base Color'].default_value=(*col,1);return m
def area(name,loc,energy,size,color):
 bpy.ops.object.light_add(type='AREA',location=loc);o=bpy.context.object;o.name=name;o.data.energy=energy;o.data.shape='DISK';o.data.size=size;o.data.color=color;o.rotation_euler=(Vector((0,0,1.3))-o.location).to_track_quat('-Z','Y').to_euler()
area('Studio warm key',(-2,-3,3),260,2,(1,.94,.88));area('Studio fill',(2,-2,2),180,2,(.90,.94,1));area('Hair rim',(1,1,3),280,1.6,(1,.94,.84))
bpy.ops.mesh.primitive_plane_add(size=200);floor=bpy.context.object;floor.name='QA floor';floor.data.materials.append(mat('Backdrop',(.035,.044,.054)))
bpy.ops.mesh.primitive_plane_add(size=200,location=(0,2,2),rotation=(math.pi/2,0,0));wall=bpy.context.object;wall.name='QA seamless backdrop';wall.data.materials.append(floor.data.materials[0])
bpy.ops.object.camera_add();cam=bpy.context.object;scene.camera=cam
scene.render.resolution_x=1000;scene.render.resolution_y=1100;scene.render.resolution_percentage=100;scene.render.image_settings.file_format='PNG'
def camera(loc,target,lens=70):cam.location=loc;cam.rotation_euler=(Vector(target)-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.lens=lens
camera((-.13,-1.20,1.66),(0,-.025,1.52),65)
bpy.ops.object.select_all(action='DESELECT');rig.select_set(True)
for o in objects:o.select_set(True)
bpy.context.view_layer.objects.active=rig
bpy.ops.export_scene.gltf(filepath=str(ROOT/'public/models/barbara/barbara-rigged.glb'),use_selection=True,export_format='GLB',export_yup=True,use_active_scene=True,export_skins=True,export_morph=True,export_morph_normal=False,export_morph_tangent=False,export_animations=False,export_apply=False,export_cameras=False,export_lights=False,export_extras=True)
report['glb_bytes']=(ROOT/'public/models/barbara/barbara-rigged.glb').stat().st_size;assert report['glb_bytes']<12_000_000
(ROOT/'docs/barbara/rig-validation.json').write_text(json.dumps(report,indent=2));bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'assets/barbara/barbara.blend'),compress=True)
if '--render' in sys.argv:
 scene.render.filepath=str(ROOT/'docs/barbara/portrait.png');bpy.ops.render.render(write_still=True)
 camera((-.9,-3.4,1.8),(0,0,.90),65);scene.render.filepath=str(ROOT/'docs/barbara/standing.png');bpy.ops.render.render(write_still=True)
# Seated QA uses actual skeleton, not baked sculpt.
def direction(n,pos,vec):
 rest=rig.data.bones[n].matrix_local.to_3x3();q=rest.col[1].normalized().rotation_difference(Vector(vec).normalized());rig.pose.bones[n].matrix=Matrix.Translation(Vector(pos))@(q.to_matrix()@rest).to_4x4();bpy.context.view_layer.update()
rig.pose.bones['pelvis'].matrix=Matrix.Translation((0,0,-.39))@rig.data.bones['pelvis'].matrix_local;bpy.context.view_layer.update()
for side in ['L','R']:
 t=rig.pose.bones['thigh.'+side];direction(t.name,t.head,(0,-1,0));s=rig.pose.bones['shin.'+side];direction(s.name,t.tail,(0,0,-1));f=rig.pose.bones['foot.'+side];direction(f.name,s.tail,rig.data.bones[f.name].matrix_local.to_3x3().col[1]);fore=rig.pose.bones['forearm.'+side];direction(fore.name,fore.head,(0,-1,0));hand=rig.pose.bones['hand.'+side];direction(hand.name,fore.tail,(0,-1,0));assert abs(math.degrees((t.tail-t.head).angle(s.tail-s.head))-90)<.01
chairmat=mat('QA oxblood upholstery',(.075,.018,.011));wood=mat('QA walnut',(.025,.015,.008))
def box(name,loc,scale,m):
 bpy.ops.mesh.primitive_cube_add(size=1,location=loc);o=bpy.context.object;o.name=name;o.scale=scale;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);o.data.materials.append(m);b=o.modifiers.new('Soft edges','BEVEL');b.width=.025;b.segments=4
box('QA seat',(0,.025,.43),(.65,.58,.12),chairmat);box('QA back',(0,.28,.77),(.65,.12,.61),chairmat)
for s in [-1,1]:
 box('QA armrest',(s*.285,-.01,.62),(.13,.58,.10),chairmat)
 for y in [-.18,.23]:box('QA chair leg',(s*.27,y,.20),(.05,.05,.40),wood)
camera((-1.05,-2.95,1.50),(0,-.03,.69),65)
if '--render' in sys.argv:scene.render.filepath=str(ROOT/'docs/barbara/seated.png');bpy.ops.render.render(write_still=True)
# Keep the standing editable source as the sole shipped blend; seated review is rendered.

print('BARBARA_BUILD_COMPLETE',report,flush=True)
