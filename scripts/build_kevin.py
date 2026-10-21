"""Deterministic, editable Kevin-inspired study. Blender 4.3+, no external assets.
Run: blender -b --python scripts/build_kevin.py -- --render
Model uses metres, Z up, faces -Y. glTF exports Y up, faces +Z.
"""
import bpy, math, os, sys, json
from mathutils import Vector
from math import sin,cos,pi,exp,sqrt
ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)
for d in bpy.data.materials: bpy.data.materials.remove(d)
COL=bpy.data.collections.new('KEVIN | editable asset'); bpy.context.scene.collection.children.link(COL)
def put(o):
 for c in list(o.users_collection): c.objects.unlink(o)
 COL.objects.link(o);return o

def mat(name,c,rough=.5,metal=0,skin=False):
 m=bpy.data.materials.new(name);m.diffuse_color=(*c,1);m.use_nodes=True;p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(*c,1);p.inputs['Roughness'].default_value=rough;p.inputs['Metallic'].default_value=metal
 if skin:
  p.inputs['Subsurface Weight'].default_value=.075;p.inputs['Subsurface Radius'].default_value=(1,.45,.25)
  n=m.node_tree.nodes.new('ShaderNodeTexNoise');n.inputs['Scale'].default_value=185;n.inputs['Detail'].default_value=2
  b=m.node_tree.nodes.new('ShaderNodeBump');b.inputs['Strength'].default_value=.13;b.inputs['Distance'].default_value=.00035;m.node_tree.links.new(n.outputs['Fac'],b.inputs['Height']);m.node_tree.links.new(b.outputs['Normal'],p.inputs['Normal'])
 return m
skin=mat('Skin | warm natural satin',(.34,.19,.12),.49,skin=True)
shade=mat('Skin | crease tint',(.30,.16,.105),.66)
lip=mat('Lips | muted rose',(.37,.19,.145),.55)
suit=mat('Wool | midnight charcoal',(.021,.026,.029),.78)
lapel=mat('Wool | lapel satin',(.027,.032,.034),.65)
shirt=mat('Cotton | warm white',(.78,.79,.74),.74)
tie=mat('Silk | black',(.012,.014,.017),.34)
red=mat('Pocket square | oxblood red',(.48,.015,.028),.5)
hair=mat('Hair | salt and pepper',(.115,.105,.095),.8)
white=mat('Eyes | ivory sclera',(.73,.72,.66),.3)
iris=mat('Eyes | hazel brown',(.12,.075,.038),.35)
pupil=mat('Eyes | pupil',(.006,.007,.006),.2)
glint=mat('Eyes | catchlight',(.95,.97,1),.12)
shoe=mat('Leather | black polished',(.014,.018,.021),.28)
sole=mat('Sole | charcoal',(.008,.009,.01),.85)
metal=mat('Watch | brushed steel',(.32,.34,.36),.27,.8)

def mesh(name,vs,fs,m):
 d=bpy.data.meshes.new(name);d.from_pydata(vs,[],fs);d.update();o=bpy.data.objects.new(name,d);COL.objects.link(o);o.data.materials.append(m)
 for p in d.polygons:p.use_smooth=True
 return o

def uv(name,loc,sc,m,seg=48,rings=32):
 bpy.ops.mesh.primitive_uv_sphere_add(segments=seg,ring_count=rings,location=loc);o=put(bpy.context.object);o.name=name;o.scale=sc;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);o.data.materials.append(m)
 for p in o.data.polygons:p.use_smooth=True
 return o

def curve(name,pts,r,m):
 d=bpy.data.curves.new(name,'CURVE');d.dimensions='3D';d.resolution_u=2;d.bevel_depth=r;d.bevel_resolution=3;s=d.splines.new('POLY');s.points.add(len(pts)-1)
 for p,v in zip(s.points,pts):p.co=(*v,1)
 o=bpy.data.objects.new(name,d);COL.objects.link(o);o.data.materials.append(m);return o

def tube(name,a,b,r1,r2,m):
 a,b=Vector(a),Vector(b);bpy.ops.mesh.primitive_cone_add(vertices=32,radius1=r1,radius2=r2,depth=(b-a).length,location=(a+b)/2);o=put(bpy.context.object);o.name=name;o.rotation_euler=(b-a).to_track_quat('Z','Y').to_euler();o.data.materials.append(m)
 for p in o.data.polygons:p.use_smooth=True
 bevel=o.modifiers.new('Soft garment edge','BEVEL');bevel.width=.009;bevel.segments=3
 return o

