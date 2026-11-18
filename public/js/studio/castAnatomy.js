// Fit the studio's reusable anatomical meshes in their metre-scale bind pose.
// Apply each fit to the face, teeth, eyes, brows and hair together so facial
// details stay seated on the skull when the character speaks or turns.
import * as THREE from 'three';

export function founderTemplate(look) {
  return look.lashes || ['bun', 'long-straight', 'long-wavy'].includes(look.hairStyle) ? 'lori' : 'mark';
}

const smooth = (a, b, x) => THREE.MathUtils.smoothstep(x, a, b);
const bell = (x, width) => Math.exp(-((x / width) ** 2));

function fitPoint(point, daymond, female) {
  const {x, y, z} = point;
  const base = female ? 1.43 : 1.48;
  const skull = smooth(base, base + .075, y);
  const nose = bell(y - (female ? 1.57 : 1.60), .025) * smooth(.09, .15, z);
  const jaw = bell(y - (female ? 1.51 : 1.55), .045);
  const cheek = bell(y - (female ? 1.58 : 1.62), .036);
  const brow = bell(y - (female ? 1.62 : 1.66), .028);
  point.x *= 1 + skull * (daymond ? .08 + .11 * jaw + .25 * nose : .04 * brow - .10 * jaw - .04 * nose);
  point.z += skull * (daymond ? .004 : .008) * cheek * bell(Math.abs(x) - .055, .024);
  point.y -= skull * (daymond ? .032 : .019);
  point.z -= skull * ((daymond ? .015 : .009) + .014 * nose);
}

// A close-trimmed goatee follows the face pigment and its expression shapes.
function groomFace(geometry, female) {
  const pos = geometry.attributes.position, color = geometry.attributes.color;
  if (!color) return;
  const mouth = female ? 1.548 : 1.584;
  for (let i = 0; i < pos.count; i++) {
    const x = Math.abs(pos.getX(i)), y = pos.getY(i) - mouth, z = pos.getZ(i);
    const front = smooth(.075, .11, z);
    const chin = (1 - smooth(.022, .042, x)) * smooth(-.061, -.047, y) * (1 - smooth(-.014, -.006, y));
    const moustache = (1 - smooth(.024, .035, x)) * bell(y - .009 + .005 * x / .03, .004);
    const corners = bell(x - .029, .005) * bell(y + .006, .014);
    const value = 1 - .88 * front * Math.max(chin, moustache, corners);
    color.setXYZ(i, color.getX(i)*value, color.getY(i)*value, color.getZ(i)*value);
  }
}

// Fit frames to the eye geometry, then parent them to the animated skull.
function addPresenterFrames(model) {
  let head, eyes;
  model.traverse(node => {
    if (node.isBone && node.name === 'head') head = node;
    if (node.isSkinnedMesh && /eyes? \| warm ivory/i.test(node.material.name)) eyes = node;
  });
  if (!eyes || !head) return;
  eyes.geometry.computeBoundingBox();
  const bounds = eyes.geometry.boundingBox;
  const eyeY = (bounds.min.y + bounds.max.y) / 2;
  const centerX = bounds.max.x - .015;
  const front = bounds.max.z + .006;
  const frame = new THREE.Group();
  const acetate = new THREE.MeshStandardMaterial({color: '#302b27', roughness: .45});
  function tube(points, radius, closed = false) {
    const path = new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p)), closed);
    frame.add(new THREE.Mesh(new THREE.TubeGeometry(path, closed ? 40 : 16, radius, 6, closed), acetate));
  }
  for (const side of [-1, 1]) {
    const rim = [];
    for (let i = 0; i < 32; i++) {
      const angle = i * Math.PI / 16;
      const dx = .025 * Math.sign(Math.cos(angle)) * Math.abs(Math.cos(angle)) ** .70;
      const dy = .015 * Math.sign(Math.sin(angle)) * Math.abs(Math.sin(angle)) ** .80;
      rim.push([side * (centerX + dx), eyeY + dy, front - .20 * dx]);
    }
    tube(rim, .0018, true);
    tube([[side*(centerX+.024),eyeY+.005,front-.005],[side*.072,eyeY+.006,front-.035],
      [side*.081,eyeY+.003,.044],[side*.079,eyeY-.006,.031]], .0016);
  }
  tube([[-centerX+.024,eyeY+.004,front+.005],[0,eyeY+.008,front+.009],
    [centerX-.024,eyeY+.004,front+.005]], .0018);
  model.add(frame);
  head.attach(frame);
}

// The trouser tops and jacket hem are separate skinned shells. Give the
// trousers clearance inside the coat so they don't poke through at the hips.
export function fitTailoring(model) {
  model.traverse(mesh => {
    if (!mesh.isSkinnedMesh || !/jeans|trousers/i.test(mesh.material.name)) return;
    const geometry = mesh.geometry.clone();
    const positions = geometry.attributes.position;
    for (let i = 0; i < positions.count; i++) {
      const height = positions.getY(i);
      const insideCoat = smooth(.86, .94, height);
      const x = positions.getX(i), z = positions.getZ(i);
      positions.setXYZ(i, x * (1 - .12 * insideCoat), height, -.025 + (z + .025) * (1 - .34 * insideCoat));
    }
    mesh.geometry = geometry;
    geometry.computeBoundingSphere();
  });
}

export function fitCastModel(model, look, role) {
  const daymond = role === 'daymond';
  const female = !daymond && founderTemplate(look) === 'lori';
  const point = new THREE.Vector3(), base = new THREE.Vector3();
  model.traverse(mesh => {
    if (!mesh.isSkinnedMesh) return;
    const material = mesh.material.name;
    if (/crease/i.test(material) || (daymond && /hair/i.test(material))) {
      mesh.visible = false;
      return;
    }
    // The four studio exports bake all mesh coordinates into actor space.
    const source = mesh.geometry;
    source.computeBoundingBox();
    if (source.boundingBox.max.y > (female ? 1.43 : 1.48)) {
      const geometry = mesh.geometry = source.clone();
      const positions = geometry.attributes.position;
      if (/anatomical_face/i.test(mesh.name) && (daymond || look.beard)) groomFace(geometry, female);
      for (let i = 0; i < positions.count; i++) {
        base.fromBufferAttribute(positions, i);
        if (base.y < (female ? 1.43 : 1.48)) continue;
        const fitted = point.copy(base);
        fitPoint(fitted, daymond, female);
        if (!daymond && !female && /hair/i.test(material)) {
          const crown = smooth(1.65, 1.74, base.y);
          fitted.y += crown * .018;
          fitted.x += crown * .006;
        }
        positions.setXYZ(i, fitted.x, fitted.y, fitted.z);
        for (const delta of geometry.morphAttributes.position || []) {
          point.fromBufferAttribute(delta, i).add(base);
          fitPoint(point, daymond, female);
          delta.setXYZ(i, point.x - positions.getX(i), point.y - positions.getY(i), point.z - positions.getZ(i));
        }
      }
      geometry.computeBoundingBox();
      geometry.computeBoundingSphere();
    }
    const dye = /Suit|tailored crepe|asymmetric jersey/i.test(material) ? look.suit
      : /hair/i.test(material) ? look.hair : null;
    if (dye) {
      mesh.material = mesh.material.clone();
      mesh.material.color.set(dye).multiplyScalar(/lapel|honey|root/i.test(material) ? .75 : 1);
    }
  });
  if (!daymond && !female) addPresenterFrames(model);
}
