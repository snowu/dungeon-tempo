import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {songs,loadSong,openmpt,isolate,trackerScore,trackerBpm,renderStems,startOf,songFor,setlist,isTracker} from '../dist/tracker.js';
import {compose,laneOf} from '../dist/music.js';import {newRun,roomChart,makeRoom} from '../dist/expedition.js';
const bytes=id=>new Uint8Array(fs.readFileSync(new URL('../dist/songs/'+songs[id].file,import.meta.url)));
test('every song loads, has a steady playable tempo, and every floor gives each bandmate a share of the room',async()=>{for(const id of Object.keys(songs)){const s=await loadSong(id,bytes(id));
 assert.ok(s.data.bpm>=70&&s.data.bpm<=130,`${id} plays at ${s.data.bpm}`);assert.equal(new Set(s.lanes.flat()).size,s.lanes.flat().length,'no channel in two lanes');
 const score=trackerScore(id,70,1).filter(e=>e.kind!=='click');for(let lane=0;lane<4;lane++)assert.ok(score.some(e=>laneOf(e.kind)===lane),`${id} lane ${lane}`);
 for(const floor of [1,4,8]){const run=newRun(9,'normal');run.floor=floor;const chart=roomChart(run,id).filter(n=>n.kind==='attack');assert.ok(chart.length>=28,`${id} floor ${floor}: ${chart.length} gems`);for(let lane=0;lane<4;lane++)assert.ok(chart.filter(n=>n.lane===lane).length>=2,`${id} floor ${floor} lane ${lane}`)}}});
test('isolating channels keeps only their notes and leaves the module playable',async()=>{const L=await openmpt(),src=bytes('djinn');await loadSong('djinn',src);const iso=isolate(src,new Set([2]));
 const p=L._malloc(iso.length);L.HEAPU8.set(iso,p);const m=L._openmpt_module_create_from_memory(p,iso.length,0,0,0);L._free(p);assert.ok(m);
 let others=0,kept=0;for(let o=0;o<L._openmpt_module_get_num_orders(m);o++){const pat=L._openmpt_module_get_order_pattern(m,o);for(let r=0;r<L._openmpt_module_get_pattern_num_rows(m,pat);r++)for(let c=0;c<4;c++){const n=L._openmpt_module_get_pattern_row_channel_command(m,pat,r,c,0);if(n>0)c===2?kept++:others++}}
 assert.equal(others,0);assert.ok(kept>100);assert.ok(Math.abs(L._openmpt_module_get_duration_seconds(m)-songs.djinn.data.total*songs.djinn.data.spb)<.5,'same length');L._openmpt_module_destroy(m)});
test('rooms become charts from the song, start elsewhere on each floor and loop past the end',async()=>{await loadSong('dim-dungeon',bytes('dim-dungeon'));
 assert.notEqual(startOf(songs['dim-dungeon'].data,1).beat,startOf(songs['dim-dungeon'].data,5).beat);
 const long=trackerScore('dim-dungeon',400,1);assert.ok(long.filter(e=>e.beat>songs['dim-dungeon'].data.total+4).length>50,'loops');
 const run=newRun(4,'normal'),chart=roomChart(run,'dim-dungeon').filter(n=>n.kind==='attack'),events=compose('dim-dungeon',run.room.endBeat,run.floor);
 assert.ok(chart.length>20);for(const n of chart)assert.ok(events.some(e=>e.beat===n.beat&&laneOf(e.kind)===n.lane));
 assert.equal(trackerBpm('dim-dungeon','normal'),songs['dim-dungeon'].data.bpm);assert.ok(trackerBpm('dim-dungeon','easy')<trackerBpm('dim-dungeon','hard'))});
test('the four stems add up to the full song',async()=>{const s=await loadSong('necromancer',bytes('necromancer')),L=await openmpt();
 const stems=renderStems('necromancer',{beats:16,bpm:s.data.bpm,sampleRate:22050});assert.equal(stems.length,4);
 const p=L._malloc(s.bytes.length);L.HEAPU8.set(s.bytes,p);const m=L._openmpt_module_create_from_memory(p,s.bytes.length,0,0,0);L._free(p);L._openmpt_module_set_position_order_row(m,startOf(s.data,1).order,0);
 const n=stems[0][0].length,l=L._malloc(n*4),r=L._malloc(n*4);L._openmpt_module_read_float_stereo(m,22050,n,l,r);const full=L.HEAPF32.slice(l>>2,(l>>2)+n);
 let err=0,energy=0;for(let i=0;i<n;i++){const sum=stems.reduce((a,st)=>a+st[0][i],0);err+=(sum-full[i])**2;energy+=full[i]**2}assert.ok(energy>0&&err/energy<.02,`residual ${err/energy}`);
 for(const st of stems)assert.ok(st[0].some(x=>Math.abs(x)>.01),'every stem plays');L._free(l);L._free(r);L._openmpt_module_destroy(m)});
test('the mixtape changes song every floor, gets faster going down, jumps ahead behind elite doors and saves the heaviest for the boss',async()=>{for(const id of new Set(setlist))await loadSong(id,bytes(id));
 const bpm=f=>songs[songFor('mixtape',f)].data.bpm;for(let f=2;f<=7;f++)assert.ok(bpm(f)>=bpm(f-1),`floor ${f}`);assert.ok(bpm(7)>bpm(1));
 assert.equal(songFor('mixtape',1),'dim-dungeon');assert.equal(songFor('mixtape',1,true),songFor('mixtape',2));assert.equal(songFor('mixtape',8),'mega-destruction');assert.notEqual(songFor('mixtape',7,true),'mega-destruction');
 assert.equal(songFor('djinn',5),'djinn');assert.equal(songFor('synth',3),'synth');assert.ok(isTracker('mixtape')&&!isTracker('synth'))});

