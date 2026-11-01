// Public-domain tracker songs from The Mod Archive, played through libopenmpt (dist/vendor, BSD license).
// A song's channels are split between the four bandmates. Each lane's stem is rendered from a copy of the module
// with every other channel silenced, so a miss drops exactly that part. Gems come from the pattern data itself.
const page=id=>`https://modarchive.org/index.php?request=view_by_moduleid&query=${id}`;
// lanes: channels for [drums, melody, bass, chords]. rpb: pattern rows per beat.
export const songs={
 'dim-dungeon':{name:'The Dim Dungeon',artist:'Drozerix',file:'the-dim-dungeon.xm',id:172732,rpb:8,lanes:[[4,5],[0,3],[1],[2]]},
 'dim-dungeon-2':{name:'The Dim Dungeon 2',artist:'Drozerix',file:'the-dim-dungeon-2.xm',id:172897,rpb:8,lanes:[[4,5],[2,3],[0],[1]]},
 'necromancer':{name:"Necromancer's Castle",artist:'Drozerix',file:'necromancers-castle.xm',id:172786,rpb:8,lanes:[[0,2],[4],[1],[5,3]]},
 'war-path':{name:'War Path',artist:'Drozerix',file:'war-path.xm',id:190185,rpb:8,lanes:[[2,3],[4],[0],[1,5]]},
 'djinn':{name:'Wrath of the Djinn',artist:'Drozerix',file:'wrath-of-the-djinn.xm',id:173080,rpb:8,lanes:[[1],[2],[3],[0]]},
 'crusaders':{name:'Crusaders',artist:'JAM',file:'crusaders.xm',id:177809,rpb:4,lanes:[[0,1,2,6],[4],[5],[3,7,8,9]]},
 'mega-destruction':{name:'Mega Destruction',artist:'Zilly Mike',file:'mega-destruction.xm',id:50252,rpb:8,lanes:[[0,3,5,6],[1],[4,7],[2,8]]}
};
for(const s of Object.values(songs)){s.url=page(s.id);s.description=`${s.artist} · public-domain tracker module from The Mod Archive`}
// The dungeon mixtape: a new song every floor, rising in tempo; an elite door jumps to the next floor's song; the boss gets the heaviest.
export const setlist=['dim-dungeon','dim-dungeon-2','war-path','necromancer','djinn','crusaders','crusaders','mega-destruction'];
export const mixtape={name:'Dungeon mixtape',description:'A new song every room, faster the deeper you go · Drozerix, JAM and Zilly Mike, public domain'};
export const songFor=(style,floor=1,elite=false)=>style!=='mixtape'?style:setlist[floor>=setlist.length?setlist.length-1:Math.min(setlist.length-2,floor-1+(elite?1:0))];
export const isTracker=style=>Boolean(songs[style])||style==='mixtape';

let L=null,loading=null;
export function openmpt(){return loading??=import('./vendor/libopenmpt.js').then(m=>m.default()).then(lib=>L=lib)}
// Loads a song once: fetches the module (or takes `bytes`) and reads its timing and notes.
export function loadSong(id,bytes){
 const s=songs[id];if(!s)return Promise.resolve(s);
 return s.loading??=(async()=>{await openmpt();
  bytes??=new Uint8Array(await (await fetch(new URL('./songs/'+s.file,import.meta.url))).arrayBuffer());
  s.bytes=bytes;s.data={...analyze(bytes,s.rpb),lanes:s.lanes};s.stems=s.lanes.map(chs=>isolate(bytes,new Set(chs)));return s})().catch(e=>{s.loading=null;throw e});
}

function open(bytes,fn){
 const p=L._malloc(bytes.length);L.HEAPU8.set(bytes,p);const m=L._openmpt_module_create_from_memory(p,bytes.length,0,0,0);L._free(p);
 if(!m)throw new Error('libopenmpt could not open the module');try{return fn(m)}finally{L._openmpt_module_destroy(m)}
}
function cstr(text){const p=L._malloc(text.length+1);for(let i=0;i<text.length;i++)L.HEAPU8[p+i]=text.charCodeAt(i);L.HEAPU8[p+text.length]=0;return p}

