import * as T from './vendor/three.module.js';
import {makeShip,random} from './ship.js';
import {toon,filmPass} from './materials.js';
import {createBelt} from './belt.js';
import {flightAxes,projectReticle} from './flight-controls.js';

const defaults={paused:false,cruise:false,cruiseSpeed:8,topSpeed:38,acceleration:12,strafePower:10,steering:.65,mouseSensitivity:1.1,mouseDeadzone:.06,inputMode:'Orbit',rollSpeed:.8,inertia:1.8,avoidance:true,camera:'Reference',cameraDistance:34,cameraAzimuth:1.02,cameraElevation:.49,cameraLag:5,asteroidCount:24000,asteroidScale:1,fieldRadius:6000,rockSeed:713,hull:'#c6d0c5',hullLight:'#d6dcd0',red:'#99534b',rock:'#7b8587',space:'#201d1c',contrast:1,wear:.6,ink:.74,grain:.2,vignette:.19,starBrightness:.8,engineGlow:.7};
const settings={...defaults},container=document.getElementById('scene'),panelEl=document.getElementById('panel');
const renderer=new T.WebGLRenderer({antialias:true,powerPreference:'high-performance',preserveDrawingBuffer:true});
renderer.setPixelRatio(Math.min(devicePixelRatio,1.65));renderer.outputColorSpace=T.SRGBColorSpace;renderer.info.autoReset=false;container.append(renderer.domElement);
const scene=new T.Scene();scene.background=new T.Color(settings.space);
const camera=new T.PerspectiveCamera(39,1,.75,settings.fieldRadius*4+500),target=new T.WebGLRenderTarget(1,1,{samples:4});
const postScene=new T.Scene(),postCamera=new T.OrthographicCamera(-1,1,1,-1,0,1),film=filmPass();postScene.add(new T.Mesh(new T.PlaneGeometry(2,2),film));film.uniforms.image.value=target.texture;
const materials={hull:toon(settings.hull),hullLight:toon(settings.hullLight),red:toon(settings.red),redLight:toon('#ad665a'),steel:toon('#636b65'),dark:toon('#373c3a'),ink:toon('#434c47'),glass:toon('#242828'),engine:toon('#d7b9a3')};
const ship=makeShip(materials);scene.add(ship.root);
const shipOrientation=new T.Quaternion(),velocity=new T.Vector3(),journey=new T.Vector3(),angular=new T.Vector3();
let distance=0,collisionCount=0,elapsed=0,lastTime=performance.now(),frame=0,frameMs=16;
const rockMaterial=toon(settings.rock,true),belt=createBelt(rockMaterial,settings);scene.add(belt.group);
const v=new T.Vector3(),forward=new T.Vector3(),up=new T.Vector3(0,1,0);
function buildField(){belt.rebuild();camera.far=settings.fieldRadius*4+500;camera.updateProjectionMatrix();stars.scale.setScalar(settings.fieldRadius*3/650);}
// Fine white and muted vermilion stars, fixed to the celestial sphere.
const stars=new T.Group();scene.add(stars);{
 const rng=random(9946);
 for(const red of [false,true]){
  const a=[];for(let i=0;i<(red?850:1900);i++){v.set(rng()-.5,rng()-.5,rng()-.5).normalize().multiplyScalar(650);a.push(...v.toArray());}
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(a,3));
  stars.add(new T.Points(g,new T.PointsMaterial({color:red?0xb76857:0xc3ccc2,size:red?1.45:.95,sizeAttenuation:false,transparent:true,opacity:settings.starBrightness,depthWrite:false})));
 }
}
stars.scale.setScalar(settings.fieldRadius*3/650);
const plumes=new T.Group();ship.root.add(plumes);
for(const s of [-1,1]){
 const plume=new T.Mesh(new T.ConeGeometry(.52,3,12,1,true),new T.MeshBasicMaterial({color:0xd5a993,transparent:true,opacity:.14,depthWrite:false,side:T.DoubleSide}));
 plume.rotation.x=Math.PI/2;plume.position.set(s*4.65,.15,11.1);plumes.add(plume);
}

