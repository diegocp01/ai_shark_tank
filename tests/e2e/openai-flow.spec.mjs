import {test,expect} from './fixtures.mjs';

// Deterministic local audio fixture: these browser tests never spend API credits.
function wav(){
 const samples=2400,buffer=Buffer.alloc(44+samples*2);
 buffer.write('RIFF');buffer.writeUInt32LE(buffer.length-8,4);buffer.write('WAVEfmt ',8);buffer.writeUInt32LE(16,16);buffer.writeUInt16LE(1,20);buffer.writeUInt16LE(1,22);buffer.writeUInt32LE(24000,24);buffer.writeUInt32LE(48000,28);buffer.writeUInt16LE(2,32);buffer.writeUInt16LE(16,34);buffer.write('data',36);buffer.writeUInt32LE(samples*2,40);
 for(let i=0;i<samples;i++)buffer.writeInt16LE(Math.sin(i/24000*440*2*Math.PI)*300,i*2+44);return buffer;
}
test('OpenAI idea flow, disclosure and server audio play without exposing credentials',async({page})=>{
 const errors=[],requests=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{
  localStorage.setItem('ai-shark-tank:voice','true');
  const Original=window.AudioContext;window.__audioStarts=0;
  window.AudioContext=class extends Original{createBufferSource(){const source=super.createBufferSource();const start=source.start.bind(source);source.start=(...args)=>{window.__audioStarts++;return start(...args);};return source;}};
 });
 await page.route('**/api/config',async route=>{const response=await route.fetch();const config=await response.json();await route.fulfill({json:{...config,generation:{model:'gpt-6.1-sol',reasoning:'medium',serviceTier:'ultrafast'},speech:{provider:'openai'}}});});
 await page.route('**/api/ideas',route=>route.fulfill({json:{idea:'A portable tool library for apartment renters'}}));
 await page.route('**/api/episodes',async route=>{const response=await route.fetch();const payload=await response.json();await route.fulfill({json:{...payload,speech:{token:'local-test-session'}}});});
 await page.route('**/api/speech',route=>{requests.push(route.request().postDataJSON());return route.fulfill({contentType:'audio/wav',body:wav()});});
 await page.goto('/?quality=low');
 await expect(page.locator('#production-note')).toContainText('OpenAI + Anthropic');
 await page.getByText('Pitch your own idea').click();await page.getByRole('button',{name:'Invent an idea'}).click();
 await expect(page.getByLabel('Your startup idea')).toHaveValue('A portable tool library for apartment renters');
 await page.getByRole('button',{name:'Enter the tank'}).click();
 await expect(page.locator('body')).toHaveAttribute('data-view','show');
 await expect.poll(()=>page.evaluate(()=>window.__audioStarts)).toBeGreaterThan(0);
 await page.getByRole('button',{name:'Pause',exact:true}).press('Enter');
 await expect(page.locator('body')).toHaveAttribute('data-playback','paused');
 await page.getByRole('button',{name:'Play',exact:true}).press('Enter');
 await expect(page.locator('body')).toHaveAttribute('data-playback','playing');
 await page.getByRole('button',{name:'Skip to verdict'}).press('Enter');
 await expect(page.locator('dialog.end-card')).toBeVisible();
 expect(requests.length).toBeGreaterThan(0);
 expect(requests.every(r=>Object.keys(r).sort().join(',')==='beatId,token')).toBe(true);
 expect(errors).toEqual([]);
});
