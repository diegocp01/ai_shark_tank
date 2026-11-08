// Read-only UI capture. Block every POST and external request, even if the
// preview has live credentials. Never click API or generate an episode here.
import { chromium, expect } from '@playwright/test';
const browser = await chromium.launch({channel:'chrome'});
try {
 const page=await browser.newPage({viewport:{width:1440,height:900}});
 const blocked=[];
 await page.route('**/*',route=>{
  const request=route.request(),url=new URL(request.url());
  if(request.method()!=='GET'||url.origin!=='http://127.0.0.1:5056'){
   blocked.push(url.pathname);return route.abort();
  }
  return route.continue();
 });
 await page.goto('http://127.0.0.1:5056/');
 await expect(page.locator('body')).toHaveClass(/is-ready/);
 await expect(page.locator('#stage')).toHaveAttribute('data-wes-model','mark');
 await expect(page.locator('#lobby button')).toHaveCount(2);
 await expect(page.locator('#api-button')).toBeEnabled();
 await expect(page.locator('#test-button')).toBeEnabled();
 await page.screenshot({path:'review/start-screen/desktop.png'});
 await page.setViewportSize({width:390,height:844});
 await page.screenshot({path:'review/start-screen/mobile.png'});
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 expect(blocked).toEqual([]);
 console.log('Captured both start-screen layouts; no POST or external requests.');
} finally {await browser.close();}
