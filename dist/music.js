// Original eight-bar arrangements. Everything is scheduled on the game's audio clock.
import {songs,trackerScore,stemsFor} from './tracker.js';
export const tracks={
 synth:{name:'Neon Catacombs',description:'Dark synthwave · pulsing bass, wide chords, backbeat snare'},
 funk:{name:'Graveyard Shift',description:'Dungeon funk · electric keys, syncopated bass, shuffled hats'},
 chip:{name:'8-Bit Afterlife',description:'Retro chiptune · pulse lead, triangle bass, tiny drum machine'}
};
// The band: each lane plays one part of the arrangement. Hats and the count-in stay on regardless.
export const parts=[{name:'Drums',player:'Knight',kinds:['kick','snare']},{name:'Melody',player:'Mage',kinds:['lead','harmony']},{name:'Bass',player:'Rogue',kinds:['bass']},{name:'Chords',player:'Skeleton',kinds:['pad','keys','arp']}];
// Bus levels bring melody, bass and chords up to the drums so any part dropping out is audible.
const laneLevels={synth:[.7,2.4,1.5,2.2],funk:[.7,2.4,1.5,1],chip:[.75,3.6,1.6,14]};
export const laneOf=kind=>parts.findIndex(p=>p.kinds.includes(kind));
const chord=(root,...notes)=>({root,notes});
const Dm=chord(38,62,65,69,76),Bb=chord(34,62,65,69,72),F=chord(41,60,64,69,67),C=chord(36,60,64,67,74),Gm=chord(43,62,65,67,70),A7=chord(45,61,64,69,67);
// Each room is a short song: verse (two melodies, alternating by floor), chorus, and a darker third section for the boss.
const sections={
 A:{chords:[Dm,Dm,Bb,Bb,F,F,C,C],melody:[
  [[0,74,.65],[1.5,77,.35],[2,81,.8],[3.5,77,.35]],[[.5,76,.6],[2,74,1.4]],[[0,77,.8],[1.5,74,.4],[2.5,72,1]],[[.5,69,.7],[2,72,.5],[3,74,.7]],
  [[0,76,.7],[1.5,79,.4],[2,81,1.2]],[[.5,79,.7],[2,76,.6],[3.5,72,.35]],[[0,74,.8],[1.5,72,.4],[2.5,67,.8]],[[0,69,.6],[1,72,.6],[2,74,1.5]]]},
 A2:{chords:[Dm,Dm,Bb,Bb,F,F,C,C],melody:[
  [[0,69,.4],[.5,72,.4],[1,74,.9],[2,77,.4],[2.5,76,.4],[3,74,.9]],[[0,72,.9],[1.5,69,.4],[2,74,1.8]],[[0,74,.4],[.5,77,.4],[1,81,.9],[2,79,.4],[2.5,77,.4],[3,74,.9]],[[.5,77,.4],[1,74,.9],[2,72,.9],[3,70,.9]],
  [[0,72,.9],[1,76,.4],[1.5,77,.4],[2,79,.9],[3,81,.9]],[[0,84,1.4],[2,81,.4],[2.5,79,.4],[3,77,.9]],[[0,76,.9],[1,79,.4],[1.5,76,.4],[2,72,1.4]],[[0,74,.4],[.5,76,.4],[1,77,.4],[1.5,79,.4],[2,76,1.8]]]},
 B:{chords:[Gm,Bb,F,C,Gm,Bb,A7,A7],melody:[
  [[0,79,.4],[.5,77,.4],[1,74,.4],[1.5,70,.4],[2,74,.9],[3,77,.9]],[[0,77,.6],[1,74,.4],[1.5,72,.4],[2,74,1.8]],[[0,72,.4],[.5,74,.4],[1,77,.9],[2.5,81,.4],[3,79,.9]],[[0,79,1.4],[2,76,.4],[2.5,74,.4],[3,72,.9]],
  [[0,74,.4],[.5,77,.4],[1,79,.4],[1.5,82,.4],[2,81,.9],[3,79,.4],[3.5,77,.4]],[[0,77,.9],[1,74,.9],[2,77,.4],[2.5,81,.4],[3,86,.9]],[[0,85,1.4],[2,81,.4],[2.5,79,.4],[3,76,.9]],[[0,73,.9],[1,76,.9],[2,79,.4],[2.5,81,.4],[3,85,.9]]]},
 C:{chords:[Dm,C,Bb,A7,Dm,C,Bb,A7],melody:[
  [[0,74,.4],[.75,77,.4],[1.5,81,.4],[2,79,.4],[2.5,77,.4],[3,76,.9]],[[0,76,.9],[1,72,.4],[1.5,76,.4],[2,79,1.4]],[[0,77,.4],[.75,74,.4],[1.5,70,.4],[2,74,.4],[2.5,77,.4],[3,81,.9]],[[0,81,1.4],[2,79,.4],[2.5,77,.4],[3,73,.9]],
  [[0,74,.4],[.75,77,.4],[1.5,81,.4],[2,79,.4],[2.5,77,.4],[3,76,.9]],[[0,76,.9],[1,72,.4],[1.5,76,.4],[2,79,1.4]],[[0,77,.4],[.75,74,.4],[1.5,70,.4],[2,74,.4],[2.5,77,.4],[3,81,.9]],[[0,74,.4],[.5,73,.4],[1,74,.4],[1.5,76,.4],[2,77,.4],[2.5,79,.4],[3,81,.9]]]}
};
// Every floor is in its own key; the boss returns home to D minor.
const keys=[0,3,-2,5,1,-3,4,0];
export function song(endBeat=36,intensity=1){
 const count=Math.max(0,Math.ceil((endBeat-4)/4)),full=Math.floor((endBeat-4)/4),order=full>16?'ABC':full>8?'AB':'A',shift=keys[(Math.max(1,intensity)-1)%8];
 const bars=Array.from({length:count},(_,bar)=>{const name=order[Math.min(order.length-1,Math.floor(bar/8))],sec=sections[name==='A'&&intensity%2===0?'A2':name],i=bar%8;
  return {name,i,chord:sec.chords[i],melody:sec.melody[i],start:i===0&&bar<full,turn:i===7&&bar+1<full}});
 return {bars,shift};
}
// A third below the melody, preferring a chord tone.
const third=(n,c)=>{const tones=[c.root,...c.notes].map(x=>x%12),scale=[2,4,5,7,9,10,0];return [n-3,n-4].find(x=>tones.includes(x%12))??[n-3,n-4].find(x=>scale.includes(x%12))??n-3};
const grooves={
 kick:{synth:{A:[0,1,2,3],B:[0,1,2,3,3.5],C:[0,.75,1.5,2,3,3.5]},funk:{A:[0,1.5,2.75],B:[0,.75,2,2.75],C:[0,1.5,2,2.75,3.5]},chip:{A:[0,2,2.75],B:[0,.75,2,2.75],C:[0,.5,1,2,2.5,3]}},
 bass:{synth:{A:[[0,0],[.75,0],[1.5,0],[2,0],[2.75,0],[3.5,12]],B:[[0,0],[.5,12],[1,0],[1.5,12],[2,0],[2.5,12],[3,0],[3.5,12]],C:[[0,0],[.5,0],[.75,7],[1.5,0],[2,12],[2.5,0],[3,10],[3.5,7]]},
  funk:{A:[[0,0],[.75,12],[1.5,0],[2,7],[2.5,10],[3.25,12]],B:[[0,0],[.5,0],[.75,12],[1.5,7],[2.25,0],[2.5,12],[3,10],[3.5,7]],C:[[0,0],[1,12],[1.5,7],[2,0],[3,12],[3.25,5],[3.5,7]]},
  chip:{A:[0,.5,1,1.5,2,2.5,3,3.5].map(b=>[b,b%1?12:0]),B:[0,.5,1,1.5,2,2.5,3,3.5].map((b,i)=>[b,[0,12,7,12][i%4]]),C:[0,.5,.75,1,1.5,2,2.5,2.75,3,3.5].map((b,i)=>[b,i%2?12:0])}}
};
export function compose(style='synth',endBeat=36,intensity=1){
 if(songs[style])return trackerScore(style,endBeat,intensity);
 if(!grooves.kick[style])style='synth';
 const events=[],{bars,shift}=song(endBeat,intensity);const add=(kind,beat,note=0,length=.2,velocity=1,pan=0)=>{if(beat<endBeat)events.push({kind,beat,note:note&&note+shift,length,velocity,pan})};
 for(let b=0;b<4;b++)events.push({kind:'click',beat:b,note:b===0?84:79,length:.08,velocity:.5,pan:0});
 bars.forEach(({name,i,chord:c,melody,start,turn},bar)=>{
  const at=4+bar*4,next=bars[bar+1]?.chord,sec=name;
  // Drums: a groove per section, a crash on each new section and a fill into the next.
  if(start)add('crash',at,0,1,bar?1:.7);
  grooves.kick[style][sec].filter(b=>!turn||b<3).forEach(b=>add('kick',at+b,0,.3,style==='chip'?.75:1));
  [1,3].forEach(b=>add('snare',at+b,0,.18,style==='funk'?.9:.8));
  if(turn){[3.25,3.5,3.75].forEach((b,j)=>add('snare',at+b,0,.1,.4+j*.15,(j-1)*.3));add('riser',at,0,4,.8)}
  else if(style==='funk'&&(bar%2||sec!=='A'))add('snare',at+2.75,0,.09,.22,-.15);
  if(sec==='C')for(let s=0;s<16;s++)add('hat',at+s*.25,0,.035,s%2?.22:.4,s%2?.3:-.2);
  else for(let eighth=0;eighth<8;eighth++){const open=sec==='B'&&style!=='chip'&&eighth%2;add('hat',at+eighth*.5+(style==='funk'&&eighth%2?.065:0),0,open?.3:eighth===7?.15:.045,open?.32:eighth%2?.5:.28,eighth%2?.25:-.2)}
  // Bass, with a chromatic approach into the next chord.
  const bass=grooves.bass[style][sec];bass.forEach(([b,o],j)=>{const approach=style!=='chip'&&sec!=='A'&&next&&next.root!==c.root&&j===bass.length-1&&b===3.5;
   add('bass',at+b,approach?next.root-1:c.root+o,style==='chip'?.34:style==='funk'?(j===0?.55:.25):.36,style==='chip'?.75:j===0||b%1===0?1:.72)});
  // Chords.
  const arp=(pattern,velocity)=>{for(let s=0;s<16;s++)add('arp',at+s*.25,c.notes[pattern[s%pattern.length]]+12,.12,velocity,s%2?.35:-.35)};
  if(style==='synth'){
   c.notes.forEach((n,j)=>add('pad',at,n,3.9,.65,(j-1.5)*.4));
   if(sec==='B')arp([0,1,2,3],.35);else if(sec==='C')arp([0,1,2,3,2,1],.4);
  }else if(style==='funk'){
   const stabs=sec==='A'?[[.5,.25],[2,.6],[3.5,.25]]:sec==='B'?[[.5,.2],[1.25,.2],[2,.6],[2.75,.2],[3.5,.2]]:[[0,1.5],[2,1.5]];
   stabs.forEach(([b,len])=>c.notes.forEach((n,j)=>add('keys',at+b,n,len,.8,(j-1.5)*.18)));
   if(sec==='C')arp([0,1,2,3,2,1],.3);
  }else arp(sec==='A'?[0,1,2,3]:sec==='B'?[0,1,2,3,3,2,1,0]:[0,2,1,3],.25);
  // The melody; the chorus adds a harmony a third below.
  for(const [b,n,len] of melody){add('lead',at+b,n,style==='funk'?len*.72:len,.65,style==='funk'?.15:-.1);if(sec==='B'&&style!=='funk')add('harmony',at+b,third(n,c),len,.5,.25)}
  if(intensity>=4&&bar%2===1&&sec!=='C')for(let s=0;s<4;s++)add('hat',at+3+s*.25,0,.035,.22,s%2?.45:-.45);
 });
 return events.sort((a,b)=>a.beat-b.beat);
}
const hz=midi=>440*2**((midi-69)/12);
export class Music {
 constructor(context,output){
  this.context=context;this.output=output;this.session=null;
  this.noise=context.createBuffer(1,context.sampleRate,context.sampleRate);
  const data=this.noise.getChannelData(0);let seed=47;
  for(let i=0;i<data.length;i++){seed=(Math.imul(seed,1664525)+1013904223)>>>0;data[i]=seed/2147483648-1;}
  const real=new Float32Array(25),imag=new Float32Array(25);
  for(let i=1;i<25;i++)imag[i]=Math.sin(Math.PI*i*.25)/i;
  this.pulse=context.createPeriodicWave(real,imag);
  // A short dark hall for the reverb send.
  const length=Math.floor(context.sampleRate*1.8);this.impulse=context.createBuffer(2,length,context.sampleRate);
  for(let ch=0;ch<2;ch++){const d=this.impulse.getChannelData(ch);for(let i=0;i<length;i++){seed=(Math.imul(seed,1664525)+1013904223)>>>0;d[i]=(seed/2147483648-1)*(1-i/length)**3}}
 }
 play({style='synth',startTime,bpm,endBeat=36,intensity=1,skipCountIn=false,stems}){
  if(songs[style])return this.playTracker({style,startTime,bpm,endBeat,intensity,skipCountIn,stems});
  this.stop();const c=this.context,spb=60/bpm,bus=c.createGain(),mix=c.createDynamicsCompressor(),delay=c.createDelay(1),wet=c.createGain(),feedback=c.createGain(),damp=c.createBiquadFilter();
  bus.gain.value=.8;mix.threshold.value=-15;mix.knee.value=12;mix.ratio.value=3;mix.attack.value=.006;mix.release.value=.15;
  const makeup=c.createGain();makeup.gain.value=1.8;bus.connect(mix);mix.connect(makeup);makeup.connect(this.output);delay.delayTime.value=spb*.75;feedback.gain.value=.24;damp.type='lowpass';damp.frequency.value=2400;
  delay.connect(damp);damp.connect(feedback);feedback.connect(delay);wet.gain.value=style==='chip'?.09:.16;damp.connect(wet);wet.connect(bus);
  // Each lane also feeds the reverb after its own gain, so a dropped part takes its tail with it.
  const verb=c.createConvolver(),verbOut=c.createGain();verb.buffer=this.impulse;verbOut.gain.value=style==='chip'?.5:.8;verb.connect(verbOut);verbOut.connect(bus);
  const levels=laneLevels[style]||laneLevels.synth,sends=[.05,.3,.03,.25].map(v=>{const g=c.createGain();g.gain.value=v;g.connect(verb);return g}),lanes=parts.map((_,i)=>{const g=c.createGain();g.gain.value=levels[i];g.connect(bus);g.connect(sends[i]);return g});
  const {bars,shift}=song(endBeat,intensity);
  const session={style,startTime,spb,bus,lanes,levels,delay,bars,shift,nodes:[bus,mix,makeup,delay,wet,feedback,damp,verb,verbOut,...sends,...lanes],sources:[],stopped:false};this.session=session;
  // Notes are turned into audio nodes only a little ahead of time: scheduling a whole room at once overloads some browsers' audio threads.
  // An offline render has no clock to wait on, so it gets everything up front.
  const events=compose(style,endBeat,intensity).filter(e=>!skipCountIn||e.beat>=4).map(e=>({e,t:startTime+(e.beat-(skipCountIn?4:0))*spb}));
  const offline=typeof OfflineAudioContext!=='undefined'&&c instanceof OfflineAudioContext;let next=0;
  const pump=()=>{if(session.stopped)return;const horizon=offline?Infinity:c.currentTime+1.5;while(next<events.length&&events[next].t<horizon){this.event(session,events[next].e,events[next].t);next++}if(next>=events.length)clearInterval(session.timer)};
  pump();if(next<events.length)session.timer=setInterval(pump,200);
  return session;
 }
 // Tracker songs: the four lane stems are rendered up front and start together after the count-in.
 playTracker({style,startTime,bpm,endBeat,intensity,skipCountIn,stems:prepared}){
  this.stop();const c=this.context,spb=60/bpm,bus=c.createGain(),mix=c.createDynamicsCompressor(),makeup=c.createGain(),begin=startTime+(skipCountIn?0:4*spb);
  bus.gain.value=.8;mix.threshold.value=-15;mix.knee.value=12;mix.ratio.value=3;mix.attack.value=.006;mix.release.value=.15;makeup.gain.value=1.8;bus.connect(mix);mix.connect(makeup);makeup.connect(this.output);
  // Stems normally arrive prepared (rendered in a worker); otherwise they render here. Each song is levelled to the same loudness.
  const {stems,level,sampleRate}=prepared??stemsFor({style,bpm,endBeat,intensity},c.sampleRate),frames=stems[0][0].length,lanes=parts.map(()=>{const g=c.createGain();g.gain.value=level;g.connect(bus);return g});
  const session={style,startTime,spb,bus,lanes,levels:lanes.map(()=>level),tracker:true,nodes:[bus,mix,makeup,...lanes],sources:[],stopped:false};this.session=session;
  if(!skipCountIn)for(let b=0;b<4;b++)this.voice(session,{kind:'click',note:b?79:84,length:.08,velocity:.5},startTime+b*spb);
  // If rendering ran past the start, join the song where it should already be.
  const now=c.currentTime,late=Math.max(0,now-begin);
  stems.forEach((st,lane)=>{const buffer=c.createBuffer(2,frames,sampleRate),src=c.createBufferSource();buffer.copyToChannel(st[0],0);buffer.copyToChannel(st[1],1);src.buffer=buffer;src.connect(lanes[lane]);
   session.sources.push(src);src.start(Math.max(begin,now),late);src.onended=()=>{src.disconnect();const i=session.sources.indexOf(src);if(i>=0)session.sources.splice(i,1)}});
  return session;
 }
 stop(){
  const s=this.session;if(!s)return;this.session=null;s.stopped=true;clearInterval(s.timer);
  const t=this.context.currentTime;s.bus.gain.cancelScheduledValues(t);s.bus.gain.setValueAtTime(.8,t);s.bus.gain.linearRampToValueAtTime(0,t+.035);
  for(const source of s.sources){try{source.stop(t+.04)}catch{}}
  setTimeout(()=>s.nodes.forEach(n=>{try{n.disconnect()}catch{}}),200);
 }
 envelope(s,time,length,level,pan=0,attack=.004,target=s.bus){
  const c=this.context,g=c.createGain(),p=c.createStereoPanner();p.pan.value=pan;
  g.gain.setValueAtTime(0,time);g.gain.linearRampToValueAtTime(level,time+attack);g.gain.exponentialRampToValueAtTime(.0001,time+Math.max(length,attack+.01));g.connect(p);p.connect(target);s.nodes.push(g,p);return g;
 }
 source(s,node,time,length){s.sources.push(node);node.start(time);node.stop(time+length+.025);node.onended=()=>{node.disconnect();const i=s.sources.indexOf(node);if(i>=0)s.sources.splice(i,1)};}
 osc(s,time,length,freq,type,level,pan=0,cutoff=0,attack=.004,target=s.bus){
  const c=this.context,o=c.createOscillator(),g=this.envelope(s,time,length,level,pan,attack,target);
  if(type==='pulse')o.setPeriodicWave(this.pulse);else o.type=type;o.frequency.setValueAtTime(freq,time);
  if(cutoff){const f=c.createBiquadFilter();f.type='lowpass';f.frequency.setValueAtTime(cutoff,time);f.frequency.exponentialRampToValueAtTime(Math.max(180,cutoff*.3),time+length);f.Q.value=.7;o.connect(f);f.connect(g);s.nodes.push(f)}else o.connect(g);
  this.source(s,o,time,length);return o;
 }
 noiseHit(s,time,length,level,cutoff,pan=0){
  const c=this.context,source=c.createBufferSource(),f=c.createBiquadFilter();source.buffer=this.noise;f.type='highpass';f.frequency.value=cutoff;source.connect(f);f.connect(this.envelope(s,time,length,level,pan));s.nodes.push(f);this.source(s,source,time,length);
 }
 event(s,e,t){
  // Route the voice through its bandmate's bus so a miss can drop that part out of the mix.
  const lane=laneOf(e.kind),bus=s.bus;if(lane>=0&&s.lanes)s.bus=s.lanes[lane];
  try{this.voice(s,e,t)}finally{s.bus=bus}
 }
 voice(s,e,t){
  const length=e.length*s.spb,v=e.velocity,c=this.context,f=hz(e.note);
  if(e.kind==='click'){this.osc(s,t,.045,f,'sine',.12*v);return}
  if(e.kind==='kick'){const o=this.osc(s,t,.28,130,'sine',.66*v);o.frequency.exponentialRampToValueAtTime(43,t+.08);this.noiseHit(s,t,.014,.075*v,1800);return}
  if(e.kind==='snare'){this.noiseHit(s,t,.16,.24*v,1500,e.pan);this.osc(s,t,.105,180,'triangle',.13*v);return}
  if(e.kind==='hat'){this.noiseHit(s,t,e.length,.12*v,7500,e.pan);return}
  if(e.kind==='crash'){this.noiseHit(s,t,1.3,.07*v,5200,-.2);this.noiseHit(s,t,.25,.05*v,9000,.2);return}
  if(e.kind==='riser'){
   // Filtered noise sweeping up into the next section.
   const n=c.createBufferSource(),f=c.createBiquadFilter(),g=c.createGain();n.buffer=this.noise;n.loop=true;f.type='bandpass';f.Q.value=2.5;f.frequency.setValueAtTime(300,t);f.frequency.exponentialRampToValueAtTime(6000,t+length);
   g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(.06*v,t+length*.95);g.gain.linearRampToValueAtTime(0,t+length);n.connect(f);f.connect(g);g.connect(s.bus);s.nodes.push(f,g);this.source(s,n,t,length);return;
  }
  if(e.kind==='bass'){
   this.osc(s,t,length,f,s.style==='chip'?'triangle':'sawtooth',s.style==='chip'?.15*v:.13*v,0,s.style==='chip'?0:s.style==='funk'?1100:650);
   if(s.style!=='chip')this.osc(s,t,length,f,'sine',.12*v);return;
  }
  if(e.kind==='pad'){
   // A short swell every quarter note keeps the pad out of the kick's way.
   for(let q=0;q<4;q++){const gain=this.envelope(s,t+q*s.spb,s.spb*.94,.028*v,e.pan,.07);const filter=c.createBiquadFilter();filter.type='lowpass';filter.frequency.value=1800;filter.connect(gain);s.nodes.push(filter);
    for(const detune of [-5,5]){const o=c.createOscillator();o.type='sawtooth';o.frequency.value=f;o.detune.value=detune;o.connect(filter);this.source(s,o,t+q*s.spb,s.spb*.94)}}return;
  }
  if(e.kind==='keys'){
   this.osc(s,t,length+.22,f,'sine',.12*v,e.pan);this.osc(s,t,.12,f*3,'sine',.018*v,e.pan);this.osc(s,t,length,f,'sine',.028*v,e.pan,0,.005,s.delay);return;
  }
  if(e.kind==='arp'){this.osc(s,t,length,f,'pulse',.055*v,e.pan,3600);return}
  if(e.kind==='lead'||e.kind==='harmony'){
   const type=s.style==='chip'?'pulse':s.style==='funk'?'sine':'triangle',level=e.kind==='lead'?1:.5;
   this.vibrato(s,this.osc(s,t,length,f,type,.115*v*level,e.pan,s.style==='chip'?4000:2400,.01),t,length,f);
   if(s.style==='synth')for(const detune of [-8,8]){const o=this.osc(s,t,length,f,'sawtooth',.03*v*level,e.pan+detune/40,2000,.012);o.detune.value=detune;this.vibrato(s,o,t,length,f)}
   if(e.kind==='harmony')return;
   this.osc(s,t,length,f,type,.04*v,-e.pan,2400,.01,s.delay);
   if(s.style==='funk')this.osc(s,t,.1,f*2,'sine',.022*v,e.pan);
  }
 }
 // Gentle vibrato that fades in on held notes.
 vibrato(s,o,t,length,freq){
  if(length<.35)return;const c=this.context,lfo=c.createOscillator(),depth=c.createGain();lfo.frequency.value=5.5;
  depth.gain.setValueAtTime(0,t);depth.gain.setValueAtTime(0,t+length*.3);depth.gain.linearRampToValueAtTime(freq*.007,t+length*.7);lfo.connect(depth);depth.connect(o.frequency);s.nodes.push(depth);this.source(s,lfo,t,length);
 }
 metronome({startTime,bpm,count=16}){
  this.stop();const spb=60/bpm,bus=this.context.createGain();bus.gain.value=.8;bus.connect(this.output);
  const session={style:'click',startTime,spb,bus,nodes:[bus],sources:[],stopped:false};this.session=session;
  // Sharp attack so the heard onset is unambiguous; first click of each bar is accented.
  for(let i=0;i<count;i++){const t=startTime+i*spb,accent=i%4===0;this.osc(session,t,.06,accent?1760:1320,'square',accent?.11:.08,0,0,.001);this.noiseHit(session,t,.012,.1,4000)}
  return Array.from({length:count},(_,i)=>startTime+i*spb);
 }
 // The enemy's call: a growl per telegraphed beat, pitched by lane so the rhythm and lanes can be heard.
 calls(list){
  const s=this.session;if(!s||s.stopped)return;
  for(const n of list){const t=s.startTime+n.beat*s.spb,f=hz([40,43,47,50][n.lane]+(s.shift||0));
   const o=this.osc(s,t,.22,f,'sawtooth',.2,(n.lane-1.5)*.3,1400);o.frequency.exponentialRampToValueAtTime(f*.7,t+.2);this.noiseHit(s,t,.06,.12,900)}
 }
 block(lane){const s=this.session;if(!s||s.stopped)return;const t=this.context.currentTime;this.osc(s,t,.12,[1568,1760,1976,2093][lane],'square',.05,(lane-1.5)*.3,5000,.001);this.noiseHit(s,t,.05,.1,6000)}
 strike(){const s=this.session;if(!s||s.stopped)return;const t=this.context.currentTime;const o=this.osc(s,t,.3,110,'sawtooth',.28,0,700);o.frequency.exponentialRampToValueAtTime(45,t+.25);this.noiseHit(s,t,.2,.25,300)}
 setLane(lane,on){
  const s=this.session;if(!s||s.stopped||!s.lanes)return;const g=s.lanes[lane].gain,t=this.context.currentTime;
  g.cancelScheduledValues(t);g.setValueAtTime(g.value,t);g.linearRampToValueAtTime(s.levels[lane]*(on?1:.06),t+(on?.03:.12));
 }
 cue(lane){
  const s=this.session;if(!s||s.stopped)return;
  if(s.tracker){this.noiseHit(s,this.context.currentTime,.03,.04,7000,(lane-1.5)*.2);return}
  const beat=Math.max(0,(this.context.currentTime-s.startTime)/s.spb-4),chord=s.bars?.[Math.floor(beat/4)]?.chord||Dm;
  // Quiet, chord-aware attacks; never a competing melody in a different key.
  this.osc(s,this.context.currentTime,.09,hz(chord.notes[lane]+(s.shift||0)),'sine',.038,(lane-1.5)*.2);
 }
}
