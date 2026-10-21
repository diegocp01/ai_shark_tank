"""Lori: fitted asymmetrical black top, slim trousers and classic pointed pumps.

Original, editable procedural tailoring. Metres, +Z up, -Y front, .L = +X.
Reference-driven visible upper garment; trousers and pumps are inferred styling.
Hands are sculptable CC0 MakeHuman anatomical derivatives, not primitive mittens.
Public interface: build_body(collection=None, skin=None) -> list[bpy.types.Object].
No rig, camera, lights or reference photograph are created by build_body().
"""
from pathlib import Path
import bpy, bmesh, math
import numpy as np
from math import sin, cos, pi, exp, sqrt
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[1]
HAND_SOURCE=ROOT/'assets/lori/source/anatomical_hands_cc0.npz'
COL=None


def material(name, color, roughness=.55, metallic=0.0, fabric=False):
    m=bpy.data.materials.get(name) or bpy.data.materials.new(name)
    m.diffuse_color=(*color,1);m.use_nodes=True
    p=m.node_tree.nodes.get('Principled BSDF')
    p.inputs['Base Color'].default_value=(*color,1)
    p.inputs['Roughness'].default_value=roughness
    p.inputs['Metallic'].default_value=metallic
    if fabric and not m.node_tree.nodes.get('Fine jersey weave'):
        p.inputs['Specular IOR Level'].default_value=.28
        p.inputs['Sheen Weight'].default_value=.11
        noise=m.node_tree.nodes.new('ShaderNodeTexNoise');noise.name='Fine jersey weave'
        noise.inputs['Scale'].default_value=820;noise.inputs['Detail'].default_value=2
        bump=m.node_tree.nodes.new('ShaderNodeBump');bump.inputs['Strength'].default_value=.12;bump.inputs['Distance'].default_value=.00013
        m.node_tree.links.new(noise.outputs['Fac'],bump.inputs['Height']);m.node_tree.links.new(bump.outputs['Normal'],p.inputs['Normal'])
    return m


def mesh(name, vertices, faces, mat, subdivision=0):
    d=bpy.data.meshes.new(name);d.from_pydata(vertices,[],faces);d.update()
    o=bpy.data.objects.new(name,d);COL.objects.link(o)
    if mat:o.data.materials.append(mat)
    for p in d.polygons:p.use_smooth=True
    # Recalculate the exterior coherently even on mirrored sections.
    bm=bmesh.new();bm.from_mesh(d);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(d);bm.free()
    if subdivision:
        mod=o.modifiers.new('Editable surface subdivision','SUBSURF');mod.levels=subdivision;mod.render_levels=subdivision
    return o


def curve(name, points, radius, mat, cyclic=False):
    d=bpy.data.curves.new(name,'CURVE');d.dimensions='3D';d.resolution_u=8;d.bevel_depth=radius;d.bevel_resolution=2
    s=d.splines.new('POLY');s.points.add(len(points)-1)
    for p,v in zip(s.points,points):p.co=(*v,1)
    s.use_cyclic_u=cyclic
    o=bpy.data.objects.new(name,d);COL.objects.link(o);o.data.materials.append(mat)
    return o


def interp(rows,t):
    k=min(len(rows)-2,max(0,int(t)));u=t-k
    a=rows[max(0,k-1)];b=rows[k];c=rows[k+1];d=rows[min(len(rows)-1,k+2)]
    return [.5*((2*b[j])+(-a[j]+c[j])*u+(2*a[j]-5*b[j]+4*c[j]-d[j])*u*u+(-a[j]+3*b[j]-3*c[j]+d[j])*u*u*u) for j in range(len(b))]


# z, half width, half depth, centre Y. Bust, ribcage, waist, hip and neck are
# sculpted as one shaped surface rather than overlapping mannequin spheres.
TORSO=[(.930,.168,.098,.014),(.945,.168,.099,.014),(.995,.157,.095,.014),(1.055,.125,.078,.015),(1.110,.112,.071,.013),(1.160,.122,.078,.010),(1.210,.142,.090,.008),(1.260,.150,.096,.006),(1.305,.157,.081,.012),(1.345,.172,.067,.017),(1.365,.164,.060,.015),(1.389,.125,.055,.006),(1.411,.075,.046,-.003),(1.433,.041,.039,-.008),(1.447,.041,.039,-.008)]


