// SVG character art. Every shark is a glossy AI robot with a dorsal fin and a
// persona-specific face; the founder is a standing robot with an idea-bulb antenna.

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

const EYES = {
  skeptic: `
    <rect x="77" y="105" width="17" height="6" rx="3"/>
    <rect x="106" y="100" width="15" height="14" rx="5"/>
    <path class="brow" d="M103 94 L125 89" fill="none" stroke-width="3.4" stroke-linecap="round"/>`,
  visionary: `
    <path d="M77 111 Q85.5 99 94 111" fill="none" stroke-width="4.4" stroke-linecap="round"/>
    <path d="M106 111 Q114.5 99 123 111" fill="none" stroke-width="4.4" stroke-linecap="round"/>
    <path class="sparkle" d="M131 86 l1.6 4 4 1.6 -4 1.6 -1.6 4 -1.6 -4 -4 -1.6 4 -1.6z"/>`,
  numbers: `
    <rect x="75" y="97" width="21" height="20" rx="4" fill="none" stroke-width="2.2"/>
    <rect x="104" y="97" width="21" height="20" rx="4" fill="none" stroke-width="2.2"/>
    <path d="M96 106 h8" fill="none" stroke-width="2.2"/>
    <rect x="80" y="102" width="11" height="10" rx="1.5"/>
    <rect x="109" y="102" width="11" height="10" rx="1.5"/>`,
  brand: `
    <path d="M76 108 Q85.5 98 95 108 Q85.5 115 76 108Z"/>
    <path d="M105 108 Q114.5 98 124 108 Q114.5 115 105 108Z"/>
    <path d="M95 106 l4.5 -3.5 M124 106 l4.5 -3.5" fill="none" stroke-width="2.2" stroke-linecap="round"/>`,
  wildcard: `
    <circle cx="85" cy="107" r="8.5"/>
    <circle cx="116" cy="109" r="4.8"/>
    <path class="brow" d="M74 93 l5.5 -3.5 5.5 3.5 5.5 -3.5" fill="none" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>`,
  founder: `
    <circle cx="87" cy="106" r="6.5"/>
    <circle cx="113" cy="106" r="6.5"/>`,
};

const IDLE_MOUTHS = {
  skeptic: `<path d="M91 131 L110 127" fill="none" stroke-width="3" stroke-linecap="round"/>`,
  visionary: `<path d="M90 127 Q100 135 110 127" fill="none" stroke-width="3" stroke-linecap="round"/>`,
  numbers: `<path d="M92 130 H108" fill="none" stroke-width="3" stroke-linecap="round"/>`,
  brand: `<path d="M92 128 Q100 133 108 128" fill="none" stroke-width="3" stroke-linecap="round"/>`,
  wildcard: `<path d="M86 126 Q100 139 114 126" fill="none" stroke-width="3" stroke-linecap="round"/>`,
  founder: `<path d="M90 127 Q100 134 110 127" fill="none" stroke-width="3" stroke-linecap="round"/>`,
};

function talkingMouth() {
  return [86, 93, 100, 107, 114]
    .map((x, index) => `<rect class="bar bar-${index}" x="${x - 1.75}" y="123" width="3.5" height="14" rx="1.75"/>`)
    .join("");
}

