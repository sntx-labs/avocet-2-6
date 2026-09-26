import * as T from './vendor/three.module.js';
import {random} from './ship.js';

function geometry(seed,detail){
 const rng=random(seed),geo=new T.IcosahedronGeometry(1,detail),p=geo.attributes.position,v=new T.Vector3();
 const phase=[rng()*9,rng()*9,rng()*9],craters=Array.from({length:14},()=>({dir:new T.Vector3(rng()-.5,rng()-.5,rng()-.5).normalize(),radius:.12+rng()*.27,depth:.04+rng()*.13}));
 for(let i=0;i<p.count;i++){
  v.fromBufferAttribute(p,i).normalize();const x=v.x,y=v.y,z=v.z;
  let d=1+.17*Math.sin(x*6+phase[0])*Math.sin(z*5+phase[1])*Math.cos(y*7+phase[2]);
  d+=.065*Math.sin(x*19+z*13)*Math.sin(y*17-z*9)+.03*Math.cos(x*39+y*31)*Math.sin(z*37);
  for(const c of craters){let a=v.distanceTo(c.dir)/c.radius;if(a<1.3)d-=c.depth*Math.exp(-a*a*3);}
  p.setXYZ(i,x*d*(.8+phase[0]*.05),y*d,z*d*(.85+phase[1]*.04));
 }
 geo.computeVertexNormals();return geo;
}

export function createBelt(material,settings){
 const group=new T.Group(),temp=new T.Object3D();let rocks=[],bins=[],recycled=0,lodCounts=[0,0,0];
 function rebuild(){
  for(const m of group.children){m.geometry.dispose();m.dispose();}group.clear();bins=[];rocks=[];recycled=0;
  const rng=random(settings.rockSeed),count=settings.asteroidCount,variants=9,capacity=Math.ceil(count/variants);
  for(let variant=0;variant<variants;variant++){
   for(const detail of [10,5,2]){
    const geo=geometry(settings.rockSeed+variant*951,detail),fade=new T.InstancedBufferAttribute(new Float32Array(capacity),1).setUsage(T.DynamicDrawUsage);geo.setAttribute('instanceFade',fade);
    const mesh=new T.InstancedMesh(geo,material,capacity);mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);mesh.frustumCulled=false;mesh.count=0;group.add(mesh);bins.push(mesh);
   }
  }
  const closeCount=Math.round(count*.05),middleCount=Math.round(count*.25);
  for(let i=0;i<count;i++){
   const layer=i<closeCount?0:i<closeCount+middleCount?1:2;
   const range=layer===0?240:layer===1?settings.fieldRadius*.24:settings.fieldRadius;
   const position=new T.Vector3((rng()-.5)*2,(rng()-.5)*2,(rng()-.5)*2).multiplyScalar(range);
   if(position.length()<40)position.setLength(65);
   const size=(rng()<.075?6+rng()*8:.35+Math.pow(rng(),3)*5)*settings.asteroidScale*(layer===0?1:layer===1?1.8:3.8);
   const rotation=new T.Euler(rng()*6,rng()*6,rng()*6);
   temp.position.set(0,0,0);temp.rotation.copy(rotation);temp.scale.setScalar(size);temp.updateMatrix();
   rocks.push({variant:i%variants,position,range,size,rotation,spin:(rng()-.5)*.05,matrix:new Float32Array(temp.matrix.elements)});
  }
  [[-26,10,-9,9],[8,-12,14,3.8],[-10,-16,-17,6],[-9,5,18,1.2],[9,8,-15,1.1]].forEach((a,i)=>{
   const r=rocks[i];r.position.set(...a.slice(0,3));r.size=a[3]*settings.asteroidScale;
   temp.position.set(0,0,0);temp.rotation.copy(r.rotation);temp.scale.setScalar(r.size);temp.updateMatrix();r.matrix.set(temp.matrix.elements);
  });
  update(0,new T.Vector3());
 }
 function update(dt,delta){
  for(const b of bins)b.count=0;lodCounts=[0,0,0];
  for(const r of rocks){
   const p=r.position,R=r.range;p.sub(delta);
   for(const axis of ['x','y','z'])if(p[axis]>R||p[axis]<-R){p[axis]=T.MathUtils.euclideanModulo(p[axis]+R,2*R)-R;recycled++;}
   const distance=p.length(),angularSize=r.size/Math.max(1,distance),lod=distance<240||angularSize>.025?0:distance<1800||angularSize>.005?1:2;
   if(distance<700&&dt){r.rotation.y+=dt*r.spin;r.rotation.x+=dt*r.spin*.3;temp.position.set(0,0,0);temp.rotation.copy(r.rotation);temp.scale.setScalar(r.size);temp.updateMatrix();r.matrix.set(temp.matrix.elements);}
   const mesh=bins[r.variant*3+lod],index=mesh.count++,offset=index*16,data=mesh.instanceMatrix.array;
   data.set(r.matrix,offset);data[offset+12]=p.x;data[offset+13]=p.y;data[offset+14]=p.z;
   const edge=Math.max(Math.abs(p.x),Math.abs(p.y),Math.abs(p.z))/R;
   mesh.geometry.attributes.instanceFade.array[index]=1-T.MathUtils.smoothstep(edge,.84,1);lodCounts[lod]++;
  }
  for(const mesh of bins){mesh.instanceMatrix.clearUpdateRanges();mesh.instanceMatrix.addUpdateRange(0,mesh.count*16);mesh.instanceMatrix.needsUpdate=true;const fade=mesh.geometry.attributes.instanceFade;fade.clearUpdateRanges();fade.addUpdateRange(0,mesh.count);fade.needsUpdate=true;}
 }
 rebuild();return{group,rebuild,update,get rocks(){return rocks;},get metrics(){return{count:rocks.length,lodCounts,recycled,range:settings.fieldRadius};}};
}
