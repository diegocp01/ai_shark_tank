// SVG character art: flat-illustration people. Every shark has its own face,
// hair, and outfit (with a little shark-fin lapel pin); founders come from the
// pitch's look. The face is drawn around a fixed frame (centered at x=100,
// chin at y=156) so full figures and avatars share the same head.

let uid = 0;

function nextId(prefix) {
  uid += 1;
  return `${prefix}-${uid}`;
}

export function shade(hex, amount) {
  const value = hex.replace("#", "");
  const full = value.length === 3 ? value.split("").map((char) => char + char).join("") : value;
  const channels = [0, 2, 4].map((offset) => parseInt(full.slice(offset, offset + 2), 16));
  const mixed = channels.map((channel) => {
    const target = amount < 0 ? 0 : 255;
    return Math.round(channel + (target - channel) * Math.abs(amount));
  });

  return `#${mixed.map((channel) => channel.toString(16).padStart(2, "0")).join("")}`;
}

const INK = "#1d1416";

const DEFAULT_LOOK = {
  top: "suit",
  suit: "#24324f",
  skin: "#e3aa83",
  hair: "#2a1e18",
  hairStyle: "short",
  brows: "soft",
  mouth: "smile",
};

function curls(points) {
  return points.map(([cx, cy, r]) => `<circle cx="${cx}" cy="${cy}" r="${r}"/>`).join("");
}

// Each style has an optional `back` layer (behind the face) and a `front` layer
// (over the forehead). Paths are filled with the hair color by their group.
const HAIR = {
  sidepart: {
    front: `<path d="M67 106 C63 74 80 52 101 52 C123 52 138 70 133 106 C131 92 127 82 119 77 C108 84 88 80 78 76 C72 84 69 94 67 106 Z"/>
      <path d="M80 70 Q98 60 120 66" fill="none" stroke="#fff" stroke-opacity="0.22" stroke-width="2.4" stroke-linecap="round"/>`,
  },
  short: {
    front: `<path d="M67 104 C63 72 82 52 102 53 C124 54 138 72 133 104 C131 92 127 85 122 82 L116 88 L110 80 L102 87 L94 80 L87 87 L80 81 C74 86 70 94 67 104 Z"/>`,
  },
  buzz: {
    front: `<path d="M69 100 C68 74 83 60 100 60 C117 60 132 74 131 100 C127 86 118 77 100 76 C82 77 73 86 69 100 Z" opacity="0.88"/>`,
  },
  slick: {
    front: `<path d="M68 102 C65 70 84 53 102 53 C122 53 137 70 132 102 C128 84 118 74 100 72 C84 73 72 84 68 102 Z"/>
      <path d="M84 62 Q100 56 118 63" fill="none" stroke="#fff" stroke-opacity="0.2" stroke-width="3" stroke-linecap="round"/>`,
  },
  curly: {
    back: curls([[70, 88, 14], [130, 88, 14], [84, 64, 16], [116, 64, 16], [100, 54, 15], [65, 106, 9], [135, 106, 9]]),
    front: curls([[82, 76, 11], [96, 70, 12], [110, 71, 12], [122, 78, 10]]),
  },
  "curly-short": {
    back: curls([[74, 86, 10], [126, 86, 10], [86, 68, 12], [114, 68, 12], [100, 62, 12]]),
    front: curls([[84, 76, 9], [97, 72, 10], [110, 73, 10], [120, 79, 8]]),
  },
  bun: {
    back: `<circle cx="100" cy="49" r="15"/>`,
    front: `<path d="M68 106 C65 74 82 57 100 57 C118 57 135 74 132 106 C129 88 118 77 100 75 C82 77 71 88 68 106 Z"/>
      <path d="M100 58 V75" fill="none" stroke="#000" stroke-opacity="0.18" stroke-width="1.6"/>`,
  },
  bob: {
    back: `<path d="M63 100 C59 69 80 51 100 51 C122 51 142 69 137 100 L139 140 C139 151 128 153 121 148 L79 148 C72 153 61 151 61 140 Z"/>`,
    front: `<path d="M66 118 C62 78 82 56 102 56 C124 56 140 76 134 118 C130 96 124 84 112 78 C100 90 84 96 70 98 C68 104 67 110 66 118 Z"/>
      <path d="M86 64 Q104 58 122 68" fill="none" stroke="#fff" stroke-opacity="0.25" stroke-width="2.6" stroke-linecap="round"/>`,
  },
  "long-wavy": {
    back: `<path d="M64 104 C58 70 78 50 100 50 C124 50 142 70 136 104 C138 128 147 150 143 176 C140 194 125 198 118 188 L82 188 C75 198 60 194 57 176 C53 150 62 128 64 104 Z"/>`,
    front: `<path d="M68 114 C64 78 82 56 100 56 C120 56 136 76 132 114 C128 92 120 80 106 76 C98 88 84 94 74 96 C71 102 69 108 68 114 Z"/>`,
  },
  "long-straight": {
    back: `<path d="M64 102 C60 68 80 50 100 50 C122 50 140 68 136 102 L140 192 L60 192 Z"/>`,
    front: `<path d="M66 116 C62 78 82 55 100 56 C99 70 90 86 72 98 C70 104 68 110 66 116 Z"/>
      <path d="M134 116 C138 78 118 55 100 56 C101 70 110 86 128 98 C130 104 132 110 134 116 Z"/>`,
  },
};

