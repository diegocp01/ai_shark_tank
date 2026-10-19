// DOM renderers for everything around the stage: caption, deal board,
// transcript, phase rail, and the verdict dialog.

import {
  formatMoneyFull,
  formatMoneyShort,
  formatOfferFull,
  formatPercent,
  impliedValuation,
} from "/shared/format.js";
import { avatar } from "./figures.js";
import { icon } from "./icons.js";

const STATUS_LABELS = {
  waiting: "Listening",
  thinking: "Thinking",
  out: "Out",
  offer: "Offer",
  team: "Team offer",
  countered: "Countered",
  deal: "Deal",
  declined: "Passed",
};

const TONE_CHIPS = {
  offer: { label: "Offer", tone: "offer" },
  out: { label: "Out", tone: "out" },
  counter: { label: "Counter", tone: "counter" },
  deal: { label: "Deal", tone: "deal" },
  "no-deal": { label: "No deal", tone: "out" },
};

export function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function personFor(speakerId, episode) {
  if (speakerId === "narrator") {
    return { id: "narrator", color: "#f6c55b" };
  }

  if (speakerId === "founder") {
    return { id: "founder", color: episode.pitch.founder.accent, accent: episode.pitch.founder.accent };
  }

  return episode.sharks.find((shark) => shark.id === speakerId);
}

// --- Caption -----------------------------------------------------------------

export function createCaption(root) {
  const avatarSlot = root.querySelector(".caption-avatar");
  const name = root.querySelector(".caption-name");
  const role = root.querySelector(".caption-role");
  const text = root.querySelector(".caption-text");
  const chip = root.querySelector(".caption-chip");
  let currentSpeaker = null;

  return {
    setBeat(beat, episode) {
      const person = personFor(beat.speakerId, episode);

      if (currentSpeaker !== beat.speakerId) {
        avatarSlot.innerHTML = avatar(person);
        currentSpeaker = beat.speakerId;
      }

      root.style.setProperty("--who", person.color);
      root.dataset.speaker = beat.speakerId;
      name.textContent = beat.speakerName;
      role.textContent = beat.speakerRole;
      text.textContent = "";
      chip.hidden = true;
      root.classList.add("is-visible");
      root.classList.remove("is-thinking");
    },
    setThinking(beat) {
      root.classList.add("is-thinking");
      text.textContent = `${beat.speakerName} is thinking`;
    },
    setText(value) {
      root.classList.remove("is-thinking");
      text.textContent = value;
    },
    land(beat) {
      const chipInfo = TONE_CHIPS[beat.tone];

      if (chipInfo) {
        chip.textContent = chipInfo.label;
        chip.dataset.tone = chipInfo.tone;
        chip.hidden = false;
      }
    },
    hide() {
      root.classList.remove("is-visible", "is-thinking");
    },
    reset() {
      currentSpeaker = null;
      avatarSlot.innerHTML = "";
      text.textContent = "";
      chip.hidden = true;
      root.classList.remove("is-visible", "is-thinking");
    },
  };
}

// --- Phase rail --------------------------------------------------------------

export function renderPhaseRail(root, phases, activePhaseId) {
  const activeIndex = phases.findIndex((phase) => phase.id === activePhaseId);

  root.innerHTML = phases
    .map((phase, index) => {
      const state = index < activeIndex ? "done" : index === activeIndex ? "active" : "todo";
      return `<li class="phase" data-state="${state}"><span class="phase-dot"></span><span class="phase-label">${escapeHtml(phase.label)}</span></li>`;
    })
    .join("");
}

// --- Deal board --------------------------------------------------------------

function bestOpenOffer(board) {
  let best = null;

  for (const entry of Object.values(board.sharks)) {
    const offer = entry.status === "deal" ? entry.offer : ["offer", "team", "countered"].includes(entry.status) ? entry.offer : null;

    if (offer) {
      const valuation = impliedValuation(offer.cashUsd, offer.equityPct);

      if (!best || valuation > best.valuation) {
        best = { offer, valuation };
      }
    }
  }

  return best;
}