// Note onsets per channel in beats, where each pattern starts, and where the song loops back to.
export function analyze(bytes,rpb){return open(bytes,m=>{
 const orders=L._openmpt_module_get_num_orders(m),channels=L._openmpt_module_get_num_channels(m),notes=[],starts=[];
 const rowDur=L._openmpt_module_get_time_at_position(m,0,1)-L._openmpt_module_get_time_at_position(m,0,0),beatAt=t=>Math.round(t/rowDur)/rpb;
 for(let o=0;o<orders;o++){const pat=L._openmpt_module_get_order_pattern(m,o),rows=L._openmpt_module_get_pattern_num_rows(m,pat);
  for(let r=0;r<rows;r++){const t=L._openmpt_module_get_time_at_position(m,o,r);if(t<0)continue;const beat=beatAt(t);if(r===0)starts.push({order:o,beat});
   for(let ch=0;ch<channels;ch++){const note=L._openmpt_module_get_pattern_row_channel_command(m,pat,r,ch,0);if(note>0&&note<=120)notes.push({beat,ch,note})}}}
 const total=beatAt(L._openmpt_module_get_duration_seconds(m)),restart=L._openmpt_module_get_restart_order(m,0);
 return {rowDur,spb:rowDur*rpb,bpm:60/(rowDur*rpb),channels,notes:notes.sort((a,b)=>a.beat-b.beat),starts,total,loop:starts.find(s=>s.order===restart)?.beat??0};
})}

// Every floor starts somewhere else in the song, at the top of a pattern whose notes sit on the beat grid from there
// (some songs open with an odd-length pattern that shifts everything after it) and where every bandmate is already playing.
const window32=(data,from)=>data.notes.filter(n=>n.beat>=from&&n.beat<from+32&&((n.beat-from)*2)%1===0);
const onGrid=(data,from)=>window32(data,from).length/Math.max(1,data.notes.filter(n=>n.beat>=from&&n.beat<from+32).length);
const playing=(data,from)=>{const near=window32(data,from);return data.lanes?data.lanes.filter(chs=>near.filter(n=>chs.includes(n.ch)).length>=4).length:4};
export function startOf(data,intensity=1){
 const scored=data.starts.filter(s=>s.beat<data.total-8).map(s=>({...s,grid:onGrid(data,s.beat),lanes:playing(data,s.beat)})),best=Math.max(...scored.map(s=>s.grid));
 const aligned=scored.filter(s=>s.grid>=best*.8),most=Math.max(...aligned.map(s=>s.lanes)),options=aligned.filter(s=>s.lanes===most),pick=options[Math.floor((Math.max(1,intensity)-1)*options.length/8)%options.length];
 return pick||{order:0,beat:0};
}

// The song as game events: four count-in clicks, then each lane's notes from the chosen start, looping as the module does.
export function trackerScore(id,endBeat=36,intensity=1){
 const s=songs[id],events=[];for(let b=0;b<4;b++)events.push({kind:'click',beat:b,note:b?79:84,length:.08,velocity:.5,pan:0});
 if(!s?.data)return events;
 const {notes,total,loop}=s.data,from=startOf(s.data,intensity).beat,lane=new Map(s.lanes.flatMap((chs,l)=>chs.map(c=>[c,l]))),kinds=['kick','lead','bass','pad'];
 const place=(n,beat)=>{if(beat<endBeat&&lane.has(n.ch))events.push({kind:kinds[lane.get(n.ch)],beat,note:n.note,length:.25,velocity:1,pan:0})};
 for(const n of notes)if(n.beat>=from)place(n,4+n.beat-from);
 for(let pass=0,at=4+total-from;at<endBeat&&total>loop;pass++,at+=total-loop)for(const n of notes)if(n.beat>=loop)place(n,at+n.beat-loop);
 return events.sort((a,b)=>a.beat-b.beat);
}
// Songs keep their own tempo; only the pace scales them (pitch unchanged). Deeper floors get faster songs instead.
export const trackerBpm=(id,pace='normal')=>songs[id].data.bpm*({easy:.8,normal:1,hard:1.12}[pace]||1);

// A copy of an XM module where only `keep` channels play notes. Effect columns stay so tempo and jumps are untouched.
export function isolate(bytes,keep){
 const d=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),head=60+d.getUint32(60,true),channels=d.getUint16(68,true),patterns=d.getUint16(70,true),out=[bytes.slice(0,head)];
 let p=head;
 for(let k=0;k<patterns;k++){
  const hl=d.getUint32(p,true),rows=d.getUint16(p+5,true),size=d.getUint16(p+7,true),data=bytes.subarray(p+hl,p+hl+size),header=bytes.slice(p,p+hl);p+=hl+size;
  if(!size){out.push(header);continue}
  const cells=new Uint8Array(rows*channels*5);
  for(let c=0,i=0;c<rows*channels;c++){let v=[0,0,0,0,0];const b=data[i];
   if(b&0x80){i++;for(let j=0;j<5;j++)if(b&1<<j)v[j]=data[i++]}else{v=[...data.subarray(i,i+5)];i+=5}
   if(!keep.has(c%channels))v[0]=v[1]=v[2]=0;cells.set(v,c*5)}
  new DataView(header.buffer).setUint16(7,cells.length,true);out.push(header,cells);
 }
 out.push(bytes.slice(p));const all=new Uint8Array(out.reduce((n,a)=>n+a.length,0));let at=0;for(const a of out){all.set(a,at);at+=a.length}return all;
}

