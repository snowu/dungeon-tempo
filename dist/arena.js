// The stage: enemy arena on top, four lanes, keycaps on the hit line, the band underneath.
// Sprites come from Kenney's Tiny Dungeon sheet (16px tiles, 12 per row).
export const geo={W:640,H:680,top:164,hit:548,px:105,band:588,enemyX:320,enemyY:80,laneX:l=>32+l*144,laneC:l=>104+l*144};
const BAND=[96,84,112,121];

export function createArena(g,art,colors,reduced){
 const fx=[],particles=[],bandHurt=[0,0,0,0],enemy={sprite:46,hurtAt:-1e9,lungeAt:-1e9,enterAt:-1e9,deathAt:0,boss:false};
 const ease=k=>1-(1-k)**3;
 function sprite(id,x,y,size){if(art.complete&&art.naturalWidth)g.drawImage(art,(id%12)*16,Math.floor(id/12)*16,16,16,Math.round(x),Math.round(y),size,size)}
 function burst(x,y,color,count,speed,now){if(reduced)return;for(let i=0;i<count;i++){const a=Math.PI*2*i/count+Math.random()*.4,v=speed*(.5+Math.random());particles.push({x,y,vx:Math.cos(a)*v,vy:Math.sin(a)*v-1,color,t0:now,life:420+Math.random()*300})}}
 function popup(text,color,x,y,now,size=22){fx.push({type:'popup',text,color,x,y,t0:now,dur:800,size})}

 return {
  enemy,
  // A new foe drops into the arena.
  reset(room,now){Object.assign(enemy,{sprite:room.sprite,boss:Boolean(room.boss),enterAt:now,deathAt:0,hurtAt:-1e9,lungeAt:-1e9});fx.length=particles.length=0},
  idle(spriteId){Object.assign(enemy,{sprite:spriteId,boss:false,enterAt:-1e9,deathAt:0});fx.length=particles.length=0},
  // A band hit flies up its lane into the enemy; damage shows when it lands.
  bolt(lane,color,label,now){fx.push({type:'bolt',lane,color,label,t0:now,dur:reduced?1:170})},
  glance(lane,now){fx.push({type:'bolt',lane,color:'#aab9c5',label:'CLANK',t0:now,dur:reduced?1:170,glance:true})},
  // The enemy's call: it lunges and marks the lane.
  call(lane,now){enemy.lungeAt=now;fx.push({type:'beam',lane,t0:now,dur:380})},
  // A missed shield: the enemy's strike reaches the bandmate in that lane.
  strike(lane,label,now){enemy.lungeAt=now;fx.push({type:'slash',lane,label,t0:now,dur:reduced?1:220})},
  block(lane,now){burst(geo.laneC(lane),geo.hit,'#9fd8ff',10,3,now);popup('BLOCK','#9fd8ff',geo.laneC(lane),geo.hit-44,now,16)},
  heal(text,now){popup(text,'#7cf0a0',geo.enemyX,geo.enemyY-30,now,18)},
  note(text,color,now){popup(text,color,geo.enemyX,geo.enemyY+70,now,15)},
  die(now){enemy.deathAt=now;burst(geo.enemyX,geo.enemyY,'#ffd27a',28,5,now);burst(geo.enemyX,geo.enemyY,'#ffffff',12,3,now)},

  backdrop(now,pulse){
   const grad=g.createLinearGradient(0,0,0,geo.top);grad.addColorStop(0,'#141924');grad.addColorStop(1,'#1d1a22');g.fillStyle=grad;g.fillRect(0,0,geo.W,geo.top-6);
   g.globalAlpha=.32;for(let x=0;x<20;x++){sprite(40,x*32,0,32);sprite(40,x*32,32,32)}g.globalAlpha=.22;for(let x=0;x<20;x++)sprite(x%5?48:49,x*32,96,32);g.globalAlpha=1;
   // Torches on the wall flicker with the beat.
   for(const x of [70,570]){g.globalAlpha=.25+pulse*.25;g.fillStyle='#ff9d3c';g.beginPath();g.arc(x,40,26,0,Math.PI*2);g.fill();g.globalAlpha=1;sprite(29,x-16,24,32)}
   g.fillStyle='#0c0f15';g.fillRect(0,geo.top-6,geo.W,6);
  },
  lanes(now,pulse,flashes,silenced){
   for(let lane=0;lane<4;lane++){const x=geo.laneX(lane),h=geo.hit+30-geo.top;
    g.fillStyle=lane%2?'#1c2330':'#19212b';g.fillRect(x,geo.top,144,h);g.strokeStyle='#ffffff07';g.strokeRect(x,geo.top,144,h);
    g.globalAlpha=(.04+pulse*.04)*(silenced[lane]?.3:1);g.fillStyle=colors[lane];g.fillRect(x,geo.top,144,h);
    g.globalAlpha=.45;g.fillRect(x+8,geo.hit-2,128,3);g.globalAlpha=1;
    if(flashes[lane]>now){g.globalAlpha=.2;g.fillRect(x,geo.hit-80,144,110);g.globalAlpha=1}}
  },
  enemySprite(now,beat,{winding,hpRatio,show=true}){
   if(!show)return;
   const size=enemy.boss?128:112,base=geo.enemyY-size/2;let x=geo.enemyX-size/2,y=base,alpha=1,scale=1;
   y+=reduced?0:Math.sin(now/380)*3;
   const enter=(now-enemy.enterAt)/650;if(enter<1)y-=(1-ease(Math.max(0,enter)))*170;
   const hurt=(now-enemy.hurtAt)/160;if(hurt<1&&!reduced)y-=(1-hurt)*7;
   const lunge=(now-enemy.lungeAt)/220;if(lunge<1&&!reduced){y+=Math.sin(lunge*Math.PI)*14;scale+=Math.sin(lunge*Math.PI)*.08}
   if(winding&&!reduced){x+=(Math.random()-.5)*3;y+=(Math.random()-.5)*2}
   if(enemy.deathAt){const k=Math.min(1,(now-enemy.deathAt)/700);alpha=1-k;scale+=k*.5;y-=k*20}
   if(alpha<=0)return;
   // Shadow, then a red aura while it winds up.
   g.globalAlpha=.35*alpha;g.fillStyle='#000';g.beginPath();g.ellipse(geo.enemyX,base+size+4,size*.36,8,0,0,Math.PI*2);g.fill();
   if(winding){const r=g.createRadialGradient(geo.enemyX,geo.enemyY,8,geo.enemyX,geo.enemyY,size*.8);r.addColorStop(0,'#ff5a5299');r.addColorStop(1,'#ff5a5200');g.globalAlpha=alpha*(.6+.4*Math.sin(now/90));g.fillStyle=r;g.fillRect(geo.enemyX-size,geo.enemyY-size,size*2,size*2)}
   g.globalAlpha=alpha;const s=size*scale;sprite(enemy.sprite,geo.enemyX-s/2+(x-(geo.enemyX-size/2)),y-(s-size)/2,s);
   if(hurt<1){g.globalCompositeOperation='lighter';g.globalAlpha=(1-hurt)*.85*alpha;sprite(enemy.sprite,geo.enemyX-s/2+(x-(geo.enemyX-size/2)),y-(s-size)/2,s);g.globalCompositeOperation='source-over'}
   g.globalAlpha=1;
   if(hpRatio!=null&&!enemy.deathAt){const w=220,bx=geo.enemyX-w/2,by=8;g.fillStyle='#00000099';g.fillRect(bx-2,by-2,w+4,10);g.fillStyle='#3a1f25';g.fillRect(bx,by,w,6);g.fillStyle=hpRatio>.3?'#f0a07d':'#ff5a52';g.fillRect(bx,by,w*hpRatio,6)}
  },
  band(now,pulse,silenced,hops){
   for(let lane=0;lane<4;lane++){const cx=geo.laneC(lane),hurt=(now-bandHurt[lane])/350,hop=reduced?0:hops[lane];
    g.globalAlpha=.35;g.fillStyle=colors[lane];g.beginPath();g.ellipse(cx,geo.band+50,26,6,0,0,Math.PI*2);g.fill();
    g.globalAlpha=silenced[lane]?.3:1;sprite(BAND[lane],cx-24+(hurt<1&&!reduced?Math.sin(hurt*40)*3:0),geo.band-(reduced||silenced[lane]?0:pulse*4)-hop+(silenced[lane]?5:0),48);
    if(hurt<1){g.globalCompositeOperation='lighter';g.globalAlpha=(1-hurt)*.8;g.fillStyle='#ff3b30';g.fillRect(cx-26,geo.band-4,52,56);g.globalCompositeOperation='source-over'}
    g.globalAlpha=silenced[lane]?.95:.6;g.font='bold 10px sans-serif';g.textAlign='center';g.fillStyle=silenced[lane]?'#ff8b83':colors[lane];
    g.fillText(silenced[lane]?'OUT':['DRUMS','MELODY','BASS','CHORDS'][lane],cx,geo.band+68);g.globalAlpha=1}
  },
  effects(now){
   for(let i=fx.length-1;i>=0;i--){const f=fx[i],k=Math.min(1,(now-f.t0)/f.dur);
    if(f.type==='bolt'){const x0=geo.laneC(f.lane),y0=geo.hit,x1=geo.enemyX,y1=geo.enemyY+10,e=ease(k),x=x0+(x1-x0)*e,y=y0+(y1-y0)*e;
     g.strokeStyle=f.color;g.lineWidth=4;g.globalAlpha=.9;g.beginPath();g.moveTo(x0+(x1-x0)*Math.max(0,e-.25),y0+(y1-y0)*Math.max(0,e-.25));g.lineTo(x,y);g.stroke();g.lineWidth=1;g.globalAlpha=1;
     if(k>=1){fx.splice(i,1);if(!f.glance)enemy.hurtAt=now;burst(x1,y1,f.color,f.glance?4:9,f.glance?1.5:3,now);popup(f.label,f.color,x1+(Math.random()-.5)*60,y1-30,now,f.glance?15:24)}continue}
    if(f.type==='slash'){const x1=geo.laneC(f.lane),y1=geo.band+20,e=ease(k),x=geo.enemyX+(x1-geo.enemyX)*e,y=geo.enemyY+(y1-geo.enemyY)*e;
     g.strokeStyle='#ff5a52';g.lineWidth=6;g.globalAlpha=.85;g.beginPath();g.moveTo(geo.enemyX+(x1-geo.enemyX)*Math.max(0,e-.3),geo.enemyY+(y1-geo.enemyY)*Math.max(0,e-.3));g.lineTo(x,y);g.stroke();g.lineWidth=1;g.globalAlpha=1;
     if(k>=1){fx.splice(i,1);bandHurt[f.lane]=now;burst(x1,y1,'#ff5a52',12,3.5,now);popup(f.label,'#ff8b83',x1,geo.band-12,now,20)}continue}
    if(f.type==='beam'){const x=geo.laneC(f.lane);g.globalAlpha=(1-k)*.5;g.strokeStyle='#ff5a52';g.lineWidth=3;g.beginPath();g.moveTo(geo.enemyX,geo.enemyY+30);g.lineTo(x,geo.top+20);g.stroke();g.lineWidth=1;g.globalAlpha=1;if(k>=1)fx.splice(i,1);continue}
    if(f.type==='popup'){g.globalAlpha=1-k*k;g.fillStyle=f.color;g.font=`800 ${f.size}px 'Space Grotesk',sans-serif`;g.textAlign='center';g.strokeStyle='#0c0f15';g.lineWidth=4;const y=f.y-ease(k)*36;g.strokeText(f.text,f.x,y);g.fillText(f.text,f.x,y);g.lineWidth=1;g.globalAlpha=1;if(k>=1)fx.splice(i,1)}
   }
   for(let i=particles.length-1;i>=0;i--){const p=particles[i],k=(now-p.t0)/p.life;if(k>=1){particles.splice(i,1);continue}p.x+=p.vx;p.y+=p.vy;p.vy+=.12;g.globalAlpha=1-k;g.fillStyle=p.color;g.fillRect(p.x-2,p.y-2,4,4)}g.globalAlpha=1;
  }
 };
}