const BROWS = {
  stern: `<path d="M79 96 L95 100"/><path d="M105 100 L121 96"/>`,
  soft: `<path d="M80 98 Q88 94 96 97"/><path d="M104 97 Q112 94 120 98"/>`,
  flat: `<path d="M80 98 H96"/><path d="M104 98 H120"/>`,
  arched: `<path d="M80 99 Q87 91 96 95"/><path d="M104 95 Q113 91 120 99"/>`,
  raised: `<path d="M80 94 Q88 89 96 93"/><path d="M104 97 Q112 95 120 97"/>`,
};

function idleMouth(kind, look) {
  switch (kind) {
    case "frown":
      return `<path d="M91 137 Q100 133 109 137" fill="none" stroke="#7a3b34" stroke-width="2.8" stroke-linecap="round"/>`;
    case "neutral":
      return look.beard === "full"
        ? `<path d="M91 134 Q100 131 109 134 Q100 140 91 134 Z" fill="#b0645a"/>`
        : `<path d="M92 135 Q100 138 108 135" fill="none" stroke="#5a2a26" stroke-width="2.8" stroke-linecap="round"/>`;
    case "lipstick":
      return `<path d="M90 134 Q95 130 100 132 Q105 130 110 134 Q100 141 90 134 Z" fill="${look.lipstick || "#c23d5c"}"/>`;
    case "grin":
      return `<path d="M87 131 Q100 147 113 131 Z" fill="#5a1f25"/><path d="M89 132 L111 132 Q110 136 100 137 Q90 136 89 132 Z" fill="#fff"/>`;
    case "smile":
    default:
      return `<path d="M90 133 Q100 142 110 133" fill="none" stroke="#7a3b34" stroke-width="2.8" stroke-linecap="round"/>`;
  }
}

function eyes(look) {
  const eye = (x, side) => `
    <ellipse cx="${x}" cy="108" rx="3.3" ry="4.1" fill="${INK}"/>
    <circle cx="${x + 1.1}" cy="106.4" r="1.05" fill="#fff"/>
    ${look.lashes ? `<path d="M${x + side * 3} 105.2 l${side * 3} -2.4" stroke="${INK}" stroke-width="1.6" stroke-linecap="round"/>` : ""}`;

  return eye(88, -1) + eye(112, 1);
}

function beard(look) {
  if (!look.beard) {
    return "";
  }

  const opacity = look.beard === "stubble" ? 0.3 : 0.95;
  return `
    <g fill="${look.hair}" opacity="${opacity}">
      <path d="M71 118 C72 142 86 157 100 157 C114 157 128 142 129 118 C125 133 116 140 100 140 C84 140 75 133 71 118 Z"/>
      <path d="M88 130 Q100 124 112 130 Q100 132 88 130 Z"/>
    </g>`;
}

