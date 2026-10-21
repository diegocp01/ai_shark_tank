// The studio, shot like the real show with two camera setups:
//  - the PANEL set: the five sharks seated in lounge chairs, facing camera
//    (the founder's point of view), in front of the warm slat wall;
//  - the PITCH set: the founder on the rug in front of their product display,
//    filmed over the backs of the sharks' chairs.
// The director cuts between the sets and pushes in on whoever is talking.
// Both sets are 1600x900 scenes scaled to fit the frame.

import { formatMoneyShort, formatPercent } from "/shared/format.js";
import { founderFigure, sharkBackFigure, sharkSeatedFigure } from "./figures.js";
import { icon } from "./icons.js";

export const SCENE_WIDTH = 1600;
export const SCENE_HEIGHT = 900;

// Panel set: seat centers (front view, left to right).
const SEAT_X = [180, 490, 800, 1110, 1420];
const SEAT_HEAD_Y = 335;
// Pitch set: chair backs are mirrored, because the camera is behind them.
const BACK_X = [1480, 1180, 740, 440, 140];
const FOUNDER_X = 960;
const FOUNDER_HEAD_Y = 300;

function panelMarkup() {
  const steps = Array.from({ length: 6 }, (_, index) => {
    const x = 470 - index * 86;
    const y = 250 - index * 40;
    return `<g transform="translate(${x} ${y})"><path d="M0 0 H150 L130 18 H-20 Z" fill="#2a2523"/><path d="M-20 18 H130" stroke="#4fa8ff" stroke-width="4" stroke-linecap="round"/></g>`;
  }).join("");

  return `
    <div class="panel-wall"></div>
    <div class="panel-glow"></div>
    <svg class="panel-stairs" viewBox="0 0 640 300" aria-hidden="true">
      <path d="M0 300 L640 300 L640 268 L0 268 Z" fill="#1a1412"/>
      ${steps}
      <path d="M-40 300 L620 270" stroke="#4fa8ff" stroke-opacity="0.35" stroke-width="2"/>
    </svg>
    <div class="panel-logo"><svg viewBox="0 0 64 48" aria-hidden="true"><path d="M4 44 C14 30 26 10 52 4 C44 18 42 30 46 44 Z"/></svg><span><b>AI</b> SHARK TANK</span></div>
    <div class="panel-floor"></div>
    <div class="panel-edge"></div>
    <div class="seats"></div>
    <div class="side-tables">
      ${[335, 645, 955, 1265]
        .map(
          (x, index) => `
        <div class="side-table" style="left:${x - 70}px">
          <div class="side-table-top"></div>
          <div class="side-table-legs"></div>
          <span class="water-glass"></span>
          <span class="notepad" style="${index % 2 ? "left:62px" : ""}"></span>
        </div>`,
        )
        .join("")}
    </div>
    <div class="handshake-founder" data-position="offstage"><div class="founder-figure"></div><div class="founder-shadow"></div></div>
    <div class="spotlight"></div>
    <div class="house-lights"></div>`;
}

function pitchMarkup() {
  const tiles = Array.from({ length: 15 }, (_, index) => `<span class="tile tile-${index % 3}"></span>`).join("");

  return `
    <div class="pitch-wall"></div>
    <div class="pitch-sconce" style="left:120px"></div>
    <div class="pitch-sconce" style="left:1010px"></div>
    <div class="pitch-door">
      <div class="door-hall"></div>
      <div class="door-frame"></div>
    </div>
    <div class="pitch-sign"><svg viewBox="0 0 64 48" aria-hidden="true"><path d="M4 44 C14 30 26 10 52 4 C44 18 42 30 46 44 Z"/></svg><span><b>AI</b> SHARK TANK</span></div>
    <div class="pitch-neon"></div>
    <div class="planter"><svg viewBox="0 0 160 260" aria-hidden="true">
      <g stroke="#3f7a43" stroke-width="5" stroke-linecap="round" fill="none">
        <path d="M80 190 C70 120 40 80 26 20"/><path d="M80 190 C84 110 96 60 90 0"/><path d="M80 190 C96 120 126 84 146 30"/>
        <path d="M80 190 C60 140 30 120 8 90"/><path d="M80 190 C104 140 136 128 156 104"/><path d="M80 190 C76 130 64 90 56 40"/>
      </g>
      <rect x="30" y="186" width="100" height="74" rx="10" fill="#2b2f36"/>
    </svg></div>
    <div class="pitch-board">
      <div class="board-head">
        <strong class="board-product"></strong>
        <span class="board-tagline"></span>
      </div>
      <div class="board-tiles">${tiles}</div>
      <div class="board-foot"><span class="board-startup"></span><span class="board-ask"></span></div>
    </div>
    <div class="pitch-floor"></div>
    <svg class="pitch-rug" viewBox="0 0 900 200" preserveAspectRatio="none" aria-hidden="true">
      <path d="M150 0 H750 L900 200 H0 Z" fill="#6e1c20"/>
      <path d="M176 12 H724 L862 188 H38 Z" fill="none" stroke="#d8a85a" stroke-width="5"/>
      <path d="M206 30 H694 L812 170 H88 Z" fill="none" stroke="#2c3f6b" stroke-width="10"/>
      <path d="M450 58 L560 100 L450 142 L340 100 Z" fill="#8f2a2a" stroke="#d8a85a" stroke-width="4"/>
      <circle cx="450" cy="100" r="14" fill="#d8a85a"/>
    </svg>
    <div class="founder" data-position="offstage"><div class="founder-figure"></div><div class="founder-shadow"></div></div>
    <div class="backs"></div>
    <div class="spotlight"></div>
    <div class="house-lights"></div>`;
}

