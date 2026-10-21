"""Regenerate the bundled CC0 female anatomical derivative from MakeHuman assets.

Usage: python scripts/build_lori_anatomy.py /path/to/makehuman/data
The source directory is intentionally external: neither reference photograph nor
MakeHuman application code is distributed. Runtime builds use the resulting NPZ.
"""
from pathlib import Path
import sys, json
import numpy as np
ROOT=Path(__file__).resolve().parents[1]
if len(sys.argv)!=2:
    raise SystemExit('Usage: python scripts/build_lori_anatomy.py /path/to/makehuman/data')
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
 'macrodetails/caucasian-female-young':.55,
 'macrodetails/caucasian-female-old':.45,
 'macrodetails/universal-female-young-averagemuscle-averageweight':.55,
 'macrodetails/universal-female-old-averagemuscle-averageweight':.45,
 'head/head-oval':.22, 'head/head-invertedtriangular':.12,
 'head/head-fat-decr':.11, 'head/head-age-incr':.36,
 'chin/chin-width-decr':.48, 'chin/chin-height-incr':.10,
 'chin/chin-prominent-decr':.16, 'chin/chin-triangle':.12,
 'nose/nose-scale-horiz-decr':.20, 'nose/nose-point-width-decr':.24,
 'nose/nose-scale-depth-decr':.03, 'nose/nose-scale-vert-incr':.40, 'nose/nose-greek-incr':.10,
 'nose/nose-point-down':.10, 'nose/nose-flaring-decr':.16,
 'mouth/mouth-scale-horiz-incr':.80,
 'mouth/mouth-upperlip-volume-incr':.04, 'mouth/mouth-lowerlip-volume-incr':.03,
 'mouth/mouth-cupidsbow-decr':.2, 'mouth/mouth-angles-up':.40,
 'mouth/mouth-upperlip-height-decr':.20,
 'mouth/mouth-laugh-lines-out':.12,
}
for s in ['l','r']:
    morphs.update({f'cheek/{s}-cheek-bones-incr':.65,f'cheek/{s}-cheek-trans-up':.18,
       f'cheek/{s}-cheek-volume-incr':.21,f'eyes/{s}-eye-scale-incr':.03,f'eyes/{s}-eye-height2-incr':.22,f'eyes/{s}-eye-height1-incr':.12,f'eyes/{s}-eye-height3-incr':.1,
       f'eyes/{s}-eye-corner2-up':.16,f'eyes/{s}-eye-bag-incr':.14,
       f'ears/{s}-ear-scale-decr':.20})
for p,w in morphs.items(): v+=delta(p)*w
EX='expression/units/caucasian/'
# A reference-guided friendly smile in Basis; smile remains an independently useful key.
v+=delta(EX+'mouth-upward-retraction')*.44
v+=delta(EX+'mouth-open')*.055
v+=(delta(EX+'eye-left-opened-up')+delta(EX+'eye-right-opened-up'))*.35
geteye=lambda name: np.mean(v[sorted(set(j for i,g in enumerate(groups) if g==name for j in faces[i]))],axis=0)
eyes_source=np.array([geteye(name) for name in ['helper-l-eye','helper-r-eye']])
# Metre-scale head crown and eye line establish the female proportions explicitly.
scale_z=(1.718-1.609)/(v[:,1].max()-eyes_source[:,1].mean())
scale_x=.101; scale_y=.102
offset=1.718-v[:,1].max()*scale_z
def transform(v): return np.stack([v[:,0]*scale_x,-v[:,2]*scale_y,v[:,1]*scale_z+offset],axis=1)
def transform_delta(d): return np.stack([d[:,0]*scale_x,-d[:,2]*scale_y,d[:,1]*scale_z],axis=1)
bv=transform(v); eyes=transform(eyes_source)
# Shorten only the forehead/crown, preserving eye-line, facial rig and lower neck.
bv[:,2]-=np.maximum(bv[:,2]-1.646,0)*.12
# Reference has a broad high zygomatic plane above the tapered jaw.
bv[:,0]*=1+.035*np.exp(-((bv[:,2]-1.587)/.030)**2)
# Neck only, no source shoulder mantle. Smoothly fit lower rows into a narrow neck.
for p in bv:
    z=p[2]
    if z<1.492:
        t=np.clip((1.492-z)/.022,0,1)
        angle=np.arctan2(p[0],-(p[1]+.008))
        p[0]=(1-t)*p[0]+t*.041*np.sin(angle)
        p[1]=(1-t)*p[1]+t*(-.008-.039*np.cos(angle))
idx=[i for i,f in enumerate(faces) if groups[i]=='body' and min(bv[j,2] for j in f)>1.402]
used=sorted(set(j for i in idx for j in faces[i])); remap={old:new for new,old in enumerate(used)}
expr={
 'mouthOpen':delta(EX+'mouth-open')*.82,
 'blink':delta(EX+'eye-left-closure')+delta(EX+'eye-right-closure')-(delta(EX+'eye-left-opened-up')+delta(EX+'eye-right-opened-up'))*.35,
 'smile':delta(EX+'mouth-upward-retraction')*.35+delta(EX+'mouth-open')*.06,
 'frown':delta(EX+'mouth-depression')*.55-delta(EX+'mouth-upward-retraction')*.44-delta(EX+'mouth-open')*.055-delta('mouth/mouth-angles-up')*.40+delta('mouth/mouth-angles-down')*.25+delta(EX+'eyebrows-left-down')*.30+delta(EX+'eyebrows-right-down')*.30,
}
# A useful semantic pigment mask, based on the source lip-volume displacement.
upper=delta('mouth/mouth-upperlip-volume-incr')
lower=delta('mouth/mouth-lowerlip-volume-incr')
lip_weight=np.clip((np.linalg.norm(upper,axis=1)+np.linalg.norm(lower,axis=1))/.075,0,1)
path=ROOT/'assets/lori/anatomical-head.npz'
np.savez_compressed(path,vertices=bv[used].astype(np.float32),faces=np.array([[remap[j] for j in faces[i]] for i in idx],dtype=np.int32),
 face_uvs=np.array([[uvs[u] for u in fuvs[i]] for i in idx],dtype=np.float32),source_indices=np.array(used,dtype=np.int32),
 eyes=eyes.astype(np.float32),lip_weight=lip_weight[used].astype(np.float32),
 **{f'delta_{n}':transform_delta(d)[used].astype(np.float32) for n,d in expr.items()})
print(json.dumps({'vertices':len(used),'faces':len(idx),'bounds':[bv[used].min(0).tolist(),bv[used].max(0).tolist()], 'eyes':eyes.tolist(),'scale':[scale_x,scale_y,scale_z],'offset':offset,'morphs':morphs},indent=2))
