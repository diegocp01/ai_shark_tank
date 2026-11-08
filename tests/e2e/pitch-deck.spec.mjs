import { expect, test } from "./fixtures.mjs";
import { readFile } from "node:fs/promises";

test("HTML deck is generated, rendered in the set, synced, downloadable and reset", async ({ page }, testInfo) => {
  const errors = [], external = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("request", request => { if (/^https?:/.test(request.url()) && new URL(request.url()).hostname !== "127.0.0.1") external.push(request.url()); });
  await page.addInitScript(() => localStorage.setItem("ai-shark-tank:voice", "false"));
  await page.goto("/?quality=low&pitch=barklight");
  const response = page.waitForResponse(r => r.url().endsWith("/api/episodes") && r.request().method() === "POST");
  await page.getByRole("button", { name: "Enter the tank" }).click();
  const { deck } = await (await response).json();
  await expect(page.locator("body")).toHaveAttribute("data-view", "show");
  await page.keyboard.press("Space");
  await expect(page.locator("#stage")).toHaveAttribute("data-deck-slides", "4");
  await expect(page.locator("#stage")).toHaveAttribute("data-deck-slide", "0");
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowRight");
  await expect(page.locator("#stage")).toHaveAttribute("data-deck-slide", "1");
  await expect(page.locator("#stage")).toHaveAttribute("data-shot", "pitch-wide");
  await page.keyboard.press("ArrowRight");
  await expect(page.locator("#stage")).toHaveAttribute("data-deck-slide", "2");
  // Verify actual HTML produces distinct, readable pixels, not just metadata.
  const pixels = await page.evaluate(async (deck) => {
    const { renderPitchDeck } = await import("/js/pitchDeck.js");
    const canvases = await renderPitchDeck(deck);
    return canvases.map(canvas => {
      const data = canvas.getContext("2d").getImageData(0, 0, 1280, 720).data;
      let bright = 0;
      for (let i = 0; i < data.length; i += 4) if (data[i] > 150 && data[i+1] > 150) bright++;
      return { bright, png: canvas.toDataURL().slice(-200) };
    });
  }, deck);
  expect(pixels.every(p => p.bright > 5000)).toBe(true);
  expect(new Set(pixels.map(p => p.png)).size).toBe(4);
  await page.locator("body").click({ position: { x: 1100, y: 10 } });
  await expect(page.locator("#transport")).toHaveCSS("opacity", "0", { timeout: 6000 });
  await expect(page.locator("#caption")).toBeHidden();
  await page.screenshot({ path: testInfo.outputPath("html-deck-in-studio.png") });
  await page.getByRole("button", { name: "Skip to verdict" }).press("Enter");
  await expect(page.locator("#stage")).toHaveAttribute("data-deck-slide", "3");
  const downloaded = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download HTML deck" }).click();
  const download = await downloaded;
  expect(download.suggestedFilename()).toBe("barklight-pitch-deck.html");
  expect(await readFile(await download.path(), "utf8")).toBe(deck.download.content);
  await page.getByRole("button", { name: "Watch again" }).click();
  await page.getByRole("button", { name: "Pause", exact: true }).press("Enter");
  await expect(page.locator("#stage")).toHaveAttribute("data-deck-slide", "0");
  await page.getByRole("button", { name: "Skip to verdict" }).press("Enter");
  await page.getByRole("button", { name: "Next pitch", exact: true }).click();
  await expect(page.locator("#stage")).toHaveAttribute("data-deck-slides", "0");
  await page.getByRole("radio", { name: /TideTrack/ }).click();
  await page.getByRole("button", { name: "Enter the tank" }).click();
  await expect(page.locator("#stage")).toHaveAttribute("data-deck-slides", "4");
  await expect(page.locator("#stage")).toHaveAttribute("data-pitch", "tidetrack");
  expect(errors).toEqual([]);
  expect(external).toEqual([]);
});