export function createStage({ root, frame }) {
  root.innerHTML = `
    <div class="set set-panel" data-active="false"><div class="camera">${panelMarkup()}</div></div>
    <div class="set set-pitch" data-active="true"><div class="camera">${pitchMarkup()}</div></div>`;

  const sets = {
    panel: root.querySelector(".set-panel"),
    pitch: root.querySelector(".set-pitch"),
  };
  const cameras = {
    panel: sets.panel.querySelector(".camera"),
    pitch: sets.pitch.querySelector(".camera"),
  };
  const seatsLayer = sets.panel.querySelector(".seats");
  const backsLayer = sets.pitch.querySelector(".backs");
  const founderEl = sets.pitch.querySelector(".founder");
  const handshakeEl = sets.panel.querySelector(".handshake-founder");
  const board = {
    root: sets.pitch.querySelector(".pitch-board"),
    product: sets.pitch.querySelector(".board-product"),
    tagline: sets.pitch.querySelector(".board-tagline"),
    tiles: sets.pitch.querySelectorAll(".tile"),
    startup: sets.pitch.querySelector(".board-startup"),
    ask: sets.pitch.querySelector(".board-ask"),
  };
  const seats = new Map();
  const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)");
  let sharkOrder = [];
  let speakerId = null;
  let handshakeId = null;
  let activeSet = "pitch";
  const walkTimers = new Map();

  function resize() {
    const scale = frame.clientWidth / SCENE_WIDTH;
    root.style.setProperty("--scene-scale", String(scale || 1));
  }

  const observer = typeof ResizeObserver === "function" ? new ResizeObserver(resize) : null;
  observer?.observe(frame);
  window.addEventListener("resize", resize);
  resize();

  function seatIndex(sharkId) {
    return sharkOrder.indexOf(sharkId);
  }

  function seatX(sharkId) {
    return SEAT_X[Math.max(0, seatIndex(sharkId))];
  }

  // The founder stands beside the investor on whichever side has room.
  function handshakeX(sharkId) {
    const x = seatX(sharkId);
    return x > SCENE_WIDTH / 2 ? x - 160 : x + 160;
  }

  function backX(sharkId) {
    return BACK_X[Math.max(0, seatIndex(sharkId))];
  }

  function useSet(name) {
    if (activeSet === name) {
      return;
    }

    activeSet = name;
    sets.panel.dataset.active = String(name === "panel");
    sets.pitch.dataset.active = String(name === "pitch");
  }

  function aim(setName, shot) {
    const zoom = reducedMotion?.matches ? 1 : shot.zoom;
    const tx = Math.min(0, Math.max(SCENE_WIDTH - SCENE_WIDTH * zoom, SCENE_WIDTH / 2 - shot.x * zoom));
    const ty = Math.min(0, Math.max(SCENE_HEIGHT - SCENE_HEIGHT * zoom, SCENE_HEIGHT / 2 - shot.y * zoom));
    cameras[setName].style.transform = `translate(${tx.toFixed(1)}px, ${ty.toFixed(1)}px) scale(${zoom})`;
    useSet(setName);
  }

  // Shot names: panel, shark-close, shark-medium, handshake (panel set);
  // pitch, founder-close, ots (pitch set). "wide" is the panel wide shot.
  function setShot(name, focusId = null) {
    switch (name) {
      case "shark-close":
        aim("panel", { x: seatX(focusId), y: 380, zoom: 1.7 });
        break;
      case "shark-medium":
        aim("panel", { x: seatX(focusId), y: 410, zoom: 1.32 });
        break;
      case "handshake": {
        const target = focusId || handshakeId || sharkOrder[0];
        aim("panel", { x: (seatX(target) + handshakeX(target)) / 2, y: 430, zoom: 1.4 });
        break;
      }
      case "pitch":
        aim("pitch", { x: 800, y: 450, zoom: 1 });
        break;
      case "founder-close":
        aim("pitch", { x: FOUNDER_X - 60, y: 420, zoom: 1.55 });
        break;
      case "ots":
        aim("pitch", { x: (backX(focusId) + FOUNDER_X) / 2, y: 500, zoom: 1.3 });
        break;
      case "panel":
      case "wide":
      default:
        aim("panel", { x: 800, y: 450, zoom: 1 });
        break;
    }
  }

  function applyGaze(talkerId, addresseeId = null) {
    const talker = talkerId && talkerId !== "narrator" ? talkerId : null;

    // Sharks face the camera (the founder) unless another shark is talking.
    for (const [id, seat] of seats) {
      const dx = talker && talker !== "founder" && talker !== id ? Math.max(-6, Math.min(6, (seatX(talker) - seatX(id)) / 70)) : 0;
      seat.el.style.setProperty("--gaze-x", `${dx}px`);
    }

    // The founder faces the panel, glancing toward whoever they're talking with.
    const focus = talker && talker !== "founder" ? talker : addresseeId;
    const founderDx = focus && seats.has(focus) ? Math.max(-5, Math.min(5, (backX(focus) - FOUNDER_X) / 150)) : 0;
    founderEl.style.setProperty("--gaze-x", `${founderDx}px`);
    handshakeEl.style.setProperty("--gaze-x", "-4px");
  }

  function moveSpotlight(actorId) {
    const panelSpot = actorId && seats.has(actorId);
    sets.panel.classList.toggle("has-speaker", Boolean(panelSpot));
    sets.pitch.classList.toggle("has-speaker", actorId === "founder");

    if (panelSpot) {
      sets.panel.style.setProperty("--spot-x", `${seatX(actorId)}px`);
      sets.panel.style.setProperty("--spot-y", `${SEAT_HEAD_Y}px`);
    }

    sets.pitch.style.setProperty("--spot-x", `${FOUNDER_X}px`);
    sets.pitch.style.setProperty("--spot-y", `${FOUNDER_HEAD_Y}px`);
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

  function setBadge(badgeEl, status, entry) {
    const badge = badgeFor(status, entry);
    const changed = badgeEl.dataset.status !== status;
    badgeEl.dataset.status = status;
    badgeEl.textContent = badge?.label || "";
    badgeEl.dataset.tone = badge?.tone || "";
    badgeEl.classList.toggle("is-visible", Boolean(badge));

    if (changed && badge) {
      badgeEl.classList.remove("is-pop");
      void badgeEl.offsetWidth;
      badgeEl.classList.add("is-pop");
    }
  }

  function setPosition(el, position, durationMs) {
    window.clearTimeout(walkTimers.get(el));

    if (durationMs === 0) {
      el.classList.remove("is-walking");
      el.classList.add("no-transition");
      el.dataset.position = position;
      void el.offsetWidth;
      el.classList.remove("no-transition");
      return;
    }

    el.style.setProperty("--walk-ms", `${durationMs}ms`);
    el.classList.add("is-walking");
    void el.offsetWidth;
    el.dataset.position = position;
    walkTimers.set(el, window.setTimeout(() => el.classList.remove("is-walking"), durationMs));
  }

  return {
    resize,
    setSharks(sharks) {
      sharkOrder = sharks.map((shark) => shark.id);
      seats.clear();
      seatsLayer.innerHTML = "";
      backsLayer.innerHTML = "";

      sharks.forEach((shark, index) => {
        const seat = document.createElement("div");
        seat.className = "seat";
        seat.dataset.id = shark.id;
        seat.dataset.status = "waiting";
        seat.style.left = `${SEAT_X[index] - 130}px`;
        seat.style.setProperty("--who", shark.color);
        seat.style.setProperty("--blink-delay", `${(index * 1.37) % 5}s`);
        seat.innerHTML = `<div class="seat-badge" aria-hidden="true"></div>${sharkSeatedFigure(shark)}`;
        seatsLayer.append(seat);

        const back = document.createElement("div");
        back.className = "seat-back";
        back.dataset.id = shark.id;
        back.style.left = `${BACK_X[index] - 165}px`;
        back.style.setProperty("--who", shark.color);
        back.innerHTML = `<div class="seat-badge" aria-hidden="true"></div>${sharkBackFigure(shark)}`;
        backsLayer.append(back);

        seats.set(shark.id, {
          el: seat,
          badge: seat.querySelector(".seat-badge"),
          back,
          backBadge: back.querySelector(".seat-badge"),
        });
      });

      applyGaze(null);
    },
    setPitch(pitch) {
      const figure = founderFigure(pitch.founder);
      founderEl.querySelector(".founder-figure").innerHTML = figure;
      handshakeEl.querySelector(".founder-figure").innerHTML = founderFigure(pitch.founder);
      founderEl.style.setProperty("--who", pitch.founder.accent);
      root.style.setProperty("--founder-accent", pitch.founder.accent);
      board.product.textContent = pitch.productName;
      board.tagline.textContent = pitch.tagline || "";
      board.startup.textContent = pitch.startupName || "";
      board.ask.textContent = pitch.askLabel ?? `Seeking ${formatMoneyShort(pitch.askUsd)} for ${formatPercent(pitch.equityPct)}`;
      board.tiles.forEach((tile) => {
        tile.innerHTML = icon(pitch.icon);
      });
      applyGaze(speakerId);
    },
    // Founder positions on the pitch set: "offstage" (in the hallway) or "mark" (on the rug).
    placeFounder(position) {
      setPosition(founderEl, position, 0);
    },
    walkTo(position, durationMs = 2000) {
      setPosition(founderEl, position, durationMs);
    },
    // Deal: the founder walks over to shake on it with the (first) investor.
    handshake(sharkId, durationMs = 1600) {
      handshakeId = sharkId;
      handshakeEl.style.setProperty("--handshake-x", `${handshakeX(sharkId)}px`);
      // Reach toward the shark with the hand nearest them.
      handshakeEl.dataset.side = handshakeX(sharkId) < seatX(sharkId) ? "left" : "right";
      setPosition(handshakeEl, "offstage", 0);
      handshakeEl.classList.add("is-celebrating");
      setPosition(handshakeEl, "beside", durationMs);
      setShot("handshake", sharkId);
    },
    setSpeaker(actorId, { phase = "speaking", lookAt = null } = {}) {
      speakerId = actorId;

      for (const [id, seat] of seats) {
        seat.el.classList.toggle("is-speaking", id === actorId && phase === "speaking");
        seat.el.classList.toggle("is-thinking", id === actorId && phase === "thinking");
        seat.el.classList.toggle("is-active", id === actorId);
        seat.back.classList.toggle("is-active", id === actorId || (actorId === "founder" && id === lookAt));
      }

      founderEl.classList.toggle("is-speaking", actorId === "founder" && phase === "speaking");
      founderEl.classList.toggle("is-active", actorId === "founder");
      moveSpotlight(actorId === "narrator" ? null : actorId);
      applyGaze(actorId, lookAt);
    },
    setSharkStatus(sharkId, status, entry) {
      const seat = seats.get(sharkId);

      if (!seat) {
        return;
      }

      seat.el.dataset.status = status;
      seat.back.dataset.status = status;
      setBadge(seat.badge, status, entry);
      setBadge(seat.backBadge, status, entry);
    },
    setShot,
    setMood(mood) {
      root.dataset.mood = mood;

      if (mood === "lobby") {
        setShot("pitch");
      }
    },
    shotForBeat(beat) {
      if (beat.kind === "verdict") {
        return beat.tone === "deal" ? { name: "handshake" } : { name: "pitch" };
      }

      if (beat.speakerId === "narrator") {
        return { name: "panel" };
      }

      if (beat.kind === "entrance") {
        return { name: "pitch" };
      }

      if (beat.kind === "pitch") {
        return { name: "founder-close" };
      }

      if (beat.kind === "question") {
        return { name: "shark-close", focus: beat.speakerId };
      }

      if (beat.kind === "offer" || beat.kind === "out") {
        return { name: "shark-medium", focus: beat.speakerId };
      }

      if (beat.speakerId === "founder") {
        return beat.targetId ? { name: "ots", focus: beat.targetId } : { name: "founder-close" };
      }

      return { name: "shark-close", focus: beat.speakerId };
    },
    reset() {
      for (const id of seats.keys()) {
        this.setSharkStatus(id, "waiting", null);
      }

      handshakeId = null;
      handshakeEl.classList.remove("is-celebrating");
      setPosition(handshakeEl, "offstage", 0);
      this.setSpeaker(null);
      setShot("panel");
    },
    celebrate(on) {
      handshakeEl.classList.toggle("is-celebrating", on);
    },
    destroy() {
      observer?.disconnect();
      window.removeEventListener("resize", resize);
    },
  };
}
