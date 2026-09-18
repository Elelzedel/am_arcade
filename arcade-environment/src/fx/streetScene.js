import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { createBlockTexture } from './streetArt.js';

// A real street beyond the doorway, in metres. Local -z points outdoors.
// Surface lighting is baked/analytic so the exterior adds no per-pixel lights
// to the arcade. Geometry, occlusion, perspective and traffic are fully 3D.
export function createStreetScene() {
    const group = new THREE.Group();
    group.name = 'exterior-world';
    const staticGroup = new THREE.Group();
    group.add(staticGroup);
    let seed = 316;
    const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
    const atlas = createBlockTexture();
    const materials = new Map();
    function surface(color, { map = null, glow = 0, grain = 0.13 } = {}) {
        const key = `${color}:${map?.uuid || "none"}:${glow}:${grain}`;
        if (materials.has(key)) return materials.get(key);
        const material = new THREE.ShaderMaterial({
            uniforms: { color: { value: new THREE.Color(color) }, map: { value: map }, glow: { value: glow }, grain: { value: grain } },
            defines: map ? { USE_MAP: '' } : {},
            vertexShader: `varying vec2 vUv; varying vec3 vP; varying vec3 vN; varying vec3 vView;
                void main() { vUv=uv; vP=position; vN=normal; vView=(inverse(modelMatrix)*vec4(cameraPosition,1.)).xyz-position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
            fragmentShader: `uniform vec3 color; uniform sampler2D map; uniform float glow; uniform float grain;
                varying vec2 vUv; varying vec3 vP; varying vec3 vN; varying vec3 vView;
                float hash(vec3 p) { return fract(sin(dot(p,vec3(12.98,78.23,38.71)))*43758.54); }
                float noise3(vec3 p) {
                    vec3 i=floor(p),f=fract(p); f=f*f*(3.-2.*f);
                    return mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x),mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),
                        mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z);
                }
                void main() {
                    vec3 base=color;
                    #ifdef USE_MAP
                    base*=texture2D(map,vUv).rgb;
                    #endif
                    vec3 n=normalize(vN);
                    float key=.38+.42*max(0.,dot(n,normalize(vec3(-.4,.8,.5))));
                    vec3 light=vec3(.62,.76,.94)*key;
                    float lamp=exp(-length((vP-vec3(-4.6,3.8,-8.8))*vec3(.32,.38,.3)));
                    light+=vec3(.58,.33,.12)*lamp;
                    float grit=1.-grain*hash(floor(vP*170.));
                    float damp=noise3(vP*vec3(1.3,.7,1.3))*noise3(vP*vec3(3.1,1.,3.1));
                    float age=smoothstep(.02,.12,grain);
                    float weather=mix(1.,.62+damp*.8,age);
                    float splash=mix(.67,1.,smoothstep(.0,.7,vP.y));
                    vec3 col=base*mix(light,vec3(1.),glow)*grit*weather*mix(1.,splash,age);
                    // Smooth automotive surfaces pick up the cool sky and long,
                    // soft streetlamp highlights instead of a flat solid fill.
                    float finish=(1.-smoothstep(.02,.07,grain))*(1.-glow);
                    vec3 view=normalize(vView); vec3 reflected=reflect(-view,n);
                    float fresnel=pow(1.-max(0.,dot(n,view)),4.);
                    col+=vec3(.055,.079,.10)*finish*(.25+fresnel*.75)*smoothstep(-.25,.8,reflected.y);
                    float highlight=pow(max(0.,dot(reflected,normalize(vec3(-.35,.8,.4)))),32.);
                    col+=vec3(.15,.12,.075)*highlight*finish;
                    gl_FragColor=vec4(col,1.);
                    #include <tonemapping_fragment>
                    #include <colorspace_fragment>
                }`,
            fog: false,
        });
        materials.set(key, material);
        return material;
    }
    const masonry = surface('#615857'), concrete = surface('#686a67'), iron = surface('#283239'), edge = surface('#75807f');
    const dark = surface('#182026'), teal = surface('#31504e'), wood = surface('#5d4636');
    const warm = surface('#c19b68', { glow: .8 }), bulb = surface('#ffdca2', { glow: 1, grain: 0 });
    const facadeMaterial = surface('#ffffff', { map: atlas, glow: .42, grain: .05 });
    function mesh(geo, material, x, y, z, parent = staticGroup) {
        const m = new THREE.Mesh(geo, material); m.position.set(x,y,z); parent.add(m); return m;
    }
    function box(w,h,d,material,x,y,z,parent=staticGroup) { return mesh(new THREE.BoxGeometry(w,h,d),material,x,y,z,parent); }
    function rod(a,b,r,material,parent=staticGroup) {
        const start=new THREE.Vector3(...a), end=new THREE.Vector3(...b), delta=end.clone().sub(start);
        const m=mesh(new THREE.CylinderGeometry(r,r,delta.length(),8),material,0,0,0,parent);
        m.position.copy(start.add(end).multiplyScalar(.5)); m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize()); return m;
    }
    function patch(x,y,w,h,z) {
        const geo=new THREE.PlaneGeometry(w,h); const uv=geo.attributes.uv;
        for(let i=0;i<uv.count;i++) uv.setXY(i,(x+uv.getX(i)*w+24)/48,(y+uv.getY(i)*h)/15);
        return mesh(geo,facadeMaterial,x+w/2,y+h/2+.16,z);
    }
    // Building masses have side walls and roofs; neighbouring fronts are offset.
    for(const [x,w,h,z] of [[-24,9,8.7,-16],[-15,9.6,12.1,-14],[6.2,10.8,10.3,-16],[17,7,13.4,-18]]) {
        box(w,h,9,masonry,x+w/2,h/2+.16,z-4.55);
        patch(x,0,w,h,z);
        box(w+.18,.14,.42,concrete,x+w/2,h+.1,z+.08);
        box(.15,h,.22,iron,x+.16,h/2,z+.13);
        // Projecting sills and lintels catch light and cast physical silhouettes.
        for(let yy=3.5;yy<h-1;yy+=1.95) for(let xx=x+.8;xx<x+w-.8;xx+=1.73) {
            box(1.02,.10,.28,concrete,xx+.43,yy+.06,z+.12);
            box(1.0,.11,.13,iron,xx+.43,yy+1.4,z+.05);
        }
    }
    // Diner: recessed rooms behind separate glass panes, thick piers and sloped canvas.
    box(8.45,3.65,7,masonry,-.825,5.985,-15.05);
    patch(-5.05,3.95,8.45,3.65,-11.5);
    box(8.5,.18,7,concrete,-.825,4.02,-14.8);
    box(8.45,.2,4.1,wood,-.825,.18,-13.5);
    box(8.45,2.85,.16,surface('#8d7252'),-.825,1.6,-15.45);
    for(const x of [-5.05,3.4]) box(.23,3.9,4.2,masonry,x,2,-13.48);
    box(8.45,.52,.26,teal,-.825,.42,-11.43);
    box(8.45,.2,.35,teal,-.825,2.96,-11.4);
    const glass=new THREE.MeshBasicMaterial({color:0x73999d,transparent:true,opacity:.08,depthWrite:false,fog:false});
    for(const [x,w] of [[-4.82,2.28],[-2.4,2.38],[.14,1.23],[1.51,1.64]]) {
        box(.09,2.35,.2,teal,x,1.8,-11.38);
        mesh(new THREE.PlaneGeometry(w-.1,2.2),glass,x+w/2,1.82,-11.39);
        box(w,.045,.10,teal,x+w/2,1.77,-11.30);
        box(w-.22,.56,.22,surface('#754339'),x+w/2,.78,-13.7);
        box(w-.3,.09,.75,wood,x+w/2,1.02,-12.8);
        rod([x+w/2,.25,-12.8],[x+w/2,1,-12.8],.04,iron);
        rod([x+w/2,2.9,-13.1],[x+w/2,2.28,-13.1],.014,iron);
        mesh(new THREE.ConeGeometry(.22,.14,16),teal,x+w/2,2.29,-13.1);
        mesh(new THREE.SphereGeometry(.09,10,6),bulb,x+w/2,2.23,-13.1);
        box(.08,.11,.08,warm,x+w*.65,1.12,-12.8);
    }
    // A scuffed tile dado and a handwritten menu give the room human scale.
    for (let y=.38;y<1.5;y+=.22) box(8.12,.012,.014,wood,-.82,y,-15.35);
    for (let x=-4.7;x<3.3;x+=.27) box(.008,1.1,.014,wood,x,.95,-15.34);
    const menuCanvas=document.createElement('canvas');menuCanvas.width=512;menuCanvas.height=384;
    const menu=menuCanvas.getContext('2d');menu.fillStyle='#24302b';menu.fillRect(0,0,512,384);
    menu.strokeStyle='#897153';menu.lineWidth=15;menu.strokeRect(8,8,496,368);
    menu.fillStyle='#cac2a1';menu.textAlign='center';menu.font='italic 34px Georgia';menu.fillText('Tonight at the Owl',256,62);
    menu.font='20px Georgia';menu.textAlign='left';
    ['Bottomless coffee       1.50','Cherry pie & cream     3.25','Grilled cheese             4.50','Soup of the day           2.75'].forEach((line,i)=>menu.fillText(line,42,127+i*47));
    menu.font='italic 19px Georgia';menu.fillText('Come in out of the rain.',111,341);
    const menuTexture=new THREE.CanvasTexture(menuCanvas);menuTexture.colorSpace=THREE.SRGBColorSpace;
    mesh(new THREE.PlaneGeometry(1.52,1.14),new THREE.MeshBasicMaterial({map:menuTexture,color:0x9c957f,fog:false}),-1.5,2.3,-15.3);
    box(8,.12,.55,wood,-.8,1.17,-14.75);
    for (const x of [-4,-3.55,1.5,1.72,2.05]) {
        mesh(new THREE.CylinderGeometry(.045,.055,.24,10),warm,x,1.34,-14.75);
    }
    box(.46,.66,.42,iron,-3.2,1.56,-15.03);
    box(.36,.2,.045,edge,-3.2,1.65,-14.8);
    rod([-3.3,1.47,-14.79],[-3.3,1.35,-14.65],.015,edge);
    // A glazed entrance door, with a solid kick plate and its own threshold.
    box(1.05,.54,.13,teal,2.56,.57,-11.45);
    for(const x of [2.05,3.06]) box(.065,2.68,.13,teal,x,1.55,-11.45);
    box(1.05,.065,.13,teal,2.56,2.87,-11.45);
    mesh(new THREE.PlaneGeometry(.81,1.93),glass,2.56,1.84,-11.36);
    box(.075,.38,.08,edge,2.9,1.25,-11.28);
    box(1.07,.09,.4,concrete,2.56,.24,-11.3);
    for(let x=-4;x<3;x+=1.1) { box(.55,.1,.5,teal,x,.7,-14.1); rod([x,.25,-14.1],[x,.67,-14.1],.03,iron); }
    // Hanging sign sits inside the glass, with the rear wall visible behind it.
    patch(-3.60,2.0,2.27,.66,-11.68);
    patch(1.9,2.02,1.1,.5,-11.68);
    const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=256;
    const ctx=canvas.getContext('2d');ctx.fillStyle='#68796a';ctx.fillRect(0,0,1024,256);
    for(let x=0;x<1024;x+=55){ctx.fillStyle='#294947';ctx.fillRect(x,0,25,256);}
    for(let i=0;i<2200;i++){
        ctx.fillStyle=i%3?'#0b232315':'#d2ccb51a';ctx.fillRect(random()*1024,random()*256,1+random()*6,2+random()*20);
    }
    const runoff=ctx.createLinearGradient(0,0,0,256);runoff.addColorStop(0,'#b2aa8618');runoff.addColorStop(.7,'#071e1b00');runoff.addColorStop(1,'#071e1b90');
    ctx.fillStyle=runoff;ctx.fillRect(0,0,1024,256);
    const cloth=new THREE.CanvasTexture(canvas);cloth.colorSpace=THREE.SRGBColorSpace;
    const awningGeo=new THREE.PlaneGeometry(8.75,1.65,64,8), verts=awningGeo.attributes.position;
    for(let i=0;i<verts.count;i++)verts.setZ(i,-.026*Math.sin(verts.getX(i)*14.)*(1.-Math.pow(verts.getY(i)/.825,2.)));
    awningGeo.computeVertexNormals();
    const awning=mesh(awningGeo,surface('#ffffff',{map:cloth,grain:.11}),-.83,3.41,-10.87);
    awning.rotation.x=-Math.PI*.28;
    box(8.75,.18,.1,teal,-.83,2.84,-10.24);
    box(8.55,.23,.14,iron,-.83,3.92,-11.32);
    patch(-4.96,3.94,8.27,.44,-11.22);
    for(const x of [-4.9,3.22]) rod([x,2.87,-10.3],[x,2.2,-11.43],.023,iron);
    // Iron fire escape has landings, railings and open steps away from the brick.
    for(let y=3.46;y<10;y+=1.95) {
        box(3,.09,.86,iron,-8.7,y,-13.5);
        rod([-10.2,y+.68,-13.05],[-7.2,y+.68,-13.05],.025,iron);
        for(let x=-10.2;x<=-7.2;x+=.3) rod([x,y,-13.05],[x,y+.68,-13.05],.016,iron);
        for(let i=0;i<12;i++) box(.65,.045,.19,iron,-9.8+i*.15,y-i*.158,-13.4);
        rod([-10.1,y+.65,-12.98],[-8.3,y-1.18,-12.98],.023,iron);
    }
    // Drainpipes, wall returns, rooftop clutter, uneven repairs and a deep alley.
    rod([3.18,.22,-11.27],[3.18,7.65,-11.27],.048,iron);
    for(let y=1;y<7;y+=1.5) box(.16,.055,.18,edge,3.18,y,-11.32);
    box(1.3,.6,1.1,iron,-3.1,8,-13);
    box(.46,1.05,.5,masonry,1.6,8,-13.8);
    for (let y=.3; y<6; y+=.24) box(.012,.012,6.7,iron,3.525,y,-14.9);
    box(2.8,5,.2,dark,4.8,2.65,-29);
    box(.9,2.1,.13,iron,4.7,1.21,-28.83);
    box(.48,.07,.15,surface('#90bbc2',{glow:1}),4.7,3.5,-28.7);
    box(1.6,1.15,.9,teal,5.2,.74,-19.8);
    box(1.72,.12,.96,iron,5.2,1.36,-19.8);
    // Sidewalks are raised above the road, with slab joints and a dark gutter.
    for(const [z,d] of [[-.85,1.7],[-10.35,2.5]]) {
        box(54,.16,d,concrete,0,.055,z);
        for(let x=-26;x<27;x+=1.23) box(.008,.006,d,iron,x,.139,z);
        for(let zz=z-d/2+.6;zz<z+d/2;zz+=.6) box(54,.006,.008,iron,0,.14,zz);
    }
    for(const z of [-1.74,-9.05]) box(54,.075,.13,iron,0,-.025,z);
    for(let x=-18;x<20;x+=8) {
        box(.64,.014,.38,iron,x,.01,-8.9);
        for(let i=0;i<8;i++) box(.025,.008,.32,dark,x-.27+i*.077,.02,-8.9);
    }
    // Lamp, bollards, overhead wire and street litter provide intermediate scale.
    rod([-4.65,.14,-8.9],[-4.65,4.2,-8.9],.055,iron);
    rod([-4.65,4.2,-8.9],[-3.95,4.2,-8.9],.045,iron);
    box(.5,.11,.28,iron,-3.95,4.15,-8.9);
    box(.4,.025,.2,bulb,-3.95,4.085,-8.9);
    mesh(new THREE.CylinderGeometry(.13,.17,.27,12),iron,-4.65,.275,-8.9);
    for(const x of [3.7,4.7,5.7]) {
        mesh(new THREE.CylinderGeometry(.065,.08,.7,12),iron,x,.49,-9.35);
        mesh(new THREE.CylinderGeometry(.069,.069,.055,12),edge,x,.75,-9.35);
    }
    let prev=[-15,6.3,-11.4];
    for(let i=1;i<=24;i++) { const p=[-15+i*1.35,6.3-Math.sin(i/24*Math.PI)*1.3,-11.4]; rod(prev,p,.012,iron); prev=p; }
    const paper=surface('#8c8572'), leaf=surface('#685238');
    for(let i=0;i<65;i++) {
        const z=i%2 ? -.2-random()*1.35 : -9.15-random()*1.8;
        const m=box(.035+random()*.13,.008,.025+random()*.09,i%5?leaf:paper,(random()-.5)*34,.15,z);
        m.rotation.y=random()*Math.PI;
    }
    // Muted distant massing is the only backdrop; the focal block is geometry.
    for(let i=0;i<15;i++) {
        const h=10+random()*16;
        box(4+random()*3,h,5,surface('#202e3b'),-38+i*5.5,h/2,-40-random()*8);
    }
    const sky=mesh(new THREE.PlaneGeometry(130,65),new THREE.MeshBasicMaterial({color:0x101b29,fog:false}),0,22,-53);
    sky.name='distant-sky';

    const carUniform={value:new THREE.Vector4(0,-4.8,0,1)};
    const roadMaterial=new THREE.ShaderMaterial({
        uniforms:{uTime:{value:0},uBlock:{value:atlas},uCar:carUniform},
        vertexShader:`varying vec3 vP; varying vec3 vEye; void main(){vP=position; vEye=(inverse(modelMatrix)*vec4(cameraPosition,1.)).xyz; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
        fragmentShader:`uniform float uTime; uniform sampler2D uBlock; uniform vec4 uCar; varying vec3 vP; varying vec3 vEye;
        float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
        float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+1.),f.x),f.y);}
        void main(){
            vec2 p=vP.xz; vec3 ray=normalize(vP-vEye); vec3 refl=vec3(ray.x,-ray.y,ray.z);
            float wet=smoothstep(.32,.72,noise(p*vec2(.52,.9)));
            float grain=noise(p*180.); vec3 col=vec3(.012,.018,.024)*( .7+grain*.55);
            float ripple=sin(length(fract(p*2.)-.5)*75.-uTime*5.)*.0015;
            refl.x+=(noise(p*vec2(7.,33.)+uTime*.1)-.5)*.04;
            refl.y+=(noise(p*vec2(9.,50.))-.5)*.019+ripple*wet;
            float t=(-11.5-vP.z)/min(refl.z,-.001); vec3 q=vP+refl*t;
            vec2 uv=vec2((q.x+24.)/48.,(q.y-.16)/15.);
            vec3 reflection=texture2D(uBlock,clamp(uv,0.,1.)).rgb;
            float valid=step(0.,uv.x)*step(uv.x,1.)*step(0.,uv.y)*step(uv.y,1.);
            col+=reflection*valid*mix(.09,.46,wet);
            float stripe=(1.-smoothstep(.03,.047,abs(p.y+5.6)))*step(.38,fract(p.x/4.6));
            col+=vec3(.095,.087,.055)*stripe*step(.2,noise(p*24.));
            float stain=noise(p*.8)*noise(p*3.1); col*=.7+stain*.55;
            float crack=abs(p.y+3.1+sin(p.x*1.8)*.13+sin(p.x*7.)*.027);
            col*=1.-(1.-smoothstep(.008,.035,crack))*.55;
            float pool=exp(-pow(abs(p.x+3.95)*.5,2.)-abs(p.y+8.9)*.5);
            col+=vec3(.13,.085,.036)*pool*(.3+wet*.7);
            float shadow=exp(-pow(abs(p.x-uCar.x)*.49,6.)-pow(abs(p.y-uCar.y)*.87,6.))*uCar.z;
            col*=1.-shadow*.88;
            float head=exp(-pow(abs(p.x-uCar.x-uCar.w*2.2)*.7,2.)-abs(p.y-uCar.y)*.8)*uCar.z;
            col+=vec3(.17,.15,.10)*head*(.2+wet*.8);
            gl_FragColor=vec4(col,1.);
            #include <colorspace_fragment>
        }`,fog:false,toneMapped:false,
    });
    // Geometry positions stay in street space for the surface's reflections.
    const groundGeo=new THREE.PlaneGeometry(100,65);groundGeo.rotateX(-Math.PI/2);groundGeo.translate(0,-.035,-31);
    mesh(groundGeo,roadMaterial,0,0,0);

    const car=createCar(surface,box,mesh,rod);
    car.group.name='passing-sedan'; group.add(car.group);
    // Rain has real depth, ends at the pavement, and stays outside the arcade.
    const count=950, rainPos=new Float32Array(count*6), drops=[];
    for(let i=0;i<count;i++) drops.push({x:(random()-.5)*42,z:-1.9-random()*24,y:random()*9,speed:6+random()*4,length:.045+random()*.09});
    const rainGeo=new THREE.BufferGeometry();rainGeo.setAttribute('position',new THREE.BufferAttribute(rainPos,3).setUsage(THREE.DynamicDrawUsage));
    const rain=new THREE.LineSegments(rainGeo,new THREE.LineBasicMaterial({color:0x8198aa,transparent:true,opacity:.12,depthWrite:false,fog:false}));
    rain.frustumCulled=false;group.add(rain);
    // Bake transformed static meshes per material to keep the detailed street cheap.
    staticGroup.updateMatrixWorld(true);
    const batches=new Map();
    for(const m of [...staticGroup.children]) {
        if(!m.isMesh || m.material.transparent || m.material===roadMaterial) continue;
        const geo=m.geometry.clone().applyMatrix4(m.matrix);
        if(!batches.has(m.material)) batches.set(m.material,[]);
        batches.get(m.material).push(geo);staticGroup.remove(m);m.geometry.dispose();
    }
    for(const [material,geometries] of batches) {
        const merged=mergeGeometries(geometries);staticGroup.add(new THREE.Mesh(merged,material));geometries.forEach(g=>g.dispose());
    }
    let time=0;
    function update(dt) {
        time+=dt;roadMaterial.uniforms.uTime.value=time;
        const cycle=(time+8)%25, direction=Math.floor((time+8)/25)%2 ? -1:1;
        car.group.visible=cycle<10;
        const x=direction*(-28+cycle*5.6), z=direction>0?-4.1:-7;
        car.group.position.set(x,0,z);car.group.rotation.y=direction>0?0:Math.PI;
        carUniform.value.set(x,z,car.group.visible?1:0,direction);
        for(const wheel of car.wheels) wheel.rotation.z=-time*5.6/.29;
        for(let i=0;i<count;i++) {
            const d=drops[i];d.y-=dt*d.speed;if(d.y<.17)d.y+=8.8;
            rainPos.set([d.x,d.y,d.z,d.x-.018,d.y+d.length,d.z],i*6);
        }
        rainGeo.attributes.position.needsUpdate=true;
    }
    update(0);
    return {group,update,car:car.group,carUniform};
}

