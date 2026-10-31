import {compose,laneOf} from './music.js';
// Deterministic runs: the same seed, difficulty and door choices give the same dungeon.
export function random(seed) { let s=seed>>>0; return ()=>{s+=0x6D2B79F5;let t=s;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296;}; }
export const FLOORS=8;

// Relics either empower one bandmate or bend a rule. `lane` ties a relic to a part.
export const relics=[
 {id:'drum',name:'War drum',icon:'◉',lane:0,description:'Drum hits deal +2 damage.'},
 {id:'echo',name:'Arcane echo',icon:'✦',lane:1,description:'Perfect melody hits deal double damage.'},
 {id:'backstab',name:'Backstab',icon:'⚔',lane:2,description:'Bass hits between the beats deal +4.'},
 {id:'choir',name:'Ghost choir',icon:'♫',lane:3,description:'Every 6th chord hit heals 1.'},
 {id:'crescendo',name:'Crescendo',icon:'▲',description:'Your combo damage bonus is doubled.'},
 {id:'parry',name:'Parry blade',icon:'†',description:'Perfect blocks strike back for 4 damage.'},
 {id:'buckler',name:'Iron buckler',icon:'◇',description:'The first shield you miss in every call is blocked anyway.'},
 {id:'encore',name:'Encore',icon:'↻',description:'When a dropped part rejoins the mix, it deals 6 damage.'},
 {id:'clock',name:'Pocket hourglass',icon:'◷',description:'The hit window is 30 ms more forgiving.'},
 {id:'heart',name:'Heart of the crypt',icon:'♥',description:'+4 maximum health. Heal 4 now.'},
 {id:'phoenix',name:'Phoenix feather',icon:'✧',description:'Once per run, survive a killing blow with 3 health.'},
 {id:'fang',name:'Metronome fang',icon:'♦',description:'+1 damage on every hit.'}
];
export const relic=id=>relics.find(r=>r.id===id);

// Sprites are Kenney Tiny Dungeon tile indexes. Tier 2 foes appear from room 4 and in elite rooms.
export const foes=[
 {name:'Moss slime',sprite:108,tier:1,trait:'feeds',traitText:'Feeds on mistakes: heals 3 whenever you miss.'},
 {name:'Crypt bat',sprite:120,tier:1,trait:'offbeat',traitText:'Flutters: its attacks land between the beats.'},
 {name:'Crypt spider',sprite:122,tier:1,trait:'webs',traitText:'Webs a lane every bar: those gems show up late.'},
 {name:'Shell crawler',sprite:123,tier:2,trait:'armored',traitText:'Armored shell: Good hits glance off. Hit Great or better.'},
 {name:'Cyclops brute',sprite:109,tier:2,trait:'slam',traitText:'Slams: every attack hits two lanes at once.'},
 {name:'Ember imp',sprite:110,tier:2,trait:'frenzy',traitText:'Frenzy: rapid-fire attacks, twice the hits per call.'}
];
const boss={name:'The Hollow Conductor',sprite:111,tier:3,trait:'armored',acts:['armored','webs','frenzy'],traitText:'Three movements: armored, then webs, then frenzy.'};

// Each room is a song: attack bars where the band deals damage, and enemy calls you echo to block.
const plans={
 crypt:['attack','call','guard','attack','attack','call','guard','attack','attack','call','guard','attack','call','guard','attack','attack'],
 elite:['attack','call','guard','attack','call','guard','attack','attack','call','guard','attack','call','guard','call','guard','attack'],
 boss:[0,1,2].flatMap(()=>['attack','call','guard','attack','call','guard','attack','attack'])
};
export const traitAt=(room,beat)=>room.acts?room.acts[Math.min(room.acts.length-1,Math.floor(Math.floor((beat-4)/4)/8))]:room.trait;

function density(run,extra){return run.mode==='easy'&&run.floor<=2?.5:(run.mode==='easy'?.8:run.mode==='hard'?1.33:1)+(extra?.2:0)}
export function makeRoom(run,route='crypt') {
 const rng=random(run.seed+run.floor*7919+(route==='elite'?443:0));
 const isBoss=run.floor===FLOORS,elite=!isBoss&&route==='elite';
 const pool=foes.filter(f=>elite||run.floor>=4?true:f.tier===1),weighted=elite||run.floor>=4?[...pool,...pool.filter(f=>f.tier===2)]:pool;
 const foe=isBoss?boss:weighted[Math.floor(rng()*weighted.length)];
 const base={easy:72,normal:108,hard:132}[run.mode];
 const room={...foe,boss:isBoss,elite,route,plan:plans[isBoss?'boss':elite?'elite':'crypt'],bpm:base+(run.floor-1)*2+(elite?6:0),hp:1,maxHp:1};
 room.endBeat=6+room.plan.length*4;
 // Enemy health is a share of what a flawless band (no relics) deals to this exact chart.
 const share=[.55,.58,.61,.64,.67,.70,.72,.75][run.floor-1]*({easy:.7,normal:1,hard:1.08}[run.mode])*(elite?1.1:1);
 let flawless=0,combo=0;for(const n of roomChart({...run,room},'synth'))if(n.kind==='attack'){combo++;flawless+=traitAt(room,n.beat)==='armored'?4:4+Math.min(3,Math.floor(combo/10))}
 room.hp=room.maxHp=Math.max(8,Math.round(flawless*share));
 return room;
}
export function newRun(seed,mode='normal') {
 const run={seed:seed>>>0,mode,floor:1,hp:{easy:16,normal:12,hard:10}[mode],relics:[],status:'combat',cleared:0,doors:[],path:['crypt'],phoenixUsed:false,choirHits:0,found:null};
 run.maxHp=run.hp;run.room=makeRoom(run);run.reward=offerRelics(run,1)[0];return run;
}

