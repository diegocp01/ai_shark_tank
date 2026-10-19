// The studio set. A 1600x900 scene scaled to fit its frame, with a "camera"
// layer that pushes in on whoever is talking.

import { formatMoneyShort, formatPercent } from "/shared/format.js";
import { founderFigure, sharkFigure } from "./figures.js";
import { icon } from "./icons.js";

export const SCENE_WIDTH = 1600;
export const SCENE_HEIGHT = 900;

const SEAT_X = [150, 330, 510, 690, 870];
const SHARK_HEAD_Y = 520;
const FOUNDER_X = 1300;
const FOUNDER_HEAD_Y = 486;
const PODIUM_X = 1110;

const SHOTS = {
  wide: { x: 800, y: 450, zoom: 1 },
  panel: { x: 520, y: 470, zoom: 1.22 },
  founder: { x: 1230, y: 500, zoom: 1.5 },
};

function seatX(index) {
  return SEAT_X[index] ?? SEAT_X[SEAT_X.length - 1];
}

function setMarkup() {
  const lights = Array.from({ length: 22 }, (_, index) => `<span style="left:${40 + index * 72}px"></span>`).join("");
  const bubbles = Array.from(
    { length: 14 },
    (_, index) =>
      `<span style="left:${6 + ((index * 37) % 88)}%;animation-delay:${(index * 0.9) % 7}s;animation-duration:${6 + (index % 4)}s;width:${4 + (index % 3) * 3}px;height:${4 + (index % 3) * 3}px"></span>`,
  ).join("");
  const fish = (className, color) =>
    `<svg class="fish ${className}" viewBox="0 0 120 50" aria-hidden="true"><path d="M8 25 C28 4 72 2 96 22 L118 6 L112 25 L118 44 L96 28 C72 48 28 46 8 25Z" fill="${color}"/><circle cx="26" cy="22" r="2.4" fill="#02111f"/></svg>`;

  return `
    <div class="set-wall"></div>
    <div class="set-slats"></div>
    <div class="set-rig">${lights}</div>
    <div class="set-beams"><span></span><span></span><span></span><span></span></div>
    <div class="set-sconce" style="left:250px"></div>
    <div class="set-sconce" style="left:610px"></div>
    <div class="set-sign">
      <svg class="set-sign-fin" viewBox="0 0 64 48" aria-hidden="true"><path d="M4 44 C14 30 26 10 52 4 C44 18 42 30 46 44 Z"/></svg>
      <span class="set-sign-ai">AI</span>
      <span class="set-sign-word">SHARK TANK</span>
    </div>
    <div class="set-aquarium">
      <div class="aquarium-water"></div>
      <div class="aquarium-caustics"></div>
      ${fish("fish-a", "#0d3e63")}
      ${fish("fish-b", "#0a304f")}
      ${fish("fish-c", "#145079")}
      <svg class="aquarium-shark" viewBox="0 0 300 110" aria-hidden="true"><path d="M6 60 C60 30 150 22 214 44 L244 18 L238 50 C258 54 276 60 294 66 C270 72 250 76 232 78 L240 102 L208 82 C150 96 70 92 6 60Z" fill="#07243c"/></svg>
      <div class="aquarium-bubbles">${bubbles}</div>
      <svg class="aquarium-weeds" viewBox="0 0 560 120" preserveAspectRatio="none" aria-hidden="true">
        <path d="M20 120 C30 80 10 60 26 20 C40 60 50 80 44 120Z M70 120 C86 70 66 40 84 0 C98 50 108 80 96 120Z M470 120 C480 76 462 50 476 16 C492 56 498 86 494 120Z M520 120 C530 90 516 66 530 40 C542 70 548 96 544 120Z"/>
      </svg>
      <div class="aquarium-glass"></div>
    </div>
    <div class="set-floor"></div>
    <div class="set-reflection"></div>
    <div class="set-mark"></div>`;
}

