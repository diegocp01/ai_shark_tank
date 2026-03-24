import { test, expect } from "@playwright/test";

const SHARKS = [
  {
    id: "rex",
    displayName: "Rex",
    fullName: "Rex The Skeptic",
    persona: "The Skeptic",
    color: "#ff6b57",
  },
  {
    id: "luna",
    displayName: "Luna",
    fullName: "Luna The Visionary",
    persona: "The Visionary",
    color: "#7ce8c8",
  },
  {
    id: "max",
    displayName: "Max",
    fullName: "Max The Numbers Shark",
    persona: "The Numbers Shark",
    color: "#f5c453",
  },
  {
    id: "vera",
    displayName: "Vera",
    fullName: "Vera The Brand Guru",
    persona: "The Brand Guru",
    color: "#ff8bc2",
  },
  {
    id: "wes",
    displayName: "Wild Wes",
    fullName: "Wild Wes The Wildcard",
    persona: "The Wildcard",
    color: "#86a5ff",
  },
];

function buildSse(events) {
  return `${events
    .map(({ event, data }) => `event: ${event}\ndata: ${JSON.stringify(data)}\n`)
    .join("\n")}\n`;
}

async function mockApi(page) {
  await page.route("**/api/config", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        runtime: "demo",
        ttsEnabled: false,
        sharks: SHARKS,
        maxEpisodeCount: 3,
      }),
    });
  });

  await page.route("**/api/speech", async (route) => {
    await route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({
        detail: "Text-to-speech is unavailable in the Playwright harness.",
      }),
    });
  });

  await page.route("**/api/feasibility-report", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        source: "heuristic",
        startupName: "Pitch Engine Labs",
        report: {
          feasibilityPercent: 64,
          isGoodBusiness: "yes",
          minimumInitialInvestmentUsd: 95000,
          difficulty: "medium",
          summary: "This pitch has a plausible business path, but it needs sharp execution.",
          biggestRisk: "Customer demand may not hold once the spectacle wears off.",
        },
        download: {
          fileName: "pitch-engine-labs-feasibility-report.txt",
          mimeType: "text/plain; charset=utf-8",
          content: "AI Shark Tank Feasibility Report",
        },
      }),
    });
  });

  await page.route("**/api/live-episode", async (route) => {
    await route.fulfill({
      status: 200,
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
      },
      body: buildSse([
        {
          event: "ready",
          data: { ok: true },
        },
        {
          event: "stage",
          data: {
            runtime: "demo",
            entranceDurationMs: 600,
            founderLook: {
              top: { type: "blazer", color: "midnight_navy", hex: "#24324f" },
              bottom: { type: "tailored_trousers", color: "sand", hex: "#bca486" },
            },
            sharks: SHARKS,
          },
        },
        {
          event: "speaker_start",
          data: {
            speakerId: "entrepreneur",
            displayName: "Entrepreneur",
            role: "Founder",
            badge: "PITCH",
          },
        },
        {
          event: "speaker_delta",
          data: {
            speakerId: "entrepreneur",
            text: "Pitch Engine Labs turns startup ideas into live AI investor simulations and I am asking for $100,000 for 10%.",
          },
        },
        {
          event: "speaker_end",
          data: {
            speakerId: "entrepreneur",
            displayName: "Entrepreneur",
            role: "Founder",
            badge: "PITCH",
            text: "Pitch Engine Labs turns startup ideas into live AI investor simulations and I am asking for $100,000 for 10%.",
          },
        },
        {
          event: "speaker_start",
          data: {
            speakerId: "max",
            displayName: "Max",
            role: "The Numbers Shark",
            badge: "LIVE",
          },
        },
        {
          event: "speaker_delta",
          data: {
            speakerId: "max",
            text: "The margins are interesting, but I need to know customer acquisition cost.",
          },
        },
        {
          event: "speaker_end",
          data: {
            speakerId: "max",
            displayName: "Max",
            role: "The Numbers Shark",
            badge: "INVEST",
            decision: "INVEST",
            offerSummary: "$100,000 for 10%",
            text: "I can do $100,000 for 10% if you can prove the business scales.",
          },
        },
        {
          event: "speaker_start",
          data: {
            speakerId: "entrepreneur",
            displayName: "Entrepreneur",
            role: "Founder",
            badge: "COUNTER",
          },
        },
        {
          event: "speaker_delta",
          data: {
            speakerId: "entrepreneur",
            text: "I will do it for $100,000, but I need to keep 92% because the content engine is the moat.",
          },
        },
        {
          event: "speaker_end",
          data: {
            speakerId: "entrepreneur",
            displayName: "Entrepreneur",
            role: "Founder",
            badge: "COUNTER",
            decision: "COUNTER",
            offerSummary: "$100,000 for 8%",
            text: "I will do it for $100,000, but I need to keep 92% because the content engine is the moat.",
          },
        },
        {
          event: "speaker_start",
          data: {
            speakerId: "max",
            displayName: "Max",
            role: "The Numbers Shark",
            badge: "DEAL",
          },
        },
        {
          event: "speaker_delta",
          data: {
            speakerId: "max",
            text: "Fine. I can do $100,000 for 8%. Let's close it.",
          },
        },
        {
          event: "speaker_end",
          data: {
            speakerId: "max",
            displayName: "Max",
            role: "The Numbers Shark",
            badge: "DEAL",
            decision: "INVEST",
            offerSummary: "$100,000 for 8%",
            text: "Fine. I can do $100,000 for 8%. Let's close it.",
          },
        },
        {
          event: "deal_outcome",
          data: {
            sharkId: "max",
            sharkName: "Max The Numbers Shark",
            founderMove: "COUNTER",
            founderTermsSummary: "$100,000 for 8%",
            finalDecision: "DEAL",
            finalTermsSummary: "$100,000 for 8%",
            handshakeReady: true,
          },
        },
        {
          event: "episode_end",
          data: {
            runtime: "demo",
            handshakeReady: true,
            dealSummary: {
              outcome: "Deal",
              investors: ["Max The Numbers Shark"],
              finalTerms: "$100,000 for 8%",
            },
          },
        },
        {
          event: "done",
          data: { ok: true },
        },
      ]),
    });
  });
}