def torso(mat, cloth=False):
    n=88;res=100;vs=[];fs=[]
    for i in range(res+1):
        z,w,d,cy=interp(TORSO,i/res*(len(TORSO)-1))
        for j in range(n):
            t=2*pi*j/n;x=w*sin(t);front=max(0,cos(t));back=max(0,-cos(t))
            y=cy-d*cos(t)
            # Gently distinct chest contours and the sternum, muted under jersey.
            y-=.010*front**4*exp(-((z-1.265)/.049)**2)*exp(-((abs(x)-.065)/.054)**2)
            y+=.0028*front**7*exp(-((z-1.325)/.034)**2)
            # Shallow collarbone ridges across a natural upper chest.
            clav=1.363-.15*abs(x)+.009*exp(-(x/.047)**2)
            y-=.0022*front**3*exp(-((z-clav)/.010)**2)*min(1,abs(x)/.035)
            y+=.003*back**8*exp(-((z-1.31)/.09)**2)
            if cloth:
                x+=.0030*sin(t);y-=.0040*cos(t)
                # Quiet oblique drape: fabric is fitted, not a shiny bodysuit.
                line=1.22-.35*x
                fold=.0019*exp(-((z-line)/.014)**2)-.0010*exp(-((z-line-.017)/.012)**2)
                fold+=.0013*exp(-((z-(1.11-.32*x))/.016)**2)
                y-=front**6*fold
                y-=.0008*front**4*sin(112*z+14*x)*exp(-((z-.97)/.04)**2)
            vs.append((x,y,z))
    for i in range(res):
        for j in range(n):a=i*n+j;b=i*n+(j+1)%n;fs.append((a,b,b+n,a+n))
    fs.extend([tuple(reversed(range(n))),tuple(res*n+j for j in range(n))])
    return mesh('Dress | torso pattern' if cloth else 'Body | sculpted torso',vs,fs,mat)


ARM=[(.145,.015,1.379,.012,.022),(.169,.014,1.378,.030,.041),(.187,.014,1.355,.044,.052),(.200,.012,1.315,.046,.050),(.214,.009,1.260,.043,.045),(.226,.003,1.180,.038,.040),(.235,-.002,1.100,.033,.035),(.238,-.009,1.065,.032,.034),(.242,-.017,1.000,.030,.031),(.245,-.023,.937,.025,.028),(.245,-.025,.891,.0225,.025),(.245,-.025,.884,.0225,.025)]


def arm(side,mat,cloth=False):
    n=56;res=90;vs=[];fs=[]
    for i in range(res+1):
        x,y,z,rx,ry=interp(ARM,i/res*(len(ARM)-1))
        if cloth:rx+=.0028;ry+=.0032
        for j in range(n):
            t=2*pi*j/n;f=0
            if cloth:
                f=.0010*sin((z-1.09)*102+1.2*cos(t))*exp(-((z-1.09)/.044)**2)*max(0,cos(t-.6))**3
                f+=.0006*sin(z*146+cos(t))*exp(-((z-.926)/.026)**2)
            vs.append((side*(x+(rx+f)*sin(t)),y-(ry+f)*cos(t),z+.0018*cos(t)*exp(-((z-1.09)/.04)**2)))
    for i in range(res):
        for j in range(n):a=i*n+j;b=i*n+(j+1)%n;fs.append((a,b,b+n,a+n))
    fs.extend([tuple(reversed(range(n))),tuple(res*n+j for j in range(n))])
    return mesh(('Sleeve' if cloth else 'Body')+' | shaped arm '+('.L' if side>0 else '.R'),vs,fs,mat)


