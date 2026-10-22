"""Organic tailored Mark body. Callable build_body(collection=None, skin=None).
Z up, faces -Y, metres. Anatomical hands use MakeHuman CC0 source mesh.
"""
import bpy, math, os, sys
from mathutils import Vector
from math import sin, cos, pi, exp, sqrt

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
HAND_SOURCE = os.path.join(ROOT, 'assets', 'kevin', 'source', 'anatomical_hands_cc0.npz')
COL = None

def material(name, color, roughness=.55, metallic=0, fabric=False):
    m=bpy.data.materials.get(name) or bpy.data.materials.new(name)
    m.diffuse_color=(*color,1); m.use_nodes=True
    p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(*color,1);p.inputs['Roughness'].default_value=roughness;p.inputs['Metallic'].default_value=metallic
    if fabric:
        p.inputs['Specular IOR Level'].default_value=.28
        n=m.node_tree.nodes.new('ShaderNodeTexNoise');n.inputs['Scale'].default_value=650;n.inputs['Detail'].default_value=2
        b=m.node_tree.nodes.new('ShaderNodeBump');b.inputs['Strength'].default_value=.19;b.inputs['Distance'].default_value=.00018
        m.node_tree.links.new(n.outputs['Fac'],b.inputs['Height']);m.node_tree.links.new(b.outputs['Normal'],p.inputs['Normal'])
    return m

def mesh(name, verts, faces, mat, sub=0):
    d=bpy.data.meshes.new(name);d.from_pydata(verts,[],faces);d.update();o=bpy.data.objects.new(name,d);COL.objects.link(o)
    if mat:o.data.materials.append(mat)
    for f in d.polygons:f.use_smooth=True
    if sub:
        m=o.modifiers.new('Tailored curvature','SUBSURF');m.levels=sub;m.render_levels=sub
    return o

def curve(name, pts, radius, mat):
    d=bpy.data.curves.new(name,'CURVE');d.dimensions='3D';d.resolution_u=12;d.bevel_depth=radius;d.bevel_resolution=3
    s=d.splines.new('BEZIER');s.bezier_points.add(len(pts)-1)
    for p,v in zip(s.bezier_points,pts):p.co=v;p.handle_left_type='AUTO';p.handle_right_type='AUTO'
    o=bpy.data.objects.new(name,d);COL.objects.link(o);o.data.materials.append(mat);return o

def ellipsoid(name, loc, scale, mat):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=40,ring_count=24,location=loc);o=bpy.context.object;o.name=name
    for c in list(o.users_collection):c.objects.unlink(o)
    COL.objects.link(o);o.scale=scale;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);o.data.materials.append(mat)
    for p in o.data.polygons:p.use_smooth=True
    return o

def interp(rows,t):
    # Cubic interpolating profile, with clamped end derivatives.
    k=min(len(rows)-2,max(0,int(t)));u=t-k;a=rows[max(0,k-1)];b=rows[k];c=rows[k+1];d=rows[min(len(rows)-1,k+2)]
    return [.5*((2*b[j])+(-a[j]+c[j])*u+(2*a[j]-5*b[j]+4*c[j]-d[j])*u*u+(-a[j]+3*b[j]-3*c[j]+d[j])*u*u*u) for j in range(len(b))]

# z, width, depth, center-y. A barrel-chested mature build with a softly rounded abdomen.
TORSO=[(.858,.184,.121,.025),(.868,.189,.126,.025),(.92,.187,.123,.027),(1.02,.187,.132,.024),(1.13,.189,.141,.020),(1.25,.204,.137,.021),(1.35,.213,.120,.025),(1.397,.211,.105,.029),(1.43,.177,.090,.007),(1.47,.094,.072,-.016),(1.489,.070,.063,-.020)]
def torso_y(x,z):
    rows=TORSO
    if z<=rows[0][0]:a,b=rows[0],rows[1]
    elif z>=rows[-1][0]:a,b=rows[-2],rows[-1]
    else:
        a,b=next((a,b) for a,b in zip(rows,rows[1:]) if a[0]<=z<=b[0])
    u=(z-a[0])/(b[0]-a[0]);w=a[1]*(1-u)+b[1]*u;d=a[2]*(1-u)+b[2]*u;cy=a[3]*(1-u)+b[3]*u
    return cy-d*sqrt(max(.01,1-(x/w)**2))

