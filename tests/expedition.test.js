import test from 'node:test';import assert from 'node:assert/strict';
import {FLOORS,newRun,roomChart,makeRoom,hitEnemy,block,enemyHit,hurt,enemyFeeds,fleeRoom,enterDoor,makeDoors,hitWindow,relics,traitAt} from '../dist/expedition.js';
import {compose,laneOf} from '../dist/music.js';
function winRoom(run){while(run.status==='combat')hitEnemy(run,'Perfect')}
const withTrait=(trait,mode='normal')=>{const run=newRun(11,mode);run.room={...run.room,trait};return run};

test('seed reproduces rooms and charts; other seeds change the run',()=>{const a=newRun(123),b=newRun(123),c=newRun(124);assert.deepEqual(a,b);assert.deepEqual(roomChart(a),roomChart(b));assert.notDeepEqual(roomChart(a),roomChart(c));assert.ok(roomChart(a).every(n=>n.beat>=4&&n.beat<a.room.endBeat-2&&n.lane>=0&&n.lane<4))});
test('a run is eight rooms: one door pick per level, the reward is named on the door, the boss is last',()=>{const run=newRun(55);for(let floor=1;floor<=FLOORS;floor++){assert.equal(run.floor,floor);const reward=run.reward;winRoom(run);assert.equal(run.cleared,floor);if(floor===FLOORS){assert.equal(run.status,'won');break}
 assert.equal(run.status,'doors');if(reward)assert.ok(run.relics.includes(reward),'winning grants the door reward');
 const doors=run.doors;if(floor===FLOORS-1){assert.deepEqual(doors.map(d=>d.type),['boss'])}else{assert.deepEqual(doors.map(d=>d.type),['crypt','elite','rest']);assert.notEqual(doors[0].relic,doors[1].relic);assert.ok(doors.every(d=>!d.relic||!run.relics.includes(d.relic)))}
 assert.equal(enterDoor(run,9),false);assert.ok(enterDoor(run,0))}
 assert.equal(run.room.boss,true);assert.equal(run.room.name,'The Hollow Conductor')});
test('rooms are long songs; the boss is longest and runs through three movements',()=>{const r=newRun(9);assert.ok(r.room.endBeat*60/r.room.bpm>30);r.floor=FLOORS;r.room=makeRoom(r);assert.equal(r.room.plan.length,24);assert.deepEqual([4,36,68].map(b=>traitAt(r.room,b)),['armored','webs','frenzy'])});
test('enemy health demands most of a flawless performance and grows deeper in',()=>{for(const mode of ['easy','normal','hard']){const early=newRun(4,mode),late=newRun(4,mode);late.floor=7;late.room=makeRoom(late);
 for(const r of [early,late]){let combo=0,flawless=0;for(const n of roomChart(r))if(n.kind==='attack'){combo++;flawless+=traitAt(r.room,n.beat)==='armored'?4:4+Math.min(3,Math.floor(combo/10))}assert.ok(r.room.hp<flawless,'winnable without relics');if(mode!=='easy')assert.ok(r.room.hp>flawless*.5,'needs real accuracy')}
 assert.ok(late.room.hp/roomChart(late).filter(n=>n.kind==='attack').length>early.room.hp/roomChart(early).filter(n=>n.kind==='attack').length)}});
test('elite doors are tougher and heal on victory; campfires heal without a fight',()=>{const a=newRun(1),b=newRun(1);for(const r of [a,b]){winRoom(r);r.hp=5}enterDoor(a,0);enterDoor(b,1);assert.ok(b.room.elite);assert.ok(b.room.bpm>a.room.bpm);assert.ok(roomChart(b).filter(n=>n.kind==='guard').length>roomChart(a).filter(n=>n.kind==='guard').length);winRoom(b);assert.equal(b.hp,8);
 const c=newRun(1);winRoom(c);c.hp=4;const floor=c.floor;assert.ok(enterDoor(c,2));assert.equal(c.hp,9);assert.equal(c.floor,floor+1);assert.equal(c.status,'doors');assert.equal(c.doors.length,3)});
test('relics change how hits score',()=>{const r=newRun(7);r.room={...r.room,trait:'',hp:999,maxHp:999};
 assert.equal(hitEnemy(r,'Perfect',{lane:0}),4);r.relics=['drum'];assert.equal(hitEnemy(r,'Perfect',{lane:0}),6);assert.deepEqual(r.triggers,['War drum']);assert.equal(hitEnemy(r,'Perfect',{lane:1}),4);
 r.relics=['echo'];assert.equal(hitEnemy(r,'Perfect',{lane:1}),8);assert.equal(hitEnemy(r,'Great',{lane:1}),3);
 r.relics=['backstab'];assert.equal(hitEnemy(r,'Great',{lane:2,beat:5.5}),7);assert.equal(hitEnemy(r,'Great',{lane:2,beat:5}),3);
 r.relics=['encore'];assert.equal(hitEnemy(r,'Good',{rejoined:true}),8);
 r.relics=[];assert.equal(hitEnemy(r,'Perfect',{combo:25}),6);r.relics=['crescendo'];assert.equal(hitEnemy(r,'Perfect',{combo:25}),8);
 r.relics=['choir'];r.hp=5;for(let i=0;i<6;i++)hitEnemy(r,'Good',{lane:3});assert.equal(r.hp,6);
 r.relics=['parry'];assert.equal(block(r,'Great'),0);assert.equal(block(r,'Perfect'),4);
 r.relics=['clock'];assert.equal(hitWindow(r,.145),.175)});