function earrings(look) {
  if (look.earrings === "hoop") {
    return `<circle cx="67" cy="124" r="4.5" fill="none" stroke="#e8c15a" stroke-width="1.8"/><circle cx="133" cy="124" r="4.5" fill="none" stroke="#e8c15a" stroke-width="1.8"/>`;
  }

  if (look.earrings === "pearl") {
    return `<circle cx="68" cy="122" r="2.8" fill="#f8f3ec"/><circle cx="132" cy="122" r="2.8" fill="#f8f3ec"/>`;
  }

  return "";
}

// The head: hair, ears, face, features. Talking and blinking hook into the
// .eyes / .mouth-idle / .mouth-talk / .gaze classes.
function headMarkup(lookInput) {
  const look = { ...DEFAULT_LOOK, ...lookInput };
  const skin = look.skin;
  const skinShadow = shade(skin, -0.16);
  const hair = HAIR[look.hairStyle] || HAIR.short;
  const browColor = look.hairStyle === "sidepart" ? shade(look.hair, -0.35) : shade(look.hair, -0.1);

  return `
    <g class="head">
      <g class="hair-back" fill="${look.hair}">${hair.back || ""}</g>
      <ellipse cx="69" cy="113" rx="6" ry="9" fill="${skinShadow}"/>
      <ellipse cx="131" cy="113" rx="6" ry="9" fill="${skinShadow}"/>
      <path class="skin" d="M70 104 C70 80 84 64 100 64 C116 64 130 80 130 104 L130 118 C130 140 116 156 100 156 C84 156 70 140 70 118 Z" fill="${skin}"/>
      <path d="M100 64 C116 64 130 80 130 104 L130 118 C130 140 116 156 100 156 C112 146 119 132 119 112 C119 88 112 72 100 64 Z" fill="#000" opacity="0.07"/>
      <ellipse cx="81" cy="124" rx="6" ry="3.4" fill="#ff7a7a" opacity="0.16"/>
      <ellipse cx="119" cy="124" rx="6" ry="3.4" fill="#ff7a7a" opacity="0.16"/>
      ${beard(look)}
      <g class="hair-front" fill="${look.hair}">${hair.front}</g>
      ${
        look.shades
          ? `<g class="shades"><rect x="76" y="70" width="20" height="10" rx="4" fill="#1b2a4a" stroke="#0c0f16" stroke-width="1.6"/><rect x="104" y="70" width="20" height="10" rx="4" fill="#1b2a4a" stroke="#0c0f16" stroke-width="1.6"/><path d="M96 74 H104" stroke="#0c0f16" stroke-width="1.6"/><path d="M80 73 l5 -1.5" stroke="#9fc3ff" stroke-opacity="0.7" stroke-width="1.4" stroke-linecap="round"/></g>`
          : ""
      }
      <g class="brows" fill="none" stroke="${browColor}" stroke-width="3.4" stroke-linecap="round">${BROWS[look.brows] || BROWS.soft}</g>
      <g class="gaze"><g class="eyes">${eyes(look)}</g></g>
      ${
        look.glasses
          ? `<g fill="none" stroke="#14161b" stroke-width="2.4"><rect x="78" y="100" width="20" height="15" rx="4.5"/><rect x="102" y="100" width="20" height="15" rx="4.5"/><path d="M98 106 H102"/><path d="M78 105 L71 103 M122 105 L129 103"/></g>`
          : ""
      }
      <path d="M99 111 Q96 120 101 123" fill="none" stroke="${skinShadow}" stroke-width="2.2" stroke-linecap="round"/>
      <g class="mouth-idle">${idleMouth(look.mouth, look)}</g>
      <g class="mouth-talk"><ellipse cx="100" cy="135" rx="6.5" ry="5" fill="#4a1a20"/><path d="M94.5 132.5 Q100 131 105.5 132.5" stroke="#fff" stroke-width="1.8" fill="none" stroke-linecap="round"/></g>
      ${earrings(look)}
    </g>`;
}