const reticle=document.createElement('div');reticle.className='flight-reticle';reticle.hidden=true;reticle.setAttribute('aria-hidden','true');
reticle.innerHTML='<span></span>';container.append(reticle);
let reticleAim=null;
function updateReticle(){
 reticleAim=projectReticle(camera,shipOrientation,settings.inputMode,settings.camera);
 reticle.hidden=!reticleAim;
 if(reticleAim){reticle.style.left=((reticleAim.x+1)*50)+'%';reticle.style.top=((1-reticleAim.y)*50)+'%';}
}
const touchKeys=new Set(),touchAim={x:0,y:0};let touchControls;
const keys=new Set(),mouseAim=new T.Vector2(),pointerPosition=new T.Vector2();let mouseActive=false,dragging=false,lastPointer={x:0,y:0};
function releasePointer(){mouseActive=false;mouseAim.set(0,0);dragging=false;}
function setInputMode(mode,resetTouch=true){if(resetTouch)touchControls?.reset();settings.inputMode=mode;settings.camera=mode==='Flight'?'Chase':'Reference';releasePointer();keys.clear();angular.set(0,0,0);refresh();updateReticle();}
const accepted=new Set(['KeyW','KeyS','KeyA','KeyD','KeyQ','KeyE','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','ShiftLeft','ShiftRight','Space','KeyR','KeyC','KeyM']);
window.addEventListener('keydown',e=>{
 if(panelEl.contains(e.target))return;
 if(accepted.has(e.code)){e.preventDefault();keys.add(e.code);}
 if(!e.repeat&&e.code==='KeyR')resetFlight();
 if(!e.repeat&&(e.code==='KeyC'||e.code==='KeyM'))setInputMode(settings.inputMode==='Flight'?'Orbit':'Flight');
});
window.addEventListener('keyup',e=>keys.delete(e.code));window.addEventListener('blur',()=>{keys.clear();releasePointer();});
document.addEventListener('visibilitychange',()=>{keys.clear();releasePointer();lastTime=performance.now();});
function aimAtPointer(e){const rect=container.getBoundingClientRect();pointerPosition.set((e.clientX-rect.left)/rect.width*2-1,1-(e.clientY-rect.top)/rect.height*2);mouseActive=true;}
container.addEventListener('pointerdown',e=>{container.focus();dragging=settings.inputMode==='Orbit';lastPointer={x:e.clientX,y:e.clientY};container.setPointerCapture(e.pointerId);if(settings.inputMode==='Flight')aimAtPointer(e);});
container.addEventListener('pointermove',e=>{
 if(settings.inputMode==='Flight'){if(e.pointerType==='mouse'||container.hasPointerCapture(e.pointerId))aimAtPointer(e);return;}
 if(!dragging)return;
 settings.cameraAzimuth=T.MathUtils.euclideanModulo(settings.cameraAzimuth+(e.clientX-lastPointer.x)*.005+Math.PI,Math.PI*2)-Math.PI;
 settings.cameraElevation=T.MathUtils.clamp(settings.cameraElevation+(e.clientY-lastPointer.y)*.004,-1.25,1.3);lastPointer={x:e.clientX,y:e.clientY};refreshCameraControls();
});
container.addEventListener('pointerleave',()=>{mouseActive=false;mouseAim.set(0,0);});
container.addEventListener('pointerup',e=>{dragging=false;if(e.pointerType!=='mouse')releasePointer();});container.addEventListener('pointercancel',releasePointer);
container.addEventListener('wheel',e=>{e.preventDefault();settings.cameraDistance=T.MathUtils.clamp(settings.cameraDistance+e.deltaY*.022,24,85);refreshCameraControls();},{passive:false});
panelEl.addEventListener('pointerdown',()=>{keys.clear();releasePointer();},true);
panelEl.addEventListener('pointerenter',releasePointer);

