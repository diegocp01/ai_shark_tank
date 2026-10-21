# Connected head topology is a CC0 MakeHuman derivative; see assets/kevin/PROVENANCE.md.
import numpy as np
from mathutils import Vector
import bpy,math
from pathlib import Path
ROOT=str(Path(__file__).resolve().parents[1])
data=np.load(ROOT+'/assets/kevin/anatomical-head.npz')
coords=data['vertices'].copy()
# Fit the anatomical bust's trapezius rows into the tailored collar; remove the
# broad source shoulder mantle while preserving the jaw and upper neck.
for point in coords:
 z=point[2]
 if z<1.56:
  source_width=np.interp(z,[1.475,1.50,1.52,1.54,1.56],[.248,.218,.156,.110,.072])
  desired_width=np.interp(z,[1.475,1.56],[.054,.072])
  point[0]*=desired_width/source_width
  t=max(0,min(1,(1.56-z)/.08));point[1]=point[1]*(1-.25*t)-.018*t
# Round the lower neck into the collar rather than retaining compressed clavicle folds.
for point in coords:
 z=point[2]
 if z<1.55:
  t=max(0,min(1,(1.55-z)/.018));angle=math.atan2(point[0],-(point[1]+.020))
  point[0]=(1-t)*point[0]+t*.059*math.sin(angle)
  point[1]=(1-t)*point[1]+t*(-.020-.057*math.cos(angle))
allfaces=data['faces'];alluv=data['face_uvs']
keep=[i for i,f in enumerate(allfaces) if min(coords[j,2] for j in f)>1.475]
used=sorted(set(j for i in keep for j in allfaces[i]));remap={old:new for new,old in enumerate(used)}
d=bpy.data.meshes.new('Kevin connected anatomical quads');d.from_pydata([coords[j] for j in used],[],[[remap[j] for j in allfaces[i]] for i in keep]);d.update();o=bpy.data.objects.new('Kevin | sculptable anatomical head',d);bpy.context.collection.objects.link(o)
for p in d.polygons:p.use_smooth=True
uv=d.uv_layers.new(name='UVMap')
for p,fi in zip(d.polygons,keep):
 for li,u in zip(p.loop_indices,alluv[fi]):uv.data[li].uv=u
mat=bpy.data.materials.new('Skin anatomy');mat.use_nodes=True;bs=mat.node_tree.nodes.get('Principled BSDF');bs.inputs['Base Color'].default_value=(.34,.195,.13,1);bs.inputs['Roughness'].default_value=.52;bs.inputs['Subsurface Weight'].default_value=.07;o.data.materials.append(mat)

mod=o.modifiers.new('Facial subdivision','SUBSURF');mod.levels=2;mod.render_levels=2
# base helper eyes follow all facial target changes exactly
for eye,center in zip(['helper-l-eye','helper-r-eye'],data['eyes']):
 radius=.012
 bpy.ops.mesh.primitive_uv_sphere_add(segments=48,ring_count=32,location=center);e=bpy.context.object;e.name=eye;e.scale=(radius,radius,radius)
 for p in e.data.polygons:p.use_smooth=True
 m=bpy.data.materials.new('Eye ivory');m.diffuse_color=(.75,.79,.82,1);m.use_nodes=True;ep=m.node_tree.nodes.get('Principled BSDF');ep.inputs['Base Color'].default_value=m.diffuse_color;ep.inputs['Roughness'].default_value=.22;e.data.materials.append(m)
 # iris disk surface toward-front
 for n,r,c,y in [('Iris',radius*.45,(.13,.075,.035,1),-.98),('Pupil',radius*.20,(.004,.004,.005,1),-1.04)]:
  bpy.ops.mesh.primitive_uv_sphere_add(segments=32,ring_count=20,location=(center[0],center[1]+radius*y,center[2]));q=bpy.context.object;q.name=n;q.scale=(r,radius*.06,r);mm=bpy.data.materials.new(n);mm.diffuse_color=c;mm.use_nodes=True;ip=mm.node_tree.nodes.get('Principled BSDF');ip.inputs['Base Color'].default_value=c;ip.inputs['Roughness'].default_value=.18;q.data.materials.append(mm)
  for p in q.data.polygons:p.use_smooth=True

exec(compile(open(ROOT+'/scripts/anatomy_detail.py').read(),'anatomy_detail.py','exec'))
