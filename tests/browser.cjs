const {chromium}=require(process.env.PLAYWRIGHT_PATH || 'playwright');
const assert=require('node:assert/strict');
// Plays a whole run on the real audio clock: eight rooms, an elite door, a campfire, the boss, then an idle run that dies.
(async()=>{
 const browser=await chromium.launch({headless:true,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{}),args:['--no-sandbox','--autoplay-policy=no-user-gesture-required']});
 try{
  const page=await browser.newPage({viewport:{width:1360,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>{localStorage.setItem('tempo-learned','yes');const Native=window.AudioContext;window.AudioContext=class extends Native{constructor(){super();window.testAudio=this;window.noteStarts=[];const create=this.createOscillator.bind(this);this.createOscillator=()=>{const o=create(),start=o.start.bind(o);o.start=t=>{window.noteStarts.push(t);start(t)};return o}}}});
  await page.goto('http://localhost:8087');await page.selectOption('#difficulty','normal');await page.selectOption('#key-layout','dfjk');await page.selectOption('#soundtrack','synth');
  await page.screenshot({path:'/tmp/rogue-ready.png'});
  const overlayOpen=()=>page.evaluate(()=>!document.querySelector('#overlay').classList.contains('hidden'));
  await page.click('#start');
  await page.waitForTimeout(500);await page.keyboard.press('Space');assert.match(await page.locator('#overlay-title').textContent(),/Holding/);const time=await page.locator('#time').textContent();await page.waitForTimeout(250);assert.equal(await page.locator('#time').textContent(),time);await page.keyboard.press('Space');
  const seed=parseInt((await page.locator('#seed').textContent()).match(/Run ([A-F0-9]+)/)[1],16);
  // Door plan per cleared floor: elite after room 1, campfire after room 2 (then a crypt), otherwise the first door.
  let floor=1,route='crypt';
  while(true){
   await page.evaluate(async({seed,floor,route,touch})=>{const {newRun,makeRoom,roomChart}=await import('./expedition.js');const run=newRun(seed,'normal');run.floor=floor;run.room=makeRoom(run,route);const notes=roomChart(run,'synth').filter(n=>n.kind!=='call'),start=Math.min(...window.noteStarts),spb=60/run.room.bpm;
    await new Promise((resolve,reject)=>{let next=0;const timeout=setTimeout(()=>reject(new Error('Room input timeout')),90000);function step(){if(!document.querySelector('#overlay').classList.contains('hidden')){clearTimeout(timeout);resolve();return}const beat=(testAudio.currentTime-start)/spb;while(next<notes.length&&beat>=notes[next].beat){const n=notes[next++];if(touch)document.querySelector(`[data-lane="${n.lane}"]`).dispatchEvent(new PointerEvent('pointerdown',{bubbles:true}));else document.body.dispatchEvent(new KeyboardEvent('keydown',{key:['d','f','j','k'][n.lane],bubbles:true}))}requestAnimationFrame(step)}step()});
   },{seed,floor,route,touch:floor===2});
   const label=await page.locator('#overlay-label').textContent();
   if(floor===8){assert.match(label,/CURSE IS BROKEN/);break}
   assert.equal(label,'ENEMY DEFEATED',`room ${floor}`);assert.equal(await page.locator('.relic-chip').count()>0,true);
   const doors=await page.locator('.choice').count();assert.equal(doors,floor===7?1:3);
   if(floor===1){await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await page.screenshot({path:'/tmp/rogue-doors-mobile.png'});await page.setViewportSize({width:1360,height:1000})}
   let pick=floor===1?1:0;
   if(floor===2){await page.evaluate(()=>window.noteStarts=[]);await page.locator('.choice').nth(2).click();assert.equal(await page.locator('#overlay-label').textContent(),'CAMPFIRE');floor++;assert.equal(await page.locator('.choice').count(),3);pick=0}
   route=floor===7?'crypt':['crypt','elite','rest'][pick];
   await page.evaluate(()=>window.noteStarts=[]);await page.locator('.choice').nth(pick).click();floor++;assert.equal(await overlayOpen(),false,`room ${floor} starts after one pick`);
  }
  assert.ok(Number(await page.locator('#score').textContent())>0);assert.ok(await page.locator('.relic-chip').count()>=6);
  await page.screenshot({path:'/tmp/rogue-victory.png'});
  await page.click('#start');assert.equal(await page.locator('#health').textContent(),'♥ 12 / 12');assert.equal(await page.locator('.relic-chip').count(),0);
  await page.waitForFunction(()=>document.querySelector('#overlay-label').textContent==='YOUR RUN HAS ENDED',null,{timeout:60000});assert.equal(await page.locator('#health').textContent(),'♥ 0 / 12');
  assert.deepEqual(errors,[]);
  console.log('PASS: real-clock eight-room victory: elite door, campfire, boss, keyboard and touch combat, pause/resume, mobile doors, idle death and restart.');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)});
