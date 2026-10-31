const {chromium}=require(process.env.PLAYWRIGHT_PATH || 'playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({headless:true,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{}),args:['--no-sandbox']});
 try{
 const page=await browser.newPage({viewport:{width:1360,height:1100}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{const Native=window.AudioContext;window.AudioContext=class extends Native{constructor(){super();window.testAudio=this;window.noteStarts=[];const create=this.createOscillator.bind(this);this.createOscillator=()=>{const o=create(),start=o.start.bind(o);o.start=t=>{window.noteStarts.push(t);start(t)};return o}}}});
 await page.addInitScript(()=>localStorage.setItem('tempo-learned','yes'));await page.goto('http://localhost:8087');await page.selectOption('#difficulty','normal');await page.selectOption('#key-layout','dfjk');await page.screenshot({path:'/tmp/rogue-ready.png',fullPage:true});await page.click('#start');
 await page.waitForTimeout(500);await page.keyboard.press('Space');assert.match(await page.locator('#overlay-title').textContent(),/Holding/);const time=await page.locator('#time').textContent();await page.waitForTimeout(250);assert.equal(await page.locator('#time').textContent(),time);await page.keyboard.press('Space');
 const seed=parseInt((await page.locator('#seed').textContent()).match(/Run ([A-F0-9]+)/)[1],16);
 let route='crypt';
 for(let floor=1;floor<=5;floor++){
  await page.evaluate(async({seed,floor,route})=>{const {newRun,makeRoom,roomChart}=await import('./expedition.js');const run=newRun(seed,'normal');run.floor=floor;run.room=makeRoom(run,route);const notes=roomChart(run),start=Math.min(...window.noteStarts),spb=60/run.room.bpm;
   await new Promise((resolve,reject)=>{let next=0;const timeout=setTimeout(()=>reject(new Error('Room input timeout')),30000);function step(){if(!document.querySelector('#overlay').classList.contains('hidden')){clearTimeout(timeout);resolve();return}const beat=(testAudio.currentTime-start)/spb;while(next<notes.length&&beat>=notes[next].beat){const n=notes[next++];if(floor===2)document.querySelector(`[data-lane="${n.lane}"]`).dispatchEvent(new PointerEvent('pointerdown',{bubbles:true}));else document.body.dispatchEvent(new KeyboardEvent('keydown',{key:['d','f','j','k'][n.lane],code:'KeyD',bubbles:true}))}requestAnimationFrame(step)}step()});
  },{seed,floor,route});
  if(floor<5){assert.match(await page.locator('#overlay-title').textContent(),/Take one relic/);assert.equal(await page.locator('.choice').count(),3);
   if(floor===1){await page.setViewportSize({width:390,height:844});await page.screenshot({path:'/tmp/rogue-loot-mobile.png',fullPage:true});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true)}
   await page.locator('.choice').first().click();assert.equal(await page.locator('.relic-chip').count(),floor);
   route=floor===1?'elite':'crypt';await page.evaluate(()=>window.noteStarts=[]);await page.locator('.choice').nth(route==='elite'?1:0).click();
  }
 }
 assert.match(await page.locator('#overlay-label').textContent(),/CURSE IS BROKEN/);assert.ok(Number(await page.locator('#score').textContent())>0);await page.screenshot({path:'/tmp/rogue-victory.png',fullPage:true});
 await page.click('#start');assert.equal(await page.locator('#health').textContent(),'♥ 12 / 12');assert.equal(await page.locator('.relic-chip').count(),0);await page.waitForFunction(()=>document.querySelector('#overlay-label').textContent==='THE SONG ENDED',null,{timeout:40000});const left=Number((await page.locator('#health').textContent()).match(/♥ (\d+)/)[1]);assert.ok(left>0&&left<12,'idle room: guards and the fleeing strike hurt, but are not fatal');assert.equal(await page.locator('.relic-chip').count(),0);await page.locator('.choice').first().click();await page.waitForFunction(()=>document.querySelector('#overlay-label').textContent==='YOUR RUN HAS ENDED',null,{timeout:40000});assert.equal(await page.locator('#health').textContent(),'♥ 0 / 12');assert.deepEqual(errors,[]);
 console.log('PASS: real-clock five-room victory, elite route, relics, boss, keyboard/touch combat, pause/resume, mobile layout, permadeath and restart.');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)});
