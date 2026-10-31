import {modes,chart,judge,nearest} from './rhythm.js';
import {layouts,practiceChart,explainTap,calibrate} from './controls.js';
import {Music,tracks,parts} from './music.js';
import {songs,loadSong,trackerBpm,isTracker} from './tracker.js';
import {FLOORS,newRun,roomChart,makeRoom,hitEnemy,block,enemyHit,enemyFeeds,fleeRoom,enterDoor,hitWindow,relic,traitAt} from './expedition.js';
import {geo,createArena} from './arena.js';
const $=id=>document.getElementById(id), canvas=$('game'), g=canvas.getContext('2d'), colors=['#d7f779','#c7abff','#7cdbd6','#ffb180'];
const art=new Image();art.src='assets/tiny-dungeon.png';
let audio,master,music,previewTimer,startTime=0,notes=[],state='ready',mode='easy',spb=60/72,score=0,combo=0,maxCombo=0,hits=0,perfect=0,feedbackUntil=0,muted=false,bursts=[],flashes=[0,0,0,0],lastBeat=0;
let phase='',silenced=[false,false,false,false],run=null,calib=null,practicing=false,practiceHits=0,practiceMisses=0,errorUntil=0;
let learned=false;try{learned=localStorage.getItem('tempo-learned')==='yes'}catch{}
let keys=layouts.asdf.keys,labels=layouts.asdf.labels;
const pads=[...document.querySelectorAll('[data-lane]')];
const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
const arena=createArena(g,art,colors,reduced);
const live=()=>['playing','paused','slain','fallen'].includes(state);
function best(){try{return Number(localStorage.getItem('dungeon-tempo-run-best-'+mode))||0}catch{return 0}}
function updateBest(){$('best').textContent=best()?best().toLocaleString():'—'}
async function ensureAudio(withSong=true){
 audio??=new (window.AudioContext||window.webkitAudioContext)();await audio.resume();
 if(!master){master=audio.createGain();master.connect(audio.destination);music=new Music(audio,master)}
 master.gain.value=muted?0:Number($('volume').value)/100*.65;
 if(withSong&&isTracker($('soundtrack').value))await loadSong($('soundtrack').value).catch(e=>songFailed(e));
}
// A tracker song that cannot load or render falls back to the synth soundtrack, and says why on screen.
function songFailed(e){console.error(e);const name=songs[$('soundtrack').value]?.name||'That song';$('soundtrack').value='synth';$('track-description').textContent=`${name} could not play here (${e.message}). Playing Neon Catacombs instead.`}
// Tracker songs keep their own tempo, scaled by the room's pace.
const tempoOf=bpm=>isTracker($('soundtrack').value)?trackerBpm($('soundtrack').value,bpm):bpm;
function soundtrack(){music.play({style:$('soundtrack').value,startTime,bpm:run.room.bpm,endBeat:run.room.endBeat,intensity:run.floor});music.calls(notes.filter(n=>n.kind==='call'));}
function stopMusic(){clearTimeout(previewTimer);previewTimer=null;if(music)music.stop();$('preview-track').textContent='▶ Preview track';$('preview-track').setAttribute('aria-pressed','false');}
function musicControls(playing){$('soundtrack').disabled=playing;$('preview-track').disabled=playing;$('key-layout').disabled=playing;$('practice').disabled=$('calibrate').disabled=$('calibrate-bar').disabled=playing||state==='doors';}
async function previewTrack(){
 if(live())return;
 if(previewTimer){stopMusic();return}
 $('preview-track').disabled=true;
 try{await ensureAudio();const bpm=tempoOf(modes[$('difficulty').value].bpm);music.play({style:$('soundtrack').value,startTime:audio.currentTime+.08,bpm,endBeat:36,skipCountIn:true});
 $('preview-track').textContent='■ Stop preview';$('preview-track').setAttribute('aria-pressed','true');previewTimer=setTimeout(stopMusic,32*60/bpm*1000+400);
 }catch(e){$('status').textContent='Audio preview could not start. Try again.';console.error(e)}finally{$('preview-track').disabled=false}
}
function syncRun(){
 if(!run)return;
 $('health').textContent=practicing?'NO DAMAGE':`♥ ${run.hp} / ${run.maxHp}`;
 $('health').classList.toggle('run-danger',!practicing&&run.hp<=3);
 $('enemy-name').textContent=run.room.name+(run.room.elite?' · ELITE':'');
 $('enemy-hp').style.width=run.room.hp/run.room.maxHp*100+'%';
 $('enemy-trait').textContent=practicing?'A practice dummy. It never attacks.':run.room.traitText+(run.room.elite?' Elite: more calls, more hits.':'');
 $('enemy-numbers').textContent=practicing?'Warm-up dummy · just find the beat':`${run.room.hp} / ${run.room.maxHp} HP`;
 $('enemy-sprite').style.backgroundPosition=`-${run.room.sprite%12*48}px -${Math.floor(run.room.sprite/12)*48}px`;
 $('room-title').textContent=practicing?'Safe practice':run.floor===FLOORS?'The final song':`Room ${run.floor} / ${FLOORS}`;
 $('map').innerHTML=Array.from({length:FLOORS},(_,i)=>`<span class="${i<run.cleared?'cleared':i===run.floor-1?'current':''}">${i===FLOORS-1?'♛':i+1}</span>`).join('');
 $('relics').innerHTML=run.relics.length?run.relics.map(id=>{const r=relic(id);return `<span class="relic-chip" title="${r.description}">${r.icon} ${r.name}</span>`}).join(''):'No relics yet. Win a room to earn its reward.';
 const reward=run.reward&&relic(run.reward);
 $('reward').textContent=practicing?'':run.status==='combat'?(reward?`Win this room: ${reward.icon} ${reward.name}`:run.room.boss?'Win this room: break the curse':'No reward in this room'):'';
 $('seed').textContent=`Run ${run.seed.toString(16).toUpperCase()} · ${run.path.map(p=>({elite:'Elite',boss:'Boss',rest:'Camp'})[p]||'Crypt').join(' → ')}`;
}
function showOverlay(label,title,copy,buttonText){
 $('overlay-label').textContent=label;$('overlay-title').textContent=title;$('overlay-copy').textContent=copy;
 $('skip-practice').hidden=true;$('choices').replaceChildren();$('start').hidden=!buttonText;if(buttonText)$('start').textContent=buttonText;
 $('overlay').classList.remove('hidden');$('overlay').classList.toggle('choosing',!buttonText);$('feedback').textContent='';
}
function choiceButton(icon,title,description,action,kind=''){
 const button=document.createElement('button');button.className='choice '+kind;
 const i=document.createElement('i'),strong=document.createElement('strong'),span=document.createElement('span');
 i.textContent=icon;strong.textContent=title;span.textContent=description;button.append(i,strong,span);button.onclick=action;$('choices').append(button);
}
function prepareRoom(){
 stopMusic();
 // Tracker stems are rendered before the start time is set, so the song can't start late.
 const style=$('soundtrack').value;if(isTracker(style))try{if(!songs[style].data)throw new Error('the song did not load');music.prepare({style,bpm:tempoOf(run.room.bpm),endBeat:run.room.endBeat,intensity:run.floor})}catch(e){songFailed(e)}
 run.room.bpm=tempoOf(run.room.bpm);spb=60/run.room.bpm;notes=practicing?practiceChart():roomChart(run,$('soundtrack').value);silenced=[false,false,false,false];phase='';combo=0;bursts=[];flashes=[0,0,0,0];errorUntil=0;
 startTime=audio.currentTime+.25;state='playing';$('overlay').classList.add('hidden');$('overlay').classList.remove('choosing');$('choices').replaceChildren();
 $('pause').disabled=false;$('difficulty').disabled=true;$('pause').textContent='Ⅱ Pause · Space';arena.reset(run.room,performance.now());
 $('status').textContent=practicing?'Practice: eight notes, no health loss.':`${run.room.name} blocks the way.`;setJudgement(practicing?'Match the letter. Wait until the gem reaches its key.':'Four count-in beats. Your band attacks first.');$('combo').innerHTML='0<span>×</span>';
 musicControls(true);document.querySelector('.playfield').scrollIntoView?.({block:'nearest',behavior:reduced?'auto':'smooth'});$('tempo').textContent=Math.round(run.room.bpm)+' BPM · 4/4';$('progress').style.width='0%';syncRun();soundtrack();
}
function setJudgement(text,kind=''){$('judgement').textContent=text;$('judgement').className=kind;}
function updateLayout(){
 const layout=layouts[$('key-layout').value]||layouts.asdf;keys=layout.keys;labels=layout.labels;
 pads.forEach((p,i)=>{p.innerHTML=`<kbd>${labels[i]}</kbd>`;p.setAttribute('aria-label',`Lane ${i+1}: ${labels[i]} or tap`)});
 $('layout-hint').textContent=layout.description;canvas.setAttribute('aria-label',`Press ${labels.join(', ')} as each gem reaches its matching key.`);
}
function setPace(value){$('difficulty').value=value;mode=value;spb=60/modes[mode].bpm;$('tempo').textContent=modes[mode].bpm+' BPM · 4/4';updateBest()}
async function beginPractice(){
 if(live()||state==='doors')return;
 try{document.activeElement?.blur();stopMusic();await ensureAudio();practicing=true;practiceHits=practiceMisses=0;score=combo=0;mode='easy';
 run=newRun(1,'easy');run.room={...run.room,name:'Practice dummy',sprite:82,trait:'',traitText:'',bpm:72,endBeat:22};$('score').textContent='000000';prepareRoom();
 }catch(e){$('status').textContent='Could not start practice audio. Try again.';console.error(e)}
}
function finishPractice(){
 stopMusic();state='trained';learned=true;practicing=false;run=null;musicControls(false);$('difficulty').disabled=false;$('pause').disabled=true;arena.idle(46);
 try{localStorage.setItem('tempo-learned','yes')}catch{}
 const ready=practiceHits>=5;setPace(ready?'normal':'easy');
 showOverlay('PRACTICE COMPLETE',ready?'You’ve got the idea.':'Take it at your pace.',`${practiceHits} / 8 notes hit. ${ready?'Pace set to In the groove (108 BPM).':'Pace set to Beginner.'} Change it any time in Setup.`, 'Enter the dungeon ↗');
 $('status').textContent='Try practice again above, or enter the dungeon.';setJudgement('Eight rooms, then the Conductor. Your band attacks; the enemy calls, you echo to block.');
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
// One decision per level: each door names the next foe and what beating it earns.
function showDoors(label,title,copy){
 state='doors';syncRun();showOverlay(label,title,copy,null);
 run.doors.forEach((door,i)=>{
  const go=async()=>{document.activeElement?.blur();await ensureAudio();const heal=door.heal;if(!enterDoor(run,i))return;if(run.status==='combat')prepareRoom();else showDoors('CAMPFIRE','You rest by the fire.',`+${heal} health (${run.hp} / ${run.maxHp}). The way down continues.`)};
  if(door.type==='boss')return choiceButton('♛','The Hollow Conductor','The final song: three movements, longer and faster. It does not flee.',go,'boss');
  if(door.type==='rest')return choiceButton('☾','Campfire',`No fight, no relic. Heal ${door.heal} (${run.hp} / ${run.maxHp} now).`,go,'rest');
  const r=relic(door.relic),foe=makeRoom({...run,floor:run.floor+1},door.type==='elite'?'elite':'crypt');
  choiceButton(r.icon,`${door.type==='elite'?'Elite · ':''}${foe.name}`,`Win: ${r.name}. ${r.description}${door.type==='elite'?' Also heal 3. Tougher, faster, more attacks.':''}`,go,door.type);
 });
 $('hint').textContent=`${run.hp} / ${run.maxHp} health · ${run.cleared} of ${FLOORS} rooms cleared`;
}
function conclude(){
 stopMusic();pads.forEach(p=>{p.classList.remove('active');p.classList.remove('missed')});$('pause').disabled=true;
 if(run.status==='doors'){
  const found=run.found&&relic(run.found);musicControls(false);
  if(found)showDoors('ENEMY DEFEATED',`${found.icon} ${found.name}`,`${found.description} Now pick your next door.`);
  else showDoors('ENEMY DEFEATED','The way is clear.','Pick your next door.');
  return;
 }
 state=run.status;musicControls(false);$('difficulty').disabled=false;
 if(score>best()){try{localStorage.setItem('dungeon-tempo-run-best-'+mode,String(score))}catch{}}updateBest();
 const won=state==='won';showOverlay(won?'THE CURSE IS BROKEN':'YOUR RUN HAS ENDED',won?'The dungeon sings.':'The beat goes on.',`${run.cleared} / ${FLOORS} rooms cleared · ${score.toLocaleString()} points · ${maxCombo} best combo`, 'Start a new run ↗');
 $('hint').textContent=won?'Eight rooms. One band. A fresh dungeon awaits.':'Health and relics reset. Each new run brings different encounters.';
 $('status').textContent=won?'Victory! You defeated the Hollow Conductor.':'Fallen in the crypt. Start fresh and try a new build.';
}
// The room is over: let the kill or the fall play out before the overlay appears.
function settle(){
 const now=performance.now();
 if(run.status==='dead'){state='fallen';jolt('.playfield','shake',420);setTimeout(conclude,700);return}
 state='slain';arena.die(now);syncRun();setJudgement(`${run.room.name} is defeated!`,'success');feedback('VICTORY','#ffd27a',900);setTimeout(conclude,950);
}
function finish(){
 if(practicing){finishPractice();return}if(run.status!=='combat')return;
 const name=run.room.name,left=run.room.hp,damage=fleeRoom(run);
 if(run.status==='doors'){stopMusic();musicControls(false);$('pause').disabled=true;showDoors('THE SONG ENDED',`${name} got away.`,`It struck as it fled (−${damage} health) and took the reward with it. Pick your next door.`);return}
 conclude();$('overlay-copy').textContent=run.room.boss?`The final note faded with the Conductor still standing (${left} HP). ${run.cleared} rooms cleared · ${score.toLocaleString()} points.`:`${name}'s parting blow finished you. ${run.cleared} rooms cleared · ${score.toLocaleString()} points.`;
}
function cuePhase(p){
 document.querySelector('.enemy-card')?.classList?.toggle('winding',p==='call');
 if(p==='call'){feedback('LISTEN…','#ff8b83',900);setJudgement(`${run.room.name} is winding up. Listen to its rhythm: you echo it next bar to block.`,'error')}
 else if(p==='guard'){feedback('BLOCK!','#9fd8ff',700);setJudgement('Echo the call: hit the red shields to block.','')}
 else if(p==='attack'){feedback('ATTACK!',colors[0],700);setJudgement('Your band attacks: every gem is a note of the song.','success')}
}
function jolt(selector,cls,ms){if(reduced)return;const el=document.querySelector(selector);if(!el?.classList)return;el.classList.remove(cls);void el.offsetWidth;el.classList.add(cls);setTimeout(()=>el.classList.remove(cls),ms)}
function reportMiss(note){
 combo=0;$('combo').innerHTML='0<span>×</span>';note.missedAt=performance.now();
 const lane=note.lane,now=performance.now();let message;
 if(practicing)practiceMisses++;
 if(note.kind==='guard'){
  const lost=enemyHit(run,note),saved=run.triggers;music.strike();jolt('.playfield','shake',320);jolt('.enemy-card','lunge',320);arena.strike(lane,lost?`−${lost}`:'SAVED',now);
  message=lost?`${run.room.name} hits you · −${lost} health`:`${saved[0]||'Something'} saved you`;
  if(saved.length&&lost)message+=` · ${saved.join(' · ')}`;
  setJudgement(message+'. Echo its call to block.','error');
 }else{
  if(!silenced[lane]){silenced[lane]=true;music.setLane(lane,false)}
  message=`MISSED ${labels[lane]} · ${parts[lane].name.toLowerCase()} dropped out`;setJudgement(message+'. Hit that lane to bring it back.','error');
 }
 if(!practicing){const fed=enemyFeeds(run);if(fed){message+=` · it feeds +${fed}`;arena.heal(`+${fed}`,now)}syncRun()}
 feedback(message,'#ff9c9c',1400,true);
 pads[lane].classList.add('missed');setTimeout(()=>pads[lane].classList.remove('missed'),900);
 if(!practicing&&run.status==='dead')settle();
}
function stray(lane){
 const lost=combo>0;combo=0;$('combo').innerHTML='0<span>×</span>';
 const drop=mode!=='easy'&&!silenced[lane];if(drop){silenced[lane]=true;music.setLane(lane,false)}
 return (lost?' · combo lost':'')+(drop?` · ${parts[lane].name.toLowerCase()} dropped out`:'');
}
function tap(lane){
 if(state==='calibrating'){recordCalibrationTap(lane);return}
 if(state!=='playing')return;
 const beat=(audio.currentTime-startTime-Number($('offset').value)/1000)/spb,now=performance.now();
 if(beat<3.5){setJudgement('Count-in: wait for the first gem. No damage.');return}if(beat>run.room.endBeat)return;
 const n=nearest(notes,lane,beat,spb,hitWindow(run,modes[mode].window));
 flashes[lane]=now+120;pads[lane].classList.add('active');setTimeout(()=>pads[lane].classList.remove('active'),120);
 // A tap with no gem near it is a stray note: it breaks the combo, and on Normal and Hard that bandmate's part drops out.
 if(!n&&phase==='call'&&!practicing){const cost=stray(lane);setJudgement('Just listen during the call. Echo it next bar to block.'+cost,'error');feedback('LISTEN…','#ff8b83',700,true);return}
 if(!n){
 const info=explainTap(notes,lane,beat,spb),message=info.kind==='WRONG KEY'?`WRONG KEY · try ${labels[info.expected]}`:`${info.kind} · ${labels[lane]}`;
 const cost=practicing?' · no damage':stray(lane);setJudgement(message+cost,'error');feedback(message,'#ffcf8a',1000,true);return;
 }
 const rating=judge((n.beat-beat)*spb,hitWindow(run,modes[mode].window));n.state='hit';hits++;combo++;maxCombo=Math.max(combo,maxCombo);if(rating==='Perfect')perfect++;
 score+=({Perfect:100,Great:75,Good:50}[rating])*(1+Math.floor(Math.min(combo,40)/10));
 $('score').textContent=String(score).padStart(6,'0');$('combo').innerHTML=combo+'<span>×</span>';bursts.push({lane,t:now});
 if(n.kind==='guard'){
  music.block(lane);arena.block(lane,now);const struck=block(run,rating);
  if(struck)arena.bolt(lane,'#9fd8ff',`${struck}`,now);
  feedback(struck?`BLOCKED · Parry blade strikes ${struck}`:`BLOCKED · ${rating}`,'#9fd8ff');setJudgement('Blocked! Echo the rest of the call.','success');syncRun();if(run.status!=='combat')settle();return;
 }
 const rejoined=silenced[lane];if(rejoined){silenced[lane]=false;music.setLane(lane,true)}
 if(practicing){practiceHits++;feedback(`${rating} · ${labels[lane]}` ,colors[lane]);setJudgement(`${practiceHits} / 8 hit — nice! Keep matching the keys.`,'success');music.cue(lane);arena.bolt(lane,colors[lane],rating,now);return}
 const damage=hitEnemy(run,rating,{lane,beat:n.beat,combo,rejoined}),triggers=run.triggers;
 if(damage){arena.bolt(lane,colors[lane],String(damage),now);jolt('.enemy-card','hurt',180)}
 else{arena.glance(lane,now);setJudgement('Armored: only Great or Perfect hits get through.','error')}
 for(const t of triggers)arena.note(t,colors[lane],now);
 feedback(damage?`${rating} · ${damage} damage${triggers.length?' · '+triggers.join(' · '):''}`:`${rating} · glances off the armor`,damage?colors[lane]:'#aab9c5');
 syncRun();if(rejoined)setJudgement(`${parts[lane].name} back in the mix. Keep it going!`,'success');
 music.cue(lane);
 $('status').textContent=`${run.room.name}: ${run.room.hp} HP remaining.`;if(run.status!=='combat')settle();
}
async function beginCalibration(){
 if(!['ready','trained','dead','won'].includes(state))return;
 try{document.activeElement?.blur();stopMusic();await ensureAudio(false)}catch(e){$('status').textContent='Audio could not start. Try again.';console.error(e);return}
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
function gem(n,x,y){
 if(n.kind==='guard'){g.fillStyle='#ff8b83';g.globalAlpha=.16;g.fillRect(x-35,y-17,70,34);g.globalAlpha=1;g.fillStyle='#2a1a20';g.strokeStyle='#ff8b83';g.lineWidth=3;g.beginPath();g.moveTo(x-15,y-15);g.lineTo(x+15,y-15);g.lineTo(x+15,y+2);g.quadraticCurveTo(x+15,y+14,x,y+19);g.quadraticCurveTo(x-15,y+14,x-15,y+2);g.closePath();g.fill();g.stroke();g.lineWidth=1;g.fillStyle='#ffb1a8';g.font='bold 15px sans-serif';g.textAlign='center';g.fillText(labels[n.lane],x,y+6);return}
 g.fillStyle=colors[n.lane];g.globalAlpha=.14;g.fillRect(x-35,y-17,70,34);g.globalAlpha=1;g.save();g.translate(x,y);g.rotate(Math.PI/4);g.fillRect(-12,-12,24,24);g.fillStyle='#ffffff77';g.fillRect(-7,-7,7,7);g.restore();g.fillStyle='#17202b';g.font='bold 15px sans-serif';g.textAlign='center';g.fillText(labels[n.lane],x,y+5);
}
function draw(now){
 const beat=live()?(audio.currentTime-startTime)/spb:lastBeat;lastBeat=beat;g.clearRect(0,0,geo.W,geo.H);g.imageSmoothingEnabled=false;
 const pulse=reduced?0:Math.max(0,1-((Math.max(beat,0)%1)*4));
 arena.backdrop(now,pulse);
 const fighting=run&&live(),winding=fighting&&!practicing&&run.room.plan?.[Math.floor((beat-4)/4)]==='call';
 arena.enemySprite(now,beat,{winding,hpRatio:fighting&&!practicing?run.room.hp/run.room.maxHp:null});
 arena.lanes(now,pulse,flashes,silenced);
 // The enemy's call: each telegraphed beat lunges, beams at its lane and flashes it red.
 if(live())for(const n of notes){if(n.kind!=='call')continue;const since=beat-n.beat;if(!n.fired&&since>=0&&since<.5){n.fired=true;arena.call(n.lane,now)}if(since<-.02||since>.4)continue;const x=geo.laneX(n.lane),k=1-since/.4;g.globalAlpha=.35*k;g.fillStyle='#ff5a52';g.fillRect(x,geo.top,144,geo.hit+30-geo.top);g.globalAlpha=k;g.fillStyle='#ff8b83';g.font='bold 40px sans-serif';g.textAlign='center';g.fillText('!',x+72,geo.top+60);g.globalAlpha=1}
 if(state==='playing'&&!practicing&&run.room.plan){const p=run.room.plan[Math.floor((beat-4)/4)]||'';if(beat>=4&&p!==phase){phase=p;cuePhase(phase);const bar=Math.floor((beat-4)/4);if(run.room.acts&&p==='attack'&&bar%8===0&&bar>0){const act={armored:'armor up',webs:'webs',frenzy:'frenzy'}[traitAt(run.room,beat)];setJudgement(`The Conductor's next movement: ${act}!`,'error');arena.note(act.toUpperCase(),'#ff8b83',now)}}}
 const renderNotes=state==='ready'||state==='trained'?chart('normal').slice(0,8):notes;
 for(const n of renderNotes){
  if(n.state==='miss'&&now-n.missedAt<900){g.fillStyle='#ff8b83';g.font='bold 34px sans-serif';g.textAlign='center';g.fillText('×',geo.laneC(n.lane),geo.hit-40);continue}
  if(n.state!=='pending')continue;const distance=n.beat-(live()?beat:1),y=geo.hit-distance*geo.px;if(y<geo.top+10||y>geo.hit+50)continue;const x=geo.laneC(n.lane);
  if(n.webbed&&distance>1.4){g.globalAlpha=.35;g.strokeStyle='#cfd6de';g.lineWidth=1;for(let k=0;k<3;k++){g.beginPath();g.arc(x,y,8+k*7,0,Math.PI*2);g.stroke()}g.globalAlpha=1;continue}
  gem(n,x,y);
 }
 bursts=bursts.filter(p=>now-p.t<400);if(!reduced)for(const p of bursts){const k=(now-p.t)/400;g.globalAlpha=1-k;g.strokeStyle=colors[p.lane];g.beginPath();g.arc(geo.laneC(p.lane),geo.hit,20+k*45,0,Math.PI*2);g.stroke();g.globalAlpha=1}
 const hops=[0,1,2,3].map(lane=>bursts.filter(p=>p.lane===lane).reduce((h,p)=>Math.max(h,10*(1-(now-p.t)/400)),0));
 arena.band(now,pulse,silenced,hops);
 arena.effects(now);
 if(state==='playing'){const adjusted=(audio.currentTime-startTime-Number($('offset').value)/1000)/spb;for(const n of notes){if(n.state==='pending'&&(adjusted-n.beat)*spb>hitWindow(run,modes[mode].window)){n.state='miss';reportMiss(n);if(state!=='playing')break}}$('progress').style.width=Math.max(0,Math.min(100,beat/run.room.endBeat*100))+'%';const remaining=Math.max(0,Math.ceil((run.room.endBeat-beat)*spb));$('time').textContent=`${Math.floor(remaining/60)}:${String(remaining%60).padStart(2,'0')}`;if(beat>=0&&beat<3.5){$('feedback').textContent=String(4-Math.floor(beat));feedbackUntil=now+50}if(state==='playing'&&beat>=run.room.endBeat)finish()}
 if(now>feedbackUntil||!['playing','slain'].includes(state))$('feedback').textContent='';requestAnimationFrame(draw)}
$('key-layout').onchange=updateLayout;updateLayout();$('practice').onclick=beginPractice;$('skip-practice').onclick=()=>{learned=true;start()};
let savedPace=null;try{savedPace=localStorage.getItem('tempo-pace')}catch{}setPace(modes[savedPace]?savedPace:learned?'normal':'easy');
if(learned){showOverlay('A NEW DUNGEON AWAITS','Find your rhythm.','Eight rooms and a boss. Your band attacks on the music; when the enemy calls, echo it to block.','Enter the dungeon ↗')}
$('preview-track').onclick=previewTrack;$('soundtrack').onchange=()=>{stopMusic();const v=$('soundtrack').value;$('track-description').textContent=(tracks[v]||songs[v]).description;if(isTracker(v))loadSong(v).catch(e=>{$('status').textContent='That song could not load.';console.error(e)})};
$('start').onclick=start;$('pause').onclick=()=>state==='paused'?start():pause();pads.forEach((p,i)=>p.addEventListener('pointerdown',e=>{e.preventDefault();tap(i)}));document.addEventListener('keydown',e=>{if(e.target.matches?.('input,select'))return;if(e.repeat)return;const lane=keys.indexOf(e.key.toLowerCase());if(lane>=0){e.preventDefault();tap(lane)}if(e.code==='Space'&&['playing','paused'].includes(state)){e.preventDefault();if(state==='playing')pause();else start()}});document.addEventListener('visibilitychange',()=>{if(document.hidden&&state==='playing')pause()});$('difficulty').onchange=()=>{setPace($('difficulty').value);try{localStorage.setItem('tempo-pace',mode)}catch{}};function volume(){if(master)master.gain.value=muted?0:Number($('volume').value)/100*.65;$('sound').textContent=muted?'Sound off ♫':'Sound on ♫';$('sound').setAttribute('aria-label',muted?'Unmute audio':'Mute audio')}$('volume').oninput=volume;$('sound').onclick=()=>{muted=!muted;volume()};$('offset').oninput=()=>setOffset(Number($('offset').value));$('calibrate').onclick=$('calibrate-bar').onclick=beginCalibration;requestAnimationFrame(draw);
