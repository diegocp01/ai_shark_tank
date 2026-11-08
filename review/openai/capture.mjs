import { assertScriptedServer } from '../offline.js';
await assertScriptedServer();
import { chromium, expect } from '@playwright/test';
import { readFile, writeFile } from 'node:fs/promises';
const payload=JSON.parse(await readFile('review/openai/generated-show.json','utf8'));
const browser=await chromium.launch({channel:'chrome',args:['--use-angle=metal']});
const page=await browser.newPage({viewport:{width:1440,height:900}});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
try{
 await page.addInitScript(()=>localStorage.setItem('ai-shark-tank:voice','false'));
 await page.route('**/api/episodes',r=>r.fulfill({json:payload}));
 await page.goto('http://127.0.0.1:5056/?quality=high');
 await page.getByRole('button',{name:'Test',exact:true}).click();await expect(page.locator('body')).toHaveAttribute('data-view','show');
 await page.keyboard.press('Space');await page.keyboard.press('ArrowRight');await page.keyboard.press('ArrowRight');await page.keyboard.press('ArrowRight');
 await expect(page.locator('#stage')).toHaveAttribute('data-deck-slide','2');
 await page.locator('body').click({position:{x:1400,y:10}});await expect(page.locator('#transport')).toHaveCSS('opacity','0',{timeout:6000});
 await page.screenshot({path:'review/openai/studio.png'});
 const preview=await browser.newPage({viewport:{width:1280,height:720}});
 await preview.goto('http://127.0.0.1:5056/api/health');const layouts=[];
 for(const [i,slide] of payload.deck.slides.entries()){
  const overflow=await preview.evaluate(html=>{document.body.innerHTML=html;document.body.style.margin='0';return Array.from(document.body.querySelectorAll('*')).filter(el=>{const r=el.getBoundingClientRect();return r.right>1281||r.bottom>721||r.left<0||r.top<0;}).map(el=>el.tagName);},slide.html);
  layouts.push({slide:i+1,overflow});await preview.screenshot({path:`review/openai/slide-${i+1}.png`});
 }
 const audioDurations=[];
 for(const speaker of ['narrator','founder','rex','luna','max','vera','wes']){
  const bytes=Array.from(await readFile(`review/openai/${speaker}.mp3`));
  const seconds=await preview.evaluate(async bytes=>{const ctx=new AudioContext();try{return (await ctx.decodeAudioData(new Uint8Array(bytes).buffer)).duration;}finally{await ctx.close();}},bytes);
  expect(seconds).toBeGreaterThan(1);audioDurations.push({speaker,seconds});
 }
 expect(errors).toEqual([]);expect(layouts.every(s=>s.overflow.length===0)).toBe(true);
 await writeFile('review/openai/browser-check.json',JSON.stringify({errors,layouts,audioDurations},null,2)+'\n');
 console.log(JSON.stringify({layouts,audioDurations,errors}));
}finally{await browser.close();}
