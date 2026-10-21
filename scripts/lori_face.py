"""Reference-guided Lori facial study built from a bundled female CC0 cage.

build_face() returns its objects. The head owns Basis, mouthOpen, blink, smile,
and frown keys. Named detail meshes carry matching expression deltas, not drivers,
so glTF can preserve them. Hair, body, studio and rig are independent builders.
"""
from pathlib import Path
import math, random
import bpy
import numpy as np
from mathutils import Vector
from mathutils.kdtree import KDTree
ROOT=Path(__file__).resolve().parents[1]
KEYS=('mouthOpen','blink','smile','frown')

def material(name,color,roughness=.5,subsurface=0):
    m=bpy.data.materials.new(name);m.diffuse_color=(*color,1);m.use_nodes=True
    bs=m.node_tree.nodes.get('Principled BSDF');bs.inputs['Base Color'].default_value=(*color,1)
    bs.inputs['Roughness'].default_value=roughness
    bs.inputs['Subsurface Weight'].default_value=subsurface
    return m

def mesh_object(name,verts,faces,mat):
    mesh=bpy.data.meshes.new(name);mesh.from_pydata(verts,[],faces);mesh.update()
    obj=bpy.data.objects.new(name,mesh);bpy.context.collection.objects.link(obj)
    obj.data.materials.append(mat)
    for p in mesh.polygons:p.use_smooth=True
    return obj

def sphere(name,center,scale,mat,segments=36,rings=24):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segments,ring_count=rings,location=center)
    obj=bpy.context.object;obj.name=name;obj.scale=scale;obj.data.materials.append(mat)
    for p in obj.data.polygons:p.use_smooth=True
    return obj