def union(parts,name,voxel=.0022,shoulders=False):
    bpy.ops.object.select_all(action='DESELECT')
    for o in parts:o.select_set(True)
    bpy.context.view_layer.objects.active=parts[0];bpy.ops.object.join();o=bpy.context.object;o.name=name
    mod=o.modifiers.new('Connected organic tailoring','REMESH');mod.mode='VOXEL';mod.voxel_size=voxel
    bpy.ops.object.modifier_apply(modifier=mod.name)
    mod=o.modifiers.new('Soft continuous surface','SMOOTH');mod.factor=.65;mod.iterations=5
    bpy.ops.object.modifier_apply(modifier=mod.name)
    if shoulders:
        group=o.vertex_groups.new(name='Sculpted shoulder transition')
        for v in o.data.vertices:
            wt=exp(-((v.co.z-1.35)/.040)**2)*exp(-((abs(v.co.x)-.159)/.059)**2)
            if wt>.01:group.add([v.index],wt,'REPLACE')
        mod=o.modifiers.new('Connected deltoid and trapezius','SMOOTH');mod.factor=.95;mod.iterations=24;mod.vertex_group=group.name
        bpy.ops.object.modifier_apply(modifier=mod.name)
    for p in o.data.polygons:p.use_smooth=True
    return o


# One continuous cut: woman's right shoulder is covered, left shoulder exposed.
# Plane equation z + .62*x - .035*y = 1.390.
def neckline_cut(o, keep_above=False, level=1.390):
    bm=bmesh.new();bm.from_mesh(o.data)
    geom=list(bm.verts)+list(bm.edges)+list(bm.faces)
    bmesh.ops.bisect_plane(bm,geom=geom,dist=.00001,plane_co=(0,0,level),plane_no=(.62,-.035,1),clear_inner=keep_above,clear_outer=not keep_above)
    # The neck opening must remain open, not an opaque disk under the head.
    if keep_above:
        cap=[f for f in bm.faces if all(v.co.z>1.443 for v in f.verts)]
        bmesh.ops.delete(bm,geom=cap,context='FACES')
    bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(o.data);bm.free();o.data.update()


def neckline_trim(o,mat):
    bm=bmesh.new();bm.from_mesh(o.data)
    edges=[e for e in bm.edges if e.is_boundary and all(abs(v.co.z+.62*v.co.x-.035*v.co.y-1.390)<.001 for v in e.verts)]
    adjacency={}
    for e in edges:
        a,b=e.verts;adjacency.setdefault(a,[]).append(b);adjacency.setdefault(b,[]).append(a)
    unused=set(adjacency);loops=[]
    while unused:
        v=next(iter(unused));pts=[];last=None;start=v
        while v in unused:
            unused.remove(v);pts.append(tuple(v.co))
            nxt=[w for w in adjacency[v] if w!=last and (w in unused or w==start)]
            if not nxt:break
            last,v=v,nxt[0]
        if len(pts)>4:loops.append(pts)
    bm.free()
    return [curve('Dress | narrow rolled asymmetric neckline',pts,.0011,mat,True) for pts in loops]


def ring_tube(name,rows,mat,n=56,res=85,wrinkles=False):
    vs=[];fs=[]
    for i in range(res+1):
        x,y,z,rx,ry=interp(rows,i/res*(len(rows)-1))
        for j in range(n):
            t=2*pi*j/n;fold=0
            if wrinkles:
                fold=.0009*sin(z*101+1.8*cos(t))*exp(-((z-.15)/.046)**2)*max(0,cos(t+.4))**2
                fold+=.0007*sin(z*87+cos(t))*exp(-((z-.51)/.043)**2)*max(0,cos(t-.7))**2
            vs.append((x+(rx+fold)*sin(t),y-(ry+fold)*cos(t),z))
    for i in range(res):
        for j in range(n):a=i*n+j;b=i*n+(j+1)%n;fs.append((a,b,b+n,a+n))
    fs.extend([tuple(reversed(range(n))),tuple(res*n+j for j in range(n))])
    return mesh(name,vs,fs,mat)


