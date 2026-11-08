// Canvas-painted textures for the 3D studio: outfit fronts, the rug, the
// product display board, the neon sign, and wood/marble surfaces.

import * as THREE from "three";

function makeCanvas(width, height) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  return [canvas, canvas.getContext("2d")];
}

function toTexture(canvas, { repeat = null, srgb = true } = {}) {
  const texture = new THREE.CanvasTexture(canvas);

  if (srgb) {
    texture.colorSpace = THREE.SRGBColorSpace;
  }

  texture.anisotropy = 8;

  if (repeat) {
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(repeat[0], repeat[1]);
  }

  return texture;
}

export function shadeHex(hex, amount) {
  const color = new THREE.Color(hex);
  const target = amount < 0 ? new THREE.Color(0, 0, 0) : new THREE.Color(1, 1, 1);
  return `#${color.lerp(target, Math.abs(amount)).getHexString()}`;
}

function seeded(seed) {
  let state = seed >>> 0 || 1;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function polygon(context, points, fill) {
  context.beginPath();
  points.forEach(([x, y], index) => (index ? context.lineTo(x, y) : context.moveTo(x, y)));
  context.closePath();
  context.fillStyle = fill;
  context.fill();
}

function fabricNoise(context, width, height, seed, alpha = 0.05) {
  const random = seeded(seed);

  for (let index = 0; index < 2600; index += 1) {
    const x = random() * width;
    const y = random() * height;
    context.fillStyle = random() > 0.5 ? `rgba(255,255,255,${alpha})` : `rgba(0,0,0,${alpha * 1.4})`;
    context.fillRect(x, y, 1 + random() * 3, 1);
  }
}

// Wraps around the torso lathe: x = around the body (front center at 512),
// y = top (shoulders) to bottom (waist).
export function outfitTexture(look, accent) {
  const [canvas, context] = makeCanvas(1024, 512);
  const cx = 512;
  const base = look.suit;
  context.fillStyle = base;
  context.fillRect(0, 0, 1024, 512);
  fabricNoise(context, 1024, 512, 7);

  // Side seams catch a little shadow.
  const seam = context.createLinearGradient(0, 0, 1024, 0);
  seam.addColorStop(0, "rgba(0,0,0,0.25)");
  seam.addColorStop(0.25, "rgba(0,0,0,0)");
  seam.addColorStop(0.75, "rgba(0,0,0,0)");
  seam.addColorStop(1, "rgba(0,0,0,0.25)");
  context.fillStyle = seam;
  context.fillRect(0, 0, 1024, 512);

  const lapels = (depth = 330) => {
    polygon(context, [[cx - 64, 0], [cx - 130, 0], [cx - 96, 60], [cx - 118, 92], [cx - 16, depth], [cx - 4, depth - 40]], shadeHex(base, -0.28));
    polygon(context, [[cx + 64, 0], [cx + 130, 0], [cx + 96, 60], [cx + 118, 92], [cx + 16, depth], [cx + 4, depth - 40]], shadeHex(base, -0.28));
    context.strokeStyle = shadeHex(base, 0.12);
    context.lineWidth = 2;
    context.beginPath();
    context.moveTo(cx - 118, 92);
    context.lineTo(cx - 16, depth);
    context.moveTo(cx + 118, 92);
    context.lineTo(cx + 16, depth);
    context.stroke();
  };
  const pocketSquare = () => {
    polygon(context, [[cx + 150, 150], [cx + 196, 136], [cx + 200, 158], [cx + 154, 170]], accent);
    context.fillStyle = "rgba(0,0,0,0.25)";
    context.fillRect(cx + 140, 168, 74, 5);
  };
  const finPin = () => {
    context.beginPath();
    context.moveTo(cx - 96, 150);
    context.bezierCurveTo(cx - 92, 128, cx - 80, 116, cx - 64, 112);
    context.bezierCurveTo(cx - 70, 124, cx - 72, 138, cx - 70, 150);
    context.closePath();
    context.fillStyle = accent;
    context.fill();
  };
  const buttons = (y) => {
    for (const offset of [0, 70]) {
      context.beginPath();
      context.arc(cx, y + offset, 7, 0, Math.PI * 2);
      context.fillStyle = shadeHex(base, -0.45);
      context.fill();
    }
  };

  switch (look.top) {
    case "turtleneck": {
      context.strokeStyle = "rgba(0,0,0,0.08)";
      context.lineWidth = 3;

      for (let x = 0; x < 1024; x += 14) {
        context.beginPath();
        context.moveTo(x, 0);
        context.lineTo(x, 512);
        context.stroke();
      }

      context.strokeStyle = "#e8c15a";
      context.lineWidth = 4;
      context.beginPath();
      context.moveTo(cx - 60, 0);
      context.quadraticCurveTo(cx, 170, cx + 60, 0);
      context.stroke();
      polygon(context, [[cx, 150], [cx + 16, 182], [cx - 16, 182]], accent);
      break;
    }
    case "dress": {
      // Solid dress with a soft V neckline and a fine gold chain.
      polygon(context, [[cx - 82, 0], [cx + 82, 0], [cx, 210]], shadeHex(look.skin, -0.04));
      context.strokeStyle = shadeHex(base, -0.25);
      context.lineWidth = 6;
      context.beginPath();
      context.moveTo(cx - 82, 0);
      context.lineTo(cx, 210);
      context.lineTo(cx + 82, 0);
      context.stroke();
      context.strokeStyle = "#e8c15a";
      context.lineWidth = 3;
      context.beginPath();
      context.moveTo(cx - 46, 0);
      context.quadraticCurveTo(cx, 110, cx + 46, 0);
      context.stroke();
      context.fillStyle = "rgba(0,0,0,0.12)";
      context.fillRect(0, 330, 1024, 14);
      break;
    }
    case "blazer":
      polygon(context, [[cx - 70, 0], [cx + 70, 0], [cx, 300]], "#e6ddd2");
      lapels(340);
      pocketSquare();
      finPin();
      buttons(380);
      break;
    case "open-collar":
      polygon(context, [[cx - 76, 0], [cx + 76, 0], [cx, 300]], "#e2e6eb");
      polygon(context, [[cx - 40, 0], [cx + 40, 0], [cx, 150]], shadeHex(look.skin, -0.05));
      polygon(context, [[cx - 76, 0], [cx - 30, 0], [cx - 54, 90]], "#ffffff");
      polygon(context, [[cx + 76, 0], [cx + 30, 0], [cx + 54, 90]], "#ffffff");
      context.strokeStyle = "#e8c15a";
      context.lineWidth = 4;
      context.beginPath();
      context.moveTo(cx - 34, 6);
      context.quadraticCurveTo(cx, 120, cx + 34, 6);
      context.stroke();
      lapels(340);
      finPin();
      buttons(380);
      break;
    case "suit":
    default:
      polygon(context, [[cx - 64, 0], [cx + 64, 0], [cx, 280]], "#dfe4ea");
      polygon(context, [[cx - 66, 0], [cx - 8, 0], [cx - 40, 70]], "#eceff3");
      polygon(context, [[cx + 66, 0], [cx + 8, 0], [cx + 40, 70]], "#eceff3");
      polygon(context, [[cx - 15, 18], [cx + 15, 18], [cx + 11, 52], [cx - 11, 52]], shadeHex(look.tie || accent, -0.25));
      polygon(context, [[cx - 11, 52], [cx + 11, 52], [cx + 22, 250], [cx, 284], [cx - 22, 250]], look.tie || accent);
      context.strokeStyle = "rgba(0,0,0,0.12)";
      context.lineWidth = 3;

      for (let y = 80; y < 260; y += 26) {
        context.beginPath();
        context.moveTo(cx - 22, y);
        context.lineTo(cx + 22, y + 14);
        context.stroke();
      }

      lapels(330);
      pocketSquare();
      finPin();
      buttons(370);
      break;
  }

  // Waist shadow.
  const waist = context.createLinearGradient(0, 380, 0, 512);
  waist.addColorStop(0, "rgba(0,0,0,0)");
  waist.addColorStop(1, "rgba(0,0,0,0.22)");
  context.fillStyle = waist;
  context.fillRect(0, 380, 1024, 132);

  return toTexture(canvas);
}

// Locally generated material detail. Linear grayscale maps are never color-
// managed as photographs; no texture service, CDN or image API is involved.
export function surfaceTexture(kind = "leather") {
  const [canvas, ctx] = makeCanvas(512, 512);
  const random = seeded(kind === "leather" ? 42 : 19);
  const image = ctx.createImageData(512, 512);
  for (let y = 0; y < 512; y++) {
    for (let x = 0; x < 512; x++) {
      const noise = random();
      const weave = kind === "fabric" ? (x % 4 < 2 ? 18 : -18) + (y % 4 < 2 ? 12 : -12) : 0;
      const grain = kind === "wood" ? Math.sin(y * 1.8 + Math.sin(x * 0.03) * 2) * 18 : 0;
      const v = Math.round(180 + noise * 65 + weave + grain);
      const i = (y * 512 + x) * 4;
      image.data[i] = image.data[i + 1] = image.data[i + 2] = v; image.data[i + 3] = 255;
    }
  }
  ctx.putImageData(image, 0, 0);
  if (kind === "leather") {
    ctx.strokeStyle = "rgba(45,45,45,0.2)"; ctx.lineWidth = 0.65;
    for (let i = 0; i < 1600; i++) {
      const x = random() * 512, y = random() * 512;
      ctx.beginPath(); ctx.ellipse(x, y, 1 + random() * 3, 1 + random() * 2, random() * 3, 0, Math.PI * 2); ctx.stroke();
    }
  }
  return toTexture(canvas, { repeat: kind === "fabric" ? [10, 10] : [2, 2], srgb: false });
}

export function rugTexture() {
  const [canvas, ctx] = makeCanvas(1536, 1024);
  const random = seeded(11);
  ctx.fillStyle = "#804333"; ctx.fillRect(0, 0, 1536, 1024);
  for (const [inset, color, width] of [[22, "#c5a17b", 28], [50, "#3e4849", 18], [96, "#b78f64", 62], [134, "#333c3d", 12], [148, "#c7a476", 5]]) {
    ctx.strokeStyle = color; ctx.lineWidth = width;
    ctx.strokeRect(inset, inset, 1536 - inset * 2, 1024 - inset * 2);
  }
  const flower = (x, y, r, tone = "#c7a77b") => {
    ctx.save(); ctx.translate(x, y); ctx.fillStyle = tone;
    for (let p = 0; p < 8; p++) {
      ctx.rotate(Math.PI / 4); ctx.beginPath(); ctx.ellipse(r * 0.5, 0, r * 0.48, r * 0.16, 0, 0, Math.PI * 2); ctx.fill();
    }
    ctx.fillStyle = "#3d4845"; ctx.beginPath(); ctx.arc(0, 0, r * 0.24, 0, 7); ctx.fill(); ctx.restore();
  };
  for (let y = 185; y < 850; y += 62) {
    for (let x = 185; x < 1350; x += 68) {
      flower(x + (y % 124 > 60 ? 25 : 0), y, 14, random() > 0.4 ? "#c5a17b" : "#424e4a");
      ctx.strokeStyle = "#af805c"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + 35, y - 35, x + 65, y); ctx.stroke();
    }
  }
  for (let x = 90; x < 1460; x += 48) { flower(x, 94, 20); flower(x, 930, 20); }
  for (let y = 140; y < 900; y += 48) { flower(94, y, 20); flower(1442, y, 20); }
  ctx.save(); ctx.translate(768, 512); ctx.scale(1.2, 1);
  for (const [r, fill] of [[215, "#cfb186"], [200, "#3c4c4d"], [165, "#ad7658"], [148, "#814438"], [75, "#c5a17b"]]) {
    ctx.beginPath();
    for (let i = 0; i <= 32; i++) {
      const angle = i / 32 * Math.PI * 2, radius = i % 2 ? r * 0.84 : r;
      if (!i) ctx.moveTo(Math.cos(angle) * radius, Math.sin(angle) * radius);
      else ctx.lineTo(Math.cos(angle) * radius, Math.sin(angle) * radius);
    }
    ctx.fillStyle = fill; ctx.fill();
  }
  flower(0, 0, 55); ctx.restore();
  // Fine weft and irregular wear keep the pattern from reading as flat vector art.
  for (let y = 0; y < 1024; y += 2) { ctx.fillStyle = `rgba(230,214,184,${0.04 + random() * 0.08})`; ctx.fillRect(0, y, 1536, 1); }
  for (let i = 0; i < 36000; i++) { ctx.fillStyle = random() > 0.5 ? "#d2b79525" : "#322e2720"; ctx.fillRect(random() * 1536, random() * 1024, 1 + random() * 3, 1); }
  return toTexture(canvas);
}