function resetFlight(){touchControls?.reset();shipOrientation.identity();ship.root.quaternion.identity();velocity.set(0,0,0);angular.set(0,0,0);journey.set(0,0,0);distance=0;collisionCount=0;keys.clear();releasePointer();buildField();updateCamera(0,true);}
function step(dt){
 if(settings.paused)return;
 elapsed+=dt;
 const aim=value=>Math.sign(value)*Math.max(0,(Math.abs(value)-settings.mouseDeadzone)/(1-settings.mouseDeadzone))*settings.mouseSensitivity;
 const pointerSteering=mouseActive&&settings.inputMode==='Flight';
 // The forward marker is also the neutral point for mouse steering.
 if(pointerSteering)mouseAim.set(T.MathUtils.clamp(pointerPosition.x-(reticleAim?.x||0),-1,1),T.MathUtils.clamp(pointerPosition.y-(reticleAim?.y||0),-1,1));
 const input=new Set([...keys,...touchKeys]);
 const axes=flightAxes(input);
 const turnX=T.MathUtils.clamp((keys.has('ArrowUp')?1:0)-(keys.has('ArrowDown')?1:0)+(pointerSteering?aim(mouseAim.y):0)-touchAim.y,-1,1),turnY=T.MathUtils.clamp((keys.has('ArrowLeft')?1:0)-(keys.has('ArrowRight')?1:0)-(pointerSteering?aim(mouseAim.x):0)-touchAim.x,-1,1),turnZ=axes.roll;
 angular.lerp(v.set(turnX*settings.steering,turnY*settings.steering,turnZ*settings.rollSpeed),1-Math.exp(-dt*4));
 shipOrientation.multiply(new T.Quaternion().setFromEuler(new T.Euler(angular.x*dt,angular.y*dt,angular.z*dt,'YXZ'))).normalize();ship.root.quaternion.copy(shipOrientation);
 forward.set(0,0,-1).applyQuaternion(shipOrientation);
 const boost=input.has('ShiftLeft')||input.has('ShiftRight'),thrust=(input.has('KeyW')?1:0)-(input.has('KeyS')?1:0),brake=input.has('Space');
 if(thrust)velocity.addScaledVector(forward,thrust*settings.acceleration*(boost?2.3:1)*dt);
 const strafe=axes.strafe;
 if(strafe)velocity.addScaledVector(v.set(1,0,0).applyQuaternion(shipOrientation),strafe*settings.strafePower*dt);
 if(settings.cruise&&!thrust&&!strafe&&!brake)velocity.lerp(v.copy(forward).multiplyScalar(settings.cruiseSpeed),1-Math.exp(-dt*.7));
 velocity.multiplyScalar(Math.exp(-dt*(brake?3.5:.11/settings.inertia)));
 const max=settings.topSpeed*(boost?2.5:1);if(velocity.length()>max)velocity.setLength(T.MathUtils.lerp(velocity.length(),max,1-Math.exp(-dt*2)));
 const delta=velocity.clone().multiplyScalar(dt);
 // Gentle deflection gives contact a physical response without interrupting exploration.
 if(settings.avoidance)for(const r of belt.rocks){const safety=r.size+5.8,d2=r.position.lengthSq();if(d2<safety*safety&&d2>.000001){const d=Math.sqrt(d2),normal=r.position.clone().divideScalar(d),closing=velocity.dot(normal);if(closing>0){velocity.addScaledVector(normal,-closing*1.4);collisionCount++;}delta.addScaledVector(normal,-(safety-d)*dt*2);}}
 journey.add(delta);distance+=delta.length();belt.update(dt,delta);
 plumes.visible=velocity.length()>.5;for(const p of plumes.children){const thrustAmount=thrust>0?boost?1.8:1:settings.cruise?.45:.08;p.scale.y=.3+thrustAmount*(1+Math.sin(elapsed*27)*.07);p.material.opacity=settings.engineGlow*(.025+thrustAmount*.13);}
}
const desiredCamera=new T.Vector3(),lookAt=new T.Vector3(0,1,0);
function updateCamera(dt,snap=false){
 const aspect=camera.aspect,portraitScale=Math.max(1,1.12/aspect),d=settings.cameraDistance*portraitScale;
 if(settings.camera==='Chase')desiredCamera.set(0,d*.32,d*.91);
 else desiredCamera.set(Math.sin(settings.cameraAzimuth)*Math.cos(settings.cameraElevation)*d,Math.sin(settings.cameraElevation)*d,-Math.cos(settings.cameraAzimuth)*Math.cos(settings.cameraElevation)*d);
 desiredCamera.applyQuaternion(shipOrientation);v.set(0,1,0).applyQuaternion(shipOrientation);desiredCamera.add(v);lookAt.copy(v);
 camera.position.lerp(desiredCamera,snap?1:1-Math.exp(-dt*settings.cameraLag));camera.up.copy(up).applyQuaternion(shipOrientation);camera.lookAt(lookAt);
}
function resize(){const w=container.clientWidth,h=container.clientHeight;if(!w||!h)return;renderer.setSize(w,h);camera.aspect=w/h;camera.updateProjectionMatrix();const ratio=renderer.getPixelRatio();target.setSize(Math.round(w*ratio),Math.round(h*ratio));film.uniforms.resolution.value.set(w*ratio,h*ratio);updateCamera(0,true);}
new ResizeObserver(resize).observe(container);

