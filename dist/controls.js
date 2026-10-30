export const layouts={
 asdf:{keys:['a','s','d','f'],labels:['A','S','D','F'],description:'Four adjacent keys, left to right.'},
 arrows:{keys:['arrowleft','arrowdown','arrowup','arrowright'],labels:['←','↓','↑','→'],description:'Left, down, up, right — match the arrow on the note.'},
 dfjk:{keys:['d','f','j','k'],labels:['D','F','J','K'],description:'Left hand D / F · right hand J / K.'}
};
export function practiceChart(){return Array.from({length:8},(_,i)=>({beat:4+i*2,lane:i%4,state:'pending'}))}
export function explainTap(notes,lane,beat,spb){
 const target=notes.filter(n=>n.state==='pending').sort((a,b)=>Math.abs(a.beat-beat)-Math.abs(b.beat-beat))[0];
 if(target&&target.lane!==lane&&Math.abs(target.beat-beat)*spb<.3)return {kind:'WRONG KEY',expected:target.lane};
 const own=notes.filter(n=>n.lane===lane).sort((a,b)=>Math.abs(a.beat-beat)-Math.abs(b.beat-beat))[0];
 return {kind:own&&own.beat<beat?'TOO LATE':'TOO EARLY',expected:lane};
}
// Median tap error against the nearest click; median and MAD shrug off a stray double-tap.
export function calibrate(taps,clicks,spb){
 const deltas=taps.map(t=>clicks.reduce((best,c)=>Math.abs(t-c)<Math.abs(best)?t-c:best,Infinity)).filter(d=>Math.abs(d)<spb*.45);
 if(deltas.length<8)return null;
 const median=a=>{const s=[...a].sort((x,y)=>x-y),m=s.length>>1;return s.length%2?s[m]:(s[m-1]+s[m])/2};
 const mid=median(deltas),spread=median(deltas.map(d=>Math.abs(d-mid)));
 return {offset:Math.max(-200,Math.min(200,Math.round(mid*100)*10)),spread:Math.round(spread*1000),count:deltas.length};
}