function thoughtBubble() {
  return `
    <g class="thought">
      <circle cx="148" cy="66" r="3.5"/>
      <circle cx="157" cy="52" r="5.5"/>
      <ellipse cx="172" cy="30" rx="21" ry="14"/>
      <g class="thought-dots" fill="#1b2230">
        <circle cx="163" cy="30" r="2.6"/><circle cx="172" cy="30" r="2.6"/><circle cx="181" cy="30" r="2.6"/>
      </g>
    </g>`;
}

// Neckline + upper body for a seated bust. `shoulderY` lets the standing
// founder reuse the same outfit art a little higher.
function torsoMarkup(look, color) {
  const suit = look.suit;
  const neck = shade(look.skin, -0.1);
  const lapelShadow = `<path d="M84 194 L100 238 L92 300 L70 300 C70 250 74 214 84 194Z" fill="#000" opacity="0.2"/>
    <path d="M116 194 L100 238 L108 300 L130 300 C130 250 126 214 116 194Z" fill="#000" opacity="0.2"/>`;
  const shoulders = `<path d="M34 300 C36 238 50 206 76 196 L100 190 L124 196 C150 206 164 238 166 300 Z" fill="${suit}"/>
    <path d="M34 300 C36 238 50 206 76 196 L84 194 C70 220 62 262 64 300 Z" fill="#fff" opacity="0.05"/>`;
  const neckShape = `<path d="M89 146 L89 190 Q100 198 111 190 L111 146 Z" fill="${neck}"/>
    <path d="M89 150 Q100 164 111 150 L111 160 Q100 170 89 160 Z" fill="#000" opacity="0.14"/>`;
  const pin = `<path class="fin" d="M70 238 C73 229 78 224 85 222 C83 227 82 232 83 238 Z" fill="${color}"/>`;

  switch (look.top) {
    case "turtleneck":
      return `
        ${neckShape}
        ${shoulders}
        <path d="M82 176 Q100 186 118 176 L120 198 Q100 208 80 198 Z" fill="${shade(suit, 0.1)}"/>
        <g stroke="#000" stroke-opacity="0.15" stroke-width="1.2"><path d="M86 182 V200"/><path d="M93 184 V204"/><path d="M100 185 V205"/><path d="M107 184 V204"/><path d="M114 182 V200"/></g>
        <path d="M86 206 Q100 230 114 206" fill="none" stroke="#e8c15a" stroke-width="1.6"/>
        <path d="M100 224 l5 9 h-10 z" fill="${color}"/>`;
    case "blazer":
      return `
        ${neckShape}
        ${shoulders}
        <path d="M86 192 L100 240 L114 192 Q100 200 86 192 Z" fill="#f4ece4"/>
        ${lapelShadow}
        <path d="M127 228 l13 -4 l1.5 8 l-13 2.5z" fill="${color}"/>
        ${pin}`;
    case "open-collar":
      return `
        ${neckShape}
        ${shoulders}
        <path d="M85 190 L100 236 L115 190 Z" fill="#f3f5f8"/>
        <path d="M91 191 L100 214 L109 191 Q100 196 91 191 Z" fill="${neck}"/>
        <path d="M85 190 L94 206 L88 214 Z M115 190 L106 206 L112 214 Z" fill="#ffffff"/>
        <path d="M92 196 Q100 212 108 196" fill="none" stroke="#e8c15a" stroke-width="1.8"/>
        ${lapelShadow}
        ${pin}`;
    case "suit":
    default:
      return `
        ${neckShape}
        ${shoulders}
        <path d="M87 191 L100 228 L113 191 Q100 198 87 191 Z" fill="#eef1f5"/>
        <path d="M86 190 L100 206 L93 214 Z M114 190 L100 206 L107 214 Z" fill="#ffffff"/>
        <path d="M96 203 H104 L105 211 L102 260 L100 266 L98 260 L95 211 Z" fill="${color}"/>
        <path d="M96 203 H104 L103 210 H97 Z" fill="${shade(color, -0.2)}"/>
        ${lapelShadow}
        <path d="M127 228 l13 -4 l1.5 8 l-13 2.5z" fill="${color}" opacity="0.9"/>
        ${pin}`;
  }
}

