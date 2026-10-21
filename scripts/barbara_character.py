"""Barbara reference study: anatomical sculpt, tailored wrap dress and cropped pixie.
Uses the repository's CC0 anatomical cage and hands; no photograph is embedded.
"""
import math, random
import bpy, bmesh
import numpy as np
from mathutils import Vector
from math import sin, cos, pi, exp
import lori_face as face
import lori_body as body


def sculpt(p):
    x,y,z=p
    front=max(0,min(1,(-y-.055)/.055))
    # Broader cheek/jaw planes, longer nose and narrower smiling eye apertures.
    x*=1+.075*exp(-((z-1.58)/.045)**2)+.10*exp(-((z-1.52)/.025)**2)
    eye=exp(-((abs(x)-.031)/.021)**4-((z-1.609)/.018)**4)*front
    z-=.20*(z-1.609)*eye
    nose=exp(-(x/.017)**4-((z-1.582)/.023)**2)*front
    y-=.004*nose;z-=.003*nose
    y+=.0024*exp(-((abs(x)-.033)/.022)**4-((z-1.592)/.006)**2)*front
    # Nasolabial plane and shallow smile crease, retained in every expression.
    crease=.025+.45*(1.57-z)
    y+=.0015*exp(-((abs(x)-crease)/.0028)**2-((z-1.552)/.026)**4)*front
    return Vector((x,y,z))


def build_face():
    objects=face.build_face()
    for o in objects:
        o.name=o.name.replace('Lori','Barbara')
        if o.data:o.data.name=o.data.name.replace('Lori','Barbara')
        if o.type!='MESH':continue
        inv=o.matrix_world.inverted()
        if o.data.shape_keys:
            for key in o.data.shape_keys.key_blocks:
                for v in key.data:v.co=inv@sculpt(o.matrix_world@v.co)
        else:
            for v in o.data.vertices:v.co=inv@sculpt(o.matrix_world@v.co)
        if o.data.color_attributes:
            for c in o.data.color_attributes['Complexion'].data:
                r,g,b,a=c.color;c.color=(r*1.18,g*1.15,b*1.10,a)
    head=next(o for o in objects if 'anatomical face' in o.name)
    with np.load(face.ROOT/'assets/lori/anatomical-head.npz') as data:
        for c,w in zip(head.data.color_attributes['Complexion'].data,data['lip_weight']):
            t=min(1,float(w)*2.3)*.7
            c.color=(*Vector(c.color[:3]).lerp(Vector((.43,.075,.048)),t),1)
    trim(head,lambda p:p.z<1.445)
    for m in {m for o in objects for m in o.data.materials if m}:
        if not m.name.startswith('Lori'):continue
        m.name=m.name.replace('Lori','Barbara')
        p=m.node_tree.nodes.get('Principled BSDF')
        if 'iris | chestnut' in m.name:p.inputs['Base Color'].default_value=(.035,.075,.080,1)
        if 'deep brown limbal' in m.name:p.inputs['Base Color'].default_value=(.025,.052,.057,1)
        if 'brows' in m.name:p.inputs['Base Color'].default_value=(.13,.075,.036,1)
    return objects


def trim(o,predicate):
    bm=bmesh.new();bm.from_mesh(o.data)
    bmesh.ops.delete(bm,geom=[v for v in bm.verts if predicate(v.co)],context='VERTS')
    bm.to_mesh(o.data);bm.free();o.data.update()


def neckline(a):
    return min(1.385,1.315+.115*abs(sin(a))) if cos(a)>0 else 1.398


