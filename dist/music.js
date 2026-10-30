// Original eight-bar arrangements. Everything is scheduled on the game's audio clock.
export const tracks={
 synth:{name:'Neon Catacombs',description:'Dark synthwave · pulsing bass, wide chords, backbeat snare'},
 funk:{name:'Graveyard Shift',description:'Dungeon funk · electric keys, syncopated bass, shuffled hats'},
 chip:{name:'8-Bit Afterlife',description:'Retro chiptune · pulse lead, triangle bass, tiny drum machine'}
};
const chords=[{root:38,notes:[62,65,69,76]},{root:34,notes:[62,65,69,72]},{root:41,notes:[60,64,69,67]},{root:36,notes:[60,64,67,74]}];
const melody=[
 [[0,74,.65],[1.5,77,.35],[2,81,.8],[3.5,77,.35]],
 [[.5,76,.6],[2,74,1.4]],
 [[0,77,.8],[1.5,74,.4],[2.5,72,1]],
 [[.5,69,.7],[2,72,.5],[3,74,.7]],
 [[0,76,.7],[1.5,79,.4],[2,81,1.2]],
 [[.5,79,.7],[2,76,.6],[3.5,72,.35]],
 [[0,74,.8],[1.5,72,.4],[2.5,67,.8]],
 [[0,69,.6],[1,72,.6],[2,74,1.5]]
];
export function compose(style='synth',endBeat=36,intensity=1){
 const events=[];const add=(kind,beat,note=0,length=.2,velocity=1,pan=0)=>{if(beat<endBeat)events.push({kind,beat,note,length,velocity,pan})};
 for(let b=0;b<4;b++)add('click',b,b===0?84:79,.08,.5);
 for(let bar=0;4+bar*4<endBeat;bar++){
  const at=4+bar*4,c=chords[Math.floor(bar/2)%4];
  const kick=style==='funk'?[0,1.5,2.75]:style==='chip'?[0,2,2.75]:[0,1,2,3];
  kick.forEach(b=>add('kick',at+b,0,.3,style==='chip'?.75:1));
  [1,3].forEach(b=>add('snare',at+b,0,.18,style==='funk'?.9:.8));
  for(let eighth=0;eighth<8;eighth++)add('hat',at+eighth*.5+(style==='funk'&&eighth%2?.065:0),0,eighth===7?.15:.045,eighth%2?.5:.28,eighth%2?.25:-.2);
  if(style==='synth'){
   c.notes.forEach((n,i)=>add('pad',at,n,3.9,.65,(i-1.5)*.4));
   [0,.75,1.5,2,2.75,3.5].forEach((b,i)=>add('bass',at+b,c.root+(i===5?12:0),.36,i%3===0?1:.72));
  }else if(style==='funk'){
   [.5,2,3.5].forEach((b,j)=>c.notes.forEach((n,i)=>add('keys',at+b,n,j===1?.6:.25,.8,(i-1.5)*.18)));
   [0,.75,1.5,2,2.5,3.25].forEach((b,i)=>add('bass',at+b,c.root+[0,12,0,7,10,12][i],i===0?.55:.25,.95));
   if(bar%2)add('snare',at+2.75,0,.09,.22,-.15);
  }else{
   for(let b=0;b<4;b+=.5)add('bass',at+b,c.root+(b%1?12:0),.34,.75);
   for(let s=0;s<16;s++)add('arp',at+s*.25,c.notes[s%4]+12,.12,.25,s%2?.35:-.35);
  }
  // A recurring two-bar call and response, with space for the player's attacks.
  for(const [b,n,len] of melody[bar%8])add('lead',at+b,n,style==='funk'?len*.72:len,.65,style==='funk'?.15:-.1);
  if(intensity>=4&&bar%2===1)for(let s=0;s<4;s++)add('hat',at+3+s*.25,0,.035,.22,s%2?.45:-.45);
 }
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
 }
 play({style='synth',startTime,bpm,endBeat=36,intensity=1,skipCountIn=false}){
  this.stop();const c=this.context,spb=60/bpm,bus=c.createGain(),mix=c.createDynamicsCompressor(),delay=c.createDelay(1),wet=c.createGain(),feedback=c.createGain(),damp=c.createBiquadFilter();
  bus.gain.value=.8;mix.threshold.value=-15;mix.knee.value=12;mix.ratio.value=3;mix.attack.value=.006;mix.release.value=.15;
  const makeup=c.createGain();makeup.gain.value=1.8;bus.connect(mix);mix.connect(makeup);makeup.connect(this.output);delay.delayTime.value=spb*.75;feedback.gain.value=.24;damp.type='lowpass';damp.frequency.value=2400;
  delay.connect(damp);damp.connect(feedback);feedback.connect(delay);wet.gain.value=style==='chip'?.09:.16;damp.connect(wet);wet.connect(bus);
  const session={style,startTime,spb,bus,delay,nodes:[bus,mix,makeup,delay,wet,feedback,damp],sources:[],stopped:false};this.session=session;
  for(const event of compose(style,endBeat,intensity)){if(skipCountIn&&event.beat<4)continue;this.event(session,event,startTime+(event.beat-(skipCountIn?4:0))*spb);}
  return session;
 }
 stop(){
  const s=this.session;if(!s)return;this.session=null;s.stopped=true;
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
  const length=e.length*s.spb,v=e.velocity,c=this.context,f=hz(e.note);
  if(e.kind==='click'){this.osc(s,t,.045,f,'sine',.12*v);return}
  if(e.kind==='kick'){const o=this.osc(s,t,.28,130,'sine',.66*v);o.frequency.exponentialRampToValueAtTime(43,t+.08);this.noiseHit(s,t,.014,.075*v,1800);return}
  if(e.kind==='snare'){this.noiseHit(s,t,.16,.24*v,1500,e.pan);this.osc(s,t,.105,180,'triangle',.13*v);return}
  if(e.kind==='hat'){this.noiseHit(s,t,e.length,.12*v,7500,e.pan);return}
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
  if(e.kind==='lead'){
   const type=s.style==='chip'?'pulse':s.style==='funk'?'sine':'triangle';
   this.osc(s,t,length,f,type,.115*v,e.pan,s.style==='chip'?4000:2400,.01);
   this.osc(s,t,length,f,type,.04*v,-e.pan,2400,.01,s.delay);
   if(s.style==='funk')this.osc(s,t,.1,f*2,'sine',.022*v,e.pan);
  }
 }
 metronome({startTime,bpm,count=16}){
  this.stop();const spb=60/bpm,bus=this.context.createGain();bus.gain.value=.8;bus.connect(this.output);
  const session={style:'click',startTime,spb,bus,nodes:[bus],sources:[],stopped:false};this.session=session;
  // Sharp attack so the heard onset is unambiguous; first click of each bar is accented.
  for(let i=0;i<count;i++){const t=startTime+i*spb,accent=i%4===0;this.osc(session,t,.06,accent?1760:1320,'square',accent?.11:.08,0,0,.001);this.noiseHit(session,t,.012,.1,4000)}
  return Array.from({length:count},(_,i)=>startTime+i*spb);
 }
 cue(lane){
  const s=this.session;if(!s||s.stopped)return;
  const beat=Math.max(0,(this.context.currentTime-s.startTime)/s.spb-4),chord=chords[Math.floor(beat/8)%4];
  // Quiet, chord-aware attacks; never a competing melody in a different key.
  this.osc(s,this.context.currentTime,.09,hz(chord.notes[lane]),'sine',.038,(lane-1.5)*.2);
 }
}
