import { readFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";

// Every episode is deterministic, so these assertions are exact: the same pitch
// and seed always produce the same lines, offers, and verdict.

const FAST = "speed=40";

async function rollCameras(page) {
  await page.getByRole("button", { name: "Roll the cameras" }).click();
  await expect(page.locator("body")).toHaveAttribute("data-view", "show");
}

async function waitForVerdict(page) {
  const dialog = page.locator("dialog.verdict");
  await expect(dialog).toBeVisible({ timeout: 40_000 });
  return dialog;
}

function boardRow(page, sharkId) {
  return page.locator(`#board-panel .board-row[data-id="${sharkId}"]`);
}

test.describe("lobby", () => {
  test("shows the lineup, the sharks, and a live stage preview", async ({ page }, testInfo) => {
    await page.goto("/");

    await expect(page.getByRole("heading", { name: "Pick a founder" })).toBeVisible();
    await expect(page.locator(".pitch-card")).toHaveCount(6);
    await expect(page.locator('.pitch-card[aria-checked="true"]')).toContainText("Barklight Labs");
    await expect(page.locator("#hero-title")).toHaveText("Barklight Labs");
    await expect(page.locator(".meet-card")).toHaveCount(5);
    await expect(page.locator(".scene .seat")).toHaveCount(5);
    await expect(page.locator(".scene .founder")).toHaveAttribute("data-position", "mark");
    await expect(page.locator("#provider-label")).toHaveText("Scripted engine · no API keys");

    await page.getByRole("radio", { name: /TideTrack/ }).click();
    await expect(page.locator("#hero-title")).toHaveText("TideTrack");
    await expect(page.locator(".hologram-name")).toHaveText("TideTrack Buoys");
    await expect(page.locator("#hero-chips")).toContainText("$1M for 10%");

    await page.screenshot({ path: testInfo.outputPath("lobby.png") });
  });

  test("validates the seed before calling the studio", async ({ page }) => {
    await page.goto("/");
    await page.locator("#seed-input").fill("0");
    await page.getByRole("button", { name: "Roll the cameras" }).click();

    await expect(page.locator("#lobby-error")).toHaveText(/Seed must be a whole number/);
    await expect(page.locator("body")).toHaveAttribute("data-view", "lobby");
  });
});

test.describe("full episode", () => {
  test("Barklight seed 1 plays from pitch to a deal with Wild Wes", async ({ page }, testInfo) => {
    await page.goto(`/?${FAST}`);
    await rollCameras(page);

    await expect(page).toHaveURL(/pitch=barklight&seed=1/);
    await expect(page.locator(".caption-name")).toBeVisible();
    await expect(page.locator(".phase-rail .phase")).toHaveCount(6);

    const dialog = await waitForVerdict(page);
    await page.screenshot({ path: testInfo.outputPath("barklight-verdict.png") });

    await expect(dialog.locator("h2")).toHaveText("Wild Wes invests in Barklight Labs");
    await expect(dialog.locator(".verdict-amount")).toHaveText("$500,000 for 9.5%");
    await expect(dialog.locator(".verdict-delta")).toHaveText("16% below the asking valuation.");
    await expect(dialog.locator(".ring-number")).toHaveText("44");
    await expect(dialog.locator(".verdict-sharks li")).toHaveCount(5);

    await dialog.getByRole("button", { name: "Close verdict" }).click();
    await expect(boardRow(page, "rex")).toHaveAttribute("data-status", "out");
    await expect(boardRow(page, "luna")).toHaveAttribute("data-status", "declined");
    await expect(boardRow(page, "max")).toHaveAttribute("data-status", "out");
    await expect(boardRow(page, "vera")).toHaveAttribute("data-status", "out");
    await expect(boardRow(page, "wes")).toHaveAttribute("data-status", "deal");
    await expect(page.locator('.seat[data-id="wes"] .seat-badge')).toHaveText("Deal");
    await expect(page.locator(".meter-caption")).toContainText("Deal values it at $5.26M");
    await expect(page.locator("#progress-label")).toHaveText("Line 25 of 25");

    await page.getByRole("tab", { name: "Transcript" }).click();
    await expect(page.locator(".transcript-list .line")).toHaveCount(25);
    await expect(page.locator(".transcript-list .line").last()).toContainText(
      "Barklight Labs leaves the tank with $500,000 for 9.5% from Wild Wes.",
    );
  });

  test("the verdict downloads a markdown feasibility report", async ({ page }) => {
    await page.goto(`/?pitch=ledgerloop&seed=7&${FAST}&autoplay=1`);
    const dialog = await waitForVerdict(page);

    await expect(dialog.locator(".verdict-stamp")).toHaveText("Multi-shark deal");
    await expect(dialog.locator("h2")).toHaveText("Max and Rex invest in LedgerLoop");

    const [download] = await Promise.all([
      page.waitForEvent("download"),
      dialog.getByRole("button", { name: "Download report" }).click(),
    ]);
    const content = await readFile(await download.path(), "utf8");

    expect(download.suggestedFilename()).toBe("ledgerloop-feasibility-report.md");
    expect(content).toContain("# LedgerLoop: AI Shark Tank Feasibility Report");
    expect(content).toContain("**Final terms:** $300,000 for 13.5%");
    expect(content).toContain("## All-Time Shark Tank Stats");
    await expect(page.locator("#toast")).toHaveText("Downloaded ledgerloop-feasibility-report.md");
  });

  test("Sproutsy seed 1 ends with every shark out", async ({ page }) => {
    await page.goto(`/?pitch=sproutsy&seed=1&${FAST}&autoplay=1`);
    const dialog = await waitForVerdict(page);

    await expect(dialog.locator(".verdict-stamp")).toHaveText("No deal");
    await expect(dialog.locator("h2")).toHaveText("Sproutsy leaves without a deal");
    await expect(dialog.locator(".verdict-kicker")).toHaveText("Every shark went out.");
    await expect(dialog.locator('.verdict-sharks li[data-status="out"]')).toHaveCount(5);
    await expect(dialog.locator('.report-stats dd[data-good="no"]')).toHaveText("No");
  });

  test("a custom idea becomes a shareable episode", async ({ page }) => {
    await page.goto(`/?${FAST}`);
    await page.getByLabel("Or pitch your own idea").fill("a marketplace for renting wedding dresses");

    await expect(page.locator('.pitch-card[aria-checked="true"]')).toHaveCount(0);
    await expect(page.locator("#hero-title")).toHaveText("Your pitch");

    await page.getByLabel("Or pitch your own idea").press("Enter");
    await expect(page).toHaveURL(/idea=a\+marketplace\+for\+renting\+wedding\+dresses&seed=1/);

    const dialog = await waitForVerdict(page);
    await expect(dialog.locator("h2")).toHaveText("WeddingDress Works leaves without a deal");

    await dialog.getByRole("button", { name: "New pitch" }).click();
    await expect(page.locator("body")).toHaveAttribute("data-view", "lobby");
    await expect(page).toHaveURL(/\/$/);
  });
});

test.describe("playback controls", () => {
  test("pause, next line, skip to verdict, and watch again", async ({ page }) => {
    await page.goto("/?pitch=odd-sox&seed=1");
    await rollCameras(page);

    await page.keyboard.press("Space");
    await expect(page.locator("body")).toHaveAttribute("data-playback", "paused");
    const label = page.locator("#progress-label");
    await expect(label).toHaveText("Line 0 of 26");

    await page.getByRole("button", { name: "Next line" }).click();
    await expect(label).toHaveText("Line 1 of 26");
    await page.keyboard.press("ArrowRight");
    await expect(label).toHaveText("Line 2 of 26");
    await expect(page.locator(".caption-name")).toHaveText("Theo");

    await page.getByRole("button", { name: "2×" }).click();
    await expect(page.getByRole("button", { name: "2×" })).toHaveAttribute("aria-pressed", "true");

    await page.getByRole("button", { name: "Skip to verdict" }).click();
    const dialog = await waitForVerdict(page);
    await expect(dialog.locator("h2")).toHaveText("Vera invests in Odd Sox Club");

    await dialog.getByRole("button", { name: "Watch again" }).click();
    await expect(dialog).toBeHidden();
    await expect(page.locator("body")).toHaveAttribute("data-playback", "playing");
    await expect(boardRow(page, "vera")).toHaveAttribute("data-status", /waiting|thinking/);
  });

  test("voices read each line through the browser's speech synthesis", async ({ page }) => {
    // Silent, deterministic stand-in for window.speechSynthesis.
    await page.addInitScript(() => {
      window.__spoken = [];
      window.SpeechSynthesisUtterance = class {
        constructor(text) {
          this.text = text;
        }
      };
      Object.defineProperty(window, "speechSynthesis", {
        configurable: true,
        value: {
          getVoices: () => [{ name: "Test Voice", lang: "en-US" }],
          addEventListener() {},
          speak(utterance) {
            window.__spoken.push(utterance.text);
            setTimeout(() => utterance.onend?.(), 20);
          },
          cancel() {},
          pause() {},
          resume() {},
        },
      });
    });

    await page.goto(`/?pitch=tidetrack&seed=1&${FAST}`);
    await rollCameras(page);
    await page.getByRole("button", { name: "Turn voices on" }).click();
    await expect(page.locator("#toast")).toHaveText(/Voices on/);

    await waitForVerdict(page);
    const spoken = await page.evaluate(() => window.__spoken);
    expect(spoken.length).toBeGreaterThan(10);
    expect(spoken.at(-1)).toBe(
      "TideTrack leaves the tank with $1 million for 16% from Luna. That values the company at $6.25 million, 38% under the ask.",
    );
  });

  test("the lobby button leaves the show", async ({ page }) => {
    await page.goto("/?pitch=tidetrack&seed=1");
    await rollCameras(page);
    await page.getByRole("button", { name: "Lobby" }).click();

    await expect(page.locator("body")).toHaveAttribute("data-view", "lobby");
    await expect(page.locator('.pitch-card[aria-checked="true"]')).toContainText("TideTrack");
  });
});

test.describe("responsive", () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

  test("works on a phone without horizontal scrolling", async ({ page }, testInfo) => {
    await page.goto(`/?pitch=dumpling-dynasty&seed=2&${FAST}`);

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
    await page.screenshot({ path: testInfo.outputPath("phone-lobby.png"), fullPage: true });

    await page.getByRole("button", { name: "Roll the cameras" }).tap();
    const dialog = await waitForVerdict(page);
    await expect(dialog.locator("h2")).toHaveText("Wild Wes and Vera invest in Dumpling Dynasty");

    const showOverflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(showOverflow).toBeLessThanOrEqual(0);
    await page.screenshot({ path: testInfo.outputPath("phone-verdict.png") });
  });
});