def torso(mat):
    n=96;r=100;vs=[];fs=[]
    for i in range(r+1):
        z,w,d,cy=interp(TORSO,i/r*(len(TORSO)-1))
        for j in range(n):
            t=2*pi*j/n;x=w*sin(t);y=cy-d*cos(t)
            # Gentle tailored cloth tension from closure, lower hem and shoulder blade.
            front=max(0,cos(t))**8
            y-=front*.0016*sin(z*68+x*9)*exp(-((z-1.07)/.10)**2)
            y+=max(0,-cos(t))**5*.002*sin(z*48)*exp(-((z-1.12)/.25)**2)
            zz=z+.006*cos(t)*exp(-((z-.86)/.04)**2)
            vs.append((x,y,zz))
    for i in range(r):
        for j in range(n):a=i*n+j;b=i*n+(j+1)%n;fs.append((a,b,b+n,a+n))
    fs += [tuple(reversed(range(n))),tuple(r*n+j for j in range(n))]
    return mesh('Jacket | shaped chest and waist',vs,fs,mat)

def sleeve(side,mat):
    # path: centre x,y,z, ellipse radius x/forward, slightly bent elbows.
    rows=[(.183,.027,1.426,.009,.020),(.201,.027,1.409,.034,.050),(.220,.027,1.389,.055,.066),(.234,.025,1.351,.063,.071),(.238,.022,1.322,.068,.073),(.250,.017,1.25,.062,.066),(.264,.008,1.16,.056,.059),(.273,-.002,1.105,.052,.055),(.277,-.015,1.04,.047,.051),(.281,-.031,.969,.041,.045),(.282,-.046,.919,.037,.041),(.282,-.048,.908,.037,.040)]
    vs=[];fs=[];n=56;r=85
    for i in range(r+1):
        x,y,z,rx,ry=interp(rows,i/r*(len(rows)-1))
        for j in range(n):
            t=2*pi*j/n
            fold=(.0019*sin((z-1.06)*110+1.1*cos(t))*exp(-((z-1.105)/.052)**2)*max(0,cos(t-.8))**3+.0009*sin((z-.93)*145+2*cos(t))*exp(-((z-.943)/.028)**2)*max(0,cos(t+.6))**2)
            vs.append((side*(x+(rx+fold)*sin(t)),y-(ry+fold)*cos(t),z+.003*cos(t)*exp(-((z-1.12)/.04)**2)))
    for i in range(r):
        for j in range(n):a=i*n+j;b=i*n+(j+1)%n;fs.append((a,b,b+n,a+n))
    fs += [tuple(reversed(range(n))),tuple(r*n+j for j in range(n))]
    return mesh('Jacket | sleeve '+str(side),vs,fs,mat)

def union(parts, name, vox=.0025):
    bpy.ops.object.select_all(action='DESELECT')
    for o in parts:o.select_set(True)
    bpy.context.view_layer.objects.active=parts[0];bpy.ops.object.join();o=bpy.context.object;o.name=name
    m=o.modifiers.new('Continuous shoulder tailoring','REMESH');m.mode='VOXEL';m.voxel_size=vox;bpy.ops.object.modifier_apply(modifier=m.name)
    m=o.modifiers.new('Soft cloth finish','SMOOTH');m.factor=.68;m.iterations=5;bpy.ops.object.modifier_apply(modifier=m.name)
    vg=o.vertex_groups.new(name='Shoulder blend')
    for v in o.data.vertices:
        weight=exp(-((v.co.z-1.385)/.070)**2)*exp(-((abs(v.co.x)-.205)/.095)**2)
        if weight>.01:vg.add([v.index],weight,'REPLACE')
    m=o.modifiers.new('Natural sloped shoulder blend','SMOOTH');m.factor=1.2;m.iterations=45;m.vertex_group=vg.name;bpy.ops.object.modifier_apply(modifier=m.name)
    for p in o.data.polygons:p.use_smooth=True
    return o

