import { chromium, expect } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
const browser = await chromium.launch({ channel:'chrome', args:['--use-angle=metal'] });
const page = await browser.newPage({ viewport:{width:1440,height:900} });
const errors=[], external=[];
page.on('pageerror',e=>errors.push(e.message));
page.on('request',r=>{if(/^https?:/.test(r.url())&&!r.url().startsWith('http://127.0.0.1:5056'))external.push(r.url());});
try {
 await page.addInitScript(()=>localStorage.setItem('ai-shark-tank:voice','false'));
 await page.goto('http://127.0.0.1:5056/?quality=high&pitch=barklight');
 await page.getByRole('button',{name:'Enter the tank'}).click();
 await expect(page.locator('body')).toHaveAttribute('data-view','show');
 await page.keyboard.press('Space');
 await page.keyboard.press('ArrowRight');
 await page.keyboard.press('ArrowRight');
 await page.keyboard.press('ArrowRight');
 await expect(page.locator('#stage')).toHaveAttribute('data-deck-slide','2');
 await page.locator('body').click({position:{x:1400,y:10}});
 await expect(page.locator('#transport')).toHaveCSS('opacity','0',{timeout:6000});
 await page.screenshot({path:'review/html-decks/studio.png'});
 console.log('Captured studio');
 await page.setViewportSize({width:390,height:844});
 await page.screenshot({path:'review/html-decks/mobile.png'});
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 const layout = await browser.newPage({viewport:{width:1280,height:720}});
 await layout.goto('http://127.0.0.1:5056/api/health');
 const report = await layout.evaluate(async()=>{
  const config=await(await fetch('/api/config')).json();
  const rows=[];
  for(const request of [...config.pitches.map(p=>({pitchId:p.id})),{idea:'Reusable lunchboxes for office workers'}]) {
   const {deck}=await(await fetch('/api/episodes',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...request,seed:1})})).json();
   for(const slide of deck.slides){
    document.body.innerHTML=''; document.body.style.margin='0';
    const root=document.createElement('div');root.style.cssText='width:1280px;height:720px;position:relative';root.innerHTML=slide.html;document.body.append(root);
    const overflow=Array.from(root.querySelectorAll('*')).filter(el=>{const b=el.getBoundingClientRect();return b.right>1281||b.bottom>721||b.left<0||b.top<0}).map(el=>el.tagName);
    rows.push({deck:deck.id,slide:slide.id,overflow});
   }
  }
  return rows;
 });
 expect(report.every(r=>r.overflow.length===0)).toBe(true);
 expect(errors).toEqual([]);expect(external).toEqual([]);
 await writeFile('review/html-decks/validation.json',JSON.stringify({errors,external,layout:report},null,2)+'\n');
 console.log('Validated',report.length,'slide layouts; no external requests or page errors');
}finally{await browser.close();}
