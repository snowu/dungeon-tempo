const {chromium}=require(process.env.PLAYWRIGHT_PATH || 'playwright');
const assert=require('node:assert/strict');
// Plays room 1 of every tracker song on the real audio clock: The Dim Dungeon is the default, stems start on time and the room is winnable.
(async()=>{
 const browser=await chromium.launch({headless:true,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{}),args:['--no-sandbox','--autoplay-policy=no-user-gesture-required']});
 try{
  for(const style of ['dim-dungeon','dim-dungeon-2','necromancer','war-path','djinn','crusaders','mega-destruction']){
   const page=await browser.newPage({viewport:{width:1360,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.addInitScript(()=>{localStorage.setItem('tempo-learned','yes');const Native=window.AudioContext;window.AudioContext=class extends Native{constructor(){super();window.testAudio=this;window.stemStarts=[];const create=this.createBufferSource.bind(this);this.createBufferSource=()=>{const s=create(),start=s.start.bind(s);s.start=(t,o)=>{window.stemStarts.push([t,o||0]);start(t,o)};return s}}}});
   await page.goto('http://localhost:8087');await page.selectOption('#difficulty','normal');await page.selectOption('#key-layout','dfjk');
   if(style==='dim-dungeon')assert.equal(await page.locator('#soundtrack').inputValue(),'dim-dungeon','default soundtrack');else await page.selectOption('#soundtrack',style);
   await page.click('#start');await page.waitForFunction(()=>window.stemStarts.length>=4,null,{timeout:15000});
   const seed=parseInt((await page.locator('#seed').textContent()).match(/Run ([A-F0-9]+)/)[1],16);
   const info=await page.evaluate(async({seed,style})=>{const {newRun,roomChart}=await import('./expedition.js'),{trackerBpm}=await import('./tracker.js');
    const run=newRun(seed,'normal');run.room.bpm=trackerBpm(style,run.room.bpm);const notes=roomChart(run,style).filter(n=>n.kind!=='call'),spb=60/run.room.bpm,start=window.stemStarts[0][0]-4*spb;
    await new Promise((resolve,reject)=>{let next=0;const timeout=setTimeout(()=>reject(new Error('Room input timeout')),90000);(function step(){if(!document.querySelector('#overlay').classList.contains('hidden')){clearTimeout(timeout);resolve();return}const beat=(testAudio.currentTime-start)/spb;while(next<notes.length&&beat>=notes[next].beat){const n=notes[next++];document.body.dispatchEvent(new KeyboardEvent('keydown',{key:'dfjk'[n.lane],bubbles:true}))}requestAnimationFrame(step)})()});
    return {lanes:[0,1,2,3].map(l=>notes.filter(n=>n.kind==='attack'&&n.lane===l).length),late:window.stemStarts.slice(0,4).map(s=>s[1])}},{seed,style});
   assert.equal(await page.locator('#overlay-label').textContent(),'ENEMY DEFEATED',style);assert.deepEqual(info.late,[0,0,0,0],`${style} stems start on time`);
   assert.ok(info.lanes.every(n=>n>=2),`${style} lanes ${info.lanes}`);assert.deepEqual(errors,[]);await page.close();
  }
  console.log('PASS: room 1 of all seven tracker songs on the real clock: default song, stems on time, every bandmate plays, every room won.');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)});