const WALNUT = ["#7c4b2c", "#45271a"];
const LEATHER = ["#f3ebde", "#d6c9b4"];

function chairGradients(ids) {
  return `
    <linearGradient id="${ids.walnut}" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${WALNUT[0]}"/><stop offset="1" stop-color="${WALNUT[1]}"/>
    </linearGradient>
    <linearGradient id="${ids.leather}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${LEATHER[0]}"/><stop offset="1" stop-color="${LEATHER[1]}"/>
    </linearGradient>`;
}

// Upper body for a seated shark, in the 300x560 seated frame (center x=150).
function seatedTorso(look, color) {
  const suit = look.suit;
  const skinShadow = shade(look.skin, -0.12);
  const lapels = `<path d="M130 236 L150 296 L138 392 L104 392 C106 330 114 270 130 236 Z" fill="#000" opacity="0.2"/>
    <path d="M170 236 L150 296 L162 392 L196 392 C194 330 186 270 170 236 Z" fill="#000" opacity="0.2"/>`;
  const body = `<path d="M84 258 C88 242 108 234 132 232 L150 238 L168 232 C192 234 212 242 216 258 L224 394 L76 394 Z" fill="${suit}"/>
    <path d="M84 258 C88 242 108 234 132 232 L138 234 C116 260 100 320 96 394 L76 394 Z" fill="#fff" opacity="0.06"/>`;
  const neck = `<path d="M138 210 L138 248 Q150 256 162 248 L162 210 Z" fill="${skinShadow}"/>`;
  const pin = `<path class="fin" d="M112 302 C116 291 122 285 130 283 C128 289 127 295 128 302 Z" fill="${color}"/>`;
  const pocket = `<path d="M178 292 l18 -5 l2 10 l-18 3 z" fill="${color}" opacity="0.92"/>`;

  switch (look.top) {
    case "turtleneck":
      return `${neck}${body}
        <path d="M126 222 Q150 236 174 222 L178 254 Q150 268 122 254 Z" fill="${shade(suit, 0.12)}"/>
        <g stroke="#000" stroke-opacity="0.14" stroke-width="1.4"><path d="M132 232 V258"/><path d="M141 236 V262"/><path d="M150 238 V264"/><path d="M159 236 V262"/><path d="M168 232 V258"/></g>
        <path d="M134 266 Q150 300 166 266" fill="none" stroke="#e8c15a" stroke-width="2"/>
        <path d="M150 292 l6 11 h-12 z" fill="${color}"/>`;
    case "blazer":
      return `${neck}${body}
        <path d="M132 234 L150 302 L168 234 Q150 246 132 234 Z" fill="#f4ece4"/>
        ${lapels}${pocket}${pin}`;
    case "open-collar":
      return `${neck}${body}
        <path d="M130 232 L150 296 L170 232 Z" fill="#f3f5f8"/>
        <path d="M138 234 L150 268 L162 234 Q150 242 138 234 Z" fill="${skinShadow}"/>
        <path d="M130 232 L142 254 L134 264 Z M170 232 L158 254 L166 264 Z" fill="#ffffff"/>
        <path d="M139 240 Q150 262 161 240" fill="none" stroke="#e8c15a" stroke-width="2"/>
        ${lapels}${pin}`;
    case "suit":
    default:
      return `${neck}${body}
        <path d="M134 234 L150 292 L166 234 Q150 244 134 234 Z" fill="#eef1f5"/>
        <path d="M132 232 L150 254 L141 264 Z M168 232 L150 254 L159 264 Z" fill="#ffffff"/>
        <path d="M145 250 H155 L157 262 L153 340 L150 348 L147 340 L143 262 Z" fill="${color}"/>
        <path d="M145 250 H155 L154 260 H146 Z" fill="${shade(color, -0.22)}"/>
        ${lapels}
        <circle cx="150" cy="364" r="3" fill="#000" opacity="0.35"/>
        ${pocket}${pin}`;
  }
}

