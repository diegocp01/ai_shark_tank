import random
random.seed(17)
bpy.context.view_layer.update()
deps=bpy.context.evaluated_depsgraph_get();ev=o.evaluated_get(deps)
def surface(x,z):
 hit,loc,n,ind=ev.ray_cast(Vector((x,-1,z)),Vector((0,1,0)))
 return (loc,n) if hit else (None,None)
strand_groups={}
def strand(name,coords,r,material):
 key=(name,material.name)
 if key not in strand_groups:
  d=bpy.data.curves.new(name,'CURVE');d.dimensions='3D';d.resolution_u=1;d.bevel_depth=r;d.bevel_resolution=1
  obj=bpy.data.objects.new(name,d);bpy.context.collection.objects.link(obj);obj.data.materials.append(material);strand_groups[key]=obj
 obj=strand_groups[key];d=obj.data;sp=d.splines.new('POLY');sp.points.add(len(coords)-1)
 for p,c in zip(sp.points,coords):p.co=(*c,1);p.radius=r/d.bevel_depth
 return obj
hairm=[]
for c in [(.055,.045,.035),(.14,.13,.11),(.30,.29,.26),(.48,.47,.43)]:
 m=bpy.data.materials.new('Natural gray hair');m.diffuse_color=(*c,1);m.use_nodes=True;p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(*c,1);p.inputs['Roughness'].default_value=.8;hairm.append(m)
browm=[]
for c in [(.018,.015,.012),(.038,.033,.029),(.085,.078,.067)]:
 m=bpy.data.materials.new('Brow dark salt and pepper');m.diffuse_color=(*c,1);m.use_nodes=True;p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(*c,1);p.inputs['Roughness'].default_value=.85;browm.append(m)
for side in [-1,1]:
 e=bpy.data.objects['helper-l-eye' if side==1 else 'helper-r-eye'];center=e.location
 print('EYE',side,tuple(center))
 for i in range(230):
  t=random.random();x=side*(abs(center.x)-.016+t*.047);z=center.z+.009+.0015*math.sin(t*math.pi)-.004*t+random.gauss(0,.001)
  loc,n=surface(x,z)
  if loc is None:continue
  coords=[loc+n*.0004,loc+n*.0009+Vector((side*.001,0,.001)),loc+n*.0006+Vector((side*.003,0,.0013))]
  strand('Brow individual fiber',coords,random.uniform(.00008,.00016),random.choices(browm,[7,3,1])[0])
# Short cropped gray hair on scalp only, sampled from each side.
for side in [-1,1]:
 for i in range(4300):
  z=random.uniform(1.677,1.763);y=random.uniform(-.115,.075)
  hit,loc,n,ind=ev.ray_cast(Vector((side*.3,y,z)),Vector((-side,0,0)))
  if not hit or abs(loc.x)<.048:continue
  # Hairline slopes back above temples; ear height stays bare at the front.
  if y<-.075+(z-1.70)*.65 or (z<1.705 and y<-.025):continue
  direction=Vector((0,.002,-.0028))
  strand('Temple cropped fiber',[loc+n*.0003,loc+n*.0012+direction*.5,loc+n*.0007+direction],random.uniform(.00012,.00022),random.choices(hairm,[1,3,5,2])[0])
# Microscopic skin relief, visible primarily under grazing light.
nt=mat.node_tree;noise=nt.nodes.new('ShaderNodeTexNoise');noise.inputs['Scale'].default_value=550;noise.inputs['Detail'].default_value=2
bump=nt.nodes.new('ShaderNodeBump');bump.inputs['Strength'].default_value=.16;bump.inputs['Distance'].default_value=.00022;nt.links.new(noise.outputs['Fac'],bump.inputs['Height']);nt.links.new(bump.outputs['Normal'],bs.inputs['Normal'])

# Spatially varying skin pigment; vertex data survives glTF export.
col=o.data.color_attributes.new(name='Complexion',type='FLOAT_COLOR',domain='POINT')
for i,vertex in enumerate(o.data.vertices):
 x,y,z=vertex.co
 front=max(0,min(1,(-y-.05)/.06))
 cheeks=math.exp(-((abs(x)-.045)/.028)**2-((z-1.649)/.034)**2)*front
 nose=math.exp(-(x/.022)**2-((z-1.646)/.023)**2)*front
 lipmask=math.exp(-(x/.027)**6-((z-1.612)/.0048)**4)*front
 variation=.012*math.sin(x*600+z*190)*math.sin(z*380+y*250)
 base=Vector((.35+variation,.20+variation*.7,.145+variation*.4))
 base=base.lerp(Vector((.38,.17,.13)),min(.40,cheeks*.22+nose*.20))
 base=base.lerp(Vector((.29,.10,.09)),lipmask*.64)
 col.data[i].color=(*base,1)
attr=nt.nodes.new('ShaderNodeVertexColor');attr.layer_name='Complexion';nt.links.new(attr.outputs['Color'],bs.inputs['Base Color'])
# Fine skin-coloured crease accents, not deep painted black lines.
crease=bpy.data.materials.new('Fine age crease');crease.diffuse_color=(.26,.145,.105,1);crease.use_nodes=True;cp=crease.node_tree.nodes.get('Principled BSDF');cp.inputs['Base Color'].default_value=crease.diffuse_color;cp.inputs['Roughness'].default_value=.72
for z,width in [(1.721,.039),(1.735,.045),(1.748,.034)]:
 coords=[]
 for i in range(50):
  x=-width+2*width*i/49;zz=z+.0013*math.sin(x/width*math.pi)+.0015*(x/width)**2
  loc,n=surface(x,zz)
  if loc is not None:coords.append(loc+n*.00004)
 if len(coords)>2:strand('Fine forehead crease',coords,.000065,crease)