export function woodTexture({ base = "#3a2416", seed = 3, planks = true } = {}) {
  const [canvas, context] = makeCanvas(512, 512);
  context.fillStyle = base;
  context.fillRect(0, 0, 512, 512);
  const random = seeded(seed);

  for (let index = 0; index < 220; index += 1) {
    const y = random() * 512;
    context.strokeStyle = random() > 0.5 ? "rgba(255,220,180,0.05)" : "rgba(0,0,0,0.12)";
    context.lineWidth = 1 + random() * 2.5;
    context.beginPath();
    context.moveTo(0, y);
    context.bezierCurveTo(170, y + random() * 8 - 4, 340, y + random() * 8 - 4, 512, y + random() * 6 - 3);
    context.stroke();
  }

  if (planks) {
    context.fillStyle = "rgba(0,0,0,0.35)";

    for (let y = 0; y < 512; y += 64) {
      context.fillRect(0, y, 512, 2);
    }

    for (let row = 0; row < 8; row += 1) {
      context.fillRect(((row * 197) % 512), row * 64, 2, 64);
    }
  }

  return toTexture(canvas, { repeat: [1, 1] });
}

export function marbleTexture() {
  const [canvas, context] = makeCanvas(512, 512);
  context.fillStyle = "#efece7";
  context.fillRect(0, 0, 512, 512);
  const random = seeded(5);

  for (let index = 0; index < 18; index += 1) {
    context.strokeStyle = `rgba(120,115,110,${0.08 + random() * 0.14})`;
    context.lineWidth = 0.6 + random() * 2;
    context.beginPath();
    let x = random() * 512;
    let y = 0;
    context.moveTo(x, y);

    while (y < 512) {
      x += random() * 40 - 20;
      y += 20 + random() * 30;
      context.lineTo(x, y);
    }

    context.stroke();
  }

  return toTexture(canvas);
}