// Canonical SHPanel lives in a separate layout region, never over the artwork.
const panel=new window.SHPanel(panelEl),controls=[];
const heading=document.createElement('div');heading.innerHTML='<h1 class="panel-title">AVOCET 2-6</h1><div class="panel-subtitle">AN ASTEROID BELT, WITHOUT AN EDGE</div>';panel._body.prepend(heading);
const flight=panel.folder('Pilot');const note=document.createElement('div');note.className='flight-note';note.innerHTML='<strong>Mouse</strong> · steer in flight mode<br><strong>W / S</strong> · thrust &nbsp; <strong>A / D</strong> · roll<br><strong>Arrows</strong> · pitch / turn &nbsp; <strong>Q / E</strong> · strafe<br><strong>Shift</strong> · boost &nbsp; <strong>Space</strong> · brake<br><strong>M / C</strong> · flight / orbit mode<br><strong>Orbit mode: drag</strong> · look around<br><strong>Scroll</strong> · zoom &nbsp; <strong>R</strong> · return home<br><strong>`</strong> · hide panel';flight._body.append(note);
const status=document.createElement('div');status.className='flight-status';flight._body.append(status);
function bind(folder,type,key,opts={},change=()=>{}){const c=folder[type](settings,key,opts);c.on('change',()=>{change();});controls.push({c,key});return c;}
bind(flight,'select','inputMode',{label:'Mouse mode',options:['Flight','Orbit']},()=>setInputMode(settings.inputMode));
bind(flight,'toggle','paused',{label:'Pause'});bind(flight,'toggle','cruise',{label:'Cruise assist'});bind(flight,'slider','cruiseSpeed',{label:'Cruise speed',min:1,max:40,step:1});
const mobile=flight.folder('Touch flight',{expanded:false}),grid=document.createElement('div');grid.className='touch-grid';
for(const[label,key]of [['↖ Roll','KeyA'],['↑ Pitch','ArrowUp'],['Roll ↗','KeyD'],['← Strafe','KeyQ'],['Thrust','KeyW'],['Strafe →','KeyE'],['Reverse','KeyS'],['↓ Pitch','ArrowDown'],['Brake','Space']]){const b=document.createElement('button');b.className='sh-btn';b.textContent=label;b.addEventListener('pointerdown',e=>{e.preventDefault();b.setPointerCapture(e.pointerId);keys.add(key);});for(const type of ['pointerup','pointercancel','lostpointercapture'])b.addEventListener(type,()=>keys.delete(key));grid.append(b);}mobile._body.append(grid);
const handling=panel.folder('Flight response',{expanded:false});
for(const[key,label,min,max,stepSize]of [['topSpeed','Maximum speed',8,80,1],['acceleration','Thrust power',2,30,1],['strafePower','Strafe thrust',2,35,1],['mouseSensitivity','Mouse response',.2,2.5,.05],['mouseDeadzone','Mouse dead zone',0,.25,.01],['steering','Turn rate',.15,1.8,.05],['rollSpeed','Roll rate',.2,2,.05],['inertia','Coasting inertia',.3,5,.1]])bind(handling,'slider',key,{label,min,max,step:stepSize});
bind(handling,'toggle','avoidance',{label:'Asteroid contact'});
const cam=panel.folder('Camera');bind(cam,'select','camera',{label:'View',options:['Reference','Chase']},()=>setInputMode(settings.camera==='Chase'?'Flight':'Orbit'));
for(const[key,label,min,max,stepSize]of [['cameraDistance','Distance',24,85,.5],['cameraAzimuth','Orbit angle',-3.14,3.14,.01],['cameraElevation','Elevation',-1.25,1.3,.01],['cameraLag','Follow response',1,12,.5]])bind(cam,'slider',key,{label,min,max,step:stepSize});
cam.button('Reference view',()=>{for(const k of ['cameraDistance','cameraAzimuth','cameraElevation'])settings[k]=defaults[k];setInputMode('Orbit');updateCamera(0,true);});
const field=panel.folder('Asteroid belt',{expanded:false});
for(const[key,label,min,max,stepSize]of [['asteroidCount','Rock count',2000,60000,1000],['asteroidScale','Rock scale',.4,2.4,.1],['fieldRadius','View range',1000,20000,500]])bind(field,'slider',key,{label,min,max,step:stepSize},buildField);
field.button('New sector',()=>{settings.rockSeed=Math.floor(Math.random()*100000);buildField();});
const art=panel.folder('Cel & ink',{expanded:false});
for(const[key,label]of [['hull','Hull ivory'],['hullLight','Armor highlights'],['red','Oxide red'],['rock','Asteroid slate'],['space','Space charcoal']])bind(art,'color',key,{label},syncArt);
for(const[key,label,min,max,stepSize]of [['contrast','Toon contrast',.5,1.2,.05],['wear','Surface wear',0,1,.05],['ink','Ink opacity',0,1,.05],['grain','Film grain',0,.65,.01],['vignette','Vignette',0,.65,.01],['starBrightness','Starlight',.1,1,.05],['engineGlow','Engine glow',0,1.5,.05]])bind(art,'slider',key,{label,min,max,step:stepSize},syncArt);
function syncArt(){for(const k of ['hull','hullLight','red'])materials[k].uniforms.base.value.set(settings[k]);rockMaterial.uniforms.base.value.set(settings.rock);rockMaterial.uniforms.spaceColor.value.set(settings.space);scene.background.set(settings.space);for(const m of [...Object.values(materials),rockMaterial]){m.uniforms.wear.value=settings.wear;m.uniforms.contrast.value=settings.contrast;}ship.outlines.material.opacity=settings.ink;film.uniforms.grain.value=settings.grain;film.uniforms.vignette.value=settings.vignette;for(const s of stars.children)s.material.opacity=settings.starBrightness;}
function refresh(){for(const{c,key}of controls)c.setValue(settings[key]);}
function refreshCameraControls(){for(const{c,key}of controls)if(key.startsWith('camera'))c.setValue(settings[key]);}
const actions=panel.folder('Session');actions.button('Return home',resetFlight);actions.button('Reset all',()=>{Object.assign(settings,defaults);refresh();syncArt();resetFlight();});
actions.button('Copy JSON',async()=>{const data=JSON.stringify({project:'avocet-2-6',version:2,settings:{...settings}},null,2);let ok=false;try{await navigator.clipboard.writeText(data);ok=true;}catch{const el=document.createElement('textarea');el.value=data;panelEl.append(el);el.select();ok=document.execCommand('copy');el.remove();}const b=[...actions._body.querySelectorAll('button')].find(b=>b.textContent==='Copy JSON');if(b){b.textContent=ok?'Copied JSON':'Copy failed';setTimeout(()=>b.textContent='Copy JSON',1800);}});
actions.button('Save image',()=>{const a=document.createElement('a');a.download='avocet-2-6.png';a.href=renderer.domElement.toDataURL('image/png');a.click();});
actions.button('Hide panel (`)',()=>document.dispatchEvent(new KeyboardEvent('keydown',{code:'Backquote',bubbles:true})));
function touchFlight(){if(settings.inputMode!=='Flight')setInputMode('Flight',false);releasePointer();}
touchControls=window.LabsTouchControls?.({label:'Spacecraft touch controls',panel:panelEl,
 pads:[{label:'Steer',change:(x,y)=>{if(x||y)touchFlight();touchAim.x=x;touchAim.y=y;}}],
 buttons:[... [['Thrust','KeyW'],['Brake','Space'],['Roll left','KeyA'],['Roll right','KeyD']].map(([label,key])=>({label,hold:down=>{if(down){touchFlight();touchKeys.add(key);}else touchKeys.delete(key);}})),
 {label:'Orbit / Fly',click:()=>setInputMode(settings.inputMode==='Flight'?'Orbit':'Flight')},
 {label:'Home',click:resetFlight}]
});
syncArt();resize();updateCamera(0,true);
function render(now){requestAnimationFrame(render);const realDt=(now-lastTime)/1000,dt=Math.min(realDt,.045);lastTime=now;frameMs=frameMs*.96+realDt*1000*.04;step(dt);updateCamera(dt);updateReticle();film.uniforms.time.value=elapsed;renderer.info.reset();renderer.setRenderTarget(target);renderer.render(scene,camera);renderer.setRenderTarget(null);renderer.render(postScene,postCamera);if(++frame%15===0)status.textContent=`${velocity.length().toFixed(1)} u/s  ·  ${Math.floor(distance)} u traveled\n${settings.paused?'Paused':settings.cruise?'Cruise assist engaged':'Manual flight'}  ·  ${settings.camera.toLowerCase()} view`;}
requestAnimationFrame(render);
window.__vesper={version:2,settings,reset:resetFlight,get state(){return{position:journey.toArray(),orientation:shipOrientation.toArray(),velocity:velocity.toArray(),distance,recycled:belt.metrics.recycled,collisionCount,mouseActive,mouseAim:mouseAim.toArray()};},get metrics(){return{drawCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles,rocks:belt.metrics.count,lodCounts:belt.metrics.lodCounts,fieldRadius:settings.fieldRadius,farClip:camera.far,frameMs,canvas:[container.clientWidth,container.clientHeight],meshes:ship.root.children.length};}};
