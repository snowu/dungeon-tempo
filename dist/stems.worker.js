// Renders a room's four tracker stems off the main thread, so picking a door never freezes the page.
// Jobs run one at a time in arrival order; the finished channels are transferred back, not copied.
import {loadSong,renderStems,loudness} from './tracker.js';
let queue=Promise.resolve();
self.onmessage=({data:{id,style,beats,intensity,bpm,sampleRate}})=>{queue=queue.then(async()=>{
 try{await loadSong(style);const stems=renderStems(style,{beats,intensity,bpm,sampleRate});
  self.postMessage({id,stems,level:loudness(stems),sampleRate},stems.flat().map(a=>a.buffer))}
 catch(e){self.postMessage({id,error:String(e?.message||e)})}
})};