def trousers(mat,seam):
    parts=[ring_tube('Trousers | smooth pelvic bridge',[(0,.018,.791,.016,.035),(0,.018,.809,.071,.068),(0,.018,.848,.142,.091),(0,.020,.900,.166,.098),(0,.018,.955,.161,.097),(0,.016,.991,.151,.094)],mat,n=72,res=50)]
    for s in [-1,1]:
        rows=[(s*.073,.016,.991,.079,.073),(s*.078,.018,.958,.084,.078),(s*.084,.020,.901,.086,.087),(s*.086,.016,.842,.084,.091),(s*.087,.010,.770,.077,.083),(s*.087,.005,.650,.064,.071),(s*.087,-.004,.510,.048,.057),(s*.087,-.005,.470,.047,.055),(s*.087,.002,.375,.047,.055),(s*.087,.007,.290,.043,.051),(s*.087,.008,.190,.035,.044),(s*.087,.006,.117,.032,.039),(s*.087,.006,.108,.032,.039)]
        parts.append(ring_tube('Trousers | shaped leg '+('.L' if s>0 else '.R'),rows,mat,wrinkles=True))
    o=union(parts,'Trousers | connected fitted hips and tapered legs',voxel=.0022)
    group=o.vertex_groups.new(name='Smooth tailored hips')
    for v in o.data.vertices:
        wt=exp(-((v.co.z-.895)/.092)**2)
        if wt>.01:group.add([v.index],wt,'REPLACE')
    mod=o.modifiers.new('Smooth hip to thigh tailoring','SMOOTH');mod.factor=.9;mod.iterations=28;mod.vertex_group=group.name
    bpy.context.view_layer.objects.active=o;bpy.ops.object.modifier_apply(modifier=mod.name)
    o['construction']='Connected crotch and hip volume; fine knee and ankle cloth tension; high enough waist for seated poses.'
    # Fine pressed crease, understated enough to retain a believable soft fabric.
    for s in [-1,1]:
        curve('Trousers | pressed front '+('.L' if s>0 else '.R'),[(s*.087,-.034,.13),(s*.087,-.039,.25),(s*.087,-.051,.43),(s*.087,-.059,.51),(s*.087,-.062,.63),(s*.086,-.077,.77),(s*.084,-.080,.85)],.00032,seam)
    return o


def hands(skin):
    data=np.load(HAND_SOURCE);out=[]
    for s,key,suffix in [(1,'l','.L'),(-1,'r','.R')]:
        A=np.array([s*.020,-.055,-.998]);A/=np.linalg.norm(A)
        U=np.array([s*.43,-.90,.065]);U-=A*np.dot(A,U);U/=np.linalg.norm(U);N=np.cross(U,A)
        vs=[]
        for xx,yy,zz in data[key+'_vertices']:
            curl=max(0,zz-.60)**2*.17
            # A subtle relaxed finger fan, with a slim female wrist and palm.
            vs.append(tuple(np.array([s*.245,-.025,.882])+.089*(xx*.94*U+(yy+curl)*N+zz*A)))
        fs=[];start=0
        for count in data[key+'_face_counts']:
            fs.append(data[key+'_indices'][start:start+count].tolist());start+=count
        o=mesh('Hand | anatomical relaxed fingers '+suffix,vs,fs,skin,2)
        o['source']='MakeHuman hm08 hand topology, CC0 (September 2020). Transformed and posed; see PROVENANCE.'
        o['pose']='Relaxed natural hands. Full separated thumb and finger topology is editable.'
        out.append(o)
    return out


# Longitudinal sections form an actual shoe last, not an ellipsoid stack.
# y, width, bottom and top: a pointed toe, arch, raised heel and open vamp.
LAST=[(-.184,.002,.022,.030),(-.165,.013,.023,.041),(-.136,.028,.023,.053),(-.099,.039,.025,.068),(-.061,.040,.031,.081),(-.022,.035,.044,.098),(.016,.029,.061,.119),(.047,.027,.070,.121),(.069,.020,.072,.109),(.080,.002,.075,.092)]


