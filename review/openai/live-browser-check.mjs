import {chromium,expect} from '@playwright/test';
import {writeFile} from 'node:fs/promises';
const browser=await chromium.launch({channel:'chrome',args:['--use-angle=metal']});
const page=await browser.newPage({viewport:{width:1440,height:900}});
const errors=[],speechStatuses=[];
page.on('pageerror',e=>errors.push(e.message));
page.on('response',r=>{if(r.url().endsWith('/api/speech'))speechStatuses.push(r.status());});
try{
 await page.addInitScript(()=>{localStorage.setItem('ai-shark-tank:voice','true');const Original=window.AudioContext;window.__audioStarts=0;window.AudioContext=class extends Original{createBufferSource(){const source=super.createBufferSource(),start=source.start.bind(source);source.start=(...args)=>{window.__audioStarts++;return start(...args);};return source;}};});
 await page.goto('http://127.0.0.1:5056/?quality=low');
 await expect(page.locator('#production-note')).toContainText('OpenAI-generated');
 const produced=page.waitForResponse(r=>r.url().endsWith('/api/episodes'),{timeout:150000});
 await page.getByRole('button',{name:'Enter the tank'}).click();
 const response=await produced;const payload=await response.json();
 if(!response.ok())throw new Error(payload.detail||'Episode failed');
 await expect(page.locator('body')).toHaveAttribute('data-view','show',{timeout:30000});
 await expect.poll(()=>page.evaluate(()=>window.__audioStarts),{timeout:60000}).toBeGreaterThan(0);
 await page.getByRole('button',{name:'Pause',exact:true}).press('Enter');
 await expect(page.locator('body')).toHaveAttribute('data-playback','paused');
 await page.getByRole('button',{name:'Turn voices off'}).press('Enter');
 await expect(page.locator('#stage')).toHaveAttribute('data-deck-slides','4');
 expect(errors).toEqual([]);expect(speechStatuses.every(status=>status===200)).toBe(true);
 const result={provider:payload.episode.provider,deck:payload.deck.generation,slides:payload.deck.slides.length,speechStatuses,audioStarted:true,paused:true,errors};
 await writeFile('review/openai/live-browser-check.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
}finally{await browser.close();}