def panel(name,xzs,mat,offset=.003,thickness=.0014):
    # Tessellate and subdivide in pattern space, then drape every vertex over the
    # shaped coat. Non-planar n-gons would cut straight through its convex chest.
    from mathutils.geometry import tessellate_polygon
    polygon=[Vector((x,z,0)) for x,z in xzs]
    tris=tessellate_polygon([polygon]);vs=[];fs=[];lookup={};steps=10
    def vertex(p):
        x,z=p.x,p.y;k=(round(x,7),round(z,7))
        if k not in lookup:
            lookup[k]=len(vs);vs.append((x,torso_y(x,z)-offset,z))
        return lookup[k]
    for tri in tris:
        a,b,c=[polygon[v] if isinstance(v,int) else v for v in tri]
        grid={}
        for i in range(steps+1):
            for j in range(steps+1-i):grid[i,j]=vertex(a+(b-a)*(i/steps)+(c-a)*(j/steps))
        for i in range(steps):
            for j in range(steps-i):
                fs.append((grid[i,j],grid[i+1,j],grid[i,j+1]))
                if i+j<steps-1:fs.append((grid[i+1,j],grid[i+1,j+1],grid[i,j+1]))
    o=mesh(name,vs,fs,mat)
    s=o.modifiers.new('Fabric thickness','SOLIDIFY');s.thickness=thickness
    b=o.modifiers.new('Rolled cut edge','BEVEL');b.width=.00065;b.segments=2
    return o

def ring_tube(name, rows, mat, n=48, resolution=65, wrinkles=False):
    vs=[];fs=[]
    for i in range(resolution+1):
        x,y,z,rx,ry=interp(rows,i/resolution*(len(rows)-1))
        for j in range(n):
            t=2*pi*j/n;fold=0
            if wrinkles:
                fold=.0016*sin(z*102+2*cos(t))*exp(-((z-.18)/.06)**2)*max(0,cos(t+.4))**2+.0008*sin(z*73+cos(t))*exp(-((z-.53)/.06)**2)*max(0,cos(t-.5))**3
            vs.append((x+(rx+fold)*sin(t),y-(ry+fold)*cos(t),z))
    for i in range(resolution):
        for j in range(n):a=i*n+j;b=i*n+(j+1)%n;fs.append((a,b,b+n,a+n))
    fs+=[tuple(reversed(range(n))),tuple(resolution*n+j for j in range(n))]
    return mesh(name,vs,fs,mat)

def anatomical_hands(skin):
    # The bundled subset contains hands only, derived from the official MakeHuman
    # hm08 base.obj. That asset was explicitly released as CC0 in September 2020.
    # Original credited holders: Data Collection AB, Joel Palmius, Jonas Hauquier.
    import numpy as np
    data=np.load(HAND_SOURCE)
    for s,side in [(1,'l'),(-1,'r')]:
        A=np.array([s*.04,-.07,-.997]);A/=np.linalg.norm(A)
        U=np.array([s*.43,-.90,.08]);U-=A*np.dot(A,U);U/=np.linalg.norm(U);N=np.cross(U,A)
        out=[]
        for xx,yy,zz in data[side+'_vertices']:
            curl=max(0,zz-.75)**2*.13
            out.append(tuple(np.array([s*.282,-.048,.899])+.104*(xx*U+(yy+curl)*N+zz*A)))
        faces=[];start=0
        for count in data[side+'_face_counts']:
            faces.append(data[side+'_indices'][start:start+count].tolist());start+=count
        obj=mesh('Hand | anatomical '+side,out,faces,skin,2)
        obj['source']='MakeHuman hm08 base.obj, CC0 (September 2020); extracted, transformed and posed for this asset.'

