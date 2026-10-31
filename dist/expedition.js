import {compose,laneOf} from './music.js';
// Deterministic runs: the same seed, difficulty and door choices give the same dungeon.
export function random(seed) { let s=seed>>>0; return ()=>{s+=0x6D2B79F5;let t=s;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296;}; }
export const relics=[
 {id:'fang',name:'Metronome fang',icon:'⚔',description:'+1 damage on every successful hit.'},
 {id:'heart',name:'Heart of the crypt',icon:'♥',description:'+4 maximum health. Heal 4 now.'},
 {id:'echo',name:'Echo crystal',icon:'✦',description:'Perfect hits deal 3 extra damage.'},
 {id:'moss',name:'Singing moss',icon:'♧',description:'Heal 4 now, then 2 after each room.'},
 {id:'clock',name:'Pocket hourglass',icon:'◷',description:'The hit window is 30 ms more forgiving.'},
 {id:'ward',name:'Bone ward',icon:'◇',description:'Block the first 3 damage in every room.'}
];
const foes=[
 {name:'Moss lurker',sprite:108,trait:'feeds',traitText:'Feeds on mistakes: heals 2 whenever you miss.'},
 {name:'Crypt spider',sprite:120,trait:'webs',traitText:'Webs one lane per bar: those gems appear late.'},
 {name:'Bone sentinel',sprite:121,trait:'armored',traitText:'Armored: Good hits glance off. Hit Great or better.'},
 {name:'Ash imp',sprite:110,trait:'offbeat',traitText:'Sneaky: attacks land between the beats.'}
];
const boss={name:'The Hollow Conductor',sprite:124,trait:'conductor',traitText:'Armored, attacks off the beat, and calls three times.'};
// Each room is a song: attack bars where the band deals damage, and enemy calls you must echo to block.
// The enemy calls right after the opening bar, so even a flawless band has to block at least once.
const plans={short:['attack','call','guard','attack','attack','call','guard','attack'],long:['attack','call','guard','attack','call','guard','attack','call','guard','attack']};
export const armored=room=>room.trait==='armored'||room.trait==='conductor';
// Beginner's first rooms are capped by their two-beat spacing, so extra density can't apply there.
function density(run,extra){return run.mode==='easy'&&run.floor<=2?.5:(run.mode==='easy'?.8:run.mode==='hard'?1.33:1)+(extra?.2:0)}
export function makeRoom(run,route='crypt') {
 const rng=random(run.seed+run.floor*7919+(route==='elite'?443:0));
 const isBoss=run.floor===5,elite=!isBoss&&route==='elite',plan=isBoss||elite?plans.long:plans.short;
 const foe=isBoss?boss:foes[Math.floor(rng()*foes.length)];
 // Enemy health is a share of what a flawless band could deal, so every room is winnable without relics.
 const attackBeats=plan.filter(p=>p==='attack').length*4,flawless=attackBeats*density(run,isBoss||elite)*4*(armored(foe)?.85:1);
 const share=[.42,.47,.52,.56,.6][run.floor-1]*({easy:.85,normal:1,hard:1.1}[run.mode])*(elite?1.12:1);
 const hp=Math.round(flawless*share);
 const base={easy:72,normal:108,hard:132}[run.mode];
 return {...foe,boss:isBoss,elite,route,plan,hp,maxHp:hp,bpm:base+(run.floor-1)*3+(elite?8:0),endBeat:6+plan.length*4,shield:run.relics.includes('ward')?3:0};
}
export function newRun(seed,mode='normal') {
 const run={seed:seed>>>0,mode,floor:1,hp:mode==='easy'?16:12,maxHp:mode==='easy'?16:12,relics:[],status:'combat',cleared:0,choices:[],path:['crypt']};run.room=makeRoom(run);return run;
}
// Attack gems are real notes of the arrangement, each bar spotlighting one bandmate.
// Calls are the enemy's telegraphed rhythm; guards echo it one bar later.
export function roomChart(run,style='synth') {
 const rng=random(run.seed^Math.imul(run.floor,1013)^(run.room.elite?993:0)),room=run.room,easy=run.mode==='easy',extra=room.elite||room.boss;
 const plan=room.plan||plans.short,barOf=beat=>Math.floor((beat-4)/4),limit=room.endBeat-2;
 const grid=easy?1:run.mode==='hard'?.25:.5,gap=easy?(run.floor<=2?2:1):.5;
 const attackBars=plan.map((p,i)=>p==='attack'?i:-1).filter(i=>i>=0);
 const target=Math.round(attackBars.length*4*density(run,extra));
 const order=[0,...[1,2,3,1,2,3,0].map(l=>({l,n:rng()})).sort((a,b)=>a.n-b.n).map(x=>x.l)];
 const spotlight=new Map(attackBars.map((bar,i)=>[bar,order[i%8]]));
 const webbed=new Map(attackBars.map(bar=>[bar,room.trait==='webs'?Math.floor(rng()*4):-1]));
 const seen=new Set(),candidates=[];
 for(const e of compose(style,room.endBeat,run.floor)){
  const lane=laneOf(e.kind),key=e.beat+':'+lane,bar=barOf(e.beat);
  if(lane<0||e.beat<4||e.beat>=limit||plan[bar]!=='attack'||Math.abs(e.beat/grid-Math.round(e.beat/grid))>1e-6||seen.has(key))continue;seen.add(key);
  candidates.push({beat:e.beat,lane,priority:(spotlight.get(bar)===lane?2:0)+(e.beat%1===0?1:0)+(e.beat%2===0?.4:0)+rng()*.8});
 }
 const chosen=[];
 for(const c of candidates.sort((a,b)=>b.priority-a.priority)){if(chosen.length>=target)break;if(chosen.every(n=>Math.abs(n.beat-c.beat)>=gap-1e-9))chosen.push(c)}
 const notes=chosen.map(({beat,lane})=>({beat,lane,kind:'attack',webbed:webbed.get(barOf(beat))===lane,state:'pending'}));
 const offbeat=!easy&&(room.trait==='offbeat'||room.trait==='conductor');
 const hits=(easy?2:run.mode==='hard'?4:3)+(extra?1:0)+(easy&&room.trait==='offbeat'?1:0);
 const slots=offbeat?[.5,1.5,2.5,3.5]:run.mode==='hard'?[0,.5,1,1.5,2,2.5,3,3.5]:[0,1,2,3],guardGap=run.mode==='hard'?.5:1;
 plan.forEach((p,bar)=>{if(p!=='call'||plan[bar+1]!=='guard')return;
  const at=4+bar*4,picked=[];
  for(const o of slots.map(o=>({o,n:rng()})).sort((a,b)=>a.n-b.n).map(x=>x.o)){if(picked.length>=Math.min(hits,slots.length))break;if(picked.every(q=>Math.abs(q-o)>=guardGap))picked.push(o)}
  for(const o of picked.sort((a,b)=>a-b)){const lane=Math.floor(rng()*4);
   notes.push({beat:at+o,lane,kind:'call',state:'call'},{beat:at+4+o,lane,kind:'guard',state:'pending'})}
 });
 return notes.sort((a,b)=>a.beat-b.beat||a.lane-b.lane);
}
export function hitEnemy(run,rating) {
 if(run.status!=='combat')return 0;
 if(armored(run.room)&&rating==='Good')return 0;
 const damage=({Perfect:4,Great:3,Good:2}[rating]||0)+(run.relics.includes('fang')?1:0)+(rating==='Perfect'&&run.relics.includes('echo')?3:0);
 run.room.hp=Math.max(0,run.room.hp-damage);
 if(run.room.hp===0){run.cleared++;run.hp=Math.min(run.maxHp,run.hp+(run.relics.includes('moss')?2:0)+(run.room.elite?2:0));run.status=run.floor===5?'won':'loot';run.choices=offerRelics(run);}
 return damage;
}
export function hurt(run,amount=1) {
 if(run.status!=='combat')return 0;
 const blocked=Math.min(run.room.shield,amount);run.room.shield-=blocked;const damage=amount-blocked;
 run.hp=Math.max(0,run.hp-damage);if(run.hp===0)run.status='dead';return damage;
}
// A miss feeds the moss lurker.
export function enemyFeeds(run) {
 if(run.status!=='combat'||run.room.trait!=='feeds'||run.room.hp===0)return 0;
 const healed=Math.min(2,run.room.maxHp-run.room.hp);run.room.hp+=healed;return healed;
}
// The song ran out: ordinary enemies strike and flee (no relic); the Conductor does not let you go.
export function fleeRoom(run) {
 if(run.status!=='combat')return 0;
 if(run.room.boss){run.hp=0;run.status='dead';return 0}
 const damage=Math.min(run.hp,run.room.elite?3:2);run.hp-=damage;
 if(run.hp===0){run.status='dead';return damage}
 run.cleared++;run.status='route';return damage;
}
export function offerRelics(run) {
 const rng=random(run.seed+run.floor*373);return relics.filter(r=>!run.relics.includes(r.id)).map(r=>({r,n:rng()})).sort((a,b)=>a.n-b.n).slice(0,3).map(x=>x.r.id);
}
export function chooseRelic(run,id) {
 if(run.status!=='loot'||!run.choices.includes(id))return false;
 run.relics.push(id);if(id==='heart'){run.maxHp+=4;run.hp=Math.min(run.maxHp,run.hp+4)}if(id==='moss')run.hp=Math.min(run.maxHp,run.hp+4);
 run.status='route';return true;
}
export function enterRoom(run,route) {
 if(run.status!=='route'||!['crypt','elite'].includes(route))return false;
 run.floor++;run.path.push(run.floor===5?'boss':route);run.room=makeRoom(run,route);run.status='combat';return true;
}
export function hitWindow(run,base) {return base + (run?.relics.includes('clock') ? .03 : 0)}