def shoe_last(side,mat,name,skin=False):
    vs=[];fs=[];n=56;res=65;cx=side*.087
    for i in range(res+1):
        y,w,b,t=interp(LAST,i/res*(len(LAST)-1));cz=(b+t)/2;h=(t-b)/2
        for j in range(n):
            a=2*pi*j/n
            vs.append((cx+w*cos(a)*(1-.035*sin(a)),y,cz+h*sin(a)))
    for i in range(res):
        for j in range(n):
            a=i*n+j;b=i*n+(j+1)%n;f=(a,b,b+n,a+n)
            if not skin:
                co=np.mean([vs[q] for q in f],axis=0);y=co[1]
                # A scooped topline opens toward the instep and encloses the heel.
                rim=float(np.interp(y,[-.19,-.089,-.061,-.025,.018,.050,.080],[.10,.10,.066,.070,.086,.106,.12]))
                if co[2]>rim:continue
            if skin and max(vs[q][1] for q in f)<-.080:continue
            fs.append(f)
    if not skin:fs.append(tuple(reversed(range(n))))
    fs.append(tuple(res*n+j for j in range(n)))
    o=mesh(name,vs,fs,mat,1)
    if not skin:
        mod=o.modifiers.new('Leather upper thickness','SOLIDIFY');mod.thickness=.0011
    return o


def pumps(side,leather,sole,skin):
    suffix='.L' if side>0 else '.R';cx=side*.087
    foot=shoe_last(side,skin,'Pump | visible foot and instep '+suffix,True)
    # Shrink the hidden foot slightly so it cannot show through the leather.
    for v in foot.data.vertices:
        v.co.x=cx+(v.co.x-cx)*.960
        bottom=float(np.interp(v.co.y,[row[0] for row in LAST],[row[2] for row in LAST]))
        top=float(np.interp(v.co.y,[row[0] for row in LAST],[row[3] for row in LAST]))
        mid=(bottom+top)/2
        v.co.z=mid+(v.co.z-mid)*.91
        v.co.y=-.05+(v.co.y+.05)*.985
    ankle=ring_tube('Pump | shaped ankle '+suffix,[(cx,.030,.076,.023,.030),(cx,.025,.092,.024,.032),(cx,.016,.117,.025,.033),(cx,.009,.139,.026,.034)],skin,n=40,res=20)
    shoe_last(side,leather,'Pump | pointed leather upper '+suffix)
    # Thin outsole follows the upward arch, with a narrow elegant heel.
    vs=[];fs=[];n=56;res=55
    for i in range(res+1):
        y,w,b,t=interp(LAST,i/res*(len(LAST)-1))
        for j in range(n):
            a=2*pi*j/n;vs.append((cx+(w+.0012)*cos(a),y,b-.001+.0016*sin(a)))
    for i in range(res):
        for j in range(n):a=i*n+j;b=i*n+(j+1)%n;fs.append((a,b,b+n,a+n))
    mesh('Pump | shaped outsole '+suffix,vs,fs,sole,1)
    ring_tube('Pump | tapered heel '+suffix,[(cx,.054,.012,.009,.011),(cx,.054,.017,.010,.012),(cx,.054,.048,.012,.014),(cx,.052,.072,.020,.021)],leather,n=32,res=30)


