const form = document.querySelector("#generate-form");
const themeInput = document.querySelector("#theme-input");
const countInput = document.querySelector("#count-input");
const generateButton = document.querySelector("#generate-button");
const results = document.querySelector("#results");
const statusCard = document.querySelector("#status-card");
const statusTitle = document.querySelector("#status-title");
const statusText = document.querySelector("#status-text");
const episodeTemplate = document.querySelector("#episode-template");

function setStatus(state, title, text) {
  statusCard.classList.remove("loading", "error");
  if (state) {
    statusCard.classList.add(state);
  }
  statusTitle.textContent = title;
  statusText.textContent = text;
}

function formatCurrency(value) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function createMetricPill(label, value) {
  const pill = document.createElement("div");
  pill.className = "metric-pill";
  pill.textContent = `${label}: ${value}`;
  return pill;
}

function createStoryCard(card) {
  const element = document.createElement("article");
  element.className = "story-card";
  element.innerHTML = `
    <div class="story-card-top">
      <div class="story-type">${card.card_type.replaceAll("_", " ")}</div>
      <div class="story-emoji">${card.emoji}</div>
    </div>
    <div>
      <h4 class="story-title">${card.title}</h4>
      <p class="story-speaker">${card.speaker}</p>
    </div>
    <p class="story-body">${card.body}</p>
  `;
  return element;
}

function createSharkCard(reaction) {
  const element = document.createElement("article");
  const decisionClass = reaction.decision === "INVEST" ? "invest" : "out";
  const counterOffer = reaction.counter_offer
    ? `<p class="shark-body"><strong>Offer:</strong> ${reaction.counter_offer}</p>`
    : "";

  element.className = "shark-card";
  element.innerHTML = `
    <div class="shark-top">
      <div>
        <div class="shark-name">${reaction.shark_name}</div>
        <div class="shark-persona">${reaction.shark_persona}</div>
      </div>
      <div class="decision-pill ${decisionClass}">${reaction.decision}</div>
    </div>
    <p class="shark-body">${reaction.challenge}</p>
    ${counterOffer}
    <p class="shark-body">${reaction.reason}</p>
  `;
  return element;
}

function renderEpisodes(episodes) {
  results.innerHTML = "";

  episodes.forEach((episode, index) => {
    const fragment = episodeTemplate.content.cloneNode(true);
    const root = fragment.querySelector(".episode");
    const dealBadge = fragment.querySelector(".deal-badge");
    const storyCards = fragment.querySelector(".story-cards");
    const sharkGrid = fragment.querySelector(".shark-grid");
    const investorTags = fragment.querySelector(".investor-tags");
    const metrics = fragment.querySelector(".pitch-metrics");

    fragment.querySelector(".episode-index").textContent = `Episode ${episode.episode_number || index + 1}`;
    fragment.querySelector(".episode-title").textContent = episode.story.episode_title;
    fragment.querySelector(".episode-teaser").textContent = episode.story.teaser;
    fragment.querySelector(".pitch-company").textContent = episode.pitch.company_name;
    fragment.querySelector(".pitch-product").textContent = episode.pitch.product_name;
    fragment.querySelector(".pitch-concept").textContent = episode.pitch.concept;
    fragment.querySelector(".pitch-founder").textContent = episode.pitch.founder_pitch;
    fragment.querySelector(".summary-headline").textContent = episode.story.deal_summary.headline;
    fragment.querySelector(".summary-terms").textContent = episode.story.deal_summary.final_terms;
    fragment.querySelector(".summary-rationale").textContent = episode.story.deal_summary.rationale;
    fragment.querySelector(".transcript-body").textContent = episode.story.full_story_markdown;
    dealBadge.textContent = episode.story.deal_summary.outcome;

    metrics.append(
      createMetricPill("Ask", formatCurrency(episode.pitch.ask_amount_usd)),
      createMetricPill("Equity", `${episode.pitch.equity_offer_percent}%`),
    );

    const investorList = episode.story.deal_summary.investors || [];
    if (investorList.length === 0) {
      const tag = document.createElement("div");
      tag.className = "investor-tag";
      tag.textContent = "No investors";
      investorTags.append(tag);
    } else {
      investorList.forEach((investor) => {
        const tag = document.createElement("div");
        tag.className = "investor-tag";
        tag.textContent = investor;
        investorTags.append(tag);
      });
    }

    episode.story.story_cards.forEach((card) => {
      storyCards.append(createStoryCard(card));
    });

    episode.shark_reactions.forEach((reaction) => {
      sharkGrid.append(createSharkCard(reaction));
    });

    results.append(root);
  });
}

async function generateEpisodes(event) {
  event.preventDefault();

  const payload = {
    theme: themeInput.value.trim(),
    count: Number.parseInt(countInput.value, 10) || window.SHARK_TANK_CONFIG.defaultCount,
  };

  generateButton.disabled = true;
  setStatus(
    "loading",
    "Generating a fresh episode batch.",
    "The entrepreneur is stepping on stage, and the sharks are warming up their one-liners."
  );

  try {
    const response = await fetch("/api/generate-episodes", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.detail || "The tank hit an unexpected snag.");
    }

    renderEpisodes(data.episodes);
    setStatus(
      "",
      `${data.count} episode${data.count === 1 ? "" : "s"} ready for airtime.`,
      "Scroll through the cards, compare the sharks, and open the full recap whenever you want the whole TV moment."
    );
    results.scrollIntoView({ behavior: "smooth", block: "start" });
  } catch (error) {
    setStatus(
      "error",
      "The sharks walked off set.",
      error instanceof Error ? error.message : "Something went wrong while generating episodes."
    );
  } finally {
    generateButton.disabled = false;
  }
}

form.addEventListener("submit", generateEpisodes);