export function renderBoard(root, episode, board, { thinkingId = null, previous = null } = {}) {
  const askValuation = impliedValuation(board.ask.cashUsd, board.ask.equityPct);
  const best = board.outcome?.type === "deal"
    ? { offer: board.outcome.offer, valuation: impliedValuation(board.outcome.offer.cashUsd, board.outcome.offer.equityPct) }
    : bestOpenOffer(board);
  const meter = best ? Math.min(100, Math.round((best.valuation / askValuation) * 100)) : 0;
  const bestLabel = best
    ? `${board.outcome?.type === "deal" ? "Deal" : "Best offer"} values it at ${formatMoneyShort(best.valuation)}`
    : board.outcome?.type === "no_deal"
      ? "No deal on the table"
      : "No offers yet";

  const rows = episode.sharks
    .map((shark) => {
      const entry = board.sharks[shark.id];
      const status = thinkingId === shark.id && entry.status === "waiting" ? "thinking" : entry.status;
      const changed = previous && previous.sharks[shark.id]?.status !== entry.status;
      const shown = entry.offer;
      let detail = shark.persona;

      if (entry.status === "countered" && entry.counter) {
        detail = `Counter ${formatPercent(entry.counter.equityPct)} · offer ${formatPercent(entry.offer.equityPct)}`;
      } else if (shown && entry.status !== "declined") {
        const partners = entry.partners
          .map((id) => episode.sharks.find((other) => other.id === id)?.displayName)
          .filter(Boolean);
        const extra = partners.length ? ` · with ${partners.join(", ")}` : shown.kicker?.short ? ` + ${shown.kicker.short}` : "";
        detail = `${formatMoneyShort(shown.cashUsd)} for ${formatPercent(shown.equityPct)}${extra}`;
      } else if (entry.status === "declined" && entry.offer) {
        detail = `Passed on ${formatMoneyShort(entry.offer.cashUsd)} for ${formatPercent(entry.offer.equityPct)}`;
      }

      return `
        <li class="board-row${changed ? " is-changed" : ""}" data-id="${shark.id}" data-status="${status}" style="--who:${shark.color}">
          ${avatar(shark, { className: "avatar-sm" })}
          <div class="board-who">
            <strong>${escapeHtml(shark.displayName)}</strong>
            <span>${escapeHtml(detail)}</span>
          </div>
          <span class="status-chip" data-status="${status}">${STATUS_LABELS[status]}</span>
        </li>`;
    })
    .join("");

  root.innerHTML = `
    <div class="board-ask">
      <span class="kicker">The ask</span>
      <div class="ask-terms"><strong>${formatMoneyShort(board.ask.cashUsd)}</strong><span>for</span><strong>${formatPercent(board.ask.equityPct)}</strong></div>
      <div class="ask-valuation">Valuation <b>${formatMoneyShort(askValuation)}</b></div>
      <div class="meter" role="img" aria-label="${escapeHtml(bestLabel)}">
        <div class="meter-fill" style="width:${meter}%"></div>
        <div class="meter-ask"></div>
      </div>
      <div class="meter-caption"><span>${escapeHtml(bestLabel)}</span><span>${best ? `${meter}% of ask` : ""}</span></div>
    </div>
    <ul class="board-rows">${rows}</ul>`;
}

// --- Transcript --------------------------------------------------------------