export function signTexture() {
  const [canvas, context] = makeCanvas(1024, 256);
  context.clearRect(0, 0, 1024, 256);
  context.font = "800 120px 'Bricolage Grotesque', 'Instrument Sans', sans-serif";
  context.textBaseline = "middle";
  context.textAlign = "left";
  const gap = 36;
  const aiWidth = context.measureText("AI").width;
  const wordWidth = context.measureText("SHARK TANK").width;
  const left = (1024 - (aiWidth + gap + wordWidth)) / 2;
  context.shadowColor = "#39e0c8";
  context.shadowBlur = 0;
  context.fillStyle = "#b7a48a";
  context.fillText("AI", left, 132);
  context.fillStyle = "#e9fffb";
  context.fillText("SHARK TANK", left + aiWidth + gap, 132);
  return toTexture(canvas);
}

export function hallTexture() {
  const [canvas, context] = makeCanvas(512, 256);
  const gradient = context.createLinearGradient(0, 0, 0, 256);
  gradient.addColorStop(0, "#0a2448");
  gradient.addColorStop(0.5, "#1d6fc0");
  gradient.addColorStop(1, "#0a2a52");
  context.fillStyle = gradient;
  context.fillRect(0, 0, 512, 256);
  const random = seeded(9);

  for (let index = 0; index < 40; index += 1) {
    context.fillStyle = `rgba(160,220,255,${0.05 + random() * 0.1})`;
    context.beginPath();
    context.arc(random() * 512, random() * 256, 2 + random() * 12, 0, Math.PI * 2);
    context.fill();
  }

  for (let x = 0; x < 512; x += 128) {
    context.fillStyle = "rgba(255,255,255,0.08)";
    context.fillRect(x, 0, 4, 256);
  }

  return toTexture(canvas, { repeat: [3, 1] });
}

