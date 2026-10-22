"""Reference-guided Mark facial study built from a bundled male CC0 cage.

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
    with np.load(ROOT/'assets/mark/anatomical-head.npz') as data:
        coords=data['vertices'].copy();faces=data['faces'].copy();uvs=data['face_uvs'].copy()
        eyes=data['eyes'].copy();lip_weight=data['lip_weight'].copy()
        deltas={name:data['delta_'+name].copy() for name in KEYS}
    skin=material('Mark skin | warm satin',(.30,.155,.085),.48,.065)
    head=mesh_object('Mark | anatomical face',coords.tolist(),faces.tolist(),skin)
    head['source']='CC0 MakeHuman male anatomical derivative; reference-guided likeness study, not a scan'
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
        cheek=math.exp(-((abs(x)-.043)/.021)**2-((z-1.655)/.020)**2)*front
        nose=math.exp(-(x/.015)**2-((z-1.644)/.016)**2)*front
        eyelid=math.exp(-((abs(x)-.03)/.017)**4-((z-1.695)/.005)**2)*front
        base=Vector((.30,.155,.085));base=base.lerp(Vector((.34,.14,.09)),cheek*.30+nose*.08)
        base=base.lerp(Vector((.25,.13,.085)),eyelid*.10)
        # Source-driven lip mask avoids painting a rectangular patch around mouth.
        lw=min(1,float(lip_weight[i])*2.3)
        base=base.lerp(Vector((.33,.15,.125)),lw*.45)
        col.data[i].color=(*base,1)
    nt=skin.node_tree;bs=nt.nodes.get('Principled BSDF')
    attr=nt.nodes.new('ShaderNodeVertexColor');attr.layer_name='Complexion';nt.links.new(attr.outputs['Color'],bs.inputs['Base Color'])
    noise=nt.nodes.new('ShaderNodeTexNoise');noise.inputs['Scale'].default_value=800;noise.inputs['Detail'].default_value=2
    bump=nt.nodes.new('ShaderNodeBump');bump.inputs['Strength'].default_value=.09;bump.inputs['Distance'].default_value=.00012
    nt.links.new(noise.outputs['Fac'],bump.inputs['Height']);nt.links.new(bump.outputs['Normal'],bs.inputs['Normal'])
    sclera=material('Mark eyes | warm ivory',(.60,.62,.59),.21)
    iris=material('Mark iris | chestnut brown',(.035,.025,.012),.26)
    limbal=material('Mark iris | deep brown limbal ring',(.025,.013,.009),.27)
    pupil=material('Mark eyes | pupil',(.003,.0025,.002),.12)
    for side,center in zip(('L','R'),eyes):
        r=.0152
        sphere('Mark Eye.'+side,center,(r,r,r),sclera)
        sphere('Mark Iris Ring.'+side,(center[0],center[1]-r*.955,center[2]),(.0074,.00085,.0074),limbal)
        sphere('Mark Iris.'+side,(center[0],center[1]-r*1.003,center[2]),(.0069,.00065,.0069),iris)
        sphere('Mark Pupil.'+side,(center[0],center[1]-r*1.045,center[2]),(.0028,.0003,.0028),pupil,32,20)
    # Natural dental arches and a dark oral backing support talking expressions.
    enamel=material('Mark Teeth | warm natural enamel',(.57,.52,.40),.38)
    oral=material('Mark mouth | dark oral interior',(.035,.008,.006),.85)
    sphere('Mark Mouth interior',(0,-.131,1.618),(.033,.018,.019),oral,24,16)
    for row in ('Upper','Lower'):
        for i in range(8):
            x=(i-3.5)*.0062;edge=abs(x)/.025
            y=(-.153 if row=='Upper' else -.141)+.012*edge**1.6;z=1.624 if row=='Upper' else 1.614
            tooth=sphere('Mark Teeth '+row+'.'+str(i+1),(x,y,z),(.00295,.0032,.0041 if row=='Upper' else .0033),enamel,12,8)
            if row=='Lower':
                # Apply scale before writing metre-space expression displacement.
                bpy.context.view_layer.objects.active=tooth
                bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
                tooth.shape_key_add(name='Basis',from_mix=False)
                for name in KEYS:
                    key=tooth.shape_key_add(name=name,from_mix=False)
                    if name=='mouthOpen':
                        for v in key.data:v.co.z-=.020;v.co.y+=.006
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
    browmat=material('Mark brows | ash brown',(.020,.011,.006),.72)
    lashmat=material('Mark lashes and liner | brown black',(.012,.008,.006),.45)
    for side,center in zip((1,-1),eyes):
        ex,ey,ez=center
        # Subtle continuous brow underpainting, with individual fibres above.
        browline=[]
        for i in range(40):
            t=i/39;x=side*(abs(ex)-.014+t*.045)
            z=ez+.009+.003*math.sin(t*math.pi*.91)+.001*t
            p,n=surface(x,z)
            if p is not None:browline.append(p+Vector((0,-.0003,0)))
        if len(browline)>2:fibre('Mark Brow base.'+('L' if side==1 else 'R'),browline,.0020,browmat,6)
        for i in range(330):
            t=rng.random();x=side*(abs(ex)-.015+t*.047)
            z=ez+.009+.003*math.sin(t*math.pi*.91)+.001*t+rng.gauss(0,.0017)*(1-t*.5)
            p,n=surface(x,z)
            if p is None:continue
            p+=n*.0003
            fibre('Mark Brow.'+('L' if side==1 else 'R'),[p,p+Vector((side*.0011,-.00035,.0009)),p+Vector((side*.0026,0,.0010*(1-t)))],rng.uniform(.00019,.00027),browmat)
    # Restrained reference-guided age lines follow the real facial surface.
    # These fine pigment fibres move with the same expression cage as the brows.
    crease=material('Mark skin | fine expression creases',(.19,.085,.044),.78)
    for row in range(2):
        line=[]
        for j in range(55):
            x=-.054+.108*j/54
            z=1.722+row*.010+.003*(1-(x/.054)**2)
            point,normal=surface(x,z)
            if point is not None:line.append(point+normal*.00008)
        if len(line)>2:fibre('Mark Forehead creases',line,.00015,crease,4)
    for side in (1,-1):
        for row in range(3):
            line=[]
            for j in range(15):
                t=j/14;x=side*(.049+.015*t)
                z=1.689+(row-1)*(.001+.004*t)-.002*t
                point,normal=surface(x,z)
                if point is not None:line.append(point+normal*.00008)
            if len(line)>2:fibre('Mark Eye creases',line,.00013,crease,4)
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