// Attack gems are real notes of the arrangement, each bar spotlighting one bandmate.
// Calls are the enemy's telegraphed rhythm; guards echo it one bar later.
export function roomChart(run,style='synth') {
 const rng=random(run.seed^Math.imul(run.floor,1013)^(run.room.elite?993:0)),room=run.room,easy=run.mode==='easy',extra=room.elite||room.boss;
 const plan=room.plan,barOf=beat=>Math.floor((beat-4)/4),limit=room.endBeat-2;
 const grid=easy?1:run.mode==='hard'?.25:.5,gap=easy?(run.floor<=2?2:1):.5;
 const attackBars=plan.map((p,i)=>p==='attack'?i:-1).filter(i=>i>=0);
 const target=Math.round(attackBars.length*4*density(run,extra));
 const order=[0,...[1,2,3,1,2,3,0].map(l=>({l,n:rng()})).sort((a,b)=>a.n-b.n).map(x=>x.l)];
 const spotlight=new Map(attackBars.map((bar,i)=>[bar,order[i%8]]));
 const webbed=new Map(attackBars.map(bar=>[bar,traitAt(room,4+bar*4)==='webs'?Math.floor(rng()*4):-1]));
 const seen=new Set(),candidates=[];
 for(const e of compose(style,room.endBeat,run.floor)){
  const lane=laneOf(e.kind),key=e.beat+':'+lane,bar=barOf(e.beat);
  if(lane<0||e.beat<4||e.beat>=limit||plan[bar]!=='attack'||Math.abs(e.beat/grid-Math.round(e.beat/grid))>1e-6||seen.has(key))continue;seen.add(key);
  candidates.push({beat:e.beat,lane,priority:(spotlight.get(bar)===lane?2:0)+(webbed.get(bar)===lane?1.5:0)+(e.beat%1===0?1:0)+(e.beat%2===0?.4:0)+rng()*.8});
 }
 // Every bandmate first gets a fair share of the room, then the best remaining notes fill it.
 const chosen=[],fits=c=>chosen.every(n=>Math.abs(n.beat-c.beat)>=gap-1e-9),quota=Math.floor(target/6);candidates.sort((a,b)=>b.priority-a.priority);
 for(let lane=0;lane<4;lane++){let taken=0;for(const c of candidates)if(c.lane===lane&&taken<quota&&chosen.length<target&&fits(c)){chosen.push(c);taken++}}
 for(const c of candidates){if(chosen.length>=target)break;if(!chosen.includes(c)&&fits(c))chosen.push(c)}
 const notes=chosen.map(({beat,lane})=>({beat,lane,kind:'attack',webbed:webbed.get(barOf(beat))===lane,state:'pending'}));
 plan.forEach((p,bar)=>{if(p!=='call'||plan[bar+1]!=='guard')return;
  const at=4+bar*4,trait=traitAt(room,at),frenzy=trait==='frenzy';
  const offbeat=!easy&&trait==='offbeat',hits=(easy?2:run.mode==='hard'?4:3)+(run.floor>=4?1:0)+(room.elite?1:0);
  const slots=offbeat?[.5,1.5,2.5,3.5]:frenzy||run.mode==='hard'?[0,.5,1,1.5,2,2.5,3,3.5]:[0,1,2,3],guardGap=frenzy||run.mode==='hard'?.5:1;
  const count=Math.min(frenzy?hits+2:hits,slots.length),picked=[];
  for(const o of slots.map(o=>({o,n:rng()})).sort((a,b)=>a.n-b.n).map(x=>x.o)){if(picked.length>=count)break;if(picked.every(q=>Math.abs(q-o)>=guardGap-1e-9))picked.push(o)}
  for(const o of picked.sort((a,b)=>a-b)){
   const lane=Math.floor(rng()*4),lanes=trait==='slam'&&!easy?[lane,(lane+1+Math.floor(rng()*3))%4]:[lane];
   for(const l of lanes)notes.push({beat:at+o,lane:l,kind:'call',call:bar,state:'call'},{beat:at+4+o,lane:l,kind:'guard',call:bar,state:'pending'});
  }
 });
 return notes.sort((a,b)=>a.beat-b.beat||a.lane-b.lane);
}

