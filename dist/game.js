import {modes,chart,judge,nearest} from './rhythm.js';
import {Music,tracks} from './music.js';
import {newRun,roomChart,hitEnemy,hurt,chooseRelic,enterRoom,hitWindow,relics} from './expedition.js';
const $=id=>document.getElementById(id), canvas=$('game'), g=canvas.getContext('2d'), colors=['#d7f779','#c7abff','#7cdbd6','#ffb180'];
const art=new Image();art.src='assets/tiny-dungeon.png';
let audio,master,music,previewTimer,startTime=0,notes=[],state='ready',mode='normal',spb=60/108,score=0,combo=0,maxCombo=0,hits=0,perfect=0,feedbackUntil=0,muted=false,bursts=[],flashes=[0,0,0,0],lastBeat=0;
let run=null,lastPenalty=-Infinity;
const keys=['d','f','j','k'],pads=[...document.querySelectorAll('[data-lane]')];
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
function musicControls(playing){$('soundtrack').disabled=playing;$('preview-track').disabled=playing;}
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
 $('health').textContent=`♥ ${run.hp} / ${run.maxHp}`+(run.room.shield?` · ◇ ${run.room.shield}`:'');
 $('health').classList.toggle('run-danger',run.hp<=3);
 $('enemy-name').textContent=run.room.name+(run.room.elite?' · ELITE':'');
 $('enemy-hp').style.width=run.room.hp/run.room.maxHp*100+'%';
 $('enemy-numbers').textContent=`${run.room.hp} / ${run.room.maxHp} HP`;
 $('enemy-sprite').style.backgroundPosition=`-${run.room.sprite%12*48}px -${Math.floor(run.room.sprite/12)*48}px`;
 $('room-title').textContent=run.floor===5?'The final downbeat':`Room ${run.floor} / 5`;
 $('map').innerHTML=Array.from({length:5},(_,i)=>`<span class="${i<run.cleared?'cleared':i===run.floor-1?'current':''}">${i===4?'♛':i+1}</span>`).join('');
 $('relics').innerHTML=run.relics.length?run.relics.map(id=>{const r=relics.find(r=>r.id===id);return `<span class="relic-chip" title="${r.description}">${r.icon} ${r.name}</span>`}).join(''):'Nothing yet. Earn your first victory.';
 $('seed').textContent=`Run ${run.seed.toString(16).toUpperCase()} · ${run.path.map(p=>p==='elite'?'Elite':p==='boss'?'Boss':'Crypt').join(' → ')}`;
}
function showOverlay(label,title,copy,buttonText){
 $('overlay-label').textContent=label;$('overlay-title').textContent=title;$('overlay-copy').textContent=copy;
 $('choices').replaceChildren();$('start').hidden=!buttonText;if(buttonText)$('start').textContent=buttonText;
 $('overlay').classList.remove('hidden');$('overlay').classList.toggle('choosing',!buttonText);$('feedback').textContent='';
}
function choiceButton(icon,title,description,action){
 const button=document.createElement('button');button.className='choice';
 const i=document.createElement('i'),strong=document.createElement('strong'),span=document.createElement('span');
 i.textContent=icon;strong.textContent=title;span.textContent=description;button.append(i,strong,span);button.onclick=action;$('choices').append(button);
}
function prepareRoom(){
 stopMusic();spb=60/run.room.bpm;notes=roomChart(run);combo=0;bursts=[];flashes=[0,0,0,0];lastPenalty=-Infinity;
 startTime=audio.currentTime+.25;state='playing';$('overlay').classList.add('hidden');$('overlay').classList.remove('choosing');$('choices').replaceChildren();
 $('pause').disabled=false;$('difficulty').disabled=true;$('pause').textContent='Ⅱ Pause · Space';
 $('status').textContent='Four beats in. Hit to attack; misses cost health.';$('combo').innerHTML='0<span>×</span>';
 musicControls(true);$('tempo').textContent=run.room.bpm+' BPM · 4/4';$('progress').style.width='0%';syncRun();soundtrack();
}
async function start(){
 document.activeElement?.blur();
 if(state==='paused'){await audio.resume();state='playing';$('overlay').classList.add('hidden');$('pause').textContent='Ⅱ Pause · Space';return}
 if(!['ready','dead','won'].includes(state))return;
 $('start').disabled=true;
 try{stopMusic();await ensureAudio();
 mode=$('difficulty').value;const seed=crypto.getRandomValues(new Uint32Array(1))[0];run=newRun(seed,mode);score=combo=maxCombo=hits=perfect=0;
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
 stopMusic();pads.forEach(p=>p.classList.remove('active'));musicControls(false);$('pause').disabled=true;syncRun();
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
function finish(){if(run.status!=='combat')return;run.hp=0;run.status='dead';conclude();$('overlay-copy').textContent=`The music ended with ${run.room.hp} enemy HP remaining. ${run.cleared} rooms cleared · ${score.toLocaleString()} points.`;}
function takeDamage(){const lost=hurt(run);syncRun();feedback(lost?'−1 health':'Ward blocked it',lost?'#ff9c9c':'#d7f779');if(run.status==='dead')conclude();}
function tap(lane){
 if(state!=='playing')return;
 const beat=(audio.currentTime-startTime-Number($('offset').value)/1000)/spb;
 if(beat<3.5||beat>34.5)return;
 const n=nearest(notes,lane,beat,spb,hitWindow(run,modes[mode].window));
 flashes[lane]=performance.now()+120;pads[lane].classList.add('active');setTimeout(()=>pads[lane].classList.remove('active'),120);
 if(!n){combo=0;$('combo').innerHTML='0<span>×</span>';if(audio.currentTime-lastPenalty>.25){lastPenalty=audio.currentTime;takeDamage()}return}
 const rating=judge((n.beat-beat)*spb,hitWindow(run,modes[mode].window));n.state='hit';hits++;combo++;maxCombo=Math.max(combo,maxCombo);if(rating==='Perfect')perfect++;
 score+=({Perfect:100,Great:75,Good:50}[rating])*(1+Math.floor(Math.min(combo,40)/10));
 $('score').textContent=String(score).padStart(6,'0');$('combo').innerHTML=combo+'<span>×</span>';
 const damage=hitEnemy(run,rating);feedback(`${rating} · ${damage} damage`,colors[lane]);syncRun();
 music.cue(lane);bursts.push({lane,t:performance.now()});
 $('status').textContent=`${run.room.name}: ${run.room.hp} HP remaining.`;if(run.status!=='combat')conclude();
}
function feedback(text,color){$('feedback').textContent=text;$('feedback').style.color=color;feedbackUntil=performance.now()+450}
function draw(now){const beat=state==='playing'||state==='paused'?(audio.currentTime-startTime)/spb:lastBeat;lastBeat=beat;g.clearRect(0,0,800,560);g.imageSmoothingEnabled=false;
// The band's little stone stage, built from Kenney's 16px tiles.
g.globalAlpha=.5;for(let x=0;x<25;x++){sprite(14,x*32,5,32);sprite(36,x*32,37,32)}g.globalAlpha=1;
const pulse=reduced?0:Math.max(0,1-((Math.max(beat,0)%1)*4));
for(let lane=0;lane<4;lane++){const x=112+lane*144;g.fillStyle=lane%2?'#1c2330':'#19212b';g.fillRect(x,83,144,390);g.strokeStyle='#ffffff07';g.strokeRect(x,83,144,390);g.globalAlpha=.04+pulse*.04;g.fillStyle=colors[lane];g.fillRect(x,83,144,390);g.globalAlpha=1;g.fillStyle=colors[lane];g.globalAlpha=.14;g.beginPath();g.ellipse(x+72,75,34,8,0,0,Math.PI*2);g.fill();g.globalAlpha=1;sprite([96,84,112,121][lane],x+48,20-(reduced?0:pulse*5),48);g.fillStyle=colors[lane];g.globalAlpha=.45;g.fillRect(x+8,466,128,3);g.globalAlpha=1;if(flashes[lane]>now){g.globalAlpha=.2;g.fillRect(x,400,144,110);g.globalAlpha=1}}
g.fillStyle='#8796a4';g.font='10px monospace';g.textAlign='center';
const renderNotes=state==='ready'?chart('normal').slice(0,8):notes;for(const n of renderNotes){if(n.state!=='pending')continue;const distance=n.beat-(state==='ready'?1:beat),y=468-distance*105;if(y<95||y>520)continue;const x=184+n.lane*144;g.fillStyle=colors[n.lane];g.globalAlpha=.14;g.fillRect(x-35,y-17,70,34);g.globalAlpha=1;g.save();g.translate(x,y);g.rotate(Math.PI/4);g.fillRect(-12,-12,24,24);g.fillStyle='#ffffff77';g.fillRect(-7,-7,7,7);g.restore()}
bursts=bursts.filter(p=>now-p.t<400);if(!reduced)for(const p of bursts){const k=(now-p.t)/400;g.globalAlpha=1-k;g.strokeStyle=colors[p.lane];g.beginPath();g.arc(184+p.lane*144,468,20+k*45,0,Math.PI*2);g.stroke();g.globalAlpha=1}
if(state==='playing'){const adjusted=(audio.currentTime-startTime-Number($('offset').value)/1000)/spb;for(const n of notes){if(n.state==='pending'&&(adjusted-n.beat)*spb>hitWindow(run,modes[mode].window)){n.state='miss';combo=0;$('combo').innerHTML='0<span>×</span>';takeDamage();if(state!=='playing')break}}$('progress').style.width=Math.max(0,Math.min(100,beat/run.room.endBeat*100))+'%';const remaining=Math.max(0,Math.ceil((run.room.endBeat-beat)*spb));$('time').textContent=`${Math.floor(remaining/60)}:${String(remaining%60).padStart(2,'0')}`;if(beat>=0&&beat<4){$('feedback').textContent=String(4-Math.floor(beat));feedbackUntil=now+50}if(state==='playing'&&beat>=run.room.endBeat)finish()}
if(now>feedbackUntil||state!=='playing')$('feedback').textContent='';requestAnimationFrame(draw)}
$('preview-track').onclick=previewTrack;$('soundtrack').onchange=()=>{stopMusic();$('track-description').textContent=tracks[$('soundtrack').value].description;};
$('start').onclick=start;$('pause').onclick=()=>state==='paused'?start():pause();pads.forEach((p,i)=>p.addEventListener('pointerdown',e=>{e.preventDefault();tap(i)}));document.addEventListener('keydown',e=>{if(e.target.matches?.('input,select'))return;if(e.repeat)return;const lane=keys.indexOf(e.key.toLowerCase());if(lane>=0){e.preventDefault();tap(lane)}if(e.code==='Space'&&['playing','paused'].includes(state)){e.preventDefault();if(state==='playing')pause();else start()}});document.addEventListener('visibilitychange',()=>{if(document.hidden&&state==='playing')pause()});$('difficulty').onchange=()=>{mode=$('difficulty').value;spb=60/modes[mode].bpm;$('tempo').textContent=modes[mode].bpm+' BPM · 4/4';$('time').textContent='0:'+String(Math.ceil(36*spb)).padStart(2,'0');updateBest()};function volume(){if(master)master.gain.value=muted?0:Number($('volume').value)/100*.65;$('sound').textContent=muted?'Sound off ♫':'Sound on ♫';$('sound').setAttribute('aria-label',muted?'Unmute audio':'Mute audio')}$('volume').oninput=volume;$('sound').onclick=()=>{muted=!muted;volume()};$('offset').oninput=()=>{$('offset-value').textContent=$('offset').value+' ms'};requestAnimationFrame(draw);
