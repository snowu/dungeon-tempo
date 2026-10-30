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
const foes=[{name:'Moss lurker',sprite:108},{name:'Crypt spider',sprite:120},{name:'Bone sentinel',sprite:121},{name:'Ash imp',sprite:110}];
export function makeRoom(run,route='crypt') {
 const rng=random(run.seed+run.floor*7919+(route==='elite'?443:0));
 const boss=run.floor===5,elite=!boss&&route==='elite';
 const foe=boss?{name:'The Hollow Conductor',sprite:124}:foes[Math.floor(rng()*foes.length)];
 const hp=(run.mode==='easy'?[18,24,34,42,56][run.floor-1]:(boss?118:46+run.floor*9))+(elite?18:0);
 const base={easy:72,normal:108,hard:132}[run.mode];
 return {...foe,boss,elite,route,hp,maxHp:hp,bpm:base+(run.floor-1)*3+(elite?8:0),endBeat:36,shield:run.relics.includes('ward')?3:0};
}
export function newRun(seed,mode='normal') {
 const run={seed:seed>>>0,mode,floor:1,hp:mode==='easy'?16:12,maxHp:mode==='easy'?16:12,relics:[],status:'combat',cleared:0,choices:[],path:['crypt']};run.room=makeRoom(run);return run;
}
export function roomChart(run) {
 const rng=random(run.seed^Math.imul(run.floor,1013)^(run.room.elite?993:0));
 const motif=Array.from({length:8},()=>Math.floor(rng()*4));const notes=[];
 for(let beat=4;beat<34;beat+=(run.mode==='easy'&&run.floor<=2?2:1)) { const lane=motif[beat%8]; notes.push({beat,lane,state:'pending'});
 if(run.mode!=='easy'&&(run.mode==='hard'||run.room.elite||run.room.boss)&&beat%4===2)notes.push({beat:beat+.5,lane:(lane+1+Math.floor(rng()*3))%4,state:'pending'});
 }return notes;
}
export function hitEnemy(run,rating) {
 if(run.status!=='combat')return 0;
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