function seatedLegs(look) {
  const trousers = shade(look.suit, -0.25);

  if (look.top === "blazer") {
    // Vera wears a dress that matches her blazer.
    return `
      <path d="M80 384 L220 384 C228 410 228 432 218 448 L82 448 C72 432 72 410 80 384 Z" fill="${look.suit}"/>
      <path d="M82 448 L218 448" stroke="#000" stroke-opacity="0.2" stroke-width="2"/>
      <path d="M110 446 L134 446 L130 520 L114 520 Z" fill="${look.skin}"/>
      <path d="M166 446 L190 446 L186 520 L170 520 Z" fill="${shade(look.skin, -0.06)}"/>
      <path d="M108 516 h28 l2 12 h-32 z M164 516 h28 l2 12 h-32 z" fill="${shade(look.suit, -0.3)}"/>`;
  }

  return `
    <path d="M84 384 L216 384 C222 404 220 426 210 440 L90 440 C80 426 78 404 84 384 Z" fill="${trousers}"/>
    <path d="M150 392 V438" stroke="#000" stroke-opacity="0.18" stroke-width="2"/>
    <path d="M100 434 L138 434 L134 520 L106 520 Z" fill="${shade(trousers, -0.06)}"/>
    <path d="M162 434 L200 434 L194 520 L166 520 Z" fill="${shade(trousers, -0.12)}"/>
    <path d="M98 516 h42 a9 9 0 0 1 0 18 h-46 a7 9 0 0 1 4 -18 z M160 516 h42 a7 9 0 0 1 4 18 h-46 a9 9 0 0 1 0 -18 z" fill="#17110d"/>`;
}

// A shark seated in a cream-and-walnut lounge chair, facing the camera.
export function sharkSeatedFigure(shark) {
  const ids = { walnut: nextId("walnut"), leather: nextId("leather") };
  const look = { ...DEFAULT_LOOK, ...shark.look };
  const sleeve = shade(look.suit, -0.1);

  return `
    <svg class="figure figure-shark" viewBox="0 0 300 560" aria-hidden="true" focusable="false">
      <defs>${chairGradients(ids)}</defs>
      <g class="chair">
        <path d="M150 456 V512" stroke="#24272d" stroke-width="12"/>
        <path d="M150 510 L70 540 M150 510 L230 540 M150 510 L150 550" stroke="#3a3e46" stroke-width="9" stroke-linecap="round"/>
        <rect x="56" y="94" width="188" height="324" rx="78" fill="url(#${ids.walnut})"/>
        <rect x="72" y="110" width="156" height="300" rx="64" fill="url(#${ids.leather})"/>
        <path d="M86 214 H214 M86 312 H214" stroke="#000" stroke-opacity="0.08" stroke-width="3"/>
        <path d="M20 318 C20 304 32 296 48 296 L94 296 L94 354 L38 354 C28 354 20 346 20 336 Z" fill="url(#${ids.walnut})"/>
        <rect x="22" y="288" width="74" height="22" rx="11" fill="url(#${ids.leather})"/>
        <path d="M280 318 C280 304 268 296 252 296 L206 296 L206 354 L262 354 C272 354 280 346 280 336 Z" fill="url(#${ids.walnut})"/>
        <rect x="204" y="288" width="74" height="22" rx="11" fill="url(#${ids.leather})"/>
        <rect x="60" y="380" width="180" height="76" rx="30" fill="url(#${ids.leather})"/>
        <rect x="56" y="432" width="188" height="30" rx="14" fill="url(#${ids.walnut})"/>
      </g>
      <g class="torso">
        ${seatedTorso(look, shark.color)}
        <path d="M88 256 C66 262 50 282 48 302 L76 310 C80 292 88 278 100 270 Z" fill="${sleeve}"/>
        <path d="M212 256 C234 262 250 282 252 302 L224 310 C220 292 212 278 200 270 Z" fill="${sleeve}"/>
        <ellipse cx="60" cy="306" rx="14" ry="9" fill="${look.skin}"/>
        <ellipse cx="240" cy="306" rx="14" ry="9" fill="${shade(look.skin, -0.06)}"/>
        ${seatedLegs(look)}
      </g>
      <g transform="translate(150 232) scale(1.32) translate(-100 -156)">${headMarkup(look)}</g>
      <g transform="translate(36 40)">${thoughtBubble()}</g>
    </svg>`;
}

