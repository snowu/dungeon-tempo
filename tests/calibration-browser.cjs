const {chromium}=require(process.env.PLAYWRIGHT_PATH||'playwright');const assert=require('node:assert/strict');
(async()=>{const b=await chromium.launch({...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{}),args:['--no-sandbox','--autoplay-policy=no-user-gesture-required']});
const page=await b.newPage({viewport:{width:1360,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.addInitScript(()=>{const N=window.AudioContext;window.AudioContext=class extends N{constructor(){super();window.testAudio=this;window.starts=[];const c=this.createOscillator.bind(this);this.createOscillator=()=>{const o=c(),s=o.start.bind(o);o.start=t=>{window.starts.push(t);s(t)};return o}}}});
await page.goto('http://localhost:8087');await page.waitForTimeout(300);
await page.click('#calibrate');await page.waitForTimeout(200);
const clicks=[...new Set(await page.evaluate(()=>window.starts))].sort((a,c)=>a-c);assert.equal(clicks.length,16);
assert.match(await page.locator('#overlay-title').textContent(),/Tap along/);assert.ok(await page.locator('#practice').isDisabled());

for(let i=4;i<16;i++){const target=clicks[i]+.06;for(;;){const t=await page.evaluate(()=>testAudio.currentTime);if(t>=target)break;await page.waitForTimeout(Math.max(1,(target-t)*1000-8))}await page.keyboard.press(['a','s','d','f'][i%4]);}
await page.waitForFunction(()=>document.querySelector('#overlay-label').textContent!=='CALIBRATE TIMING',null,{timeout:8000});
const measured=Number(await page.locator('#offset').inputValue());assert.ok(Math.abs(measured-60)<=20,'offset '+measured);

await page.reload();await page.waitForTimeout(300);assert.equal(Number(await page.locator('#offset').inputValue()),measured);
// too few taps path
await page.click('#calibrate');await page.waitForTimeout(11500);assert.match(await page.locator('#overlay-title').textContent(),/Not enough/);assert.equal(Number(await page.locator('#offset').inputValue()),measured);
await page.click('#start');await page.waitForTimeout(300);assert.equal(await page.locator('#room-title').textContent(),'Safe practice');
assert.deepEqual(errors,[]);console.log('PASS: calibration measures a 60 ms-late player, persists across reload, rejects too few taps, returns to the start flow.');await b.close()})().catch(e=>{console.error(e);process.exit(1)});