def shoe(side,leather,sole,seam):
    cx=side*.095;vs=[];fs=[];n=64
    # Cross-section layers for a closed oxford last, not stacked spheres.
    rows=[(.024,.056,.126,-.041),(.032,.060,.132,-.045),(.050,.059,.130,-.044),(.074,.057,.124,-.042),(.096,.050,.103,-.031),(.117,.042,.067,.000),(.139,.041,.049,.017)]
    for z,w,d,cy in rows:
        for j in range(n):
            t=2*pi*j/n;front=cos(t);x=cx+w*sin(t)*(1-.15*max(0,front));y=cy-d*cos(t);vs.append((x,y,z))
    for i in range(len(rows)-1):
        for j in range(n):a=i*n+j;b=i*n+(j+1)%n;fs.append((a,b,b+n,a+n))
    fs+=[tuple(reversed(range(n))),tuple((len(rows)-1)*n+j for j in range(n))]
    mesh('Loafer shoe | sculpted last '+str(side),vs,fs,leather,2)
    # Thin layered outsole preserves the shoe shape and a flat ground contact.
    ring_tube('Loafer sole '+str(side),[(cx,-.044,.014,.060,.134),(cx,-.044,.019,.061,.135),(cx,-.044,.031,.060,.133)],sole,n=64,resolution=8)
    ellipsoid('Stacked heel '+str(side),(cx,.035,.019),(.049,.047,.018),sole)
    curve('Loafer vamp seam '+str(side),[(cx-.043,-.098,.079),(cx-.026,-.113,.087),(cx,-.118,.090),(cx+.026,-.113,.087),(cx+.043,-.098,.079)],.00065,seam)