const BACK_HAIR = {
  short: `<path d="M80 88 C78 48 98 30 120 30 C142 30 162 48 160 88 C158 102 150 110 140 112 L100 112 C90 110 82 102 80 88 Z"/>`,
  buzz: `<path d="M82 88 C80 50 98 34 120 34 C142 34 160 50 158 88 C156 100 148 108 140 110 L100 110 C92 108 84 100 82 88 Z" opacity="0.85"/>`,
  bob: `<path d="M76 82 C74 44 96 28 120 28 C144 28 166 44 164 82 L166 120 C150 128 90 128 74 120 Z"/>`,
  long: `<path d="M76 82 C74 44 96 28 120 28 C144 28 166 44 164 82 L172 178 C150 188 90 188 68 178 Z"/>`,
  bun: `<path d="M80 88 C78 48 98 32 120 32 C142 32 162 48 160 88 C158 102 150 110 140 112 L100 112 C90 110 82 102 80 88 Z"/><circle cx="120" cy="44" r="17"/>`,
  curly: curls([[90, 52, 22], [120, 40, 22], [150, 52, 22], [84, 80, 18], [156, 80, 18], [100, 96, 16], [140, 96, 16], [120, 70, 22]]),
  "curly-short": curls([[96, 50, 16], [120, 42, 17], [144, 50, 16], [90, 76, 14], [150, 76, 14], [120, 84, 18]]),
};

const BACK_HAIR_FOR = {
  sidepart: "short",
  short: "short",
  slick: "short",
  buzz: "buzz",
  bob: "bob",
  "long-wavy": "long",
  "long-straight": "long",
  bun: "bun",
  curly: "curly",
  "curly-short": "curly-short",
};

// A shark seen from behind their chair, for the over-the-shoulder pitch shot.
export function sharkBackFigure(shark) {
  const ids = { walnut: nextId("walnut"), leather: nextId("leather") };
  const look = { ...DEFAULT_LOOK, ...shark.look };
  const hair = BACK_HAIR[BACK_HAIR_FOR[look.hairStyle] || "short"];

  return `
    <svg class="figure figure-back" viewBox="0 0 240 300" aria-hidden="true" focusable="false">
      <defs>${chairGradients(ids)}</defs>
      <path d="M30 300 C32 196 60 150 120 146 C180 150 208 196 210 300 Z" fill="${look.suit}"/>
      <rect x="104" y="108" width="32" height="46" rx="12" fill="${shade(look.skin, -0.14)}"/>
      <path d="M100 148 Q120 156 140 148 L138 160 Q120 166 102 160 Z" fill="${look.top === "turtleneck" ? shade(look.suit, 0.12) : "#eef1f5"}"/>
      <g class="back-head">
        <ellipse cx="82" cy="84" rx="7" ry="11" fill="${shade(look.skin, -0.1)}"/>
        <ellipse cx="158" cy="84" rx="7" ry="11" fill="${shade(look.skin, -0.1)}"/>
        <ellipse cx="120" cy="76" rx="38" ry="44" fill="${look.skin}"/>
        <g fill="${look.hair}">${hair}</g>
        ${look.glasses ? `<path d="M76 78 h8 M156 78 h8" stroke="#14161b" stroke-width="3" stroke-linecap="round"/>` : ""}
      </g>
      <path d="M22 300 L22 216 C22 172 60 152 120 152 C180 152 218 172 218 216 L218 300 Z" fill="url(#${ids.walnut})"/>
      <path d="M40 196 C50 172 82 164 120 164 C158 164 190 172 200 196" fill="none" stroke="#fff" stroke-opacity="0.1" stroke-width="4" stroke-linecap="round"/>
    </svg>`;
}