def patch(name,pts,m,thick=.001):
 o=mesh(name,pts,[tuple(range(len(pts)))],m);s=o.modifiers.new('Fabric thickness','SOLIDIFY');s.thickness=thick;b=o.modifiers.new('Soft cut edge','BEVEL');b.width=.0018;b.segments=3;return o

def ringshape(name,rings,m,n=64):
 vs=[];fs=[]
 for z,w,depth,cy in rings:
  for j in range(n):
   t=2*pi*j/n;vs.append((w*sin(t),cy-depth*cos(t),z))
 for i in range(len(rings)-1):
  for j in range(n):a=i*n+j;b=i*n+(j+1)%n;fs.append((a,b,b+n,a+n))
 fs.extend([tuple(reversed(range(n))),tuple((len(rings)-1)*n+j for j in range(n))]);return mesh(name,vs,fs,m)
# Broad bald cranium, rounded cheeks, firm chin. Dense organic single surface.
profile=[(-.146,.022,.041,.052),(-.137,.052,.054,.069),(-.119,.078,.067,.077),(-.09,.095,.078,.084),(-.06,.094,.076,.09),(-.025,.099,.078,.096),(.01,.096,.076,.10),(.05,.096,.081,.104),(.09,.092,.080,.10),(.12,.08,.068,.087),(.145,.055,.045,.064),(.158,.001,.001,.001)]
def interp(h,k):
 if h>.06:
  cap=sqrt(max(0,1-((h-.06)/.100)**2))
  return {1:.095,2:.081,3:.104}[k]*cap
 for i in range(1,len(profile)):
  if h<=profile[i][0]:
   a,b=profile[i-1],profile[i];t=(h-a[0])/(b[0]-a[0]);p0=profile[max(0,i-2)][k];p1=a[k];p2=b[k];p3=profile[min(len(profile)-1,i+1)][k];return .5*((2*p1)+(-p0+p2)*t+(2*p0-5*p1+4*p2-p3)*t*t+(-p0+3*p1-3*p2+p3)*t*t*t)
 return profile[-1][k]
def g(x,z,cx,cz,wx,wz):return exp(-((x-cx)/wx)**2-((z-cz)/wz)**2)
HZ=1.655
# Face sculpted depth includes continuous nose bridge/ala/tip, cheek planes, sockets.
def face_depth(x,z):
 w=max(.000001,interp(z,1));d=interp(z,2)*sqrt(max(.0,1-(x/w)**2))
 d+=.023*g(x,z,0,-.018,.015,.036)+.029*g(x,z,0,-.044,.022,.018)
 for s in [-1,1]:
  d+=.011*g(x,z,s*.017,-.049,.010,.009)
  d-=.013*g(x,z,s*.039,.013,.026,.017)
  d+=.009*g(x,z,s*.042,.042,.029,.014)
  d+=.017*g(x,z,s*.059,-.035,.033,.038)
 d+=.009*g(x,z,0,-.086,.041,.021)+.010*g(x,z,0,-.123,.036,.014)
 return d
vs=[];fs=[];N=160;R=144
for i in range(R+1):
 z=-.146+i/R*.306;w=interp(z,1)
 for j in range(N):
  t=2*pi*j/N;x=w*sin(t);front=cos(t);depth=face_depth(x,z) if front>=0 else interp(z,3)*abs(front)
  vs.append((x,-depth if front>=0 else depth,HZ+z))
for i in range(R):
 for j in range(N):a=i*N+j;b=i*N+(j+1)%N;fs.append((a,b,b+N,a+N))