test('missed shields hurt (harder deeper in); buckler and phoenix step in',()=>{const r=newRun(3);const hp=r.hp;assert.equal(enemyHit(r,{call:1}),1);assert.equal(r.hp,hp-1);
 const deep=newRun(3);deep.floor=5;deep.room=makeRoom(deep);assert.equal(enemyHit(deep,{call:1}),2);
 const b=newRun(3);b.relics=['buckler'];assert.equal(enemyHit(b,{call:1}),0);assert.equal(enemyHit(b,{call:1}),1);assert.equal(enemyHit(b,{call:5}),0);
 const p=newRun(3);p.relics=['phoenix'];p.hp=1;enemyHit(p,{call:1});assert.equal(p.hp,3);assert.equal(p.status,'combat');p.hp=1;enemyHit(p,{call:2});assert.equal(p.status,'dead')});
test('every call is echoed by a guard in the same lane one bar later, only in call and guard bars',()=>{for(const mode of ['easy','normal','hard'])for(const route of ['crypt','elite']){const run=newRun(5,mode);if(route==='elite'){run.floor=2;run.room=makeRoom(run,'elite')}const chart=roomChart(run),calls=chart.filter(n=>n.kind==='call'),guards=chart.filter(n=>n.kind==='guard');assert.ok(calls.length>0);assert.equal(calls.length,guards.length);for(const c of calls)assert.ok(guards.some(g=>g.lane===c.lane&&g.beat===c.beat+4));const bar=b=>run.room.plan[Math.floor((b-4)/4)];assert.ok(calls.every(n=>bar(n.beat)==='call')&&guards.every(n=>bar(n.beat)==='guard'));assert.ok(chart.filter(n=>n.kind==='attack').every(n=>bar(n.beat)==='attack'))}});
test('every attack gem is a real note of its lane instrument; all four bandmates play; drums open',()=>{for(const style of ['synth','funk','chip'])for(const mode of ['easy','normal','hard']){const run=newRun(99,mode);const chart=roomChart(run,style).filter(n=>n.kind==='attack'),events=compose(style,run.room.endBeat,run.floor);for(const n of chart)assert.ok(events.some(e=>e.beat===n.beat&&laneOf(e.kind)===n.lane),`${style}/${mode} ${n.beat}:${n.lane}`);assert.deepEqual([...new Set(chart.map(n=>n.lane))].sort(),[0,1,2,3]);assert.equal(chart[0].lane,0)}});
test('enemy traits: armor, feeding, off-beat, webs, slams, frenzy',()=>{
 const s=withTrait('armored');s.room.hp=s.room.maxHp=99;assert.equal(hitEnemy(s,'Good'),0);assert.ok(hitEnemy(s,'Great')>0);
 const m=withTrait('feeds');m.room.hp-=5;const hp=m.room.hp;assert.equal(enemyFeeds(m),3);assert.equal(m.room.hp,hp+3);assert.equal(enemyFeeds(withTrait('webs')),0);
 assert.ok(roomChart(withTrait('offbeat')).filter(n=>n.kind==='guard').every(n=>n.beat%1===.5));
 const web=roomChart(withTrait('webs')).filter(n=>n.webbed);assert.ok(web.length>0&&web.every(n=>n.kind==='attack'));
 const slam=roomChart(withTrait('slam')).filter(n=>n.kind==='guard');assert.ok(slam.some(a=>slam.some(b=>b!==a&&b.beat===a.beat&&b.lane!==a.lane)),'slams hit two lanes at once');
 assert.ok(roomChart(withTrait('frenzy')).filter(n=>n.kind==='guard').length>roomChart(withTrait('feeds')).filter(n=>n.kind==='guard').length)});
test('when the song ends, ordinary enemies strike and flee with the reward; the boss ends the run',()=>{const r=newRun(3);const hp=r.hp,reward=r.reward;assert.equal(fleeRoom(r),2);assert.equal(r.hp,hp-2);assert.equal(r.status,'doors');assert.equal(r.cleared,1);assert.ok(!r.relics.includes(reward));assert.ok(enterDoor(r,0));
 const b=newRun(3);b.floor=FLOORS;b.room=makeRoom(b);fleeRoom(b);assert.equal(b.status,'dead');
 const low=newRun(3);low.hp=1;fleeRoom(low);assert.equal(low.status,'dead')});
test('heart relic raises max health; death is terminal; new runs reset',()=>{const r=newRun(2);winRoom(r);const d=r.doors.findIndex(d=>d.relic);r.doors[d].relic='heart';enterDoor(r,d);winRoom(r);assert.equal(r.maxHp,16);
 const x=newRun(1);hurt(x,12);assert.equal(x.status,'dead');const hp=x.room.hp;hitEnemy(x,'Perfect');assert.equal(x.room.hp,hp);assert.equal(enterDoor(x,0),false);const fresh=newRun(2);assert.equal(fresh.hp,12);assert.equal(fresh.floor,1);assert.equal(fresh.relics.length,0);assert.equal(relics.length,12)});