export function createTranscript(root) {
  const list = root.querySelector(".transcript-list");
  const empty = root.querySelector(".transcript-empty");
  let liveItem = null;

  function scrollToEnd() {
    root.scrollTop = root.scrollHeight;
  }

  return {
    start(beat, episode) {
      const person = personFor(beat.speakerId, episode);
      liveItem = document.createElement("li");
      liveItem.className = "line is-live";
      liveItem.style.setProperty("--who", person.color);
      liveItem.dataset.speaker = beat.speakerId;
      liveItem.innerHTML = `
        ${avatar(person, { className: "avatar-xs" })}
        <div class="line-body">
          <div class="line-meta"><strong>${escapeHtml(beat.speakerName)}</strong><span>${escapeHtml(beat.speakerRole)}</span></div>
          <p class="line-text"></p>
        </div>`;
      list.append(liveItem);
      empty.hidden = true;
      scrollToEnd();
    },
    update(text) {
      if (liveItem) {
        liveItem.querySelector(".line-text").textContent = text;
      }
    },
    land(beat) {
      if (!liveItem) {
        return;
      }

      liveItem.querySelector(".line-text").textContent = beat.text;
      liveItem.classList.remove("is-live");

      const chip = TONE_CHIPS[beat.tone];

      if (chip) {
        liveItem.querySelector(".line-meta").insertAdjacentHTML(
          "beforeend",
          `<em class="mini-chip" data-tone="${chip.tone}">${chip.label}</em>`,
        );
      }

      liveItem = null;
      scrollToEnd();
    },
    reset() {
      list.innerHTML = "";
      liveItem = null;
      empty.hidden = false;
    },
  };
}

// --- Verdict -----------------------------------------------------------------

const DIFFICULTY_LABELS = { easy: "Easy", medium: "Medium", hard: "Hard" };

function ring(percent) {
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  const dash = (percent / 100) * circumference;

  return `
    <svg class="ring" viewBox="0 0 100 100" role="img" aria-label="Feasibility ${percent}%">
      <circle cx="50" cy="50" r="${radius}" class="ring-track"/>
      <circle cx="50" cy="50" r="${radius}" class="ring-value" stroke-dasharray="${dash.toFixed(1)} ${circumference.toFixed(1)}"/>
      <text x="50" y="50" class="ring-number">${percent}</text>
      <text x="50" y="66" class="ring-unit">feasible</text>
    </svg>`;
}