// A hit from the band. `hit` describes it: {lane, beat, combo, rejoined}. Relic triggers are kept in run.triggers.
export function hitEnemy(run,rating,hit={}) {
 run.triggers=[];if(run.status!=='combat')return 0;
 const {lane=-1,beat=4,combo=0,rejoined=false}=hit,has=id=>run.relics.includes(id),note=id=>run.triggers.push(relic(id).name);
 if(traitAt(run.room,beat)==='armored'&&rating==='Good')return 0;
 let damage=({Perfect:4,Great:3,Good:2}[rating]||0);
 if(lane===1&&rating==='Perfect'&&has('echo')){damage*=2;note('echo')}
 if(lane===0&&has('drum')){damage+=2;note('drum')}
 if(lane===2&&beat%1!==0&&has('backstab')){damage+=4;note('backstab')}
 if(rejoined&&has('encore')){damage+=6;note('encore')}
 if(has('fang'))damage+=1;
 damage+=Math.min(3,Math.floor(combo/10))*(has('crescendo')?2:1);
 if(lane===3&&has('choir')&&++run.choirHits%6===0&&run.hp<run.maxHp){run.hp++;note('choir')}
 return damageEnemy(run,damage);
}
function damageEnemy(run,damage) {
 run.room.hp=Math.max(0,run.room.hp-damage);
 if(run.room.hp===0){run.cleared++;if(run.floor===FLOORS)run.status='won';else{run.status='doors';run.found=run.reward;if(run.reward)gainRelic(run,run.reward);if(run.room.elite)run.hp=Math.min(run.maxHp,run.hp+3);run.doors=makeDoors(run)}}
 return damage;
}
// A guard shield hit in time. Perfect blocks with the Parry blade strike back.
export function block(run,rating) {
 run.triggers=[];if(run.status!=='combat'||rating!=='Perfect'||!run.relics.includes('parry'))return 0;
 run.triggers.push(relic('parry').name);return damageEnemy(run,4);
}
// A missed guard shield: the enemy's hit lands, unless the buckler or phoenix steps in.
export function enemyHit(run,note) {
 run.triggers=[];if(run.status!=='combat')return 0;
 if(run.relics.includes('buckler')&&note&&!(run.room.buckled||=[]).includes(note.call)){run.room.buckled.push(note.call);run.triggers.push(relic('buckler').name);return 0}
 return hurt(run,run.room.boss||(run.floor>=5&&run.mode!=='easy')?2:1);
}
export function hurt(run,amount=1) {
 if(!['combat','doors'].includes(run.status))return 0;
 const before=run.hp;run.hp=Math.max(0,run.hp-amount);
 if(run.hp===0&&run.relics.includes('phoenix')&&!run.phoenixUsed){run.phoenixUsed=true;run.hp=3;(run.triggers||=[]).push(relic('phoenix').name)}
 if(run.hp===0)run.status='dead';return before-run.hp;
}
// A miss feeds the moss slime.
export function enemyFeeds(run) {
 if(run.status!=='combat'||run.room.trait!=='feeds'||run.room.hp===0)return 0;
 const healed=Math.min(3,run.room.maxHp-run.room.hp);run.room.hp+=healed;return healed;
}
// The song ran out: ordinary enemies strike and flee with the reward; the Conductor does not let you go.
export function fleeRoom(run) {
 if(run.status!=='combat')return 0;
 if(run.room.boss){run.hp=0;run.status='dead';return 0}
 run.status='doors';const damage=hurt(run,run.room.elite?3:2);
 if(run.status==='dead')return damage;
 run.cleared++;run.found=null;run.doors=makeDoors(run);return damage;
}

export function offerRelics(run,count,salt=0) {
 const rng=random(run.seed+run.floor*373+salt);return relics.filter(r=>!run.relics.includes(r.id)).map(r=>({r,n:rng()})).sort((a,b)=>a.n-b.n).slice(0,count).map(x=>x.r.id);
}
function gainRelic(run,id) {
 if(run.relics.includes(id))return;run.relics.push(id);
 if(id==='heart'){run.maxHp+=4;run.hp=Math.min(run.maxHp,run.hp+4)}
}
// One decision per level: each door shows the next room and what winning it earns.
export function makeDoors(run) {
 if(run.floor+1===FLOORS)return [{type:'boss'}];
 const [a,b]=offerRelics(run,2,17);
 return [{type:'crypt',relic:a},{type:'elite',relic:b,heal:3},{type:'rest',heal:5}].filter(d=>d.type==='rest'||d.relic);
}
export function enterDoor(run,index) {
 const door=run.doors[index];if(run.status!=='doors'||!door)return false;
 run.floor++;run.path.push(door.type);run.reward=door.relic||null;run.found=null;
 if(door.type==='rest'){run.hp=Math.min(run.maxHp,run.hp+door.heal);run.cleared++;run.doors=makeDoors(run);return true}
 run.room=makeRoom(run,door.type==='elite'?'elite':'crypt');run.status='combat';run.doors=[];return true;
}
export function hitWindow(run,base) {return base + (run?.relics.includes('clock') ? .03 : 0)}
