export const modes={easy:{bpm:72,window:.24},normal:{bpm:108,window:.145},hard:{bpm:132,window:.12}};
export function chart(mode){const notes=[];for(let beat=4;beat<64;beat++){notes.push({beat,lane:[0,2,1,3,0,1,2,3][beat%8],state:'pending'});if(mode==='hard'&&beat%4===2)notes.push({beat:beat+.5,lane:(beat+1)%4,state:'pending'});}return notes;}
export function judge(delta,window){const d=Math.abs(delta);return d<=.055?'Perfect':d<=.1?'Great':d<=window?'Good':null;}
export function nearest(notes,lane,beat,secondsPerBeat,window){return notes.filter(n=>n.state==='pending'&&n.lane===lane&&Math.abs((n.beat-beat)*secondsPerBeat)<=window).sort((a,b)=>Math.abs(a.beat-beat)-Math.abs(b.beat-beat))[0];}