export function renderVerdict(root, { episode, board, allTime }) {
  const { result, report, pitch } = episode;
  const isDeal = result.outcome === "deal";
  const investors = result.sharkIds.map((id) => episode.sharks.find((shark) => shark.id === id));
  const askValuation = pitch.valuationUsd;
  const dealValuation = result.valuationUsd || 0;
  const scaleMax = Math.max(askValuation, dealValuation);
  const delta = isDeal ? Math.round((dealValuation / askValuation - 1) * 100) : 0;

  const sharkChips = episode.sharks
    .map((shark) => {
      const status = board.sharks[shark.id].status;
      return `<li data-status="${status}" style="--who:${shark.color}">${avatar(shark, { className: "avatar-sm" })}<span>${escapeHtml(shark.displayName)}</span><em class="status-chip" data-status="${status}">${STATUS_LABELS[status]}</em></li>`;
    })
    .join("");

  const factorBars = report.factors
    .map(
      (factor) => `
        <li>
          <span>${escapeHtml(factor.label)}</span>
          <div class="factor-bar"><i style="width:${Math.round(factor.score * 100)}%"></i></div>
          <b>${Math.round(factor.score * 100)}</b>
        </li>`,
    )
    .join("");

  const terms = isDeal
    ? `
      <div class="verdict-terms">
        <span class="kicker">Final terms</span>
        <strong class="verdict-amount">${formatMoneyFull(result.offer.cashUsd)} <span>for</span> ${formatPercent(result.offer.equityPct)}</strong>
        ${result.offer.kicker ? `<p class="verdict-kicker">${escapeHtml(result.offer.kicker.label)}</p>` : ""}
        <div class="valuation-compare">
          <div><span>Asked</span><div class="compare-bar"><i style="width:${(askValuation / scaleMax) * 100}%"></i></div><b>${formatMoneyShort(askValuation)}</b></div>
          <div class="is-deal"><span>Closed</span><div class="compare-bar"><i style="width:${(dealValuation / scaleMax) * 100}%"></i></div><b>${formatMoneyShort(dealValuation)}</b></div>
        </div>
        <p class="verdict-delta">${delta === 0 ? "Closed exactly at the asking valuation." : `${Math.abs(delta)}% ${delta < 0 ? "below" : "above"} the asking valuation.`}</p>
      </div>`
    : `
      <div class="verdict-terms">
        <span class="kicker">Final terms</span>
        <strong class="verdict-amount verdict-amount-none">No deal</strong>
        <p class="verdict-kicker">${
          result.declinedOffer
            ? `${escapeHtml(pitch.founder.name)} turned down ${escapeHtml(formatOfferFull(result.declinedOffer))}.`
            : "Every shark went out."
        }</p>
      </div>`;

  const keyNumbers = report.keyNumbers;

  root.innerHTML = `
    <div class="verdict-card" data-outcome="${result.outcome}">
      <header class="verdict-head">
        <div class="verdict-stamp">${isDeal ? icon("check") : icon("x")}<span>${isDeal ? (result.dealType === "Multi-Shark Deal" ? "Multi-shark deal" : "Deal") : "No deal"}</span></div>
        <button class="icon-button" type="button" data-action="close-verdict" aria-label="Close verdict">${icon("close")}</button>
      </header>
      <div class="verdict-grid">
        <section class="verdict-main">
          <h2 id="verdict-title">${escapeHtml(result.headline)}</h2>
          <p class="verdict-sub">${escapeHtml(episode.title)} · seed ${episode.seed}</p>
          ${
            investors.length
              ? `<div class="verdict-investors">${investors.map((shark) => avatar(shark, { className: "avatar-md" })).join("")}<span>${escapeHtml(investors.map((shark) => shark.fullName).join(" + "))}</span></div>`
              : ""
          }
          ${terms}
          <ul class="verdict-sharks">${sharkChips}</ul>
          <div class="verdict-caption">
            <span class="kicker">Social caption</span>
            <p>${escapeHtml(episode.socialCaption)}</p>
          </div>
        </section>
        <section class="verdict-report" aria-labelledby="report-title">
          <span class="kicker" id="report-title">Feasibility report</span>
          <div class="report-head">
            ${ring(report.feasibilityPercent)}
            <dl class="report-stats">
              <div><dt>Good business?</dt><dd data-good="${report.isGoodBusiness}">${report.isGoodBusiness === "yes" ? "Yes" : "No"}</dd></div>
              <div><dt>Difficulty</dt><dd>${DIFFICULTY_LABELS[report.difficulty]}</dd></div>
              <div><dt>Min. investment</dt><dd>${formatMoneyShort(report.minimumInitialInvestmentUsd)}</dd></div>
              <div><dt>First revenue</dt><dd>${escapeHtml(report.timeToFirstRevenue)}</dd></div>
            </dl>
          </div>
          <p class="report-summary">${escapeHtml(report.summary)}</p>
          <p class="report-risk"><b>Biggest risk.</b> ${escapeHtml(report.biggestRisk)}</p>
          <ul class="factor-list">${factorBars}</ul>
          <dl class="report-numbers">
            <div><dt>Sales, 12 mo</dt><dd>${keyNumbers.revenueTtmUsd ? formatMoneyShort(keyNumbers.revenueTtmUsd) : "None"}</dd></div>
            <div><dt>Gross margin</dt><dd>${keyNumbers.grossMarginPct}%</dd></div>
            <div><dt>LTV : CAC</dt><dd>${keyNumbers.ltvToCac}×</dd></div>
          </dl>
        </section>
      </div>
      <footer class="verdict-actions">
        <button class="button button-primary" type="button" data-action="download-report">${icon("download")}<span>Download report</span></button>
        <button class="button" type="button" data-action="copy-caption">${icon("copy")}<span>Copy caption</span></button>
        <button class="button" type="button" data-action="copy-link">${icon("link")}<span>Copy link</span></button>
        <span class="verdict-spacer"></span>
        <button class="button" type="button" data-action="replay">${icon("restart")}<span>Watch again</span></button>
        <button class="button" type="button" data-action="new-pitch">${icon("exit")}<span>New pitch</span></button>
      </footer>
      ${
        allTime
          ? `<p class="verdict-archive">Episode ${allTime.totalEpisodes.toLocaleString("en-US")} in the studio archive · ${allTime.dealRatePercent}% of pitches close a deal${
              allTime.topShark ? ` · Most active: ${escapeHtml(allTime.topShark.name)}` : ""
            }</p>`
          : ""
      }
    </div>`;
}
