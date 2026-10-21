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

export function sharkFigure(shark) {
  const chairId = nextId("chair");
  const look = { ...DEFAULT_LOOK, ...shark.look };

  return `
    <svg class="figure figure-shark" viewBox="0 0 200 300" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="${chairId}" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#33231c"/>
          <stop offset="1" stop-color="#110b09"/>
        </linearGradient>
      </defs>
      <g class="chair">
        <rect x="26" y="40" width="148" height="268" rx="44" fill="url(#${chairId})"/>
        <rect x="26" y="40" width="148" height="268" rx="44" fill="none" stroke="${shark.color}" stroke-opacity="0.24" stroke-width="2"/>
        <g fill="#000" opacity="0.28">
          <circle cx="58" cy="78" r="3"/><circle cx="142" cy="78" r="3"/><circle cx="58" cy="130" r="3"/><circle cx="142" cy="130" r="3"/>
        </g>
        <path d="M56 50 Q100 36 144 50" fill="none" stroke="#fff" stroke-opacity="0.1" stroke-width="3" stroke-linecap="round"/>
      </g>
      <g class="torso">${torsoMarkup(look, shark.color)}</g>
      <g transform="translate(100 174.6) scale(1.16) translate(-100 -160)">${headMarkup(look)}</g>
      ${thoughtBubble()}
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
