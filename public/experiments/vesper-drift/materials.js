import * as T from './vendor/three.module.js';
const noise=`
float hash(vec3 p){p=fract(p*.3183099+vec3(.13,.27,.41));p*=17.;return fract(p.x*p.y*p.z*(p.x+p.y+p.z));}
float noise(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x),mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z);}
`;
export function toon(color,rock=false){return new T.ShaderMaterial({
 uniforms:{base:{value:new T.Color(color)},spaceColor:{value:new T.Color('#201d1c')},lightDirection:{value:new T.Vector3(.6,1,-.3).normalize()},wear:{value:.55},contrast:{value:1},isRock:{value:rock?1:0}},
 vertexShader:`varying vec3 vNormal;varying vec3 vLocal;varying vec3 vView;varying float vFade;
 #ifdef USE_INSTANCING
 attribute float instanceFade;
 #endif
 void main(){vLocal=position;vec3 n=normal;vec4 p=vec4(position,1.);vFade=1.;
 #ifdef USE_INSTANCING
 n=mat3(instanceMatrix)*n;p=instanceMatrix*p;vFade=instanceFade;
 #endif
 vNormal=normalize(mat3(modelMatrix)*n);vec4 wp=modelMatrix*p;vView=cameraPosition-wp.xyz;gl_Position=projectionMatrix*viewMatrix*wp;}`,
 fragmentShader:`uniform vec3 base,spaceColor;uniform vec3 lightDirection;uniform float wear,contrast,isRock;varying vec3 vNormal,vLocal,vView;varying float vFade;${noise}
 void main(){vec3 N=normalize(vNormal);float light=dot(N,lightDirection);float t;
 if(isRock>.5){float f=noise(vLocal*6.)*.6+noise(vLocal*18.)*.3+noise(vLocal*44.)*.1;light+=(f-.53)*1.5;t=light<.09?.12:light<.35?.44:light<.66?.8:1.;if(f<.37)t*=.28;}
 else{t=light<-.22?.24:light<.14?.48:light<.56?.78:1.;float f=noise(vLocal*22.);t-=step(.79,f)*wear*.13;float scratches=step(.78,noise(vLocal*vec3(26.,3.,48.)))*step(.7,noise(vLocal*14.));t-=scratches*wear*.26;}
 t=mix(.8,t,contrast);vec3 col=base*t;col=mix(col,vec3(.105,.1,.095),.025);col=mix(spaceColor,col,vFade);gl_FragColor=vec4(col,1.);
 #include <colorspace_fragment>
 }`,side:T.DoubleSide});}

export function filmPass(){return new T.ShaderMaterial({uniforms:{image:{value:null},time:{value:0},grain:{value:.16},vignette:{value:.2},resolution:{value:new T.Vector2(1,1)}},vertexShader:`varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}`,fragmentShader:`uniform sampler2D image;uniform float time,grain,vignette;uniform vec2 resolution;varying vec2 vUv;float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}void main(){vec3 c=texture2D(image,vUv).rgb;float n=h(floor(vUv*resolution)+floor(time*12.));c*=1.-vignette*pow(length((vUv-.5)*1.35),1.6);gl_FragColor=vec4(c,1.);
#include <colorspace_fragment>
gl_FragColor.rgb+=(n-.5)*grain*.18;
}`});}