fs.extend([tuple(reversed(range(N))),tuple(R*N+j for j in range(N))]);head=mesh('Kevin | continuous sculpted head',vs,fs,skin)
# Neck and ears.
uv('Neck',(0,.008,1.49),(.065,.057,.075),skin)
for s in [-1,1]:
 ear=uv('Ear '+str(s),(s*.098,.006,HZ-.026),(.020,.017,.041),skin)
 uv('Ear concha '+str(s),(s*.110,-.008,HZ-.025),(.009,.004,.021),shade)
 pts=[(s*(.105+.011*sin(t)),-.012-.003*cos(t),HZ-.024+.032*cos(t)) for t in [i/40*2*pi for i in range(41)]];curve('Ear helix '+str(s),pts,.0036,skin)
 uv('Earlobe '+str(s),(s*.104,-.002,HZ-.059),(.011,.012,.012),skin)
 # Thin hair around sides and rear; crown remains bare.
 for row in range(4):
  for j in range(22):
   t=s*(1.32+j/25*1.1);z=-.015+row*.009;w=interp(z,1);x=w*sin(t);y=-interp(z,3)*cos(t)
   curve('Temple hair',[(x*1.004,y*1.004,HZ+z),(x*1.006,y*1.006,HZ+z+.009)],.0003,hair)
# Eyes are anatomical almond surfaces, not protruding spheres.
for s in [-1,1]:
 cx=s*.039;cz=.012;pts=[(cx,-face_depth(cx,cz)-.001,HZ+cz)];n=64
 for j in range(n):
  t=j/n*2*pi;x=cx+.019*cos(t);z=cz+(.0034 if sin(t)>0 else .0040)*sin(t);pts.append((x,-face_depth(x,z)-.0017,HZ+z))
 eye=mesh('Eye almond '+str(s),pts,[(0,j+1,(j+1)%n+1) for j in range(n)],white)
 cy=-face_depth(cx,cz)-.003
 uv('Iris '+str(s),(cx,cy,HZ+cz),(.0061,.0017,.0061),iris,32,20)
 uv('Pupil '+str(s),(cx,cy-.0016,HZ+cz),(.0026,.001,.0028),pupil,24,16)
 uv('Catchlight '+str(s),(cx-.0016,cy-.0025,HZ+cz+.002),(.0009,.0006,.0009),glint,16,12)
 for upper in [True,False]:
  ps=[]
  for j in range(33):
   t=j/32*pi+(0 if upper else pi);x=cx+.019*cos(t);z=cz+(.0035 if upper else .0041)*sin(t);ps.append((x,-face_depth(x,z)-.0028,HZ+z))
  curve('Upper lid' if upper else 'Lower lid',ps,.0013 if upper else .0008,skin)
 # Eye bags and lid fold, subtle shallow crease.
 for dz,width in [(.013,.023),(-.011,.021)]:
  ps=[]
  for j in range(31):
   x=cx-width+j/30*width*2;z=cz+dz+( .002 if dz>0 else -.003)*sin(j/30*pi);ps.append((x,-face_depth(x,z)-.00035,HZ+z))
  curve('Lid fold',ps,.00020,shade)
 # tapered eyebrows following brow ridge
 for k in range(60):
  t=k/59;x=s*(.018+t*.047);z=.030+.005*sin(t*pi)-.006*t;y=-face_depth(x,z)-.001
  curve('Brow hair',[(x,y,HZ+z),(x+s*.002,y-.0005,HZ+z+.0015)],.00030,hair)
 # tiny recessed nostrils under nose wings
 x=s*.014;z=-.052;uv('Nostril '+str(s),(x,-face_depth(x,z)-.001,HZ+z),(.0045,.0016,.0022),shade,24,16)
 # Nasolabial line and cheek folds (skin-colored rim, very fine crease)
 ps=[]
 for j in range(25):
  t=j/24;x=s*(.023+.014*t);z=-.053-.038*t;ps.append((x,-face_depth(x,z)-.00045,HZ+z))
 curve('Nasolabial fold',ps,.00022,shade)
# Closed restrained mouth with sculpted vermilion, cupid's bow.
for upper in [True,False]:
 vs=[];fs=[]
 for i in range(61):
  x=-.031+i/60*.062;t=x/.031;line=-.088-.003*t*t
  for j in range(5):
   v=j/4;width=(1-t*t)*(.0032 if upper else .0045);z=line+(width*v if upper else -width*v);depth=face_depth(x,z)+.0018+.0015*sin(v*pi);vs.append((x,-depth,HZ+z))
 for i in range(60):
  for j in range(4):a=i*5+j;fs.append((a,a+1,a+6,a+5))
 mesh('Upper lip' if upper else 'Lower lip',vs,fs,lip)
