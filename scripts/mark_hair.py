"""Short swept Mark hair: scalp-conforming closed coverage plus directional fibres.
No spherical hair helmet. The underlying anatomical scalp defines every patch.
"""
import bpy, math, random
from mathutils import Vector
from mark_face import material, mesh_object

def build_hair():
    head=bpy.data.objects['Mark | anatomical face']
    deps=bpy.context.evaluated_depsgraph_get();bpy.context.view_layer.update()
    evaluated=head.evaluated_get(deps);mesh=evaluated.to_mesh()
    dark=material('Mark hair | deep brown',(.022,.014,.010),.72)
    mid=material('Mark hair | brown fibres',(.043,.027,.018),.62)
    grey=material('Mark hair | restrained temple silver',(.105,.090,.074),.72)
    # Uneven hairline: higher frontal edge, lower temples and tapered nape.
    def hairline(p):
        front=max(0,min(1,(-p.y-.025)/.115))
        temple=max(0,min(1,(abs(p.x)-.055)/.045))
        return 1.670 + .084*front - .015*temple*front + .001*math.sin(p.x*90)
    ids=[p.index for p in mesh.polygons if all((mesh.vertices[j].co.z>hairline(mesh.vertices[j].co) and not (abs(mesh.vertices[j].co.x)>.083 and mesh.vertices[j].co.z<1.718)) for j in p.vertices)]
    used=sorted({j for i in ids for j in mesh.polygons[i].vertices});remap={v:i for i,v in enumerate(used)}
    vv=[tuple(mesh.vertices[j].co+mesh.vertices[j].normal*.0020) for j in used]
    ff=[tuple(remap[j] for j in mesh.polygons[i].vertices) for i in ids]
    # Project the open edge to a continuous hairline instead of retaining the
    # anatomical quad rows' staircase. Interior crown coverage remains intact.
    edge_counts={}
    for face in ff:
        for a,b in zip(face,face[1:]+face[:1]):
            edge=tuple(sorted((a,b)));edge_counts[edge]=edge_counts.get(edge,0)+1
    boundary={j for edge,count in edge_counts.items() if count==1 for j in edge}
    for j in boundary:
        p=Vector(vv[j]);z=hairline(p)
        if abs(p.x)>.080:z=max(z,1.718)
        hit,co,normal,_=evaluated.closest_point_on_mesh(Vector((p.x,p.y,z)))
        if hit:vv[j]=tuple(co+normal*.0022)
    cap=mesh_object('Hair | full anatomical scalp coverage',vv,ff,dark)
    # Closed solid backing makes gaps impossible even between every strand.
    sol=cap.modifiers.new('Closed hairline backing','SOLIDIFY');sol.thickness=.0015
    rng=random.Random(106);gv=[[],[],[]];gf=[[],[],[]]
    polys=[mesh.polygons[i] for i in ids]
    areas=[p.area for p in polys]
    for k in range(4500):
        poly=rng.choices(polys,weights=areas,k=1)[0]
        a,b,c=[mesh.vertices[j] for j in list(poly.vertices)[:3]]
        u=rng.random();v=rng.random()
        if u+v>1:u=1-u;v=1-v
        p=a.co*(1-u-v)+b.co*u+c.co*v
        n=(a.normal*(1-u-v)+b.normal*u+c.normal*v).normalized()
        # Subtle lateral sweep across the crown, backward at sides.
        flow=Vector((.65,.55,-.18)) if p.z>1.735 else Vector((.05,.30,-.95))
        flow=(flow-n*flow.dot(n)).normalized()
        length=rng.uniform(.009,.022) if p.z>1.735 else rng.uniform(.005,.012)
        group=2 if abs(p.x)>.075 and rng.random()<.13 else (1 if rng.random()<.34 else 0)
        verts,faces=gv[group],gf[group];base=len(verts)
        tangent=flow.cross(n).normalized()
        radius=rng.uniform(.00018,.00031)
        for step in range(5):
            t=step/4; center=p+n*(.0026+.0025*math.sin(t*math.pi))+flow*length*t
            r=radius*(1-.85*t)
            for j in range(3):
                ang=j*math.tau/3;verts.append(tuple(center+r*(math.cos(ang)*tangent+math.sin(ang)*n)))
        for step in range(4):
            for j in range(3):
                q=base+step*3+j;r=base+step*3+(j+1)%3;faces.append((q,r,r+3,q+3))
    for label,verts,faces,mat in zip(('dark','brown','silver'),gv,gf,(dark,mid,grey)):
        mesh_object('Hair | swept '+label+' fibres',verts,faces,mat)
    evaluated.to_mesh_clear()
    return [o for o in bpy.context.scene.objects if o.name.startswith('Hair |')]