def build_face():
    start=set(bpy.data.objects)
    rng=random.Random(41)
    with np.load(ROOT/'assets/lori/anatomical-head.npz') as data:
        coords=data['vertices'].copy();faces=data['faces'].copy();uvs=data['face_uvs'].copy()
        eyes=data['eyes'].copy();lip_weight=data['lip_weight'].copy()
        deltas={name:data['delta_'+name].copy() for name in KEYS}
    skin=material('Lori skin | warm satin',(.405,.215,.125),.48,.065)
    head=mesh_object('Lori | anatomical face',coords.tolist(),faces.tolist(),skin)
    head['source']='CC0 MakeHuman female anatomical derivative; reference-guided likeness study, not a scan'
    head['facial_morphs']='mouthOpen, blink, smile, frown; keep jaw neutral when using mouthOpen'
    uv=head.data.uv_layers.new(name='UVMap')
    for p,faceuv in zip(head.data.polygons,uvs):
        for li,xy in zip(p.loop_indices,faceuv):uv.data[li].uv=xy
    head.shape_key_add(name='Basis',from_mix=False)
    for name in KEYS:
        key=head.shape_key_add(name=name,from_mix=False)
        key.data.foreach_set('co',(coords+deltas[name]).reshape(-1));key.value=0
    sub=head.modifiers.new('Sculptable facial subdivision','SUBSURF');sub.levels=2;sub.render_levels=2
    # Vertex pigment is portable to glTF and follows the same anatomical topology.
    col=head.data.color_attributes.new(name='Complexion',type='FLOAT_COLOR',domain='POINT')
    for i,(x,y,z) in enumerate(coords):
        front=np.clip((-y-.075)/.05,0,1)
        cheek=math.exp(-((abs(x)-.043)/.021)**2-((z-1.582)/.020)**2)*front
        nose=math.exp(-(x/.015)**2-((z-1.572)/.016)**2)*front
        eyelid=math.exp(-((abs(x)-.03)/.017)**4-((z-1.616)/.005)**2)*front
        base=Vector((.405,.215,.125));base=base.lerp(Vector((.45,.175,.12)),cheek*.30+nose*.08)
        base=base.lerp(Vector((.12,.062,.038)),eyelid*.52)
        # Source-driven lip mask avoids painting a rectangular patch around mouth.
        lw=min(1,float(lip_weight[i])*2.3)
        base=base.lerp(Vector((.43,.135,.135)),lw*.83)
        col.data[i].color=(*base,1)
    nt=skin.node_tree;bs=nt.nodes.get('Principled BSDF')
    attr=nt.nodes.new('ShaderNodeVertexColor');attr.layer_name='Complexion';nt.links.new(attr.outputs['Color'],bs.inputs['Base Color'])
    noise=nt.nodes.new('ShaderNodeTexNoise');noise.inputs['Scale'].default_value=800;noise.inputs['Detail'].default_value=2
    bump=nt.nodes.new('ShaderNodeBump');bump.inputs['Strength'].default_value=.09;bump.inputs['Distance'].default_value=.00012
    nt.links.new(noise.outputs['Fac'],bump.inputs['Height']);nt.links.new(bump.outputs['Normal'],bs.inputs['Normal'])
    sclera=material('Lori eyes | warm ivory',(.60,.62,.59),.21)
    iris=material('Lori iris | chestnut brown',(.045,.021,.009),.26)
    limbal=material('Lori iris | deep brown limbal ring',(.025,.013,.009),.27)
    pupil=material('Lori eyes | pupil',(.003,.0025,.002),.12)
    for side,center in zip(('L','R'),eyes):
        r=.0152
        sphere('Lori Eye.'+side,center,(r,r,r),sclera)
        sphere('Lori Iris Ring.'+side,(center[0],center[1]-r*.955,center[2]),(.0074,.00085,.0074),limbal)
        sphere('Lori Iris.'+side,(center[0],center[1]-r*1.003,center[2]),(.0069,.00065,.0069),iris)
        sphere('Lori Pupil.'+side,(center[0],center[1]-r*1.045,center[2]),(.0028,.0003,.0028),pupil,32,20)
    # Individual enamel crowns follow an anatomical dental arch behind the lips.
    enamel=material('Lori Teeth | natural enamel',(.81,.78,.68),.29,.025)
    for row in ('Upper','Lower'):
        for i in range(8):
            x=(i-3.5)*.0059;edge=abs(x)/.03
            y=((- .1462+.016*edge**1.7) if row=='Upper' else (-.134+.032*edge**1.7)) + float(eyes[:,1].mean()) + .1235164
            z=1.5532+edge*.0013 if row=='Upper' else 1.5408+edge*.0015
            bpy.ops.mesh.primitive_cube_add(size=1,location=(x,y,z))
            tooth=bpy.context.object;tooth.name='Lori Teeth '+row+'.'+str(i+1).zfill(2)
            tooth.scale=(.00565,.0046,.0081 if row=='Upper' else .0040)
            tooth.rotation_euler[2]=-x*.95
            bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
            tooth.data.materials.append(enamel)
            bevel=tooth.modifiers.new('Rounded enamel edges','BEVEL');bevel.width=.00065;bevel.segments=3
            for p in tooth.data.polygons:p.use_smooth=True
            if row=='Lower':
                bpy.context.view_layer.objects.active=tooth;bpy.ops.object.modifier_apply(modifier=bevel.name)
                tooth.shape_key_add(name='Basis',from_mix=False)
                for name in KEYS:
                    key=tooth.shape_key_add(name=name,from_mix=False)
                    if name=='mouthOpen':
                        for v in key.data:v.co.z-=.021;v.co.y+=.008
        bpy.context.view_layer.update()
    evaluated=head.evaluated_get(bpy.context.evaluated_depsgraph_get())
    def surface(x,z):
        hit,p,n,_=evaluated.ray_cast(Vector((x,-.5,z)),Vector((0,1,0)))
        return (p,n) if hit else (None,None)
    # Fibre details are authored as grouped tubes, rather than thousands of objects.
    groups={}
    def fibre(group,points,radius,mat,sides=5):
        if group not in groups:groups[group]=[[],[],mat]
        vv,ff,_=groups[group];offset=len(vv)
        for i,p in enumerate(points):
            p=Vector(p);tangent=Vector(points[min(i+1,len(points)-1)])-Vector(points[max(0,i-1)])
            tangent.normalize();axis=tangent.cross(Vector((0,0,1)))
            if axis.length<.01:axis=tangent.cross(Vector((1,0,0)))
            axis.normalize();other=tangent.cross(axis).normalized();r=radius*(1-.83*(i/(len(points)-1))**1.8)
            for j in range(sides):vv.append(tuple(p+r*(math.cos(j*math.tau/sides)*axis+math.sin(j*math.tau/sides)*other)))
        for i in range(len(points)-1):
            for j in range(sides):
                a=offset+i*sides+j;b=offset+i*sides+(j+1)%sides
                ff.append((a,b,b+sides,a+sides))
        ff.append(tuple(offset+j for j in range(sides-1,-1,-1)))
        ff.append(tuple(offset+(len(points)-1)*sides+j for j in range(sides)))
    browmat=material('Lori brows | ash brown',(.065,.032,.015),.72)
    lashmat=material('Lori lashes and liner | brown black',(.012,.008,.006),.45)
    for side,center in zip((1,-1),eyes):
        ex,ey,ez=center
        # Subtle continuous brow underpainting, with individual fibres above.
        browline=[]
        for i in range(40):
            t=i/39;x=side*(abs(ex)-.014+t*.045)
            z=ez+.015+.007*math.sin(t*math.pi*.91)-.004*t
            p,n=surface(x,z)
            if p is not None:browline.append(p+Vector((0,-.0003,0)))
        if len(browline)>2:fibre('Lori Brow base.'+('L' if side==1 else 'R'),browline,.00065,browmat,6)
        for i in range(230):
            t=rng.random();x=side*(abs(ex)-.015+t*.047)
            z=ez+.015+.007*math.sin(t*math.pi*.91)-.004*t+rng.gauss(0,.00085)*(1-t*.5)
            p,n=surface(x,z)
            if p is None:continue
            p+=n*.0003
            fibre('Lori Brow.'+('L' if side==1 else 'R'),[p,p+Vector((side*.0011,-.00035,.0009)),p+Vector((side*.0026,0,.0010*(1-t)))],rng.uniform(.000095,.00016),browmat)
        # Detect the true aperture boundary by ray-depth transition. This keeps
        # liner and lashes on the anatomical lid, including after proportion edits.
        def lid_point(t,upper=True):
            x=ex+side*(-.0122+.0248*t)
            sign=1 if upper else -1
            for dz in np.linspace(0,.012,121):
                p,n=surface(x,ez+sign*dz)
                if p is not None and p.y<ey-.008:
                    outer,normal=surface(x,float(p.z)+sign*.0006)
                    if outer is not None:p=outer
                    globe=ey-math.sqrt(max(0,.0152**2-(x-ex)**2-(p.z-ez)**2))
                    p.y=min(p.y,globe)-.00085
                    return p
            return None
        line=[]
        for i in range(45):
            p=lid_point(i/44)
            if p is not None:line.append(p)
        if len(line)>2:fibre('Lori Upper liner.'+('L' if side==1 else 'R'),line,.00065,lashmat,6)
        for i in range(36):
            t=.03+.94*i/35;p=lid_point(t)
            if p is None:continue
            length=.003+.0016*math.sin(t*math.pi)+.0013*t
            fibre('Lori Upper lashes.'+('L' if side==1 else 'R'),[p,p+Vector((side*(t-.3)*.001,-length*.5,.001)),p+Vector((side*(t-.3)*.0025,-length,.0030))],.00019,lashmat)
        for i in range(18):
            t=.10+.82*i/17;p=lid_point(t,False)
            if p is None:continue
            fibre('Lori Lower lashes.'+('L' if side==1 else 'R'),[p,p+Vector((side*(t-.3)*.0009,-.0012,-.0005)),p+Vector((side*(t-.3)*.0014,-.0017,-.001))],.000075,lashmat)
    # A nearest-cage interpolation transfers expression motion to surface details.
    kd=KDTree(len(coords))
    for i,c in enumerate(coords):kd.insert(Vector(c),i)
    kd.balance()
    for name,(vv,ff,mat) in groups.items():
        obj=mesh_object(name,vv,ff,mat);obj.shape_key_add(name='Basis',from_mix=False)
        base=np.array(vv,dtype=np.float32);weights=[]
        for c in base:
            neighbors=kd.find_n(Vector(c),4)
            inds=np.array([n[1] for n in neighbors]);ww=1/(np.array([n[2] for n in neighbors])+.0001)**2;ww/=ww.sum();weights.append((inds,ww))
        for keyname in KEYS:
            out=base.copy()
            for i,(inds,ww) in enumerate(weights):out[i]+=np.sum(deltas[keyname][inds]*ww[:,None],axis=0)
            key=obj.shape_key_add(name=keyname,from_mix=False);key.data.foreach_set('co',out.reshape(-1));key.value=0
    return [o for o in bpy.data.objects if o not in start]

if __name__=='__main__':build_face()
