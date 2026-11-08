import sanitizeHtml from "sanitize-html";

const escape = (value) => String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const money = (value) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
const cssValue = /^(?!.*(?:url|expression|var|image|attr))[a-zA-Z0-9#.,% ()\-]+$/i;
const properties = ["color", "background-color", "font-size", "font-weight", "font-family", "line-height", "letter-spacing", "text-align", "text-transform", "display", "flex-direction", "flex-wrap", "align-items", "justify-content", "gap", "padding", "padding-top", "margin", "margin-top", "margin-bottom", "width", "height", "max-width", "min-width", "border-radius", "border-color", "border-width", "border-style", "box-sizing", "overflow", "opacity", "flex"];

export function sanitizeSlide(html) {
  return sanitizeHtml(html, {
    allowedTags: ["div", "section", "article", "header", "footer", "h1", "h2", "h3", "p", "span", "strong", "b", "em", "ul", "ol", "li", "small", "br"],
    allowedAttributes: { "*": ["style"] },
    allowedStyles: { "*": Object.fromEntries(properties.map((property) => [property, [cssValue]])) },
    disallowedTagsMode: "discard",
    nonTextTags: ["style", "script", "textarea", "option", "iframe", "object"],
  });
}

function frame(brand, label, body) {
  return `<div style="height:720px;box-sizing:border-box;padding:64px 76px;background-color:#101f28;color:#f6f1e7;font-family:Arial;display:flex;flex-direction:column;justify-content:space-between"><header style="display:flex;justify-content:space-between;color:#a9bebc;font-size:22px;letter-spacing:3px"><span>${escape(brand)}</span><span>${escape(label)}</span></header><div>${body}</div><footer style="font-size:18px;color:#a9bebc">FOUNDER PRESENTATION · SIMULATED BUSINESS</footer></div>`;
}
const heading = (text) => `<h1 style="font-size:70px;line-height:1.05;margin:0 0 28px;max-width:1080px">${escape(text)}</h1>`;
const paragraph = (text) => `<p style="font-size:30px;line-height:1.35;margin:0;max-width:1060px">${escape(text)}</p>`;

export const mockDeckProvider = {
  id: "mock-html", label: "Mock HTML deck", live: false,
  async generateDeck({ episode }) {
    const { pitch, beats } = episode;
    const pitchBeats = beats.filter((beat) => beat.kind === "pitch");
    const negotiation = beats.find((beat) => beat.phase === "negotiation") || beats.at(-1);
    const metric = (value, label) => `<div style="flex:1;padding:26px;background-color:#20353e;border-radius:12px"><strong style="display:block;font-size:52px;color:#d5b780">${escape(value)}</strong><p style="font-size:23px;margin:14px 0 0">${escape(label)}</p></div>`;
    return {
      title: `${pitch.startupName} — founder deck`,
      slides: [
        { title: pitch.startupName, beatId: beats[0].id, html: frame(pitch.startupName, "01 / THE COMPANY", heading(pitch.productName) + paragraph(pitch.tagline)) },
        { title: "The opportunity", beatId: pitchBeats[0].id, html: frame(pitch.startupName, "02 / THE OPPORTUNITY", heading(pitch.tagline) + paragraph(pitchBeats[0].text.replace(/^I'm seeking[^.]*\.\s*/, ""))) },
        { title: "Traction", beatId: pitchBeats[1].id, html: frame(pitch.startupName, "03 / TRACTION", heading("The business, today.") + `<div style="display:flex;gap:22px;margin-bottom:28px">${metric(money(pitch.metrics.revenueTtmUsd), "Trailing annual revenue")}${metric(`${pitch.metrics.growthMoMPct}%`, "Monthly growth")}${metric(pitch.metrics.customers.toLocaleString("en-US"), pitch.metrics.customerNoun || "Customers")}</div>` + paragraph(pitchBeats[1].text)) },
        { title: "The ask", beatId: negotiation.id, html: frame(pitch.startupName, "04 / THE ASK", heading(`${money(pitch.askUsd)} for ${pitch.equityPct}%`) + paragraph(`Building ${pitch.startupName} with the right partner.`) + `<p style="font-size:28px;color:#d5b780;margin-top:32px">${money(pitch.valuationUsd)} implied valuation</p>`) },
      ],
    };
  },
};

// Supply a server-side API callback later; this module never makes network calls.
export function createModelDeckProvider({ generate }) {
  if (typeof generate !== "function") throw new TypeError("A generate callback is required.");
  return {
    id: "model-html", label: "Model HTML deck", live: true,
    async generateDeck({ episode }) {
      return generate({
        system: "Create a 1280x720 HTML pitch deck. Return a JSON object with title and 1–8 slides, each with title, beatId and html. Use only inline CSS, semantic HTML and no scripts, external assets, links or images. The first slide must start at the first beat; use distinct beatIds in chronological order. Use only supplied business facts; these are simulated, not verified claims. Keep each slide concise and readable on a television.",
        episode,
      });
    },
  };
}

export async function createPitchDeck(episode, provider = mockDeckProvider) {
  const raw = await provider.generateDeck({ episode });
  if (!raw || typeof raw.title !== "string" || !Array.isArray(raw.slides) || raw.slides.length < 1 || raw.slides.length > 8) throw new Error("Invalid deck structure.");
  let previous = -1;
  const slides = raw.slides.map((slide, index) => {
    const beatIndex = episode.beats.findIndex((beat) => beat.id === slide.beatId);
    if (beatIndex < 0 || beatIndex <= previous || (index === 0 && beatIndex !== 0)) throw new Error("Invalid deck beat order.");
    if (typeof slide.html !== "string" || slide.html.length > 40000 || typeof slide.title !== "string") throw new Error("Invalid slide content.");
    previous = beatIndex;
    const html = sanitizeSlide(slide.html);
    if (!sanitizeHtml(html, { allowedTags: [], allowedAttributes: {} }).trim()) throw new Error("Empty slide content.");
    return { id: `slide-${index + 1}`, title: slide.title.slice(0, 160), beatId: slide.beatId, beatIndex, html };
  });
  const deck = { id: `${episode.id}-deck`, title: raw.title.slice(0, 160), width: 1280, height: 720, provider: { id: provider.id, label: provider.label, live: Boolean(provider.live) }, slides };
  if (raw.generation) deck.generation = raw.generation;
  deck.download = { fileName: `${episode.pitch.id}-pitch-deck.html`, mimeType: "text/html;charset=utf-8", content: exportDeck(deck) };
  return deck;
}

function exportDeck(deck) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'"><title>${escape(deck.title)}</title><style>html{scroll-snap-type:y mandatory;background:#101f28}body{margin:0;font-family:Arial;color:white}main{width:1280px;margin:auto}section.slide{width:1280px;height:720px;overflow:hidden;scroll-snap-align:start;page-break-after:always}nav{padding:20px}a{color:#d5b780;margin-right:24px}@media print{nav{display:none}@page{size:1280px 720px;margin:0}}</style></head><body><nav>${deck.slides.map((slide, i) => `<a href="#slide-${i + 1}">${escape(slide.title)}</a>`).join("")}</nav><main>${deck.slides.map((slide, i) => `<section class="slide" id="slide-${i + 1}" aria-label="${escape(slide.title)}">${slide.html}</section>`).join("")}</main></body></html>`;
}