export function founderFigure(founder) {
  const look = { ...DEFAULT_LOOK, suit: founder.suit, skin: founder.skin, hair: founder.hair, hairStyle: founder.hairStyle, beard: founder.beard, lashes: founder.lashes };
  const accent = founder.accent || "#7ce8c8";
  const suit = look.suit;
  const trousers = shade(suit, -0.35);
  const hand = look.skin;

  return `
    <svg class="figure figure-founder" viewBox="0 0 240 520" aria-hidden="true" focusable="false">
      <g transform="translate(20 0)">
        <g class="legs">
          <g class="leg leg-left">
            <path d="M80 300 L76 488 L104 488 L112 302Z" fill="${trousers}"/>
            <path d="M70 486 h38 a8 8 0 0 1 0 16 h-42 a6 6 0 0 1 4 -16z" fill="#16110e"/>
          </g>
          <g class="leg leg-right">
            <path d="M108 302 L116 488 L144 488 L140 300Z" fill="${shade(trousers, -0.12)}"/>
            <path d="M112 486 h38 a8 8 0 0 1 4 16 h-42 a8 8 0 0 1 0 -16z" fill="#16110e"/>
          </g>
        </g>
        <g class="arm arm-back">
          <path d="M150 196 C166 204 172 240 170 290 L154 292 C152 250 150 222 142 206Z" fill="${shade(suit, -0.18)}"/>
          <ellipse cx="162" cy="298" rx="9" ry="11" fill="${shade(hand, -0.08)}"/>
        </g>
        <g class="torso">
          <path d="M89 140 L89 186 Q100 194 111 186 L111 140 Z" fill="${shade(look.skin, -0.1)}"/>
          <path d="M44 306 C42 236 52 198 76 186 L100 180 L124 186 C148 198 158 236 156 306 Z" fill="${suit}"/>
          <path d="M44 306 C42 236 52 198 76 186 L84 184 C68 214 60 262 62 306 Z" fill="#fff" opacity="0.06"/>
          <path d="M87 181 L100 220 L113 181 Q100 188 87 181 Z" fill="#eef2f7"/>
          <path d="M86 180 L100 196 L93 204 Z M114 180 L100 196 L107 204 Z" fill="#ffffff"/>
          <path d="M84 184 L100 232 L92 306 L68 306 C68 250 72 206 84 184Z" fill="#000" opacity="0.2"/>
          <path d="M116 184 L100 232 L108 306 L132 306 C132 250 128 206 116 184Z" fill="#000" opacity="0.2"/>
          <path d="M96.5 193 H103.5 L104.5 200 L102 244 L100 250 L98 244 L95.5 200 Z" fill="${accent}"/>
          <path d="M126 222 l12 -4 l1.4 7 l-12 2.4z" fill="${accent}"/>
        </g>
        <g class="arm arm-front">
          <path d="M52 196 C36 206 30 242 32 290 L48 292 C50 252 52 224 60 208Z" fill="${shade(suit, 0.06)}"/>
          <ellipse cx="40" cy="298" rx="9" ry="11" fill="${hand}"/>
        </g>
        <g transform="translate(100 158) scale(1.18) translate(-100 -150)">${headMarkup(look)}</g>
      </g>
    </svg>`;
}

export function avatar(person, { className = "" } = {}) {
  if (person.id === "narrator") {
    return `
      <span class="avatar avatar-narrator ${className}" aria-hidden="true">
        <svg viewBox="0 0 24 24"><path d="M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3Z" fill="currentColor"/><path d="M6 11a6 6 0 0 0 12 0M12 17v4M8.5 21h7" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>
      </span>`;
  }

  const isFounder = person.id === "founder";
  const color = isFounder ? person.accent || "#7ce8c8" : person.color;
  const look = isFounder
    ? { ...DEFAULT_LOOK, suit: person.suit, skin: person.skin, hair: person.hair, hairStyle: person.hairStyle, beard: person.beard, lashes: person.lashes }
    : { ...DEFAULT_LOOK, ...person.look };

  return `
    <span class="avatar ${className}" style="--who:${color}" aria-hidden="true">
      <svg viewBox="44 46 112 112" focusable="false">
        <g class="torso">${torsoMarkup(look, color)}</g>
        ${headMarkup(look)}
      </svg>
    </span>`;
}