// The head is shared by full figures and the small avatars.
function headMarkup({ color, shell, eyes, fin = true, antenna = null, ids }) {
  const shellLight = shade(shell, 0.28);
  const shellDark = shade(shell, -0.32);

  return `
    <defs>
      <linearGradient id="${ids.shell}" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="${shellLight}"/>
        <stop offset="0.55" stop-color="${shell}"/>
        <stop offset="1" stop-color="${shellDark}"/>
      </linearGradient>
      <radialGradient id="${ids.visor}" cx="0.45" cy="0.3" r="0.85">
        <stop offset="0" stop-color="#1c2738"/>
        <stop offset="1" stop-color="#05080e"/>
      </radialGradient>
      <filter id="${ids.glow}" x="-40%" y="-40%" width="180%" height="180%">
        <feGaussianBlur stdDeviation="2.1" result="blur"/>
        <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
      </filter>
    </defs>
    <g class="head">
      ${fin ? `<path class="fin" d="M90 68 C96 40 112 24 130 17 C123 35 121 52 123 70 Z" fill="${color}"/>` : ""}
      ${
        antenna
          ? `<path d="M100 64 V34" stroke="${shellDark}" stroke-width="4" stroke-linecap="round"/>
             <circle class="bulb" cx="100" cy="28" r="8" fill="${antenna}"/>`
          : ""
      }
      <rect x="39" y="99" width="15" height="36" rx="7.5" fill="${shellDark}"/>
      <rect x="146" y="99" width="15" height="36" rx="7.5" fill="${shellDark}"/>
      <circle class="ear-light" cx="46.5" cy="117" r="3.6" fill="${color}"/>
      <circle class="ear-light" cx="153.5" cy="117" r="3.6" fill="${color}"/>
      <rect x="50" y="62" width="100" height="110" rx="44" fill="url(#${ids.shell})"/>
      <path d="M62 84 Q78 66 104 66" fill="none" stroke="#fff" stroke-opacity="0.35" stroke-width="3" stroke-linecap="round"/>
      <rect class="visor" x="59" y="80" width="82" height="66" rx="29" fill="url(#${ids.visor})"/>
      <rect x="59" y="80" width="82" height="66" rx="29" fill="none" stroke="${color}" stroke-opacity="0.28" stroke-width="1.6"/>
      <path d="M70 92 Q82 85 96 86" fill="none" stroke="#fff" stroke-opacity="0.16" stroke-width="2.5" stroke-linecap="round"/>
      <g class="face" fill="${color}" stroke="${color}" filter="url(#${ids.glow})">
        <g class="gaze">
          <g class="eyes">${EYES[eyes]}</g>
          <g class="mouth-idle">${IDLE_MOUTHS[eyes]}</g>
          <g class="mouth-talk" stroke="none">${talkingMouth()}</g>
        </g>
      </g>
      <g class="thinking-dots" fill="${color}">
        <circle cx="86" cy="113" r="4"/><circle cx="100" cy="113" r="4"/><circle cx="114" cy="113" r="4"/>
      </g>
    </g>`;
}

export function sharkFigure(shark) {
  const ids = { shell: nextId("shell"), visor: nextId("visor"), glow: nextId("glow"), chair: nextId("chair") };
  const { color } = shark;
  const { suit, shell, eyes } = shark.look;

  return `
    <svg class="figure figure-shark" viewBox="0 0 200 300" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="${ids.chair}" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#33231c"/>
          <stop offset="1" stop-color="#110b09"/>
        </linearGradient>
      </defs>
      <g class="chair">
        <rect x="26" y="58" width="148" height="250" rx="44" fill="url(#${ids.chair})"/>
        <rect x="26" y="58" width="148" height="250" rx="44" fill="none" stroke="${color}" stroke-opacity="0.22" stroke-width="2"/>
        <g fill="#000" opacity="0.28">
          <circle cx="62" cy="96" r="3"/><circle cx="100" cy="88" r="3"/><circle cx="138" cy="96" r="3"/>
          <circle cx="62" cy="140" r="3"/><circle cx="138" cy="140" r="3"/>
        </g>
        <path d="M56 68 Q100 54 144 68" fill="none" stroke="#fff" stroke-opacity="0.1" stroke-width="3" stroke-linecap="round"/>
      </g>
      <g class="torso">
        <path d="M34 300 C36 238 50 206 76 196 L100 190 L124 196 C150 206 164 238 166 300 Z" fill="${suit}"/>
        <path d="M34 300 C36 238 50 206 76 196 L84 194 C70 220 62 262 64 300 Z" fill="#fff" opacity="0.05"/>
        <path d="M84 194 L100 238 L92 300 L70 300 C70 250 74 214 84 194Z" fill="#000" opacity="0.2"/>
        <path d="M116 194 L100 238 L108 300 L130 300 C130 250 126 214 116 194Z" fill="#000" opacity="0.2"/>
        <path d="M88 192 L100 228 L112 192 Z" fill="#e9edf3"/>
        <path d="M100 200 L106 214 L102 262 L100 268 L98 262 L94 214 Z" fill="${color}"/>
        <path d="M127 226 l13 -4 l1.5 8 l-13 2.5z" fill="${color}" opacity="0.9"/>
        <rect x="90" y="164" width="20" height="32" rx="6" fill="${shade(shell, -0.45)}"/>
      </g>
      ${headMarkup({ color, shell, eyes, ids })}
    </svg>`;
}