// Every song is brought to the same loudness: the lane gain that sets its full mix to a common level.
export function loudness(stems){let sum=0;const frames=stems[0][0].length;for(let i=0;i<frames;i+=4){let x=0;for(const st of stems)x+=st[0][i];sum+=x*x}return Math.min(4,.055/Math.max(1e-4,Math.sqrt(sum/(frames/4))))}

// ---------- Room stems, off the main thread ----------
// A room's stems take a few hundred ms to render on a desktop and seconds on a phone, so a module worker renders them,
// ideally while the player is still choosing a door. Without workers, or if the worker fails, they render here as before.
// Keys leave out the sample rate: stems carry their own and Web Audio resamples them.
const stemKey=({style,bpm,endBeat=36,intensity=1})=>[style,bpm,endBeat,intensity].join();
const stemCache=new Map(),jobs=new Map();let worker=null,workerBroken=typeof Worker==='undefined',jobId=0;
function renderHere({style,bpm,endBeat=36,intensity=1},sampleRate){const stems=renderStems(style,{beats:endBeat-4,intensity,bpm,sampleRate});return {stems,level:loudness(stems),sampleRate}}
function startWorker(){
 try{worker=new Worker(new URL('./stems.worker.js',import.meta.url),{type:'module'})}catch{workerBroken=true;return}
 worker.onmessage=({data})=>{const job=jobs.get(data.id);jobs.delete(data.id);if(!job)return;if(data.error)job.fallback();else job.done({stems:data.stems,level:data.level,sampleRate:data.sampleRate})};
 worker.onerror=()=>{workerBroken=true;worker?.terminate();worker=null;const waiting=[...jobs.values()];jobs.clear();waiting.forEach(job=>job.fallback())};
}
function renderAway(req,sampleRate){
 if(!worker&&!workerBroken)startWorker();
 if(workerBroken)return Promise.resolve().then(()=>renderHere(req,sampleRate));
 return new Promise((done,fail)=>{const id=++jobId,{style,bpm,endBeat=36,intensity=1}=req;
  jobs.set(id,{done,fallback:()=>{try{done(renderHere(req,sampleRate))}catch(e){fail(e)}}});
  worker.postMessage({id,style,beats:endBeat-4,intensity,bpm,sampleRate})});
}
// Stems for a room, rendered once: resolves to {stems,level,sampleRate}.
export function prepareStems(req,sampleRate=48000){
 if(!songs[req?.style])return Promise.resolve(null);
 const key=stemKey(req);let entry=stemCache.get(key);
 if(!entry){entry={};entry.promise=renderAway(req,sampleRate).then(r=>entry.result=r,e=>{if(stemCache.get(key)===entry)stemCache.delete(key);throw e});stemCache.set(key,entry)}
 return entry.promise;
}
// Stems right now: from the cache, or rendered on the spot when nobody prepared them.
export function stemsFor(req,sampleRate){const key=stemKey(req),hit=stemCache.get(key)?.result;if(hit)return hit;const r=renderHere(req,sampleRate);stemCache.set(key,{promise:Promise.resolve(r),result:r});return r}
// Starts on the rooms the player can reach next and lets go of every other room; each one is tens of MB.
export function prefetchStems(reqs,sampleRate){
 const wanted=reqs.filter(r=>songs[r?.style]),keep=new Set(wanted.map(stemKey));
 for(const k of stemCache.keys())if(!keep.has(k))stemCache.delete(k);
 for(const r of wanted)prepareStems(r,sampleRate).catch(()=>{});
}

// Renders the four lane stems for a room: `beats` of music from the floor's start, at `bpm`.
export function renderStems(id,{beats,intensity=1,bpm,sampleRate=44100}){
 const s=songs[id],factor=bpm/s.data.bpm,{order}=startOf(s.data,intensity),frames=Math.ceil((beats*s.data.spb/factor+.5)*sampleRate),chunk=4096;
 const key=cstr('play.tempo_factor'),left=L._malloc(chunk*4),right=L._malloc(chunk*4);
 try{return s.stems.map(bytes=>open(bytes,m=>{
  L._openmpt_module_set_repeat_count(m,-1);L._openmpt_module_ctl_set_floatingpoint(m,key,factor);L._openmpt_module_set_position_order_row(m,order,0);
  const out=[new Float32Array(frames),new Float32Array(frames)];
  for(let at=0;at<frames;){const got=L._openmpt_module_read_float_stereo(m,sampleRate,Math.min(chunk,frames-at),left,right);if(!got)break;
   out[0].set(L.HEAPF32.subarray(left>>2,(left>>2)+got),at);out[1].set(L.HEAPF32.subarray(right>>2,(right>>2)+got),at);at+=got}
  return out}))}
 finally{L._free(key);L._free(left);L._free(right)}
}
