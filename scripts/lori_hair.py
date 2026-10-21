"""Authored layered blonde waves. No downloaded hair meshes/textures."""
import bpy, math, random
from mathutils import Vector
from math import sin,cos,pi

def build_hair():
 rng=random.Random(41);out=[];mats=[]
 for name,col in [('champagne',(.48,.32,.13)),('honey',(.45,.30,.13)),('gold',(.58,.40,.20)),('light',(.66,.48,.25)),('root',(.20,.115,.046))]:
  m=bpy.data.materials.new('Hair '+name);m.diffuse_color=(*col,1);m.use_nodes=True;p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(*col,1);p.inputs['Roughness'].default_value=.39;p.inputs['Metallic'].default_value=.04;mats.append(m)
 def mesh(name,verts,faces,mat):
  verts=[(v[0],v[1],v[2]-.008*max(0,min(1,(v[2]-1.60)/.12))) for v in verts]
  d=bpy.data.meshes.new(name);d.from_pydata(verts,[],faces);d.update();o=bpy.data.objects.new(name,d);bpy.context.collection.objects.link(o);o.data.materials.append(mat)
  for p in d.polygons:p.use_smooth=True
  out.append(o);return o
 # Scalp cap: forehead apex descending behind ears, open face.
 vs=[];fs=[];n=80;r=25
 for i in range(r+1):
  t=i/r
  for j in range(n):
   a=2*pi*j/n;front=max(0,cos(a));end=.66 if cos(a)>.15 else .66+1.46*min(1,(.15-cos(a))/.6);ph=.012+t*end
   vs.append((.091*sin(ph)*sin(a),-.052-.102*sin(ph)*cos(a),1.600+.119*cos(ph)))
 for i in range(r):
  for j in range(n):a=i*n+j;b=i*n+(j+1)%n;fs.append((a,b,b+n,a+n))
 mesh('Hair | scalp volume',vs,fs,mats[1])
 # Elliptical continuous locks, broad ribbon shape with narrow sides and fine ridges.
 def lock(name,points,width,depth,mat):
  n=10;vs=[];fs=[]
  for i,p in enumerate(points):
   t=i/(len(points)-1);taper=(1-t)**.38*min(1,t*14);w=width*taper+.0003
   tangent=Vector(points[min(i+1,len(points)-1)])-Vector(points[max(0,i-1)])
   across=tangent.cross(Vector((0,1,0))).normalized()
   for j in range(n):
    a=2*pi*j/n;v=Vector(p)+across*(w*cos(a))+Vector((0,depth*sin(a)*taper,0));vs.append(v)
  for i in range(len(points)-1):
   for j in range(n):a=i*n+j;b=i*n+(j+1)%n;fs.append((a,b,b+n,a+n))
  fs.extend([tuple(reversed(range(n))),tuple((len(points)-1)*n+j for j in range(n))]);return mesh(name,vs,fs,mat)
 # Continuous waved mantle prevents separated rope-like scalp and rear hair.
 vs=[];fs=[];na=120;nt=64
 for i in range(nt+1):
  t=i/nt
  for j in range(na+1):
   a=.68+(2*pi-1.36)*j/na
   ph=min(1,t*3.8)*pi/2;wave=.009*sin(t*14+a*1.8)*t
   ridge=.0014*sin(a*75+t*7)*sin(ph)
   x=(.094*sin(ph)+.027*t+wave+ridge)*sin(a)
   y=-.048-(.099*sin(ph)+wave+ridge)*cos(a)
   z=1.719-(.438+.017*cos(a*3))*t
   vs.append((x,y,z))
 for i in range(nt):
  for j in range(na):
   a=i*(na+1)+j;fs.append((a,a+1,a+na+2,a+na+1))
 mantle=mesh('Hair | continuous soft wave mantle',vs,fs,mats[0]);solid=mantle.modifiers.new('Hair body thickness','SOLIDIFY');solid.thickness=.005
 # Low-profile highlight wisps sit within the continuous surface, not loose cords.
 for k in range(28):
  a=.70+(2*pi-1.40)*k/27;pts=[]
  for i in range(40):
   t=i/39;ph=min(1,t*3.8)*pi/2;wave=.009*sin(t*14+a*1.8)*t
   pts.append(((.095*sin(ph)+.027*t+wave)*sin(a),-.048-(.101*sin(ph)+wave)*cos(a),1.719-(.438+.017*cos(a*3))*t))
  lock('Hair | mantle highlight %02d'%k,pts,.003,.0012,mats[(k+1)%4])
 # Front framing locks: part lies at anatomical right (-X), sweep over left (+X).
 for side in [-1,1]:
  for k in range(20):
   pts=[];phase=k*.12;length=.38+.07*sin(k*1.7);start=-.027+k*.0014
   for i in range(44):
    t=i/43
    if side==1:
     x=start+(.115-start)*sin(min(1,t*2.5)*pi/2)+.024*sin(t*11+phase)*t
     z=1.728-length*t
     y=-.072-.083*sin(min(1,t*3)*pi/2)+.018*t+.012*cos(t*10+phase)*t
    else:
     x=start-(.100+start)*sin(min(1,t*3.3)*pi/2)-.023*sin(t*10+phase)*t
     z=1.725-length*t
     y=-.066-.086*sin(min(1,t*3.2)*pi/2)+.008*t+.013*cos(t*10+phase)*t
    # Layers spread across sides, keeping central eyes/nose unobstructed.
    x+=side*(k/19)*.026*t;y+=.020*(k/19)
    pts.append((x,y,z))
   lock('Hair | face framing %s %02d'%(side,k),pts,.009+k%3*.001,.0022,mats[(k+2)%4])
 # Side-part sweep laid across the crown and forehead, then curling past the temple.
 for k in range(23):
  pts=[]
  for i in range(48):
   t=i/47;spread=(k-11)*.0009
   x=-.033+spread+.158*sin(min(1,t*1.9)*pi/2)+.013*sin(t*13)*t
   y=-.085-.100*sin(min(1,t*6.5)*pi/2)+.032*t+spread*.25
   z=1.726-.418*t+(k-11)*.0003
   pts.append((x,y,z))
  lock('Hair | side swept fringe %02d'%k,pts,.0045,.0018,mats[(k+2)%4])
 # Sparse fine bright strands follow curves without fibrous noise.
 for o in out:
  o['attachment']='head; chest-length ends blended to chest during posed tests'
 return out
