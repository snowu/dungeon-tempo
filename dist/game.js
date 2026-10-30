import {modes,chart,judge,nearest} from './rhythm.js';
import {layouts,practiceChart,explainTap,calibrate} from './controls.js';
import {Music,tracks} from './music.js';
import {newRun,roomChart,hitEnemy,hurt,chooseRelic,enterRoom,hitWindow,relics} from './expedition.js';
const $=id=>document.getElementById(id), canvas=$('game'), g=canvas.getContext('2d'), colors=['#d7f779','#c7abff','#7cdbd6','#ffb180'];
const art=new Image();art.src='assets/tiny-dungeon.png';
let audio,master,music,previewTimer,startTime=0,notes=[],state='ready',mode='easy',spb=60/72,score=0,combo=0,maxCombo=0,hits=0,perfect=0,feedbackUntil=0,muted=false,bursts=[],flashes=[0,0,0,0],lastBeat=0;
let run=null,calib=null,practicing=false,practiceHits=0,practiceMisses=0,errorUntil=0;
let learned=false;try{learned=localStorage.getItem('tempo-learned')==='yes'}catch{}
let keys=layouts.asdf.keys,labels=layouts.asdf.labels;
const pads=[...document.querySelectorAll('[data-lane]')];
const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
function best(){try{return Number(localStorage.getItem('dungeon-tempo-run-best-'+mode))||0}catch{return 0}}
function updateBest(){$('best').textContent=best()?best().toLocaleString():'—'}updateBest();
function sprite(id,x,y,size=48){if(art.complete&&art.naturalWidth)g.drawImage(art,(id%12)*16,Math.floor(id/12)*16,16,16,Math.round(x),Math.round(y),size,size)}
async function ensureAudio(){
 audio??=new (window.AudioContext||window.webkitAudioContext)();await audio.resume();
 if(!master){master=audio.createGain();master.connect(audio.destination);music=new Music(audio,master)}
 master.gain.value=muted?0:Number($('volume').value)/100*.65;
}
function soundtrack(){music.play({style:$('soundtrack').value,startTime,bpm:run.room.bpm,endBeat:run.room.endBeat,intensity:run.floor});}
function stopMusic(){clearTimeout(previewTimer);previewTimer=null;if(music)music.stop();$('preview-track').textContent='▶ Preview track';$('preview-track').setAttribute('aria-pressed','false');}
function musicControls(playing){$('soundtrack').disabled=playing;$('preview-track').disabled=playing;$('key-layout').disabled=playing;$('practice').disabled=$('calibrate').disabled=$('calibrate-bar').disabled=playing||Boolean(run&&['loot','route'].includes(run.status));}
async function previewTrack(){
 if(['playing','paused'].includes(state))return;
 if(previewTimer){stopMusic();return}
 $('preview-track').disabled=true;
 try{await ensureAudio();music.play({style:$('soundtrack').value,startTime:audio.currentTime+.08,bpm:modes[$('difficulty').value].bpm,skipCountIn:true});
 $('preview-track').textContent='■ Stop preview';$('preview-track').setAttribute('aria-pressed','true');previewTimer=setTimeout(stopMusic,32*60/modes[$('difficulty').value].bpm*1000+400);
 }catch(e){$('status').textContent='Audio preview could not start. Try again.';console.error(e)}finally{$('preview-track').disabled=false}
}
function syncRun(){
 if(!run)return;
 $('health').textContent=practicing?'NO DAMAGE':`♥ ${run.hp} / ${run.maxHp}`+(run.room.shield?` · ◇ ${run.room.shield}`:'');
 $('health').classList.toggle('run-danger',run.hp<=3);
 $('enemy-name').textContent=run.room.name+(run.room.elite?' · ELITE':'');
 $('enemy-hp').style.width=run.room.hp/run.room.maxHp*100+'%';
 $('enemy-numbers').textContent=practicing?'Warm-up dummy · just find the beat':`${run.room.hp} / ${run.room.maxHp} HP`;
 $('enemy-sprite').style.backgroundPosition=`-${run.room.sprite%12*48}px -${Math.floor(run.room.sprite/12)*48}px`;
 $('room-title').textContent=practicing?'Safe practice':run.floor===5?'The final downbeat':`Room ${run.floor} / 5`;
 $('map').innerHTML=Array.from({length:5},(_,i)=>`<span class="${i<run.cleared?'cleared':i===run.floor-1?'current':''}">${i===4?'♛':i+1}</span>`).join('');
 $('relics').innerHTML=run.relics.length?run.relics.map(id=>{const r=relics.find(r=>r.id===id);return `<span class="relic-chip" title="${r.description}">${r.icon} ${r.name}</span>`}).join(''):'Nothing yet. Earn your first victory.';
 $('seed').textContent=`Run ${run.seed.toString(16).toUpperCase()} · ${run.path.map(p=>p==='elite'?'Elite':p==='boss'?'Boss':'Crypt').join(' → ')}`;
}
function showOverlay(label,title,copy,buttonText){
 $('overlay-label').textContent=label;$('overlay-title').textContent=title;$('overlay-copy').textContent=copy;
 $('skip-practice').hidden=true;$('choices').replaceChildren();$('start').hidden=!buttonText;if(buttonText)$('start').textContent=buttonText;
 $('overlay').classList.remove('hidden');$('overlay').classList.toggle('choosing',!buttonText);$('feedback').textContent='';
}
function choiceButton(icon,title,description,action){
 const button=document.createElement('button');button.className='choice';
 const i=document.createElement('i'),strong=document.createElement('strong'),span=document.createElement('span');
 i.textContent=icon;strong.textContent=title;span.textContent=description;button.append(i,strong,span);button.onclick=action;$('choices').append(button);
}
function prepareRoom(){
 stopMusic();spb=60/run.room.bpm;notes=practicing?practiceChart():roomChart(run);combo=0;bursts=[];flashes=[0,0,0,0];errorUntil=0;
 startTime=audio.currentTime+.25;state='playing';$('overlay').classList.add('hidden');$('overlay').classList.remove('choosing');$('choices').replaceChildren();
 $('pause').disabled=false;$('difficulty').disabled=true;$('pause').textContent='Ⅱ Pause · Space';
 $('status').textContent=practicing?'Practice: eight notes, no health loss.':'Only a missed note costs health. Wrong taps are free.';setJudgement(practicing?'Match the letter. Wait until the gem reaches its key.':'Four count-in beats. Wait for the first gem to reach its key.');$('combo').innerHTML='0<span>×</span>';
 musicControls(true);document.querySelector('.playfield').scrollIntoView?.({block:'nearest',behavior:reduced?'auto':'smooth'});$('tempo').textContent=run.room.bpm+' BPM · 4/4';$('progress').style.width='0%';syncRun();soundtrack();
}
function setJudgement(text,kind=''){$('judgement').textContent=text;$('judgement').className=kind;}
function updateLayout(){
 const layout=layouts[$('key-layout').value]||layouts.asdf;keys=layout.keys;labels=layout.labels;
 pads.forEach((p,i)=>{p.innerHTML=`<kbd>${labels[i]}</kbd>`;p.setAttribute('aria-label',`Lane ${i+1}: ${labels[i]} or tap`)});
 $('layout-hint').textContent=layout.description;canvas.setAttribute('aria-label',`Press ${labels.join(', ')} as each gem reaches its matching key.`);
}
async function beginPractice(){
 if(['playing','paused','loot','route'].includes(state))return;
 try{document.activeElement?.blur();stopMusic();await ensureAudio();practicing=true;practiceHits=practiceMisses=0;score=combo=0;mode='easy';
 run=newRun(1,'easy');run.room={...run.room,name:'Practice · no damage',bpm:72,endBeat:22};$('score').textContent='000000';prepareRoom();
 }catch(e){$('status').textContent='Could not start practice audio. Try again.';console.error(e)}
}
function finishPractice(){
 stopMusic();state='trained';learned=true;practicing=false;run=null;musicControls(false);$('difficulty').disabled=false;$('pause').disabled=true;
 try{localStorage.setItem('tempo-learned','yes')}catch{}
 showOverlay('PRACTICE COMPLETE',practiceHits>=4?'You’ve got the idea.':'Take it at your pace.',`${practiceHits} / 8 notes hit. ${practiceMisses} missed. Practice never costs health.`, 'Enter the dungeon ↗');
 $('status').textContent='Try practice again above, or enter the dungeon.';setJudgement('Beginner starts at 72 BPM with notes two beats apart.');
}
async function start(){
 document.activeElement?.blur();
 if(state==='paused'){await audio.resume();state='playing';$('overlay').classList.add('hidden');$('pause').textContent='Ⅱ Pause · Space';return}
 if(!['ready','trained','dead','won'].includes(state))return;
 if(!learned&&state==='ready'){await beginPractice();return}
 $('start').disabled=true;
 try{stopMusic();await ensureAudio();
 practicing=false;mode=$('difficulty').value;const seed=crypto.getRandomValues(new Uint32Array(1))[0];run=newRun(seed,mode);score=combo=maxCombo=hits=perfect=0;
 $('score').textContent='000000';updateBest();prepareRoom();
 }catch(e){$('overlay-copy').textContent='Audio could not start. Try a browser with Web Audio support.';console.error(e)}finally{$('start').disabled=false}
}
async function pause(){if(state!=='playing')return;state='paused';await audio.suspend();showOverlay('TAKE A BREATHER','Holding the beat.','Your run is paused. Your party is safe.','Resume run ↗');$('hint').textContent='Space to resume';$('pause').textContent='▶ Resume · Space'}
function showRoutes(){
 state='route';syncRun();
 if(run.floor===4){showOverlay('THE LAST DOOR','The conductor awaits.','Your build is ready. One final battle remains.',null);choiceButton('♛','Enter the sanctum','Defeat the Hollow Conductor to break the curse.',()=>advance('crypt'));}
 else{showOverlay('CHOOSE YOUR NEXT ROOM','Which way down?','The choice changes the enemy, tempo and pattern.',null);
 choiceButton('◇','Quiet crypt','Standard enemy. Slower tempo. No extra healing.',()=>advance('crypt'));
 choiceButton('⚔','Elite chamber','+18 enemy HP, +8 BPM, extra notes. Victory heals 2 HP.',()=>advance('elite'));}
 $('hint').textContent='Your health and relics carry into the next room.';
}
function advance(route){if(enterRoom(run,route)){document.activeElement?.blur();prepareRoom()}}
function conclude(){
 stopMusic();pads.forEach(p=>{p.classList.remove('active');p.classList.remove('missed')});musicControls(false);$('pause').disabled=true;syncRun();
 if(run.status==='loot'){
 state='loot';showOverlay('ENEMY DEFEATED','Take one relic.','Shape your build. The other relics stay in the crypt.',null);
 for(const id of run.choices){const r=relics.find(r=>r.id===id);choiceButton(r.icon,r.name,r.description,()=>{if(chooseRelic(run,id))showRoutes()})}
 $('hint').textContent=`${run.hp} / ${run.maxHp} health · ${run.cleared} of 5 rooms cleared`;return;
 }
 state=run.status;$('difficulty').disabled=false;
 if(score>best()){try{localStorage.setItem('dungeon-tempo-run-best-'+mode,String(score))}catch{}}updateBest();
 const won=state==='won';showOverlay(won?'THE CURSE IS BROKEN':'YOUR RUN HAS ENDED',won?'The dungeon sings.':'The beat goes on.',`${run.cleared} / 5 rooms cleared · ${score.toLocaleString()} points · ${maxCombo} best combo`, 'Start a new run ↗');
 $('hint').textContent=won?'Five rooms. One band. A fresh dungeon awaits.':'Health and relics reset. Each new run brings different encounters.';
 $('status').textContent=won?'Victory! You defeated the Hollow Conductor.':'Fallen in the crypt. Start fresh and try a new build.';
}
function finish(){if(practicing){finishPractice();return}if(run.status!=='combat')return;run.hp=0;run.status='dead';conclude();$('overlay-copy').textContent=`The music ended with ${run.room.hp} enemy HP remaining. ${run.cleared} rooms cleared · ${score.toLocaleString()} points.`;}
function reportMiss(note){
 combo=0;$('combo').innerHTML='0<span>×</span>';note.missedAt=performance.now();
 const lane=note.lane;let impact;
 if(practicing){practiceMisses++;impact='no damage in practice'}else{const lost=hurt(run);impact=lost?'−1 health':'ward blocked the damage';syncRun()}
 const message=`MISSED ${labels[lane]} · ${impact}`;setJudgement(message,'error');feedback(message,'#ff9c9c',1400,true);
 pads[lane].classList.add('missed');setTimeout(()=>pads[lane].classList.remove('missed'),900);
 if(!practicing&&run.status==='dead')conclude();
}
function tap(lane){
 if(state==='calibrating'){recordCalibrationTap(lane);return}
 if(state!=='playing')return;
 const beat=(audio.currentTime-startTime-Number($('offset').value)/1000)/spb;
 if(beat<3.5){setJudgement('Count-in: wait for the first gem. No damage.');return}if(beat>run.room.endBeat)return;
 const n=nearest(notes,lane,beat,spb,hitWindow(run,modes[mode].window));
 flashes[lane]=performance.now()+120;pads[lane].classList.add('active');setTimeout(()=>pads[lane].classList.remove('active'),120);
 if(!n){
 const info=explainTap(notes,lane,beat,spb),message=info.kind==='WRONG KEY'?`WRONG KEY · try ${labels[info.expected]}`:`${info.kind} · ${labels[lane]}`;
 setJudgement(message+' · no damage','error');feedback(message,'#ffcf8a',1000,true);return;
 }
 const rating=judge((n.beat-beat)*spb,hitWindow(run,modes[mode].window));n.state='hit';hits++;combo++;maxCombo=Math.max(combo,maxCombo);if(rating==='Perfect')perfect++;
 score+=({Perfect:100,Great:75,Good:50}[rating])*(1+Math.floor(Math.min(combo,40)/10));
 $('score').textContent=String(score).padStart(6,'0');$('combo').innerHTML=combo+'<span>×</span>';
 if(practicing){practiceHits++;feedback(`${rating} · ${labels[lane]}` ,colors[lane]);setJudgement(`${practiceHits} / 8 hit — nice! Keep matching the keys.`,'success');music.cue(lane);bursts.push({lane,t:performance.now()});return}
 const damage=hitEnemy(run,rating);feedback(`${rating} · ${damage} damage`,colors[lane]);syncRun();
 music.cue(lane);bursts.push({lane,t:performance.now()});
 $('status').textContent=`${run.room.name}: ${run.room.hp} HP remaining.`;if(run.status!=='combat')conclude();
}
async function beginCalibration(){
 if(!['ready','trained','dead','won'].includes(state))return;
 try{document.activeElement?.blur();stopMusic();await ensureAudio()}catch(e){$('status').textContent='Audio could not start. Try again.';console.error(e);return}
 const bpm=90,first=audio.currentTime+.4,clicks=music.metronome({startTime:first,bpm,count:16});
 calib={prev:state,taps:[],clicks:clicks.slice(4),spb:60/bpm};state='calibrating';musicControls(true);$('difficulty').disabled=true;
 showOverlay('CALIBRATE TIMING','Tap along with the click.','Four clicks to listen, then press any lane key or tap a pad on each of the next twelve. Close your eyes if it helps — trust your ears.',null);
 $('hint').textContent='0 / 12 taps';calib.timer=setTimeout(finishCalibration,(first+16*60/bpm+.4-audio.currentTime)*1000);
}
function recordCalibrationTap(lane){
 const t=audio.currentTime;if(t<calib.clicks[0]-calib.spb/2)return;calib.taps.push(t);
 flashes[lane]=performance.now()+120;pads[lane].classList.add('active');setTimeout(()=>pads[lane].classList.remove('active'),120);
 $('hint').textContent=`${Math.min(calib.taps.length,12)} / 12 taps`;
}
function finishCalibration(){
 if(state!=='calibrating')return;stopMusic();clearTimeout(calib.timer);
 const result=calibrate(calib.taps,calib.clicks,calib.spb),taps=calib.taps.length;state=calib.prev;calib=null;musicControls(false);$('difficulty').disabled=false;
 const next=state==='ready'&&!learned?'Practice first ↗':['dead','won'].includes(state)?'Start a new run ↗':'Enter the dungeon ↗';
 if(!result){showOverlay('CALIBRATION','Not enough taps landed.',`${taps} taps, too few near a click. Your offset is unchanged — try again from the sidebar.`,next);return}
 setOffset(result.offset);
 const why=result.offset>0?`You hear the beat about ${result.offset} ms late, so hits now allow for it.`:result.offset<0?`You tap about ${-result.offset} ms ahead of the beat, so hits now allow for it.`:'Your timing is spot on. No adjustment needed.';
 showOverlay('CALIBRATION COMPLETE',`Offset set to ${result.offset>0?'+':''}${result.offset} ms`,why+(result.spread>45?' Your taps were uneven; run it again for a steadier reading.':''),next);
 $('hint').textContent=`${result.count} taps measured · ±${result.spread} ms spread`;
}
function setOffset(ms){$('offset').value=ms;$('offset-value').textContent=$('offset').value+' ms';try{localStorage.setItem('tempo-offset',String(ms))}catch{}}
try{const saved=localStorage.getItem('tempo-offset');if(saved&&Number.isFinite(Number(saved)))setOffset(Number(saved))}catch{}
function feedback(text,color,duration=450,error=false){const now=performance.now();if(!error&&now<errorUntil)return;if(error)errorUntil=now+duration;$('feedback').textContent=text;$('feedback').style.color=color;feedbackUntil=now+duration}
function draw(now){const beat=state==='playing'||state==='paused'?(audio.currentTime-startTime)/spb:lastBeat;lastBeat=beat;g.clearRect(0,0,640,560);g.imageSmoothingEnabled=false;
// The band's little stone stage, built from Kenney's 16px tiles.
g.globalAlpha=.5;for(let x=0;x<20;x++){sprite(14,x*32,5,32);sprite(36,x*32,37,32)}g.globalAlpha=1;
const pulse=reduced?0:Math.max(0,1-((Math.max(beat,0)%1)*4));
for(let lane=0;lane<4;lane++){const x=32+lane*144;g.fillStyle=lane%2?'#1c2330':'#19212b';g.fillRect(x,83,144,390);g.strokeStyle='#ffffff07';g.strokeRect(x,83,144,390);g.globalAlpha=.04+pulse*.04;g.fillStyle=colors[lane];g.fillRect(x,83,144,390);g.globalAlpha=1;g.fillStyle=colors[lane];g.globalAlpha=.14;g.beginPath();g.ellipse(x+72,75,34,8,0,0,Math.PI*2);g.fill();g.globalAlpha=1;sprite([96,84,112,121][lane],x+48,20-(reduced?0:pulse*5),48);g.fillStyle=colors[lane];g.globalAlpha=.45;g.fillRect(x+8,466,128,3);g.globalAlpha=1;if(flashes[lane]>now){g.globalAlpha=.2;g.fillRect(x,400,144,110);g.globalAlpha=1}}
g.fillStyle='#8796a4';g.font='10px monospace';g.textAlign='center';
const renderNotes=state==='ready'?chart('normal').slice(0,8):notes;for(const n of renderNotes){if(n.state==='miss'&&now-n.missedAt<900){g.fillStyle='#ff8b83';g.font='bold 34px sans-serif';g.textAlign='center';g.fillText('×',104+n.lane*144,425);continue}if(n.state!=='pending')continue;const distance=n.beat-(state==='ready'?1:beat),y=468-distance*105;if(y<95||y>520)continue;const x=104+n.lane*144;g.fillStyle=colors[n.lane];g.globalAlpha=.14;g.fillRect(x-35,y-17,70,34);g.globalAlpha=1;g.save();g.translate(x,y);g.rotate(Math.PI/4);g.fillRect(-12,-12,24,24);g.fillStyle='#ffffff77';g.fillRect(-7,-7,7,7);g.restore();g.fillStyle='#17202b';g.font='bold 15px sans-serif';g.textAlign='center';g.fillText(labels[n.lane],x,y+5)}
bursts=bursts.filter(p=>now-p.t<400);if(!reduced)for(const p of bursts){const k=(now-p.t)/400;g.globalAlpha=1-k;g.strokeStyle=colors[p.lane];g.beginPath();g.arc(104+p.lane*144,468,20+k*45,0,Math.PI*2);g.stroke();g.globalAlpha=1}
if(state==='playing'){const adjusted=(audio.currentTime-startTime-Number($('offset').value)/1000)/spb;for(const n of notes){if(n.state==='pending'&&(adjusted-n.beat)*spb>hitWindow(run,modes[mode].window)){n.state='miss';combo=0;$('combo').innerHTML='0<span>×</span>';reportMiss(n);if(state!=='playing')break}}$('progress').style.width=Math.max(0,Math.min(100,beat/run.room.endBeat*100))+'%';const remaining=Math.max(0,Math.ceil((run.room.endBeat-beat)*spb));$('time').textContent=`${Math.floor(remaining/60)}:${String(remaining%60).padStart(2,'0')}`;if(beat>=0&&beat<3.5){$('feedback').textContent=String(4-Math.floor(beat));feedbackUntil=now+50}if(state==='playing'&&beat>=run.room.endBeat)finish()}
if(now>feedbackUntil||state!=='playing')$('feedback').textContent='';requestAnimationFrame(draw)}
$('key-layout').onchange=updateLayout;updateLayout();$('practice').onclick=beginPractice;$('skip-practice').onclick=()=>{learned=true;start()};
if(learned){showOverlay('A NEW DUNGEON AWAITS','Find your rhythm.','Beginner has slow notes and generous timing. Practice is always available above.','Enter the dungeon ↗')}
$('preview-track').onclick=previewTrack;$('soundtrack').onchange=()=>{stopMusic();$('track-description').textContent=tracks[$('soundtrack').value].description;};
$('start').onclick=start;$('pause').onclick=()=>state==='paused'?start():pause();pads.forEach((p,i)=>p.addEventListener('pointerdown',e=>{e.preventDefault();tap(i)}));document.addEventListener('keydown',e=>{if(e.target.matches?.('input,select'))return;if(e.repeat)return;const lane=keys.indexOf(e.key.toLowerCase());if(lane>=0){e.preventDefault();tap(lane)}if(e.code==='Space'&&['playing','paused'].includes(state)){e.preventDefault();if(state==='playing')pause();else start()}});document.addEventListener('visibilitychange',()=>{if(document.hidden&&state==='playing')pause()});$('difficulty').onchange=()=>{mode=$('difficulty').value;spb=60/modes[mode].bpm;$('tempo').textContent=modes[mode].bpm+' BPM · 4/4';$('time').textContent='0:'+String(Math.ceil(36*spb)).padStart(2,'0');updateBest()};function volume(){if(master)master.gain.value=muted?0:Number($('volume').value)/100*.65;$('sound').textContent=muted?'Sound off ♫':'Sound on ♫';$('sound').setAttribute('aria-label',muted?'Unmute audio':'Mute audio')}$('volume').oninput=volume;$('sound').onclick=()=>{muted=!muted;volume()};$('offset').oninput=()=>setOffset(Number($('offset').value));$('calibrate').onclick=$('calibrate-bar').onclick=beginCalibration;requestAnimationFrame(draw);