def build_body(collection=None,skin=None):
    """Build an editable, unrigged Lori wardrobe/body; return new objects only."""
    global COL
    COL=collection or bpy.data.collections.new('LORI | body and black wardrobe')
    if collection is None:bpy.context.scene.collection.children.link(COL)
    before=set(bpy.data.objects)
    if skin is None:
        skin=material('Lori | warm peach skin',(.405,.215,.125),.48)
        skin.node_tree.nodes.get('Principled BSDF').inputs['Subsurface Weight'].default_value=.065
    jersey=material('Lori | fine black asymmetric jersey',(.010,.009,.011),.69,fabric=True)
    trouser=material('Lori | black tailored crepe',(.012,.012,.015),.79,fabric=True)
    edge=material('Lori | black rolled edging',(.014,.013,.015),.61)
    seam=material('Lori | subtle charcoal stitching',(.018,.018,.021),.80)
    leather=material('Lori | black pump leather',(.010,.009,.011),.28)
    sole=material('Lori | charcoal pump soles',(.005,.004,.006),.70)
    body=union([torso(skin),arm(-1,skin),arm(1,skin)],'Body | Skin torso and connected bare shoulder',shoulders=True)
    neckline_cut(body,True,1.384)
    body['anatomy']='Connected neck, clavicles, trapezius and left deltoid; hidden skin removed to prevent garment poke-through.'
    top_parts=[torso(jersey,True),arm(-1,jersey,True),arm(1,jersey,True)]
    for side in [-1,1]:
        top_parts.append(ring_tube('Dress | underarm fabric gusset',[(side*.148,.010,1.200,.006,.028),(side*.163,.011,1.225,.024,.037),(side*.165,.012,1.270,.029,.040),(side*.167,.012,1.300,.025,.039)],jersey,n=40,res=24))
    top=union(top_parts,'Dress | asymmetric fitted top',shoulders=True)
    group=top.vertex_groups.new(name='Soft underarm tailoring')
    for v in top.data.vertices:
        wt=exp(-((v.co.z-1.272)/.058)**2)*exp(-((abs(v.co.x)-.168)/.048)**2)
        if wt>.01:group.add([v.index],wt,'REPLACE')
    mod=top.modifiers.new('Smooth sleeve gusset transition','SMOOTH');mod.factor=.95;mod.iterations=42;mod.vertex_group=group.name
    bpy.context.view_layer.objects.active=top;bpy.ops.object.modifier_apply(modifier=mod.name)
    neckline_cut(top)
    top['reference']='Black asymmetric top: covered right shoulder, exposed left shoulder, long sleeves. Reference photograph not distributed.'
    top['construction']='Short hip-length hem suitable for seated poses; continuous shoulders and sleeves; open diagonal neckline.'
    neckline_trim(top,edge)
    mod=top.modifiers.new('Jersey hem and neckline thickness','SOLIDIFY');mod.thickness=.0012;mod.offset=-1
    # Cuff stitch follows the slim wrist rather than making a thick cuff block.
    for s in [-1,1]:
        pts=[(s*(.245+.0255*sin(t)),-.025-.028*cos(t),.891) for t in [2*pi*j/72 for j in range(72)]]
        curve('Sleeve | fine cuff stitch '+('.L' if s>0 else '.R'),pts,.0004,edge,True)
    trousers(trouser,seam)
    hands(skin)
    for s in [-1,1]:pumps(s,leather,sole,skin)
    result=[o for o in bpy.data.objects if o not in before]
    for o in result:
        o['asset_component']='Lori body and wardrobe';o['units']='metres; Z-up; forward=-Y; left=+X'
    return result


def preview():
    bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
    build_body()
    s=bpy.context.scene;s.render.engine='CYCLES';s.cycles.samples=48;s.cycles.use_denoising=False
    s.render.resolution_x=1100;s.render.resolution_y=1500;s.render.resolution_percentage=100
    s.world.color=(.19,.19,.19);s.view_settings.view_transform='AgX'
    for name,loc,energy,size,col in [('Key',(-2,-3,3.4),390,2.3,(1,.9,.81)),('Fill',(2,-2,2.6),280,2.0,(.84,.90,1)),('Rim',(1,2,2.9),450,1.6,(1,.93,.86))]:
        bpy.ops.object.light_add(type='AREA',location=loc);o=bpy.context.object;o.name=name;o.data.energy=energy;o.data.shape='DISK';o.data.size=size;o.data.color=col;o.rotation_euler=(Vector((0,0,.9))-o.location).to_track_quat('-Z','Y').to_euler()
    bpy.ops.object.camera_add(location=(1.8,-5.8,1.85));c=bpy.context.object;c.data.type='ORTHO';c.data.ortho_scale=1.72;c.rotation_euler=(Vector((0,0,.77))-c.location).to_track_quat('-Z','Y').to_euler();s.camera=c
    s.render.filepath='/tmp/lori-body-preview.png'
    bpy.ops.wm.save_as_mainfile(filepath='/tmp/lori-body-preview.blend');bpy.ops.render.render(write_still=True)

if __name__=='__main__':preview()