export function createStage({ root, frame }) {
  root.innerHTML = `
    <div class="camera" data-shot="wide">
      ${setMarkup()}
      <div class="seats"></div>
      <div class="set-desk">
        <div class="desk-top"></div>
        <div class="desk-front"></div>
      </div>
      <div class="plates"></div>
      <div class="podium">
        <div class="hologram">
          <span class="hologram-icon"></span>
          <strong class="hologram-name"></strong>
          <span class="hologram-ask"></span>
        </div>
        <div class="podium-plinth"></div>
      </div>
      <div class="founder" data-position="offstage">
        <div class="founder-figure"></div>
        <div class="founder-shadow"></div>
      </div>
      <div class="spotlight"></div>
      <div class="house-lights"></div>
    </div>`;

  const camera = root.querySelector(".camera");
  const seatsLayer = root.querySelector(".seats");
  const platesLayer = root.querySelector(".plates");
  const founderEl = root.querySelector(".founder");
  const founderFigureEl = root.querySelector(".founder-figure");
  const spotlight = root.querySelector(".spotlight");
  const hologram = {
    icon: root.querySelector(".hologram-icon"),
    name: root.querySelector(".hologram-name"),
    ask: root.querySelector(".hologram-ask"),
  };
  const seats = new Map();
  const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)");
  let sharkOrder = [];
  let speakerId = null;
  let walkTimer = null;

  function resize() {
    const scale = frame.clientWidth / SCENE_WIDTH;
    root.style.setProperty("--scene-scale", String(scale || 1));
  }

  const observer = typeof ResizeObserver === "function" ? new ResizeObserver(resize) : null;
  observer?.observe(frame);
  window.addEventListener("resize", resize);
  resize();

  function positionOf(actorId) {
    if (actorId === "founder") {
      return { x: FOUNDER_X - (founderEl.dataset.position === "approach" ? 190 : 0), y: FOUNDER_HEAD_Y };
    }

    const index = sharkOrder.indexOf(actorId);

    if (index >= 0) {
      return { x: seatX(index), y: SHARK_HEAD_Y };
    }

    return null;
  }

  // Everyone looks at whoever is talking; the speaker looks at who they're addressing.
  function applyGaze(talkerId, addresseeId = null) {
    const talker = talkerId && talkerId !== "narrator" ? talkerId : null;

    for (const [id, seat] of seats) {
      const lookAt = talker && talker !== id ? talker : talker === id && addresseeId ? addresseeId : "founder";
      const target = positionOf(lookAt);
      const self = positionOf(id);
      const dx = target ? Math.max(-6, Math.min(6, (target.x - self.x) / 90)) : 0;
      seat.el.style.setProperty("--gaze-x", `${dx}px`);
    }

    const founderLookAt = talker && talker !== "founder" ? talker : addresseeId;
    const founderTarget = (founderLookAt && positionOf(founderLookAt)) || { x: 520 };
    const founderDx = Math.max(-6, Math.min(0, (founderTarget.x - FOUNDER_X) / 140));
    founderEl.style.setProperty("--gaze-x", `${founderDx}px`);
  }

  function setShot(name, focusId) {
    let shot = SHOTS.wide;

    if (!reducedMotion?.matches) {
      if (name === "close" && focusId) {
        const position = positionOf(focusId);
        shot = focusId === "founder" ? SHOTS.founder : { x: position.x + 40, y: 470, zoom: 1.55 };
      } else if (name === "medium" && focusId) {
        const position = positionOf(focusId);
        shot = { x: position.x + 80, y: 470, zoom: 1.3 };
      } else if (name === "two" && focusId) {
        const position = positionOf(focusId);
        const founderPosition = positionOf("founder");
        const span = Math.abs(founderPosition.x - position.x) + 420;
        const zoom = Math.max(1, Math.min(1.45, SCENE_WIDTH / span));
        shot = { x: (position.x + founderPosition.x) / 2, y: 480, zoom };
      } else if (SHOTS[name]) {
        shot = SHOTS[name];
      }
    }

    const { zoom } = shot;
    const tx = Math.min(0, Math.max(SCENE_WIDTH - SCENE_WIDTH * zoom, SCENE_WIDTH / 2 - shot.x * zoom));
    const ty = Math.min(0, Math.max(SCENE_HEIGHT - SCENE_HEIGHT * zoom, SCENE_HEIGHT / 2 - shot.y * zoom));
    camera.style.transform = `translate(${tx.toFixed(1)}px, ${ty.toFixed(1)}px) scale(${zoom})`;
    camera.dataset.shot = name;
  }

  function moveSpotlight(actorId) {
    const position = actorId ? positionOf(actorId) : null;
    spotlight.classList.toggle("is-on", Boolean(position));

    if (position) {
      root.style.setProperty("--spot-x", `${position.x}px`);
      root.style.setProperty("--spot-y", `${position.y}px`);
    }
  }

  function badgeFor(status, entry) {
    const offer = entry?.counter && status === "countered" ? entry.counter : entry?.offer;
    const terms = offer ? `${formatMoneyShort(offer.cashUsd)} · ${formatPercent(offer.equityPct)}` : "";

    switch (status) {
      case "out":
        return { label: "Out", tone: "out" };
      case "offer":
        return { label: terms, tone: "offer" };
      case "team":
        return { label: `Team · ${terms}`, tone: "offer" };
      case "countered":
        return { label: `Counter · ${formatPercent(offer.equityPct)}`, tone: "counter" };
      case "deal":
        return { label: "Deal", tone: "deal" };
      case "declined":
        return { label: "Passed", tone: "muted" };
      default:
        return null;
    }
  }

  return {
    resize,
    setSharks(sharks) {
      sharkOrder = sharks.map((shark) => shark.id);
      seats.clear();
      seatsLayer.innerHTML = "";
      platesLayer.innerHTML = "";

      sharks.forEach((shark, index) => {
        const seat = document.createElement("div");
        seat.className = "seat";
        seat.dataset.id = shark.id;
        seat.dataset.status = "waiting";
        seat.style.left = `${seatX(index) - 100}px`;
        seat.style.setProperty("--who", shark.color);
        seat.style.setProperty("--blink-delay", `${(index * 1.37) % 5}s`);
        seat.innerHTML = `
          <div class="seat-badge" aria-hidden="true"></div>
          ${sharkFigure(shark)}`;
        seatsLayer.append(seat);

        const plate = document.createElement("div");
        plate.className = "plate";
        plate.dataset.id = shark.id;
        plate.style.left = `${seatX(index) - 72}px`;
        plate.style.setProperty("--who", shark.color);
        plate.innerHTML = `<strong>${shark.displayName}</strong><span>${shark.persona}</span>`;
        platesLayer.append(plate);

        seats.set(shark.id, { el: seat, badge: seat.querySelector(".seat-badge"), plate });
      });

      applyGaze(null);
    },
    setPitch(pitch) {
      founderFigureEl.innerHTML = founderFigure(pitch.founder);
      founderEl.style.setProperty("--who", pitch.founder.accent);
      hologram.icon.innerHTML = icon(pitch.icon);
      hologram.name.textContent = pitch.productName;
      hologram.ask.textContent = pitch.askLabel ?? `${formatMoneyShort(pitch.askUsd)} for ${formatPercent(pitch.equityPct)}`;
      root.style.setProperty("--founder-accent", pitch.founder.accent);
      applyGaze(speakerId);
    },
    // Teleport (no walk animation), e.g. when previewing a pitch in the lobby.
    placeFounder(position) {
      window.clearTimeout(walkTimer);
      founderEl.classList.remove("is-walking");
      founderEl.classList.add("no-transition");
      founderEl.dataset.position = position;
      void founderEl.offsetWidth;
      founderEl.classList.remove("no-transition");
    },
    walkTo(position, durationMs = 2000) {
      window.clearTimeout(walkTimer);
      founderEl.style.setProperty("--walk-ms", `${durationMs}ms`);
      founderEl.classList.add("is-walking");
      // Force a style flush so the transition runs from the current spot.
      void founderEl.offsetWidth;
      founderEl.dataset.position = position;
      walkTimer = window.setTimeout(() => founderEl.classList.remove("is-walking"), durationMs);
    },
    setSpeaker(actorId, { phase = "speaking", lookAt = null } = {}) {
      speakerId = actorId;

      for (const [id, seat] of seats) {
        seat.el.classList.toggle("is-speaking", id === actorId && phase === "speaking");
        seat.el.classList.toggle("is-thinking", id === actorId && phase === "thinking");
        seat.el.classList.toggle("is-active", id === actorId);
      }

      founderEl.classList.toggle("is-speaking", actorId === "founder" && phase === "speaking");
      founderEl.classList.toggle("is-active", actorId === "founder");
      root.classList.toggle("has-speaker", Boolean(actorId) && actorId !== "narrator");
      moveSpotlight(actorId === "narrator" ? null : actorId);
      applyGaze(actorId, lookAt);
    },
    setSharkStatus(sharkId, status, entry) {
      const seat = seats.get(sharkId);

      if (!seat) {
        return;
      }

      const previous = seat.el.dataset.status;
      seat.el.dataset.status = status;
      seat.plate.dataset.status = status;
      const badge = badgeFor(status, entry);
      seat.badge.textContent = badge?.label || "";
      seat.badge.dataset.tone = badge?.tone || "";
      seat.badge.classList.toggle("is-visible", Boolean(badge));

      if (previous !== status && badge) {
        seat.badge.classList.remove("is-pop");
        void seat.badge.offsetWidth;
        seat.badge.classList.add("is-pop");
      }
    },
    setShot,
    setMood(mood) {
      root.dataset.mood = mood;
    },
    shotForBeat(beat) {
      if (beat.speakerId === "narrator" || beat.kind === "entrance") {
        return { name: "wide" };
      }

      if (beat.kind === "pitch") {
        return { name: "close", focus: "founder" };
      }

      if (beat.kind === "question") {
        return { name: "close", focus: beat.speakerId };
      }

      if (beat.kind === "answer") {
        return { name: "two", focus: beat.targetId };
      }

      if (beat.kind === "offer" || beat.kind === "out") {
        return { name: "medium", focus: beat.speakerId };
      }

      if (beat.speakerId === "founder") {
        return beat.targetId ? { name: "two", focus: beat.targetId } : { name: "founder" };
      }

      return { name: "two", focus: beat.speakerId };
    },
    reset() {
      for (const id of seats.keys()) {
        this.setSharkStatus(id, "waiting", null);
      }

      this.setSpeaker(null);
      setShot("wide");
      founderEl.classList.remove("is-celebrating");
    },
    celebrate(on) {
      founderEl.classList.toggle("is-celebrating", on);
    },
    destroy() {
      observer?.disconnect();
      window.removeEventListener("resize", resize);
    },
  };
}
