"""Regenerate the bundled CC0 male anatomical derivative from MakeHuman assets.

Usage: python scripts/build_mark_anatomy.py /path/to/makehuman/data
The source directory is intentionally external: neither reference photograph nor
MakeHuman application code is distributed. Runtime builds use the resulting NPZ.
"""
from pathlib import Path
import sys, json
import numpy as np
ROOT=Path(__file__).resolve().parents[1]
if len(sys.argv)!=2:
    raise SystemExit('Usage: python scripts/build_mark_anatomy.py /path/to/makehuman/data')
SRC=Path(sys.argv[1]).expanduser().resolve()
if not (SRC/'3dobjs/base.obj').is_file():
    raise SystemExit('Source directory must contain 3dobjs/base.obj and targets/. Ordinary builds use the bundled NPZ instead.')
verts=[]; faces=[]; uvs=[]; fuvs=[]; groups=[]; group=''
for line in (SRC/'3dobjs/base.obj').read_text().splitlines():
    if line.startswith('v '): verts.append(list(map(float,line.split()[1:])))
    elif line.startswith('vt '): uvs.append(list(map(float,line.split()[1:3])))
    elif line.startswith('g '): group=line[2:]
    elif line.startswith('f '):
        row=[t.split('/') for t in line.split()[1:]]
        faces.append([int(t[0])-1 for t in row]); fuvs.append([int(t[1])-1 for t in row]); groups.append(group)
v=np.array(verts,dtype=np.float64)
def delta(path):
    out=np.zeros_like(v)
    for line in (SRC/'targets'/(path+'.target')).read_text().splitlines():
        if not line.strip() or line.startswith('#'): continue
        r=line.split(); out[int(r[0])]=np.array(list(map(float,r[1:4])))
    return out
morphs={
 'macrodetails/caucasian-male-young':.50,
 'macrodetails/caucasian-male-old':.50,
 'macrodetails/universal-male-young-averagemuscle-averageweight':.50,
 'macrodetails/universal-male-old-averagemuscle-averageweight':.50,
 'head/head-rectangular':.65, 'head/head-square':.16,
 'head/head-fat-decr':.12, 'head/head-age-incr':.65,
 'chin/chin-width-incr':.58, 'chin/chin-height-incr':.10,
 'chin/chin-prominent-incr':.12,
 'nose/nose-scale-horiz-incr':.22, 'nose/nose-point-width-incr':.43,
 'nose/nose-scale-depth-incr':.16, 'nose/nose-scale-vert-incr':.12,
 'nose/nose-point-down':.20, 'nose/nose-hump-incr':.15,
 'mouth/mouth-scale-horiz-incr':.33,
 'mouth/mouth-upperlip-volume-decr':.32, 'mouth/mouth-lowerlip-volume-decr':.15,
 'mouth/mouth-cupidsbow-decr':.3, 'mouth/mouth-angles-up':.13,
 'mouth/mouth-laugh-lines-out':.42,
}
for side in ['l','r']:
    morphs.update({f'cheek/{side}-cheek-bones-incr':.43,
       f'cheek/{side}-cheek-volume-incr':.34,
       f'eyes/{side}-eye-height2-incr':.14,
       f'eyes/{side}-eye-bag-incr':.28,
       f'ears/{side}-ear-scale-incr':.04})
for p,w in morphs.items(): v+=delta(p)*w
EX='expression/units/caucasian/'
# A reference-guided friendly smile in Basis; smile remains an independently useful key.
v+=delta(EX+'mouth-upward-retraction')*.31
v+=delta(EX+'mouth-open')*.0
v+=(delta(EX+'eye-left-opened-up')+delta(EX+'eye-right-opened-up'))*.20
geteye=lambda name: np.mean(v[sorted(set(j for i,g in enumerate(groups) if g==name for j in faces[i]))],axis=0)
eyes_source=np.array([geteye(name) for name in ['helper-l-eye','helper-r-eye']])
# Metre-scale head crown and eye line establish the male proportions explicitly.
scale_z=(1.800-1.690)/(v[:,1].max()-eyes_source[:,1].mean())
scale_x=.109; scale_y=.109
offset=1.800-v[:,1].max()*scale_z
def transform(v): return np.stack([v[:,0]*scale_x,-v[:,2]*scale_y,v[:,1]*scale_z+offset],axis=1)
def transform_delta(d): return np.stack([d[:,0]*scale_x,-d[:,2]*scale_y,d[:,1]*scale_z],axis=1)
bv=transform(v); eyes=transform(eyes_source)
# Mark's broad upper face and full malar planes distinguish this from the base.
for point in bv:
    x,y,z=point
    band=np.exp(-((z-1.661)/.029)**2)
    front=np.clip((-y-.060)/.070,0,1)
    point[0]*=1+.055*band*front
    point[1]-=.0025*np.exp(-((abs(x)-.046)/.022)**2)*band*front
# Fit an adult male neck into the authored shirt collar.
for point in bv:
    z=point[2]
    if z<1.605:
        t=np.clip((1.605-z)/.025,0,1)
        angle=np.arctan2(point[0],-(point[1]+.010))
        point[0]=(1-t)*point[0]+t*.061*np.sin(angle)
        point[1]=(1-t)*point[1]+t*(-.010-.053*np.cos(angle))
idx=[i for i,f in enumerate(faces) if groups[i]=='body' and min(bv[j,2] for j in f)>1.475]
used=sorted(set(j for i in idx for j in faces[i])); remap={old:new for new,old in enumerate(used)}
expr={
 'mouthOpen':delta(EX+'mouth-open')*.82,
 'blink':delta(EX+'eye-left-closure')+delta(EX+'eye-right-closure')-(delta(EX+'eye-left-opened-up')+delta(EX+'eye-right-opened-up'))*.20,
 'smile':delta(EX+'mouth-upward-retraction')*.35+delta(EX+'mouth-open')*.06,
 'frown':delta(EX+'mouth-depression')*.55-delta(EX+'mouth-upward-retraction')*.31-delta(EX+'mouth-open')*.0-delta('mouth/mouth-angles-up')*.13+delta('mouth/mouth-angles-down')*.25+delta(EX+'eyebrows-left-down')*.30+delta(EX+'eyebrows-right-down')*.30,
}
# A useful semantic pigment mask, based on the source lip-volume displacement.
upper=delta('mouth/mouth-upperlip-volume-incr')
lower=delta('mouth/mouth-lowerlip-volume-incr')
lip_weight=np.clip((np.linalg.norm(upper,axis=1)+np.linalg.norm(lower,axis=1))/.075,0,1)
path=ROOT/'assets/mark/anatomical-head.npz'
np.savez_compressed(path,vertices=bv[used].astype(np.float32),faces=np.array([[remap[j] for j in faces[i]] for i in idx],dtype=np.int32),
 face_uvs=np.array([[uvs[u] for u in fuvs[i]] for i in idx],dtype=np.float32),source_indices=np.array(used,dtype=np.int32),
 eyes=eyes.astype(np.float32),lip_weight=lip_weight[used].astype(np.float32),
 **{f'delta_{n}':transform_delta(d)[used].astype(np.float32) for n,d in expr.items()})
print(json.dumps({'vertices':len(used),'faces':len(idx),'bounds':[bv[used].min(0).tolist(),bv[used].max(0).tolist()], 'eyes':eyes.tolist(),'scale':[scale_x,scale_y,scale_z],'offset':offset,'morphs':morphs},indent=2))