export function founderFigure(founder) {
  const ids = { shell: nextId("shell"), visor: nextId("visor"), glow: nextId("glow") };
  const suit = founder.suit || "#24324f";
  const accent = founder.accent || "#7ce8c8";
  const trousers = shade(suit, -0.35);

  return `
    <svg class="figure figure-founder" viewBox="0 0 240 520" aria-hidden="true" focusable="false">
      <g transform="translate(20 0)">
        <g class="legs">
          <g class="leg leg-left">
            <path d="M80 300 L76 488 L104 488 L112 302Z" fill="${trousers}"/>
            <path d="M70 486 h38 a8 8 0 0 1 0 16 h-42 a6 6 0 0 1 4 -16z" fill="#0d0f14"/>
          </g>
          <g class="leg leg-right">
            <path d="M108 302 L116 488 L144 488 L140 300Z" fill="${shade(trousers, -0.12)}"/>
            <path d="M112 486 h38 a8 8 0 0 1 4 16 h-42 a8 8 0 0 1 0 -16z" fill="#0d0f14"/>
          </g>
        </g>
        <g class="arm arm-back">
          <path d="M150 196 C166 204 172 240 170 290 L154 292 C152 250 150 222 142 206Z" fill="${shade(suit, -0.18)}"/>
          <circle cx="162" cy="298" r="11" fill="#c7cfdb"/>
        </g>
        <g class="torso">
          <path d="M44 306 C42 236 52 198 76 186 L100 180 L124 186 C148 198 158 236 156 306 Z" fill="${suit}"/>
          <path d="M44 306 C42 236 52 198 76 186 L84 184 C68 214 60 262 62 306 Z" fill="#fff" opacity="0.06"/>
          <path d="M84 184 L100 232 L92 306 L68 306 C68 250 72 206 84 184Z" fill="#000" opacity="0.2"/>
          <path d="M116 184 L100 232 L108 306 L132 306 C132 250 128 206 116 184Z" fill="#000" opacity="0.2"/>
          <path d="M88 182 L100 220 L112 182 Z" fill="#eef2f7"/>
          <path d="M100 190 L105 202 L102 246 L100 252 L98 246 L95 202 Z" fill="${accent}"/>
          <rect x="90" y="160" width="20" height="28" rx="6" fill="#4a5262"/>
        </g>
        <g class="arm arm-front">
          <path d="M52 196 C36 206 30 242 32 290 L48 292 C50 252 52 224 60 208Z" fill="${shade(suit, 0.06)}"/>
          <circle cx="40" cy="298" r="11" fill="#d7dee8"/>
        </g>
        ${headMarkup({ color: accent, shell: "#cfd7e3", eyes: "founder", fin: false, antenna: accent, ids })}
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

  const ids = { shell: nextId("shell"), visor: nextId("visor"), glow: nextId("glow") };
  const isFounder = person.id === "founder";
  const color = isFounder ? person.accent || "#7ce8c8" : person.color;
  const shell = isFounder ? "#cfd7e3" : person.look.shell;
  const eyes = isFounder ? "founder" : person.look.eyes;

  return `
    <span class="avatar ${className}" style="--who:${color}" aria-hidden="true">
      <svg viewBox="34 14 132 160" focusable="false">
        ${headMarkup({ color, shell, eyes, fin: !isFounder, antenna: isFounder ? color : null, ids })}
      </svg>
    </span>`;
}
