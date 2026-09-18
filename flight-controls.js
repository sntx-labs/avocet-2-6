import {Vector3} from './vendor/three.module.js';

export function flightAxes(keys){
  return {
    roll:(keys.has('KeyA')?1:0)-(keys.has('KeyD')?1:0),
    strafe:(keys.has('KeyE')?1:0)-(keys.has('KeyQ')?1:0),
  };
}

// Project a point 200 units along the nose axis, rather than assuming the raised
// chase camera's screen center is the ship's heading.
const aimPoint=new Vector3();
export function projectReticle(camera,orientation,inputMode,cameraMode){
  if(inputMode!=='Flight'||cameraMode!=='Chase')return null;
  camera.updateMatrixWorld();
  aimPoint.set(0,1,-200).applyQuaternion(orientation).project(camera);
  if(!Number.isFinite(aimPoint.x)||!Number.isFinite(aimPoint.y)||aimPoint.z < -1||aimPoint.z > 1||Math.abs(aimPoint.x)>1||Math.abs(aimPoint.y)>1)return null;
  return {x:aimPoint.x,y:aimPoint.y};
}