def build_body():
    body.COL=bpy.data.collections.new('BARBARA | couture and anatomy');bpy.context.scene.collection.children.link(body.COL)
    skin=body.material('Barbara | peach skin',(.478,.247,.138),.52)
    skin.node_tree.nodes.get('Principled BSDF').inputs['Subsurface Weight'].default_value=.07
    red=body.material('Barbara | vermilion crepe',(.60,.018,.008),.56,fabric=True)
    edge=body.material('Barbara | crimson seams',(.39,.012,.007),.64)
    gold=body.material('Barbara | brushed gold',(.65,.39,.10),.25,.8)
    pearl=body.material('Barbara | ivory pearl',(.88,.82,.65),.22,.12)
    leather=body.material('Barbara | nude pump leather',(.28,.13,.072),.31)
    sole=body.material('Barbara | dark leather sole',(.035,.018,.012),.7)
    o=body.union([body.torso(skin),body.arm(-1,skin),body.arm(1,skin)],'Body | connected skin',shoulders=True)
    trim(o,lambda p:p.z>1.447 or (abs(p.x)<(.20 if p.z<1.10 else .16) and p.z<1.28))
    body.ring_tube('Body | neck join',[(0,-.008,1.422,.041,.039),(0,-.008,1.452,.041,.039),(0,-.008,1.480,.041,.039)],skin,n=64,res=24)
    for s in [-1,1]:
        sleeve=body.arm(s,red,True);sleeve.name='Sleeve | Barbara cap '+str(s)
        trim(sleeve,lambda p:p.z<1.287)
        for v in sleeve.data.vertices:
            v.co.z+=.006*max(0,min(1,(v.co.z-1.32)/.04))
        mod=sleeve.modifiers.new('Turned sleeve edge','SOLIDIFY');mod.thickness=.0014
    # Lofted V neckline; tailored volume uses the existing continuous torso pattern.
    vs=[];fs=[];n=96;r=65
    for i in range(r+1):
        u=i/r
        for j in range(n):
            a=2*pi*j/n;z=1.012+(neckline(a)-1.012)*u
            rows=body.TORSO
            w=float(np.interp(z,[p[0] for p in rows],[p[1] for p in rows]))
            d=float(np.interp(z,[p[0] for p in rows],[p[2] for p in rows]));cy=.01
            x=(w+.005)*sin(a);front=max(0,cos(a))
            y=cy-(d+.005)*cos(a)
            y-=.011*front**4*exp(-((z-1.265)/.049)**2)*exp(-((abs(x)-.065)/.054)**2)
            for level in [1.065,1.104,1.15,1.205]:
                y-=.0035*front**6*exp(-((z-level+.33*x)/.009)**2)
            vs.append((x,y,z))
    for i in range(r):
        for j in range(n):a=i*n+j;b=i*n+(j+1)%n;fs.append((a,b,b+n,a+n))
    top=body.mesh('Dress | Barbara wrap bodice',vs,fs,red,1)
    mod=top.modifiers.new('Crepe thickness','SOLIDIFY');mod.thickness=.0014
    body.curve('Dress | V neckline seam',vs[-n:],.0009,edge,True)
    # Continuous pencil skirt. Generous knee circumference for the seated pose.
    rows=[(0,.016,.57,.164,.108),(0,.016,.585,.166,.110),(0,.017,.68,.177,.119),(0,.018,.79,.187,.130),(0,.018,.89,.186,.129),(0,.017,.96,.166,.104),(0,.012,1.025,.142,.089),(0,.011,1.055,.127,.083)]
    skirt=body.ring_tube('Skirt | continuous wrap',rows,red,n=96,res=75)
    for v in skirt.data.vertices:
        x,y,z=v.co;front=max(0,-y/.1)
        v.co.y-=.0025*front**4*sin(65*z+12*x)*exp(-((z-.96)/.11)**2)
    trim(skirt,lambda p:p.z<.571)
    mod=skirt.modifiers.new('Skirt hem thickness','SOLIDIFY');mod.thickness=.0015
    body.curve('Skirt | diagonal wrap seam',[(.098-.16*t,-(.09+.02*sin(pi*t)),1.028-.445*t) for t in np.linspace(0,1,80)],.0008,edge)
    # Skin legs under skirt, including gently modeled knees and calves.
    for s in [-1,1]:
        rows=[(s*.087,.008,.12,.027,.035),(s*.087,.005,.22,.033,.041),(s*.087,.008,.32,.049,.055),(s*.087,.002,.40,.048,.051),(s*.087,-.002,.49,.043,.047),(s*.087,.005,.56,.050,.058),(s*.087,.010,.67,.067,.071),(s*.087,.012,.79,.078,.082)]
        body.ring_tube('Leg | Barbara anatomy '+str(s),rows,skin,n=48,res=70)
        body.pumps(s,leather,sole,skin)
    body.hands(skin)
    # Two irregular pearl strands fall over the collarbones, with real bead gaps.
    for strand in range(2):
        count=31+strand*4
        for i in range(count):
            a=2*pi*i/count
            x=(.066+strand*.012)*sin(a);y=-.010-(.059+strand*.016)*cos(a)
            z=1.416-(.054+strand*.019)*max(0,cos(a))+.009*max(0,-cos(a))
            r=.0043+(i%3)*.00035
            face.sphere('Necklace | pearl', (x,y,z),(r,r*.88,r),pearl,16,12)
    for s in [-1,1]:
        face.sphere('Earring | pearl '+str(s),(s*.082,-.036,1.568),(.0046,.0046,.005),pearl,20,14)
        face.sphere('Earring | gold mount '+str(s),(s*.082,-.034,1.575),(.003,.003,.0034),gold,16,12)
    for i in range(26):
        a=2*pi*i/26
        face.sphere('Bracelet | gold link',(.245+.025*sin(a),-.025-.028*cos(a),.918),(.003,.003,.006),gold,12,8)