curve('Mouth seam',[(x,-face_depth(x,-.088-.003*(x/.031)**2)-.0025,HZ-.088-.003*(x/.031)**2) for x in [-.031+i/60*.062 for i in range(61)]],.00065,shade)
# Forehead lines retain a smooth bald silhouette.
for z,width in [(.071,.047),(.088,.045),(.103,.037)]:
 curve('Forehead fine fold',[(x,-face_depth(x,z+.003*(x/width)**2)-.0001,HZ+z+.003*(x/width)**2) for x in [-width+i/60*2*width for i in range(61)]],.00013,shade)
# Body tailoring, straight natural stance.
ringshape('Jacket | tailored body',[(.85,.145,.092,.015),(.90,.16,.105,.014),(1.02,.165,.115,.014),(1.18,.178,.115,.012),(1.32,.207,.104,.01),(1.37,.163,.086,.012),(1.40,.108,.071,.012),(1.445,.08,.062,.006)],suit)
ringshape('Shirt front',[(1.08,.061,.117,.005),(1.34,.085,.113,.003),(1.445,.053,.063,0)],shirt)
# Lapels match black suit, V neck and tie.
for s in [-1,1]:
 patch('Notched lapel '+str(s),[(s*.052,-.062,1.444),(s*.105,-.102,1.393),(s*.13,-.105,1.355),(s*.111,-.116,1.35),(s*.136,-.115,1.32),(s*.040,-.128,1.12),(s*.012,-.128,1.17),(s*.075,-.117,1.355)],lapel,.003)
 patch('Shirt collar '+str(s),[(s*.004,-.071,1.444),(s*.047,-.063,1.445),(s*.050,-.091,1.421),(s*.022,-.112,1.397)],shirt,.002)
curve('Jacket opening',[(0,-.124,.86),(.013,-.133,1.12),(.025,-.132,1.2)],.0014,lapel)
patch('Tie blade',[(-.014,-.123,1.389),(.014,-.123,1.389),(.025,-.130,1.13),(0,-.132,1.092),(-.021,-.13,1.13)],tie,.003)
patch('Tie knot',[(-.012,-.114,1.411),(.012,-.114,1.411),(.010,-.125,1.386),(-.008,-.125,1.386)],tie,.006)
for z in [1.10,.99]:uv('Jacket button',(.024,-.132,z),(.007,.003,.007),shoe,24,12)
# Pocket and signature red square on anatomical left.
patch('Breast pocket welt',[(.09,-.112,1.285),(.151,-.10,1.295),(.15,-.103,1.283),(.09,-.115,1.274)],lapel,.003)
patch('Red silk pocket square',[(.096,-.114,1.288),(.102,-.117,1.333),(.116,-.115,1.32),(.133,-.109,1.342),(.144,-.106,1.326),(.145,-.106,1.295)],red,.002)
for s in [-1,1]:
 # pockets below waist
 curve('Hip pocket welt',[(s*.073,-.108,1.00),(s*.148,-.078,1.015)],.003,lapel)
 shoulder=(s*.184,.012,1.325);elbow=(s*.254,.005,1.10);wrist=(s*.269,-.043,.89)
 uv('Shoulder '+str(s),shoulder,(.054,.067,.052),suit)
 tube('Upper sleeve '+str(s),elbow,shoulder,.052,.073,suit)
 uv('Elbow '+str(s),elbow,(.053,.054,.061),suit)
 tube('Lower sleeve '+str(s),wrist,elbow,.038,.052,suit)
 tube('White shirt cuff '+str(s),(s*.27,-.046,.866),wrist,.035,.036,shirt)
 # Hand palm and slightly bent individual fingers
 uv('Palm '+str(s),(s*.269,-.049,.823),(.036,.022,.052),skin)
 for i in range(4):
  x=s*(.242+i*.017);length=[.064,.075,.071,.056][i];base=.801
  a=(x,-.053,base);b=(x+s*.002,-.065,base-length*.6);c=(x+s*.001,-.075,base-length)
  tube('Finger proximal',b,a,.008,.0095,skin);uv('Finger joint',b,(.0085,.008,.01),skin,24,16);tube('Finger distal',c,b,.0065,.008,skin);uv('Fingertip',c,(.0067,.0068,.008),skin,24,16)
  uv('Nail',(c[0],c[1]-.005,c[2]+.008),(.0048,.001,.007),shirt,24,16)
 tube('Thumb', (s*.223,-.078,.795),(s*.239,-.049,.846),.009,.015,skin)
 uv('Thumb tip',(s*.222,-.079,.792),(.010,.009,.012),skin,24,16)
 # trouser leg softly shaped to knee then tapered ankle
 leg=ringshape('Trouser leg '+str(s),[(.10,.055,.065,0),(.25,.058,.067,.005),(.51,.064,.073,.008),(.72,.075,.086,.014),(.90,.081,.088,.015)],suit,48);leg.location.x=s*.082
 curve('Pressed trouser crease',[(s*.082,-.07,.17),(s*.082,-.073,.48),(s*.082,-.079,.68),(s*.082,-.074,.84)],.00075,lapel)
 uv('Shoe sole '+str(s),(s*.082,-.048,.042),(.064,.138,.025),sole)
 uv('Oxford shoe '+str(s),(s*.082,-.051,.074),(.061,.131,.048),shoe)
 uv('Shoe ankle '+str(s),(s*.082,.015,.104),(.054,.064,.049),shoe)
 for j in range(4):curve('Shoe lace',[(s*.082-.019,-.018-j*.012,.119-j*.003),(s*.082+.019,-.018-j*.012,.119-j*.003)],.0012,sole)