test("landing page and generation flow", async ({ page }, testInfo) => {
  await mockApi(page);
  await page.goto("/");

  await expect(page.getByText("AI Shark Tank")).toBeVisible();
  await expect(page.locator(".scene-root canvas")).toBeVisible();
  await expect(page.getByRole("button", { name: "Generate" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Download report" })).toBeDisabled();
  await expect(page.getByText(/Voice off|Voice unavailable/)).toBeVisible();
  await expect(page.locator("#tts-toggle")).toBeDisabled();
  await expect(page.locator(".shark-tag")).toHaveCount(5);

  await page.screenshot({
    path: testInfo.outputPath("landing-page.png"),
    fullPage: false,
  });

  await page.getByRole("button", { name: "Generate" }).click();

  await expect(page.locator("#founder-bubble")).toBeVisible();
  await expect(page.locator("#moment-banner")).toContainText("Founder counters");
  await expect(page.getByRole("button", { name: "Download report" })).toBeEnabled();
  await expect(page.locator("#deal-stamp")).toContainText("$100,000");
  await expect(page.locator(".actor-tag")).toHaveCount(6);

  await page.screenshot({
    path: testInfo.outputPath("episode-generated.png"),
    fullPage: false,
  });
});

test("deal state stays visible at the end", async ({ page }) => {
  await mockApi(page);
  await page.goto("/");

  await page.getByRole("button", { name: "Generate" }).click();

  await expect(page.locator("#founder-bubble")).toBeVisible();
  await expect(page.locator("#moment-banner")).toContainText("Founder counters");
  await expect(page.locator("#status-copy")).toBeHidden();
  await expect(page.getByRole("button", { name: "Download report" })).toBeEnabled();
  await expect(page.locator("#deal-stamp")).toContainText("Pitch Engine Labs");
  await expect(page.locator("#deal-stamp")).toContainText("Max");
});