def build_hair():
    rng=random.Random(92);mats=[]
    for name,col in [('shadow',(.22,.14,.064)),('wheat',(.53,.38,.19)),('champagne',(.57,.41,.21)),('ivory',(.64,.48,.26)),('honey',(.43,.28,.12))]:
        mats.append(face.material('Barbara pixie | '+name,col,.46))
    def surface(a,p,lift=0):
        return Vector(((.092+lift)*sin(p)*sin(a),-.045-(.102+lift)*sin(p)*cos(a),1.599+(.128+lift)*cos(p)))
    def end(a):return 1.26+.32*(1-max(0,cos(a))**2)+.32*max(0,-cos(a))
    vs=[];fs=[];n=96;r=32
    for i in range(r+1):
        for j in range(n):
            a=2*pi*j/n;vs.append(surface(a,.01+(end(a)-.01)*i/r))
    for i in range(r):
        for j in range(n):a=i*n+j;b=i*n+(j+1)%n;fs.append((a,b,b+n,a+n))
    face.mesh_object('Hair | cropped scalp',vs,fs,mats[1])
    # Small tapered locks follow scalp flow, with an asymmetric, airy front fringe.
    groups=[([],[]) for _ in mats]
    for k in range(750):
        a=rng.uniform(-pi,pi);p=rng.uniform(.08,end(a)-.16)
        length=rng.uniform(.45,.78);width=rng.uniform(.0018,.0032)
        vv,ff=groups[1+k%4];base=len(vv);steps=13;sides=8
        for i in range(steps):
            t=i/(steps-1);ph=min(end(a)+.08,p+length*t)
            aa=a+(.44 if cos(a)>.1 else .17)*sin(t*pi/2)
            lift=.0015+.003*sin(pi*t)+(.004 if p<.6 else 0)*sin(pi*t)
            center=surface(aa,ph,lift)
            across=Vector((cos(aa),sin(aa),0));normal=(center-Vector((0,-.045,1.599))).normalized()
            taper=(1-t)**.7+.012
            for j in range(sides):
                q=2*pi*j/sides
                vv.append(center+across*(width*cos(q)*taper)+normal*(.00038*sin(q)*taper))
        for i in range(steps-1):
            for j in range(sides):a0=base+i*sides+j;b=base+i*sides+(j+1)%sides;ff.append((a0,b,b+sides,a0+sides))
        ff.extend([tuple(base+j for j in reversed(range(sides))),tuple(base+(steps-1)*sides+j for j in range(sides))])
    # Front layers follow the curved skull with irregular tips above the brows.
    for k in range(80):
        a=-.9+1.8*k/79;startp=rng.uniform(.30,.65);endp=rng.uniform(1.19,1.33)
        vv,ff=groups[1+k%4];base=len(vv);steps=16;sides=8
        for i in range(steps):
            t=i/(steps-1);aa=a+.18*t
            center=surface(aa,startp+(endp-startp)*t,.003+.004*sin(pi*t))
            across=Vector((cos(aa),sin(aa),0));normal=(center-Vector((0,-.045,1.599))).normalized()
            width=.0024*(1-t)**.65+.00003
            for j in range(sides):
                q=2*pi*j/sides;vv.append(center+across*(width*cos(q))+normal*(.0005*sin(q)))
        for i in range(steps-1):
            for j in range(sides):a0=base+i*sides+j;b=base+i*sides+(j+1)%sides;ff.append((a0,b,b+sides,a0+sides))
        ff.extend([tuple(base+j for j in reversed(range(sides))),tuple(base+(steps-1)*sides+j for j in range(sides))])
    for i,(vs,fs) in enumerate(groups):
        if vs:face.mesh_object('Hair | sculpted pixie layers '+str(i),vs,fs,mats[i])