# understated wristwatch
uv('Watch face',(-.274,-.080,.88),(.022,.007,.023),metal)
uv('Watch dial',(-.274,-.087,.88),(.018,.001,.019),tie)
# Refine proportions and smooth joined jacket into an organic tailored silhouette.
for o in list(COL.objects):
 if o.name.startswith('Ear'):
  side=1 if (o.location.x>0 or (o.type=='CURVE' and o.data.splines[0].points[0].co.x>0)) else -1
  center=Vector((side*.100,.0,HZ-.026))
  if o.type=='MESH':
   for v in o.data.vertices:
    w=o.matrix_world @ v.co;w=center+(w-center)*.70;v.co=o.matrix_world.inverted() @ w
  elif o.type=='CURVE':
   for sp in o.data.splines:
    for p in sp.points:
     w=center+(Vector(p.co[:3])-center)*.70;p.co=(*w,1)
for o in list(COL.objects):
 if o.name.startswith(('Kevin |','Ear','Eye','Iris','Pupil','Catchlight','Upper lip','Lower lip','Upper lid','Lower lid','Lid fold','Brow','Temple','Nostril','Nasolabial','Mouth','Forehead')):
  # world-space affine transform centered at facial origin; handles curves and meshes.
  if o.type == 'MESH':
   for v in o.data.vertices:
    world=o.matrix_world @ v.co;world.x*=1.06;world.z=HZ+(world.z-HZ)*.85-.047;v.co=o.matrix_world.inverted() @ world
  elif o.type=='CURVE':
   for sp in o.data.splines:
    for p in sp.points:p.co.x*=1.06;p.co.z=HZ+(p.co.z-HZ)*.85-.047
bpy.ops.object.select_all(action='DESELECT')
parts=[o for o in COL.objects if o.name.startswith(('Jacket |','Shoulder','Upper sleeve','Lower sleeve','Elbow'))]
for o in parts:o.select_set(True)
bpy.context.view_layer.objects.active=parts[0];bpy.ops.object.convert(target='MESH');bpy.ops.object.join();j=bpy.context.object;j.name='Jacket | continuous tailored shell'
r=j.modifiers.new('Tailoring voxel union','REMESH');r.mode='VOXEL';r.voxel_size=.0035;bpy.ops.object.modifier_apply(modifier=r.name)
sm=j.modifiers.new('Cloth contour smoothing','SMOOTH');sm.factor=1.3;sm.iterations=6;bpy.ops.object.modifier_apply(modifier=sm.name)
for p in j.data.polygons:p.use_smooth=True
# Asset root and export selection. Keep editing pieces named and separate.
root=bpy.data.objects.new('Kevin_OLeary_Study',None);COL.objects.link(root)
for o in list(COL.objects):
 if o!=root:o.parent=root