function createCar(surface,box,mesh,rod) {
    const group=new THREE.Group(), wheels=[];
    const paint=surface('#344448',{grain:.015}), rubber=surface('#10151a',{grain:.1}), trim=surface('#7c8587',{grain:.02});
    const glass=surface('#243b49',{grain:0}), light=surface('#e3dbc0',{glow:1,grain:0}), red=surface('#a93628',{glow:.75,grain:0});
    function profile(points,width,mat) {
        const shape=new THREE.Shape();points.forEach(([x,y],i)=>i?shape.lineTo(x,y):shape.moveTo(x,y));shape.closePath();
        const geo=new THREE.ExtrudeGeometry(shape,{depth:width,bevelEnabled:true,bevelSegments:2,steps:1,bevelSize:.035,bevelThickness:.03});
        return mesh(geo,mat,0,0,-width/2,group);
    }
    profile([[-2.18,.38],[-2.2,.63],[-1.72,.76],[-1.25,.79],[.7,.78],[1.68,.68],[2.16,.56],[2.16,.36],[1.65,.29],[-1.8,.29]],1.64,paint);
    profile([[-1.35,.77],[-.83,1.31],[.37,1.30],[1.03,.76]],1.40,paint);
    // Separate sloping windshield/rear glass and inset side glazing reveal width.
    function quad(points,material) {
        const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(points.flat(),3));
        geo.setAttribute('uv',new THREE.Float32BufferAttribute([0,0,1,0,1,1,0,1],2));geo.setIndex([0,1,2,0,2,3]);geo.computeVertexNormals();
        const m=mesh(geo,material,0,0,0,group);m.material.side=THREE.DoubleSide;
    }
    quad([[.97,.82,-.67],[.97,.82,.67],[.38,1.29,.64],[.38,1.29,-.64]],glass);
    quad([[-1.29,.82,.67],[-1.29,.82,-.67],[-.83,1.29,-.64],[-.83,1.29,.64]],glass);
    for(const side of [-1,1]) {
        const z=side*.743;
        quad([[-1.23,.84,z],[-.78,1.25,z],[-.30,1.25,z],[-.30,.84,z]],glass);
        quad([[-.22,.84,z],[-.22,1.25,z],[.34,1.25,z],[.89,.84,z]],glass);
        box(3.7,.025,.022,trim,0,.76,side*.854,group);
        for(const x of [-.6,.5]) box(.13,.025,.035,trim,x,.71,side*.855,group);
        rod([-.26,.38,side*.863],[-.26,.76,side*.863],.006,rubber,group);
        box(.22,.09,.13,paint,.75,.89,side*.84,group);
        for(const x of [-1.38,1.34]) {
            const wheel=new THREE.Group();wheel.position.set(x,.255,side*.83);group.add(wheel);
            const tire=mesh(new THREE.CylinderGeometry(.29,.29,.18,24),rubber,0,0,0,wheel);tire.rotation.x=Math.PI/2;
            const hub=mesh(new THREE.CylinderGeometry(.155,.155,.018,20),trim,0,0,side*.10,wheel);hub.rotation.x=Math.PI/2;
            mesh(new THREE.TorusGeometry(.115,.023,6,20),rubber,0,0,side*.112,wheel);
            for(let i=0;i<8;i++) {
                const a=i*Math.PI/4;
                const spoke=box(.036,.15,.012,trim,Math.sin(a)*.07,Math.cos(a)*.07,side*.121,wheel);spoke.rotation.z=-a;
            }
            mesh(new THREE.SphereGeometry(.042,10,6),trim,0,0,side*.12,wheel);
            wheels.push(wheel);
            mesh(new THREE.TorusGeometry(.325,.026,6,24,Math.PI),paint,x,.255,side*.873,group);
        }
    }
    for(const side of [-1,1]) {
        box(3.55,.025,.018,rubber,-.03,.43,side*.861,group);
        rod([.87,.68,side*.859],[1.82,.58,side*.86],.009,trim,group);
    }
    for(const x of [-2.18,2.16]) box(.09,.09,1.58,trim,x,.37,0,group);
    for(const z of [-.57,.57]) {box(.04,.14,.32,light,2.195,.55,z,group);box(.04,.13,.29,red,-2.235,.56,z,group);}
    box(.045,.12,.65,rubber,2.2,.52,0,group);
    for(let z=-.25;z<.3;z+=.07) box(.049,.014,.04,trim,2.22,.52,z,group);
    box(.05,.085,.29,trim,-2.235,.45,0,group);
    // Merge rigid bodywork by material, keeping the wheel assemblies movable.
    const batches=new Map();group.updateMatrixWorld(true);
    for(const m of [...group.children]) {
        if(!m.isMesh)continue;
        let geo=m.geometry.clone().applyMatrix4(m.matrix);
        if(geo.index){const old=geo;geo=geo.toNonIndexed();old.dispose();}
        if(!batches.has(m.material))batches.set(m.material,[]);
        batches.get(m.material).push(geo);group.remove(m);m.geometry.dispose();
    }
    for(const [mat,geos] of batches){group.add(new THREE.Mesh(mergeGeometries(geos),mat));geos.forEach(g=>g.dispose());}
    return {group,wheels};
}
