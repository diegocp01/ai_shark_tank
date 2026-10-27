import { readFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";

// Every episode is deterministic, so these assertions are exact: the same pitch
// and seed always produce the same lines, offers, and verdict.

const FAST = "speed=40";

async function enterTheTank(page) {
  await page.getByRole("button", { name: "Enter the tank" }).click();
  await expect(page.locator("body")).toHaveAttribute("data-view", "show");
}

async function waitForVerdict(page) {
  const dialog = page.locator("dialog.end-card");
  await expect(dialog).toBeVisible({ timeout: 40_000 });
  return dialog;
}

test.describe("title screen", () => {
  test("shows the lineup over the live 3D studio", async ({ page }, testInfo) => {
    await page.goto("/");

    await expect(page.getByRole("heading", { name: "AI Shark Tank" })).toBeVisible();
    await expect(page.locator(".stage canvas")).toBeVisible();
    await expect(page.locator(".stage")).toHaveAttribute("data-mood", "lobby");
    await expect(page.getByRole("radio")).toHaveCount(6);
    await expect(page.getByRole("radio", { name: /Barklight Labs/ })).toHaveAttribute("aria-checked", "true");
    await expect(page.locator("#tonight-title")).toHaveText("Barklight Labs · seeking $500K for 8%");

    await page.getByRole("radio", { name: /TideTrack/ }).click();
    await expect(page.locator("#tonight-title")).toHaveText("TideTrack · seeking $1M for 10%");
    await expect(page.locator(".stage")).toHaveAttribute("data-pitch", "tidetrack");

    // No dashboard chrome: the show itself has no panels.
    await expect(page.locator(".player")).toBeHidden();
    await page.screenshot({ path: testInfo.outputPath("title.png") });
  });

  test("seats the rigged Kevin, Lori, Barbara, and Mark models in their chairs", async ({ page }) => {
    // Full quality loads rigged models; software WebGL is slow, so allow extra time.
    test.setTimeout(150_000);
    await page.goto("/?quality=high");
    await expect(page.locator(".stage")).toHaveAttribute("data-quality", "high");
    await expect(page.locator(".stage")).toHaveAttribute("data-rex-model", "kevin", { timeout: 120_000 });
    await expect(page.locator(".stage")).toHaveAttribute("data-luna-model", "lori", { timeout: 120_000 });
    await expect(page.locator(".stage")).toHaveAttribute("data-vera-model", "barbara", { timeout: 120_000 });
    await expect(page.locator(".stage")).toHaveAttribute("data-wes-model", "mark", { timeout: 120_000 });
  });

  test("validates the seed before rolling", async ({ page }) => {
    await page.goto("/");
    await page.locator("#seed-input").fill("0");
    await page.getByRole("button", { name: "Enter the tank" }).click();

    await expect(page.locator("#lobby-error")).toHaveText(/Seed must be a whole number/);
    await expect(page.locator("body")).toHaveAttribute("data-view", "lobby");
  });
});

test.describe("full episode", () => {
  test("Barklight seed 1 plays from the entrance to a handshake with Wild Wes", async ({ page }, testInfo) => {
    await page.goto(`/?${FAST}`);
    await enterTheTank(page);

    await expect(page).toHaveURL(/pitch=barklight&seed=1/);
    await expect(page.locator(".title-screen")).toBeHidden();
    await expect(page.locator(".onair")).toBeVisible();

    const dialog = await waitForVerdict(page);
    await page.screenshot({ path: testInfo.outputPath("barklight-verdict.png") });

    await expect(dialog.locator(".slate-stamp")).toHaveText("Deal");
    await expect(dialog.locator("h2")).toHaveText("Wild Wes invests in Barklight Labs");
    await expect(dialog.locator(".slate-terms")).toHaveText("$500,000 for 9.5%");
    await expect(dialog.locator(".slate-note")).toHaveText("16% below the asking valuation of $6.25M.");
    await expect(dialog.locator(".slate-facts")).toContainText("Feasibility 44%");

    await dialog.getByRole("button", { name: "Close verdict" }).click();
    await expect(page.locator(".stage")).toHaveAttribute("data-shot", "handshake");
    await expect(page.locator(".stage")).toHaveAttribute("data-founder", "handshake");
    await expect(page.locator(".lower-third")).toContainText("Deal · Wild Wes");
    await expect(page.locator("#progress")).toHaveAttribute("aria-valuetext", "Line 25 of 25");
    await expect(page.locator("#transcript li")).toHaveCount(25);
    await expect(page.locator("#transcript li").last()).toContainText("Barklight Labs leaves the tank with $500,000 for 9.5% from Wild Wes.");
  });

  test("the end slate downloads a markdown feasibility report", async ({ page }) => {
    await page.goto(`/?pitch=ledgerloop&seed=7&${FAST}&autoplay=1`);
    const dialog = await waitForVerdict(page);

    await expect(dialog.locator(".slate-stamp")).toHaveText("Multi-shark deal");
    await expect(dialog.locator("h2")).toHaveText("Max and Rex invest in LedgerLoop");

    const [download] = await Promise.all([page.waitForEvent("download"), dialog.getByRole("button", { name: "Download report" }).click()]);
    const content = await readFile(await download.path(), "utf8");

    expect(download.suggestedFilename()).toBe("ledgerloop-feasibility-report.md");
    expect(content).toContain("# LedgerLoop: AI Shark Tank Feasibility Report");
    expect(content).toContain("**Final terms:** $300,000 for 13.5%");
    expect(content).toContain("## All-Time Shark Tank Stats");
    await expect(page.locator("#toast")).toHaveText("Downloaded ledgerloop-feasibility-report.md");
  });

  test("Sproutsy seed 1 ends with every shark out and the founder walking off", async ({ page }) => {
    await page.goto(`/?pitch=sproutsy&seed=1&${FAST}&autoplay=1`);
    const dialog = await waitForVerdict(page);

    await expect(dialog.locator(".slate-stamp")).toHaveText("No deal");
    await expect(dialog.locator("h2")).toHaveText("Sproutsy leaves without a deal");
    await expect(dialog.locator(".slate-note")).toHaveText("Every shark went out.");
    await expect(dialog.locator(".slate-facts")).toContainText("Good business? No");
    await expect(page.locator(".stage")).toHaveAttribute("data-founder", /exit|offstage/);
  });

  test("a custom idea becomes a shareable episode", async ({ page }) => {
    await page.goto(`/?${FAST}`);
    await page.getByText("Pitch your own idea").click();
    await page.getByLabel("Your startup idea").fill("a marketplace for renting wedding dresses");

    await expect(page.locator('.lineup-card[aria-checked="true"]')).toHaveCount(0);
    await expect(page.locator("#tonight-title")).toHaveText("Your pitch");

    await page.getByLabel("Your startup idea").press("Enter");
    await expect(page).toHaveURL(/idea=a\+marketplace\+for\+renting\+wedding\+dresses&seed=1/);

    const dialog = await waitForVerdict(page);
    await expect(dialog.locator("h2")).toHaveText("WeddingDress Works leaves without a deal");

    await dialog.getByRole("button", { name: "Next pitch" }).click();
    await expect(page.locator("body")).toHaveAttribute("data-view", "lobby");
    await expect(page).toHaveURL(/\/$/);
  });
});

test.describe("playback", () => {
  test("pause, next line, skip to verdict, and watch again", async ({ page }) => {
    await page.goto("/?pitch=odd-sox&seed=1");
    await enterTheTank(page);

    await page.keyboard.press("Space");
    await expect(page.locator("body")).toHaveAttribute("data-playback", "paused");
    await expect(page.locator(".player")).toBeVisible();
    const progress = page.locator("#progress");
    await expect(progress).toHaveAttribute("aria-valuetext", "Line 0 of 26");

    await page.getByRole("button", { name: "Next line" }).click();
    await expect(progress).toHaveAttribute("aria-valuetext", "Line 1 of 26");
    await page.keyboard.press("ArrowRight");
    await expect(progress).toHaveAttribute("aria-valuetext", "Line 2 of 26");
    await expect(page.locator(".sub-name")).toHaveText("Theo · Founder");
    await expect(page.locator(".stage")).toHaveAttribute("data-shot", /founder-close|pitch-wide/);

    await page.getByRole("button", { name: "2×" }).click();
    await expect(page.getByRole("button", { name: "2×" })).toHaveAttribute("aria-pressed", "true");

    await page.getByRole("button", { name: "Skip to verdict" }).click();
    const dialog = await waitForVerdict(page);
    await expect(dialog.locator("h2")).toHaveText("Vera invests in Odd Sox Club");

    await dialog.getByRole("button", { name: "Watch again" }).click();
    await expect(dialog).toBeHidden();
    await expect(page.locator("body")).toHaveAttribute("data-playback", "playing");
  });

  test("voices read each line through the browser's speech synthesis", async ({ page }) => {
    // Silent, deterministic stand-in for window.speechSynthesis, with voices
    // already switched on from a previous visit.
    await page.addInitScript(() => {
      localStorage.setItem("ai-shark-tank:voice", "true");
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
    await enterTheTank(page);

    const dialog = await waitForVerdict(page);
    const spoken = await page.evaluate(() => window.__spoken);
    expect(spoken).toHaveLength(23);
    expect(spoken.at(-1)).toBe("TideTrack leaves the tank with $1 million for 16% from Luna. That values the company at $6.25 million, 38% under the ask.");

    await dialog.getByRole("button", { name: "Close verdict" }).click();
    await page.getByRole("button", { name: "Turn voices off" }).click();
    await expect(page.locator("#toast")).toHaveText("Voices off");
    await expect(page.getByRole("button", { name: "Turn voices on" })).toHaveAttribute("aria-pressed", "false");
  });

  test("the lobby button leaves the show", async ({ page }) => {
    await page.goto("/?pitch=tidetrack&seed=1");
    await enterTheTank(page);
    await page.getByRole("button", { name: "Lobby" }).click();

    await expect(page.locator("body")).toHaveAttribute("data-view", "lobby");
    await expect(page.getByRole("radio", { name: /TideTrack/ })).toHaveAttribute("aria-checked", "true");
  });
});

test.describe("phone", () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

  test("fills the screen without horizontal scrolling", async ({ page }, testInfo) => {
    await page.goto(`/?pitch=dumpling-dynasty&seed=2&${FAST}`);

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
    await page.screenshot({ path: testInfo.outputPath("phone-title.png") });

    await page.getByRole("button", { name: "Enter the tank" }).tap();
    const dialog = await waitForVerdict(page);
    await expect(dialog.locator("h2")).toHaveText("Wild Wes and Vera invest in Dumpling Dynasty");

    const showOverflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(showOverflow).toBeLessThanOrEqual(0);
    await page.screenshot({ path: testInfo.outputPath("phone-verdict.png") });
  });
});