root['description']='Kevin OLeary inspired likeness study from user-provided seated TV reference; handcrafted procedural geometry, not a scan.'
root['version']='1.0';root['rig_status']='Unrigged neutral standing pose; isolated review asset, existing cast unchanged.'
# Lighting/render collection (excluded from GLB).
scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=128;scene.cycles.use_denoising=False
scene.world.color=(.16,.16,.16)
def area(name,loc,energy,size,color,target=(0,0,1.1)):
 bpy.ops.object.light_add(type='AREA',location=loc);o=bpy.context.object;o.name=name;o.data.energy=energy;o.data.shape='DISK';o.data.size=size;o.data.color=color;o.rotation_euler=(Vector(target)-o.location).to_track_quat('-Z','Y').to_euler()
area('Key softbox',(-2,-3,3.5),350,2.0,(1,.88,.75));area('Fill softbox',(2,-2,2.2),160,1.8,(.75,.85,1));area('Rim',(1,1,3),450,1.5,(.8,.9,1))
bpy.ops.mesh.primitive_plane_add(size=200);floor=bpy.context.object;floor.name='Studio floor (not exported)';floor.data.materials.append(mat('Studio floor',(.033,.042,.052),.8))
bpy.ops.object.camera_add(location=(2.6,-5.5,2.2));cam=bpy.context.object;cam.name='Review camera';scene.camera=cam
scene.render.resolution_x=1000;scene.render.resolution_y=1200;scene.render.resolution_percentage=100
scene.view_settings.view_transform='AgX';scene.render.image_settings.file_format='PNG';scene.render.film_transparent=False
# Export glTF with applied modifiers and supported material channels; render-only pore bump is not baked.
bpy.ops.object.select_all(action='DESELECT')
for o in COL.objects:o.select_set(True)
bpy.context.view_layer.objects.active=root
os.makedirs(ROOT+'/docs/kevin',exist_ok=True);os.makedirs(ROOT+'/public/models/kevin',exist_ok=True);os.makedirs(ROOT+'/assets/kevin',exist_ok=True)
# Duplicate to an export collection so source objects stay editable.
EXPORT=bpy.data.collections.new('EXPORT_TEMP');scene.collection.children.link(EXPORT)
bpy.ops.object.select_all(action='DESELECT');copies=[]
for o in list(COL.objects):
 if o.type not in {'MESH','CURVE'}:continue
 c=o.copy();c.data=o.data.copy();c.parent=None;c.matrix_world=o.matrix_world.copy();EXPORT.objects.link(c);c.select_set(True);copies.append(c)
bpy.context.view_layer.objects.active=copies[0];bpy.ops.object.convert(target='MESH')
for obj in EXPORT.objects:
 if obj.name.startswith('Jacket |'):
  bpy.context.view_layer.objects.active=obj;d=obj.modifiers.new('Runtime reduction','DECIMATE');d.ratio=.45;bpy.ops.object.modifier_apply(modifier=d.name)
# Join by material to bound draw calls. GLB does not retain editing-object names.
groups={}
for o in list(EXPORT.objects):groups.setdefault(o.data.materials[0].name,[]).append(o)
for material,objs in groups.items():
 bpy.ops.object.select_all(action='DESELECT')
 for o in objs:o.select_set(True)
 bpy.context.view_layer.objects.active=objs[0];bpy.ops.object.join();bpy.context.object.name=material
bpy.ops.object.select_all(action='DESELECT')
for o in EXPORT.objects:o.select_set(True)
bpy.ops.export_scene.gltf(filepath=ROOT+'/public/models/kevin/kevin.glb',use_selection=True,export_format='GLB',export_apply=True,export_yup=True,export_cameras=False,export_lights=False,export_extras=True)
for o in list(EXPORT.objects):bpy.data.objects.remove(o,do_unlink=True)
bpy.data.collections.remove(EXPORT)

def camera(loc,target,lens):
 cam.location=loc;cam.rotation_euler=(Vector(target)-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.lens=lens
camera((2.6,-5.5,2.2),(0,0,.95),70)
bpy.ops.wm.save_as_mainfile(filepath=ROOT+'/assets/kevin/kevin.blend',compress=True)
if '--render' in sys.argv:
 camera((.36,-1.1,1.77),(0,-.005,1.58),70);scene.render.filepath=ROOT+'/docs/kevin/portrait.png';bpy.ops.render.render(write_still=True)
 camera((2.6,-5.5,2.2),(0,0,.95),70);scene.render.filepath=ROOT+'/docs/kevin/full-body.png';bpy.ops.render.render(write_still=True)
print('KEVIN_BUILD_COMPLETE')
