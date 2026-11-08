import { test, expect } from './fixtures.mjs';
import { createLiveEpisode } from '../../src/lib/liveEpisode.js';
import { resolvePitch } from '../../src/lib/scriptedEngine.js';
import { createPitchDeck } from '../../src/lib/pitchDeck.js';
import { scriptedClients } from '../fixtures/liveCast.mjs';
for (const choice of ['counter','decline']) test(`mixed-provider contract plays ${choice} using only scripted fixtures`, async ({ page }) => {
 const episode = await createLiveEpisode(resolvePitch({pitchId:'barklight'}),1,scriptedClients({choice,response:'revise'}));
 const deck = await createPitchDeck(episode);
 await page.addInitScript(()=>localStorage.setItem('ai-shark-tank:voice','false'));
 await page.route('**/api/episodes',async route=>{
  const payload=await (await route.fetch()).json();
  await route.fulfill({json:{...payload,episode,deck,speech:null}});
 });
 await page.goto('/?quality=low');
 await page.getByRole('button',{name:'Enter the tank'}).click();
 await expect(page.locator('body')).toHaveAttribute('data-view','show');
 await page.getByRole('button',{name:'Skip to verdict'}).press('Enter');
 const dialog=page.locator('dialog.end-card');await expect(dialog).toBeVisible();
 if(choice==='counter') {
  await expect(dialog.locator('h2')).toHaveText('Kevin O’Leary invests in Barklight Labs');
  await expect(dialog).toContainText('$250,000 for 17.5%');
 } else {
  await expect(dialog).toContainText('declined the available offers');
  await expect(dialog).not.toContainText('Every shark went out');
 }
});