def build_body(collection=None, skin=None):
    global COL
    COL=collection or bpy.data.collections.new('MARK | tailored body')
    if not collection:bpy.context.scene.collection.children.link(COL)
    wool=material('Suit | textured black worsted',(.012,.025,.060),.79,fabric=True)
    lapel=material('Suit | softly rolled lapels',(.017,.033,.075),.73,fabric=True)
    stitch=material('Suit | fine charcoal seams',(.022,.034,.055),.78)
    white=material('Shirt | pale blue cotton',(.57,.68,.78),.76,fabric=True)
    tie=material('Tie | woven black silk',(.009,.010,.012),.35,fabric=True)
    denim=material('Jeans | dark indigo denim',(.010,.019,.035),.86,fabric=True)
    red=material('Pocket square | crimson silk',(.46,.010,.022),.45)
    leather=material('Shoes | polished black leather',(.015,.019,.026),.48)
    sole=material('Shoes | dark sole',(.006,.007,.008),.80)
    metal=material('Watch | brushed silver',(.35,.39,.41),.24,.88)
    if skin is None:
        skin=material('Skin | mature warm tone',(.30,.155,.085),.51)
        skin.node_tree.nodes.get('Principled BSDF').inputs['Subsurface Weight'].default_value=.06
    jacket=union([torso(wool),sleeve(-1,wool),sleeve(1,wool)],'Jacket | continuous organic tailored shell')
    # Cut the coat shell behind the open shirt, rather than leaving a navy throat.
    import bmesh
    bm=bmesh.new();bm.from_mesh(jacket.data)
    remove=[f for f in bm.faces if f.calc_center_median().z>1.433 and abs(f.calc_center_median().x)<.044 and f.calc_center_median().y<-.035]
    bmesh.ops.delete(bm,geom=remove,context='FACES');bm.to_mesh(jacket.data);bm.free()
    # Shirt front as a softly convex gridded inset.
    vs=[];fs=[];nz=40;nx=16
    for i in range(nz+1):
        t=i/nz;w=.006+.055*t
        for j in range(nx+1):
            x=(-1+2*j/nx)*w;top=1.453+.040*abs(-1+2*j/nx)**.7;z=1.155+(top-1.155)*t;vs.append((x,torso_y(x,z)-.004,z))
    for i in range(nz):
        for j in range(nx):a=i*(nx+1)+j;fs.append((a,a+1,a+nx+2,a+nx+1))
    mesh('Shirt | shaped white inset',vs,fs,white)
    for z in [1.27,1.35,1.428]:
        ellipsoid('Shirt pearl button',(0,torso_y(0,z)-.008,z),(.0025,.001,.0025),white)
    # Open cotton neck band sits above the jacket; no opaque cap across the neck.
    bandv=[];bandf=[]
    for z,rx,ry in [(1.473,.062,.060),(1.482,.062,.060),(1.491,.061,.058)]:
        for j in range(64):
            t=.60+(2*pi-1.20)*j/63;bandv.append((rx*sin(t),-.020-ry*cos(t),z))
    for i in range(2):
        for j in range(63):
            a=i*64+j;b=i*64+j+1;bandf.append((a,b,b+64,a+64))
    band=mesh('Shirt | fitted cotton neck band',bandv,bandf,white)
    solid=band.modifiers.new('Cotton band thickness','SOLIDIFY');solid.thickness=.0013

    for s in [-1,1]:
        # Two distinct pieces make a genuine notch and roll rather than a broad flat triangle.
        panel('Jacket collar '+str(s),[(s*.054,1.486),(s*.095,1.465),(s*.139,1.414),(s*.116,1.389),(s*.081,1.429)],lapel,.007,.0024)
        panel('Jacket notched lapel '+str(s),[(s*.081,1.429),(s*.117,1.394),(s*.144,1.401),(s*.157,1.367),(s*.039,1.131),(s*.011,1.151)],lapel,.008,.0027)
        panel('Shirt pointed collar '+str(s),[(s*.026,1.486),(s*.052,1.480),(s*.064,1.458),(s*.042,1.425),(s*.022,1.456)],white,.012,.002)
        pts=[]
        for x,z in [(s*.117,1.394),(s*.151,1.365),(s*.037,1.136)]:pts.append((x,torso_y(x,z)-.011,z))
        curve('Lapel pick stitch '+str(s),pts,.00035,stitch)
        # Welt pocket and lower pocket flap follow the chest curve.
        xzs=[(s*.079,1.005),(s*.168,1.019),(s*.169,.998),(s*.081,.981)]
        panel('Jacket flap pocket '+str(s),xzs,lapel,.008,.002)
        curve('Jacket side seam '+str(s),[(s*.176,torso_y(s*.176,z)-.002,z) for z in [.91,1.03,1.15,1.29]],.00045,stitch)
        # Shirt cuffs are shaped with continuous ellipses.
        ring_tube('Shirt cuff '+str(s),[(s*.282,-.048,.886,.032,.035),(s*.282,-.048,.899,.034,.038),(s*.282,-.047,.917,.034,.038)],white,resolution=12)
        for j in range(4):ellipsoid('Sleeve kissing button '+str(s),(s*.315,-.062,.933+j*.012),(.0027,.0042,.0042),leather)
    # Offset closure, one working button, second lower button; split hem remains unobtrusive.
    curve('Jacket front opening',[(.008,torso_y(.008,z)-.003,z) for z in [.865,.94,1.02,1.09,1.145]],.0008,lapel)
    for z in [1.12,1.025]:
        y=torso_y(.019,z)-.009;ellipsoid('Jacket horn button',(.019,y,z),(.0070,.0028,.0070),leather)
        for dx,dz in [(-.0015,-.0015),(-.0015,.0015),(.0015,-.0015),(.0015,.0015)]:ellipsoid('Horn button stitch',(.019+dx,y-.0027,z+dz),(.0005,.0003,.0005),stitch)
    panel('Breast pocket welt',[(.095,1.314),(.166,1.325),(.165,1.313),(.095,1.302)],lapel,.006,.002)
    # Trousers: generous thigh, pressed fronts, slight bends and natural break above shoes.
    for s in [-1,1]:
        rows=[(s*.087,.024,1.03,.087,.099),(s*.092,.025,.91,.091,.102),(s*.099,.021,.80,.089,.098),(s*.099,.012,.68,.080,.088),(s*.097,-.002,.55,.069,.076),(s*.096,.005,.44,.065,.072),(s*.095,.014,.31,.061,.070),(s*.095,.012,.20,.060,.069),(s*.095,.008,.132,.060,.070),(s*.095,.005,.118,.060,.069)]
        leg=ring_tube('Trousers | draped leg '+str(s),rows,denim,resolution=95,wrinkles=True)
        curve('Trousers | side seam '+str(s),[(s*.155,.010,.15),(s*.158,.014,.33),(s*.166,.003,.54),(s*.185,.016,.80)],.00035,stitch)
        shoe(s,leather,sole,stitch)
    anatomical_hands(skin)
    # Understated wristwatch, exposed just beyond the left cuff.
    ellipsoid('Watch | steel bezel',(-.307,-.068,.890),(.007,.021,.023),metal)
    ellipsoid('Watch | charcoal dial',(-.313,-.068,.890),(.002,.017,.019),tie)
    return COL
