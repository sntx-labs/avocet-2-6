import * as T from './vendor/three.module.js';

export function random(seed){return()=>{seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}

// Geometry is authored in ship coordinates: the bow points toward -Z.
export function makeShip(materials){
 const root=new T.Group(),buckets=new Map(),inks=[],windowPanels=[],rng=random(31708);
 const vec=(x,y,z)=>new T.Vector3(x,y,z);
 function add(geo,mat,p=[0,0,0],rot=[0,0,0],outline=true){
  let m=new T.Matrix4().compose(vec(...p),new T.Quaternion().setFromEuler(new T.Euler(...rot)),vec(1,1,1));
  geo.applyMatrix4(m);
  if(outline){let ed=new T.EdgesGeometry(geo,25);inks.push(...ed.attributes.position.array);ed.dispose();}
  const g=geo.index?geo.toNonIndexed():geo;g.deleteAttribute('uv');
  if(!buckets.has(mat))buckets.set(mat,[]);buckets.get(mat).push(g);return g;
 }
 function box(w,h,d,x,y,z,mat='hull',b=.1){return add(bevelBox(w,h,d,b),materials[mat],[x,y,z]);}
 function cylinder(r,len,x,y,z,mat='hull',axis='z',r2=r,n=12){return add(new T.CylinderGeometry(r2,r,len,n,1),materials[mat],[x,y,z],axis==='z'?[Math.PI/2,0,0]:axis==='x'?[0,0,Math.PI/2]:[0,0,0]);}
 function sideArmor(thick,h,d,x,y,z,cut=.35){
  const shape=new T.Shape(),a=d/2,b=h/2;
  shape.moveTo(-a+cut,-b);shape.lineTo(a-cut,-b);shape.lineTo(a,-b+cut);shape.lineTo(a,b-cut);shape.lineTo(a-cut,b);shape.lineTo(-a+cut,b);shape.lineTo(-a,b-cut);shape.lineTo(-a,-b+cut);shape.closePath();
  const g=new T.ExtrudeGeometry(shape,{depth:thick,bevelEnabled:false,steps:1});g.translate(0,0,-thick/2);add(g,materials.hull,[x,y,z],[0,Math.PI/2,0]);
 }
 function line(points,mat='ink',radius=.027){for(let i=1;i<points.length;i++){let a=vec(...points[i-1]),b=vec(...points[i]),d=b.clone().sub(a);let g=new T.CylinderGeometry(radius,radius,d.length(),5);g.applyQuaternion(new T.Quaternion().setFromUnitVectors(vec(0,1,0),d.normalize()));add(g,materials[mat],a.add(b).multiplyScalar(.5).toArray(),[0,0,0],false);}}
 function wedge(sections,mat='hull'){ // each station: z, half width, bottom, top, bevel
  const vertices=[],idx=[];
  for(const [z,w,b,t,c]of sections)vertices.push(-w+c,t,z,w-c,t,z,w,t-c,z,w,b+c,z,w-c,b,z,-w+c,b,z,-w,b+c,z,-w,t-c,z);
  for(let j=0;j<sections.length-1;j++)for(let k=0;k<8;k++){let a=j*8+k,b=j*8+(k+1)%8,c=b+8,d=a+8;idx.push(a,d,b,b,d,c);}
  for(let k=1;k<7;k++){idx.push(0,k,k+1);let o=(sections.length-1)*8;idx.push(o,o+k+1,o+k);}
  let g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(vertices,3));g.setIndex(idx);g.computeVertexNormals();g=g.toNonIndexed();g.computeVertexNormals();return add(g,materials[mat]);
 }
 function plate(w,d,x,y,z,mat='hull',detail=true){
  box(w,.12,d,x,y,z,mat,Math.min(.09,w*.12,d*.12));
  if(!detail)return;
  // Little tabs, pin fasteners and chipped edge marks break up the perfect CAD lines.
  for(let i=0;i<3;i++){let px=x+(rng()-.5)*w*.86,pz=z+(rng()-.5)*d*.88;
   box(.026+rng()*.018,.012,.05+rng()*.16,px,y+.068,pz,rng()<.4?'hullLight':'ink',0);}
  for(let s of [-1,1])box(.13,.05,.27,x+s*w*.37,y+.09,z-d*.47,'hullLight',.02);
 }
 function vent(w,d,x,y,z,axis='top'){
  if(axis==='top'){box(w,.065,d,x,y,z,'dark',.04);for(let k=-d/2+.12;k<d/2;k+=.16)box(w*.92,.04,.043,x,y+.045,z+k,'steel',.01);}
  else {box(.08,w,d,x,y,z,'dark',.02);for(let k=-d/2+.1;k<d/2;k+=.17)box(.1,w*.88,.04,x,y,z+k,'steel',.01);}
 }
 // Deep charcoal keel and the massive multi-station chamfered main pressure hull.
 wedge([[-12,2.65,-1.6,.15,.32],[-9.3,3.45,-2.05,1.35,.6],[-4.5,3.9,-2.1,1.95,.55],[4,3.8,-1.65,1.9,.45],[9.8,3.2,-1.3,1.5,.5]],'dark');
 wedge([[-12.1,2.6,-.6,.2,.28],[-9.5,3.4,-.6,1.53,.55],[-4,3.95,-.35,2.12,.52],[3.8,3.8,-.25,2.1,.4],[9.5,3.1,-.3,1.62,.45]]);
 box(5.7,.44,12.6,0,-1.83,-2.8,'steel',.15);
 // Segmented port and starboard flank armor, undercut utility bays and skirt.
 for(const s of [-1,1]){
  for(let j=0;j<7;j++){
   const z=-8.7+j*2.55,x=s*(z<-8?3.68:4.02);
   box(.42,1.5,2.49,x,.63,z,'hull',.1);
   box(.29,.15,2.25,x+s*.11,-.19,z,'hullLight',.045);
   if(j<5){box(.46,1.15,2.43,s*(j===0?3.50:3.97),-1.40,z,'hull',.13);
    box(.2,.28,1.84,s*(j===0?3.51:3.98),-.66,z,'dark',.03);
    box(.37,.12,2.13,s*(j===0?3.50:3.98),-1.87,z,'hullLight',.04);
    for(let k=0;k<3;k++)box(.04,.34,.05,s*(j===0?3.68:4.14),-1.29,z-.8+k*.1,'steel',.01);
   }
   for(let k=0;k<5;k++)box(.016,.025+rng()*.08,.028,x+s*.12,.33+rng()*.7,z-1+rng()*2,'ink',0);
   box(.12,.22,.15,x+s*.14,1.12,z-.9,'steel',.015);
  }
  // Paired faded red circular insignia on forward side armor.
  for(const z of [-4.95,-2.4]){cylinder(.42,.024,s*4.245,.72,z,'red','x',.42,32);box(.04,.15,.05,s*4.265,.73,z+.13,'ink',0);}
  for(const z of [-8,-6.8,-1.1,1.3]){box(.045,.085,.43,s*3.94,.27,z,'steel',.012);}
 }
 // Broad bow deck: individual stepped armor tiles follow the taper.
 for(let j=0;j<4;j++){
  const z=-8.75+j*1.4,y=1.61+j*.15,w=2.92+j*.17;
  for(const s of [-1,1]){
   add(bevelBox(w,.14,1.32,.035),materials.hull,[s*(w/2+.05),y+.1,z],[-.107,0,0]);
   for(let k=0;k<3;k++){let zz=z+(rng()-.5)*1.1;box(.025,.016,.12,s*(.4+rng()*2.1),y+.19+(zz-z)*.107,zz,'ink',0);}
  }
 }
 for(const s of [-1,1]){
  add(bevelBox(2.41,.18,2.59,.065),materials.hull,[s*1.25,.92,-10.77],[-.473,0,0]);
  box(.2,1.02,1.7,s*2.87,-.31,-10.9,'hull',.06);
  box(.22,.79,.96,s*3.20,-.48,-9.67,'hull',.06);
  box(.14,.52,1.41,s*2.99,-1.18,-10.57,'hullLight',.045);
  for(let k=0;k<4;k++)box(.025,.022,.32,s*3.33,.55-k*.12,-9.43,'steel',.005);
 }
 add(bevelBox(1.72,.06,1.49,.015),materials.red,[0,1.84,-8.6],[-.107,0,0]);
 line([[-.62,1.84,-9.13],[.61,1.84,-9.13]],'redLight',.016);
 for(const s of [-1,1]){
  plate(1.24,2.65,s*2.59,1.72,-7.5);
  vent(.8,1.3,s*1.74,2.22,-5.52);
  plate(1.26,.65,s*2.25,2.26,-4.28);
  box(.12,.16,.36,s*2.26,2.4,-4.28,'steel',.03);
  plate(.64,1.15,s*2.56,1.98,-7.02,'hullLight',false);
  // Blunt split grille at the bow, with light armor brow.
  box(2.42,.95,.16,s*1.28,-.37,-12.14,'dark',.08);
  for(let j=0;j<5;j++)box(2.24,.037,.07,s*1.28,-.71+j*.16,-12.24,'steel',.01);
  box(2.48,.18,.3,s*1.29,.21,-12.02,'hullLight',.04);
  box(.13,.85,.12,s*2.56,-.33,-12.22,'hull',.03);
  box(2.1,.22,.4,s*1.3,-.94,-11.93,'hull',.04);
 }
 // Recessed bridge well, red command module and its faceted almost-black glass.
 box(5.23,.17,5.2,0,2.18,-.96,'dark',.2);
 for(const s of [-1,1])box(.44,.45,5.3,s*2.55,2.35,-.9,'hull',.15);
 box(4.85,.3,.35,0,2.31,-3.7,'hullLight',.06);
 // Open shell: the former solid red wedge intersected the glazing. Each window
 // now occupies its own planar aperture, with adjoining (non-overlapping) frames.
 wedge([[-3.28,1.98,2.26,2.69,.10],[-1.95,1.98,2.29,2.69,.10],[.84,1.98,2.31,2.69,.10],[1.64,1.52,2.3,2.69,.10]],'red');
 const A=[-1.65,3.91,-1.94],B=[1.65,3.91,-1.94],C=[1.95,2.71,-3.28],D=[-1.95,2.71,-3.28];
 function face(v,mat){const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(v.flat(),3));g.setIndex([0,1,2,0,2,3]);g.computeVertexNormals();add(g,materials[mat]);}
 function glazing(corners,name){
  const outer=corners.map(p=>vec(...p)),center=outer.reduce((c,p)=>c.add(p),vec(0,0,0)).multiplyScalar(.25);
  const inner=outer.map(p=>p.clone().lerp(center,.10));
  for(let j=0;j<4;j++)face([outer[j],outer[(j+1)%4],inner[(j+1)%4],inner[j]].map(p=>p.toArray()),'red');
  const points=inner.map(p=>p.toArray());face(points,'glass');windowPanels.push({name,points});
  line([...corners,corners[0]],'redLight',.045);
  return inner;
 }
 glazing([A,D,C,B],'windshield');
 line([[0,3.91,-1.965],[0,2.71,-3.305]],'red',.055);
 line([[-1.55,3.85,-2.03],[0,2.77,-3.24],[1.55,3.85,-2.03]],'red',.034);
 for(const s of [-1,1]){
  glazing([[s*1.65,3.91,-1.94],[s*1.95,2.71,-3.28],[s*1.95,2.71,.85],[s*1.65,3.91,.85]],s<0?'port window':'starboard window');
  line([[s*1.67,3.91,-.67],[s*1.97,2.71,-1.42]],'red',.055);
  line([[s*1.69,3.83,.63],[s*1.95,2.79,-1.37]],'red',.037);
  for(let j=0;j<4;j++)box(.07,.58,.10,s*1.75,2.82,1+j*.17,'redLight',.012);
 }
 face([[-1.65,3.91,.85],[1.65,3.91,.85],[1.95,2.71,.85],[-1.95,2.71,.85]],'red');
 box(3.32,.12,2.81,0,3.97,-.545,'red',.025);
 for(let j=0;j<4;j++)plate(3.32,.37,0,4.04+j*.035,-1.4+j*.58,j%2?'red':'redLight',false);
 box(1.1,.05,.78,.38,4.21,-.38,'red',.06);cylinder(.28,.055,.38,4.25,-.38,'dark','y',.28,12);
 // Rear superstructure, two tall antenna fins, and the rectangular central tower.
 for(const s of [-1,1]){
  box(2.3,1.15,3.7,s*2.03,2.45,4.2,'hull',.26);
  for(let j=0;j<3;j++)plate(2.11,1.08,s*2.03,3.055,3+j*1.18);
  box(1.15,.08,.85,s*2.02,3.16,4.9,'steel',.045);
  box(.7,.06,.64,s*2.02,3.22,4.9,'hull',.035);
  box(1.0,1.1,1.55,s*4.52,2.75,7.31,'hull',.25);
  box(.71,4.9,.49,s*4.51,5.62,7.29,'hull',.08);
  box(.54,4.55,.09,s*4.51,5.67,6.99,'hullLight',.02);
  line([[s*4.51,3.45,6.93],[s*4.51,7.87,6.93]],'steel',.021);
  for(const y of [4.1,6.2,7.6])box(.57,.06,.04,s*4.51,y,6.92,'steel',.008);
  box(.95,.28,.82,s*4.51,3.35,7.3,'steel',.08);
 }
 box(2.9,2.35,2.45,0,3.5,6.6,'hull',.24);
 box(2.47,1.88,.15,0,3.5,5.29,'dark',.21);
 for(let i=0;i<4;i++){
  const x=1.16-i*.09;line([[-x,2.73,5.14],[-x,4.22-i*.07,5.14],[x,4.22-i*.07,5.14],[x,2.73,5.14]],i%2?'steel':'hullLight',.035);
 }
 plate(2.2,1.64,0,4.74,6.65);
 cylinder(.045,2.6,2.65,4.0,2.4,'steel','y',.026,7);
 cylinder(.08,.15,2.65,5.32,2.4,'redLight','y');
 // Oversized stern sponsons. Open dark insets show ribbed mechanical cores.
 for(const s of [-1,1]){
  box(2.82,3.66,7.75,s*4.63,.18,5.1,'steel',.5);
  for(let j=0;j<6;j++){
   box(3.07,.48,1.18,s*4.67,1.99,1.87+j*1.31,'hull',.17);
   if(j%2===0){sideArmor(.57,3.05,2.51,s*6.1,.0,2.48+j*1.31,.48);
    box(.09,.84,1.15,s*6.4,-.47,2.48+j*1.31,'hullLight',.06);
    line([[s*6.43,.63,2+j*1.31],[s*6.43,.3,2+j*1.31],[s*6.43,.2,2.45+j*1.31],[s*6.43,-.83,2.45+j*1.31]],'steel',.019);
   }
   box(.36,.36,1.08,s*5.8,-1.61,1.86+j*1.31,'hullLight',.12);
  }
  box(1.9,2.8,.42,s*4.77,.06,1.01,'dark',.3);
  for(let j=0;j<11;j++)box(1.57,.056,.1,s*4.77,-1.1+j*.23,.74,'steel',.012);
  // Forward-facing side utility nozzle and its concentric housing.
  for(let j=0;j<4;j++)cylinder(.86-j*.13,.24,s*4.04,1.1,.91-j*.23,j%2?'steel':'hull','z');
  cylinder(.36,.15,s*4.04,1.1,.03,'dark','z');
  for(let j=0;j<4;j++)box(.6,.027,.018,s*4.04,.87+j*.14,-.061,'steel',0);
  // Pod aft engines; pale exhaust will be added separately at runtime.
  cylinder(1.06,.62,s*4.65,.15,9.1,'hull','z');
  cylinder(.85,.35,s*4.65,.15,9.5,'dark','z');
  cylinder(.59,.06,s*4.65,.15,9.7,'engine','z');
  for(const z of [3,5.8,7.9]){
   vent(.72,.85,s*6.425,.62,z,'side');
   line([[s*6.29,-.6,z-.4],[s*6.29,-1.08,z-.4],[s*6.29,-1.08,z+.43]],'steel',.044);
   box(.06,.34,.5,s*6.41,1.16,z+.16,'red',.02);
   for(let k=0;k<4;k++)box(.02,.36,.025,s*6.46,1.17,z+.01+k*.09,'hullLight',0);
  }
  // Long forward sensor booms at the shoulders.
  box(1.17,.91,3.95,s*4.12,1.58,-2.19,'hull',.22);
  cylinder(.3,.65,s*4.12,1.63,-4.39,'steel','z');
  cylinder(.21,.43,s*4.12,1.63,-4.81,'hull','z');
  cylinder(.051,3.5,s*4.12,1.63,-6.76,'hullLight','z',.037,7);
  // Exposed pipes underneath the lower forward edge.
  line([[s*2.9,-1.9,-3.2],[s*3.7,-2.27,-3.6],[s*3.7,-2.27,-6.4],[s*3.19,-1.9,-7]],'steel',.06);
  cylinder(.054,2,s*2.4,-2.17,-7.1,'hullLight','z');
 }
 // Deck service plates, small blocks, and deliberately sparse fine engraving.
 // The reverse view is fully modeled too: service hatch, vented bulkhead and pipes.
 box(5.72,2.44,.22,0,.07,9.86,'hull',.08);
 box(3.07,1.66,.12,0,.13,10.04,'dark',.045);
 box(2.79,1.40,.08,0,.13,10.12,'steel',.035);
 for(let j=0;j<8;j++)box(2.50,.063,.08,0,-.41+j*.15,10.20,'dark',.01);
 for(const s of [-1,1]){
  box(.84,1.91,.10,s*2.20,.07,10.02,'hullLight',.035);
  box(.5,.28,.035,s*2.20,.74,10.09,'red',.015);
  line([[s*1.72,-.75,10.12],[s*1.72,.61,10.12],[s*1.53,.88,10.12]],'steel',.043);
  for(let k=0;k<4;k++)box(.041,.12,.05,s*2.4,-.54+k*.24,10.10,'steel',.007);
  box(2.26,.37,.29,s*1.2,-1.28,-12.08,'hull',.07);
 }
 box(.13,1.9,.14,0,.09,10.25,'hull',.025);
 box(3.2,.20,.24,0,1.29,9.99,'hullLight',.045);
 for(let i=0;i<42;i++){
  const s=rng()<.5?-1:1,z=2.1+rng()*6.5,x=s*(.3+rng()*2.6);
  plate(.18+rng()*.55,.16+rng()*.46,x,2.14,z,rng()<.22?'steel':'hull',false);
 }
 for(const s of [-1,1]){
  for(let j=0;j<115;j++){
   let z=-7.2+rng()*8.9,x=s*4.239,y=-1.82+rng()*3.1;
   if(y>-.88&&y<-.16)continue;
   box(.013,.015+rng()*.025,.035+rng()*.10,x,y,z,rng()<.6?'steel':'hullLight',0);
  }
  for(const z of [-6.9,-4.4,-1.85]){
   line([[s*4.25,1.28,z],[s*4.25,1.11,z],[s*4.25,1.11,z+.15],[s*4.25,.72,z+.15]],'steel',.014);
   box(.02,.17,.23,s*4.26,.07,z+.6,'steel',.005);
   for(let k=0;k<3;k++)box(.025,.11,.018,s*4.275,.08,z+.52+k*.055,'hullLight',0);
  }
 }
 // Merge by material so hundreds of authored details remain inexpensive to render.
 for(const[material,geos]of buckets){
  let ps=[],ns=[];for(const g of geos){ps.push(...g.attributes.position.array);ns.push(...g.attributes.normal.array);g.dispose();}
  const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(ps,3));geo.setAttribute('normal',new T.Float32BufferAttribute(ns,3));
  const mesh=new T.Mesh(geo,material);root.add(mesh);
 }
 const lg=new T.BufferGeometry();lg.setAttribute('position',new T.Float32BufferAttribute(inks,3));
 const outlines=new T.LineSegments(lg,new T.LineBasicMaterial({color:0x242a29,transparent:true,opacity:.78}));root.add(outlines);
 return {root,outlines,windowPanels};
}

// Beveled rectangular solid with eight corners per cross-section.
function bevelBox(w,h,d,b){
 b=Math.min(b,w*.24,h*.24,d*.24);if(b<.001)return new T.BoxGeometry(w,h,d);
 const shape=new T.Shape();const x=w/2-b,z=d/2-b;
 shape.moveTo(-x+b,-z);shape.lineTo(x-b,-z);shape.lineTo(x,-z+b);shape.lineTo(x,z-b);shape.lineTo(x-b,z);shape.lineTo(-x+b,z);shape.lineTo(-x,z-b);shape.lineTo(-x,-z+b);shape.closePath();
 const g=new T.ExtrudeGeometry(shape,{depth:h-2*b,bevelEnabled:true,bevelSegments:1,steps:1,bevelSize:b,bevelThickness:b,curveSegments:1});
 g.rotateX(-Math.PI/2);g.translate(0,-h/2+b,0);return g;
}