function wrapText(context, text, maxWidth) {
  const words = String(text).split(/\s+/);
  const lines = [];
  let line = "";

  for (const word of words) {
    const next = line ? `${line} ${word}` : word;

    if (context.measureText(next).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }

  if (line) {
    lines.push(line);
  }

  return lines;
}

// The founder's product display, like the boards founders roll into the tank.
export function createBoardTexture() {
  const [canvas, context] = makeCanvas(1024, 1280);
  const texture = toTexture(canvas);

  function draw(pitch) {
    const accent = pitch.founder?.accent || "#39e0c8";
    context.fillStyle = "#f5f3ef";
    context.fillRect(0, 0, 1024, 1280);
    const sheen = context.createLinearGradient(0, 0, 1024, 1280);
    sheen.addColorStop(0, "rgba(255,255,255,0.6)");
    sheen.addColorStop(1, "rgba(0,0,0,0.06)");
    context.fillStyle = sheen;
    context.fillRect(0, 0, 1024, 1280);

    context.textAlign = "center";
    context.fillStyle = "#4e4a55";
    context.font = "800 104px 'Bricolage Grotesque', 'Instrument Sans', sans-serif";
    const nameLines = wrapText(context, String(pitch.productName || "").toUpperCase(), 900).slice(0, 2);
    nameLines.forEach((line, index) => context.fillText(line, 512, 170 + index * 110));

    const tagTop = 170 + nameLines.length * 110 - 30;
    context.font = "700 34px 'Instrument Sans', sans-serif";
    context.fillStyle = shadeHex(accent, -0.45);
    wrapText(context, String(pitch.tagline || "").toUpperCase(), 860)
      .slice(0, 2)
      .forEach((line, index) => context.fillText(line, 512, tagTop + index * 44));

    context.font = "700 30px 'Instrument Sans', sans-serif";
    context.fillStyle = "#8a8690";
    context.textAlign = "left";
    context.fillText(String(pitch.startupName || "").toUpperCase(), 70, 1220);
    context.textAlign = "right";
    context.fillStyle = "#a07a2a";
    context.fillText(pitch.askLabel ? pitch.askLabel.toUpperCase() : "", 954, 1220);
    texture.needsUpdate = true;
  }

  return {
    texture,
    setPitch(pitch) { draw(pitch); },
  };
}
