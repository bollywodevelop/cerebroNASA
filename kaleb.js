const canvas=document.getElementById("brain");
const ctx=canvas.getContext("2d");
const nodeCountText=document.getElementById("nodeCount");
const synapseCountText=document.getElementById("synapseCount");
const signalCountText=document.getElementById("signalCount");
const selectedInfo=document.getElementById("selectedInfo");
const legendItems=document.getElementById("legendItems");
const copyNeuron=document.getElementById("copyNeuron");
const searchInput=document.getElementById("searchInput");
const themeFilter=document.getElementById("themeFilter");
const countryFilter=document.getElementById("countryFilter");
const searchResults=document.getElementById("searchResults");
const synapseSwitch=document.getElementById("synapseSwitch");
const synapseState=document.getElementById("synapseState");
const statusText=document.getElementById("statusText");
const nasaResourceList=document.getElementById("nasaResourceList");

const DATA_URL="kaleb_data_342.json";
const MIN_ZOOM=.45,MAX_ZOOM=8,DRAG_THRESHOLD=4;
const NUM_PARTICLES=260;
let data=null,neurons=[],signals=[],waves=[],quantumParticles=[];
let edgesByNeuron=new Map(),selectedNeuron=null;
let W=0,H=0,CX=0,CY=0,DPR=1;
let mouseX=-9999,mouseY=-9999;
let orbitX=0,orbitY=0,targetOrbitX=0,targetOrbitY=0;
let cameraZoom=1,targetZoom=1,cameraDistance=900;
let cameraAnimating=false,animationStart=0;
let isDragging=false,didDrag=false,dragStartX=0,dragStartY=0,dragStartOrbitX=0,dragStartOrbitY=0;
let brainPulse=0,pulseScale=1,pulseEnergy=0,lastAutomaticWave=0;
let synapsesVisible=true;
let openTheme=null;
const AUTOMATIC_WAVE_INTERVAL=2800;
const COLOR_MAP={};

const INTRO_POINTS_URL="brain_intro_points.json";
const INTRO_DURATION=7600;
const INTRO_FORM_END=2400;
const INTRO_HOLD_END=4200;
const INTRO_EXPAND_END=7000;
let introPoints=[];
let introStart=0;
let introProgress=0;
let introActive=true;
let autoSpin=true;

const THEME_DESCRIPTIONS={
  ASTRONOMIA:"Estudio y exploración de estrellas, galaxias, observación y fenómenos del universo.",
  EXOPLANETAS:"Búsqueda, identificación y análisis de mundos que orbitan otras estrellas.",
  IA:"Modelos, aprendizaje automático y sistemas inteligentes aplicados a problemas espaciales.",
  DATOS:"Datos científicos, análisis, procesamiento, visualización y descubrimiento de patrones.",
  SATELITES:"Satélites, observación orbital, comunicaciones y tecnologías que trabajan alrededor de la Tierra.",
  TIERRA:"Sistemas terrestres, observación de nuestro planeta y fenómenos ambientales.",
  CLIMA:"Clima, atmósfera, meteorología y efectos de las condiciones ambientales.",
  AGRICULTURA:"Aplicaciones de la ciencia espacial para cultivos, recursos y producción sostenible.",
  ASTEROIDES:"Asteroides, meteoros, objetos cercanos y riesgos o fenómenos relacionados.",
  ESPACIO_WEATHER:"Clima espacial, actividad solar, tormentas y sus efectos sobre la Tierra y la tecnología.",
  MARTE:"Exploración, superficie, ciencia y tecnologías relacionadas con Marte.",
  SALUD:"Ciencia, salud humana, bienestar y aplicaciones biomédicas vinculadas al espacio.",
  EDUCACION:"Herramientas y experiencias para enseñar, aprender y acercar la ciencia al público.",
  ROBOTICA:"Robots, vehículos autónomos, control y sistemas mecánicos para exploración.",
  VISUALIZACION:"Representación interactiva de información científica, espacial y geográfica.",
  WEB:"Aplicaciones web, interfaces, plataformas y herramientas digitales.",
  SOSTENIBILIDAD:"Soluciones orientadas al uso responsable de recursos y a la sostenibilidad.",
  NASA:"Proyectos vinculados directamente con datos, misiones, ciencia o tecnología de NASA."
};

async function init(){
  try{
    const [dataResponse,introResponse]=await Promise.all([fetch(DATA_URL),fetch(INTRO_POINTS_URL)]);
    if(!dataResponse.ok)throw new Error("No se pudo cargar "+DATA_URL);
    if(!introResponse.ok)throw new Error("No se pudo cargar "+INTRO_POINTS_URL);
    data=await dataResponse.json();
    const introData=await introResponse.json();
    introPoints=introData.points||[];
    Object.assign(COLOR_MAP,data.themeColors||{});
    COLOR_MAP.NASA="#00eaff";
    document.body.classList.add("intro");
    introStart=performance.now();
    createBrain();
    createConnectionsIndex();
    createFilters();
    createNASAResources();
    createLegend();
    createQuantumParticles();
    resize();
    renderSearchResults();
    requestAnimationFrame(animate);
  }catch(error){
    console.error(error);
    selectedInfo.innerHTML="ERROR DE DATOS<br>"+escapeHtml(error.message);
  }
}

function resize(){
  W=window.innerWidth;H=window.innerHeight;CX=W/2;CY=H/2;
  DPR=Math.min(window.devicePixelRatio||1,2);
  canvas.width=W*DPR;canvas.height=H*DPR;
  canvas.style.width=W+"px";canvas.style.height=H+"px";
  ctx.setTransform(DPR,0,0,DPR,0,0);
}
window.addEventListener("resize",resize);

function createBrain(){
  neurons.length=0;
  const total=data.nodes.length;
  data.nodes.forEach((node,index)=>{
    const hemisphere=Math.random()<.5?-1:1;
    const angle=Math.random()*Math.PI*2;
    const radius=Math.sqrt(Math.random());
    const width=300*radius,height=205*radius;
    let x=hemisphere*(45+width*.75);
    let y=Math.sin(angle)*height;
    x+=Math.sin(y*.035)*35;
    x+=Math.sin(angle*5)*18*radius;
    y+=Math.cos(angle*7)*12*radius;
    const z=(Math.random()-.5)*260;
    const ip=introPoints[index%Math.max(1,introPoints.length)]||{x:x,y:y,z:z};
    neurons.push({
      ...node,x,y,z,baseX:x,baseY:y,baseZ:z,
      introX:ip.x,introY:ip.y,introZ:ip.z,
      radius:1.2+Math.random()*2.2,
      phase:Math.random()*Math.PI*2,energy:0,hemisphere
    });
  });
  nodeCountText.textContent="NEURONAS: "+total;
  synapseCountText.textContent="SINAPSIS: "+data.edges.length;
}

function createConnectionsIndex(){
  edgesByNeuron.clear();
  data.edges.forEach(e=>{
    if(!edgesByNeuron.has(e.sourceNeuron))edgesByNeuron.set(e.sourceNeuron,[]);
    if(!edgesByNeuron.has(e.targetNeuron))edgesByNeuron.set(e.targetNeuron,[]);
    edgesByNeuron.get(e.sourceNeuron).push(e);
    edgesByNeuron.get(e.targetNeuron).push(e);
  });
}

function uniqueSorted(values){return [...new Set(values)].sort((a,b)=>a.localeCompare(b,"es"))}

function createFilters(){
  const themes=uniqueSorted(neurons.flatMap(n=>[n.primaryTheme,...(n.secondaryThemes||[])]));
  themes.forEach(theme=>{
    const option=document.createElement("option");option.value=theme;option.textContent=prettyTheme(theme);themeFilter.appendChild(option);
  });
  uniqueSorted(neurons.map(n=>n.country)).forEach(country=>{
    const option=document.createElement("option");option.value=country;option.textContent=country;countryFilter.appendChild(option);
  });
  searchInput.addEventListener("input",renderSearchResults);
  themeFilter.addEventListener("change",renderSearchResults);
  countryFilter.addEventListener("change",renderSearchResults);
}

const NASA_RESOURCES=[
  {name:"NASA",type:"APP",url:"https://www.nasa.gov/nasa-app/",play:"https://play.google.com/store/apps/details?id=gov.nasa"},
  {name:"Earth Now",type:"APP",url:"https://science.nasa.gov/eyes/earth-now/",play:"https://play.google.com/store/apps/details?id=gov.nasa.jpl.earthnow.activity"},
  {name:"GLOBE Observer",type:"APP",url:"https://observer.globe.gov/",play:"https://play.google.com/store/apps/details?id=gov.nasa.globe.observer"},
  {name:"ISS Explorer",type:"APP",url:"https://www.nasa.gov/apps/",play:"https://play.google.com/store/apps/details?id=gov.nasa.jsc.igoal.ISSExplorer"},
  {name:"NASA Science: Humans in Space",type:"APP",url:"https://www.nasa.gov/apps/",play:"https://play.google.com/store/apps/developer?id=NASA"},
  {name:"Spot the Station",type:"APP",url:"https://www.nasa.gov/spot-the-station/",play:"https://play.google.com/store/apps/developer?id=NASA"},
  {name:"Spacecraft AR",type:"APP",url:"https://science.nasa.gov/eyes/spacecraft-ar/",play:"https://play.google.com/store/apps/developer?id=NASA"},
  {name:"To the Moon and Beyond",type:"APP",url:"https://www.nasa.gov/apps/",play:"https://play.google.com/store/apps/developer?id=NASA"},
  {name:"WeatherSats AR",type:"APP",url:"https://www.nasa.gov/apps/",play:"https://play.google.com/store/apps/developer?id=NASA"},
  {name:"NASA Science",type:"WEB",url:"https://science.nasa.gov/"},
  {name:"NASA Eyes",type:"WEB",url:"https://science.nasa.gov/eyes/"},
  {name:"NASA Apps",type:"WEB",url:"https://www.nasa.gov/apps/"},
  {name:"NASA Software",type:"WEB",url:"https://www.nasa.gov/software/"},
  {name:"NASA Software Catalog",type:"WEB",url:"https://software.nasa.gov/"},
  {name:"NASA Science Data Portal",type:"WEB",url:"https://science.data.nasa.gov/"},
  {name:"NASA Image and Video Library",type:"WEB",url:"https://www.nasa.gov/stem-content/nasa-image-and-video-library/"},
  {name:"NASA Open Science",type:"WEB",url:"https://science.nasa.gov/open-science/"},
  {name:"Eyes on the Solar System",type:"INTERACTIVE",url:"https://eyes.nasa.gov/apps/solar-system/"},
  {name:"Eyes on Asteroids",type:"INTERACTIVE",url:"https://eyes.nasa.gov/apps/asteroids/"},
  {name:"Eyes on the Earth",type:"INTERACTIVE",url:"https://eyes.nasa.gov/apps/earth/"},
  {name:"Eyes on Exoplanets",type:"INTERACTIVE",url:"https://eyes.nasa.gov/apps/exo/"},
  {name:"DSN Now",type:"INTERACTIVE",url:"https://eyes.nasa.gov/dsn/dsn.html"},
  {name:"Mars Relay Network",type:"INTERACTIVE",url:"https://eyes.nasa.gov/apps/mars-relay-network/"}
];

function createNASAResources(){
  if(!nasaResourceList)return;
  nasaResourceList.innerHTML="";
  NASA_RESOURCES.forEach(r=>{
    const item=document.createElement("div");item.className="nasa-resource";
    const title=document.createElement("div");title.className="nasa-resource-title";title.textContent=r.name;
    const type=document.createElement("span");type.className="nasa-resource-type";type.textContent=r.type;title.appendChild(type);
    item.appendChild(title);
    const links=document.createElement("div");links.className="nasa-resource-links";
    const site=document.createElement("a");site.href=r.url;site.target="_blank";site.rel="noopener noreferrer";site.textContent="NASA / SITIO";links.appendChild(site);
    if(r.play){const play=document.createElement("a");play.href=r.play;play.target="_blank";play.rel="noopener noreferrer";play.textContent="GOOGLE PLAY";links.appendChild(play)}
    item.appendChild(links);nasaResourceList.appendChild(item);
  });
}

function createLegend(){
  const order=["NASA","ASTRONOMIA","EXOPLANETAS","IA","DATOS","SATELITES","TIERRA","CLIMA","AGRICULTURA","ASTEROIDES","ESPACIO_WEATHER","MARTE","SALUD","EDUCACION","ROBOTICA","VISUALIZACION","WEB","SOSTENIBILIDAD"];
  legendItems.innerHTML="";
  order.forEach(theme=>{
    if(!COLOR_MAP[theme])return;
    const linked=neurons.filter(n=>n.primaryTheme===theme||(n.secondaryThemes||[]).includes(theme));
    const wrap=document.createElement("div");wrap.className="legend-item";
    const row=document.createElement("button");row.className="legend-folder";row.type="button";
    row.innerHTML=`<span class="folder-arrow">▶</span><span class="legend-dot" style="color:${COLOR_MAP[theme]};background:${COLOR_MAP[theme]}"></span><span>${escapeHtml(prettyTheme(theme))}</span><span class="theme-count">${theme==="NASA"?NASA_RESOURCES.length:linked.length}</span>`;
    const detail=document.createElement("div");detail.className="folder-content";detail.style.display="none";
    const desc=document.createElement("div");desc.className="folder-description";desc.textContent=THEME_DESCRIPTIONS[theme]||"Tema científico representado en la red KALEB.";
    const list=document.createElement("div");list.className="folder-list";
    if(theme==="NASA"){
      NASA_RESOURCES.forEach(r=>{
        const btn=document.createElement("button");btn.type="button";btn.className="folder-project";btn.textContent=`${r.name} · ${r.type}`;
        btn.addEventListener("click",()=>{window.open(r.url,"_blank","noopener");});list.appendChild(btn);
      });
    }else{
      linked.sort((a,b)=>a.projectName.localeCompare(b.projectName,"es")).forEach(n=>{
        const btn=document.createElement("button");btn.type="button";btn.className="folder-project";btn.textContent=n.projectName;
        btn.addEventListener("click",()=>selectNeuron(n));list.appendChild(btn);
      });
    }
    detail.appendChild(desc);detail.appendChild(list);wrap.appendChild(row);wrap.appendChild(detail);legendItems.appendChild(wrap);
    row.addEventListener("click",()=>{
      const isOpen=detail.style.display!=="none";
      document.querySelectorAll(".folder-content").forEach(el=>el.style.display="none");
      document.querySelectorAll(".legend-folder").forEach(el=>el.classList.remove("open"));
      if(!isOpen){detail.style.display="block";row.classList.add("open");openTheme=theme;highlightTheme(theme)}else{openTheme=null;clearThemeHighlight()}
    });
  });
}

function highlightTheme(theme){
  neurons.forEach(n=>n.energy=(n.primaryTheme===theme||(n.secondaryThemes||[]).includes(theme))?.7:0);
}
function clearThemeHighlight(){neurons.forEach(n=>n.energy*=.35)}

function prettyTheme(theme){return String(theme||"").replaceAll("_"," ")}

function renderSearchResults(){
  if(!data)return;
  const q=(searchInput.value||"").trim().toLowerCase();
  const theme=themeFilter.value;
  const country=countryFilter.value;
  let matches=neurons.filter(n=>{
    const hay=[n.projectName,n.team,n.country,n.location,n.challenge,n.primaryTheme,...(n.secondaryThemes||[]),...(n.concepts||[])].join(" ").toLowerCase();
    const themeMatch=!theme||(n.primaryTheme===theme||(n.secondaryThemes||[]).includes(theme));
    return (!q||hay.includes(q))&&(!country||n.country===country)&&themeMatch;
  });
  matches.sort((a,b)=>a.projectName.localeCompare(b.projectName,"es"));
  searchResults.innerHTML="";
  if(!matches.length){searchResults.innerHTML='<div class="no-results">NO HAY NEURONAS QUE COINCIDAN.</div>';return}
  const shown=matches.slice(0,40);
  shown.forEach(n=>{
    const btn=document.createElement("button");btn.className="result";btn.type="button";
    btn.innerHTML=`<span class="result-name">${escapeHtml(n.projectName)}</span><span class="result-meta">${escapeHtml(n.country)} · ${escapeHtml(prettyTheme(n.primaryTheme))}</span>`;
    btn.addEventListener("click",()=>selectNeuron(n));searchResults.appendChild(btn);
  });
  if(matches.length>40){
    const more=document.createElement("div");more.className="no-results";more.textContent=`MOSTRANDO 40 DE ${matches.length} RESULTADOS`;searchResults.appendChild(more);
  }
}

function createQuantumParticles(){
  quantumParticles.length=0;
  for(let i=0;i<NUM_PARTICLES;i++)quantumParticles.push({angle:Math.random()*Math.PI*2,radius:180+Math.random()*500,z:(Math.random()-.5)*700,speed:.0002+Math.random()*.001,size:Math.random()*1.8,phase:Math.random()*Math.PI*2});
}

window.addEventListener("mousemove",e=>{mouseX=e.clientX;mouseY=e.clientY});
window.addEventListener("mouseleave",()=>{mouseX=-9999;mouseY=-9999});

canvas.addEventListener("mousedown",e=>{
  if(e.button!==0)return;
  if(cameraAnimating)cameraAnimating=false;
  isDragging=true;didDrag=false;dragStartX=e.clientX;dragStartY=e.clientY;dragStartOrbitX=targetOrbitX;dragStartOrbitY=targetOrbitY;canvas.style.cursor="grabbing";
});
window.addEventListener("mousemove",e=>{
  if(!isDragging)return;
  const dx=e.clientX-dragStartX,dy=e.clientY-dragStartY;
  if(Math.abs(dx)>DRAG_THRESHOLD||Math.abs(dy)>DRAG_THRESHOLD)didDrag=true;
  targetOrbitX=dragStartOrbitX+dx*.008;targetOrbitY=dragStartOrbitY+dy*.006;
  const limit=Math.PI*.42;targetOrbitY=Math.max(-limit,Math.min(limit,targetOrbitY));
});
window.addEventListener("mouseup",e=>{if(e.button!==0)return;isDragging=false;canvas.style.cursor="crosshair"});
window.addEventListener("blur",()=>{isDragging=false;canvas.style.cursor="crosshair"});
canvas.addEventListener("wheel",e=>{e.preventDefault();targetZoom*=e.deltaY<0?1.15:.87;targetZoom=Math.max(MIN_ZOOM,Math.min(MAX_ZOOM,targetZoom))},{passive:false});

synapseSwitch.addEventListener("click",()=>{
  synapsesVisible=!synapsesVisible;
  synapseSwitch.classList.toggle("on",synapsesVisible);
  synapseSwitch.setAttribute("aria-pressed",String(synapsesVisible));
  synapseState.textContent=synapsesVisible?"VISIBLES":"OCULTAS";
  statusText.textContent=synapsesVisible?"SINAPSIS NEURALES ACTIVAS":"SINAPSIS NEURALES OCULTAS";
});

function updateBrainPulse(time){
  const slow=Math.sin(time*.0022),secondary=Math.sin(time*.0045);const raw=slow*.75+secondary*.25;
  brainPulse=raw*.5+.5;pulseScale=1+brainPulse*.025;pulseEnergy=.65+brainPulse*.35;
}
function currentIntroFactor(time){
  if(!introActive)return 1;
  const elapsed=time-introStart;
  if(elapsed<0)return 0;
  if(elapsed<INTRO_FORM_END)return 0;
  if(elapsed<INTRO_HOLD_END)return .03;
  if(elapsed<INTRO_EXPAND_END){
    const p=(elapsed-INTRO_HOLD_END)/(INTRO_EXPAND_END-INTRO_HOLD_END);
    return 0.03+(1-Math.pow(1-p,3))*.97;
  }
  introActive=false;
  introProgress=1;
  document.body.classList.remove("intro");
  return 1;
}

function renderPosition(n,time){
  const factor=currentIntroFactor(time);
  introProgress=factor;
  if(factor>=1)return {x:n.x,y:n.y,z:n.z};
  return {
    x:n.introX+(n.x-n.introX)*factor,
    y:n.introY+(n.y-n.introY)*factor,
    z:n.introZ+(n.z-n.introZ)*factor
  };
}

function project3D(x,y,z){
  x*=pulseScale;y*=pulseScale;z*=pulseScale;
  const cosX=Math.cos(orbitX),sinX=Math.sin(orbitX);let rx=x*cosX-z*sinX,rz=x*sinX+z*cosX;
  const cosY=Math.cos(orbitY),sinY=Math.sin(orbitY);const ry=y*cosY-rz*sinY;rz=y*sinY+rz*cosY;
  const perspective=cameraDistance/(cameraDistance+rz);return{x:CX+rx*perspective*cameraZoom,y:CY+ry*perspective*cameraZoom,scale:perspective*cameraZoom,depth:rz};
}
function neuronScreenPosition(n,time=performance.now()){const p=renderPosition(n,time);return project3D(p.x,p.y,p.z)}
function getNeuron(id){return neurons[id-1]}

function fireSynapse(source){
  if(!source)return;
  const connected=edgesByNeuron.get(source.neuron)||[];if(!connected.length)return;
  const edge=connected[Math.floor(Math.random()*connected.length)];
  const targetId=edge.sourceNeuron===source.neuron?edge.targetNeuron:edge.sourceNeuron;const target=getNeuron(targetId);if(!target)return;
  signals.push({source,target,progress:0,speed:.018+Math.random()*.025,weight:edge.weight});source.energy=1;
}
function createWave(x=0,y=0,z=0){waves.push({x,y,z,radius:20,alpha:.9,speed:5,maxRadius:650,thickness:1.5})}

function drawConnections(pulse){
  const factor=introProgress;
  if(!synapsesVisible||factor<.72){synapseCountText.textContent="SINAPSIS: "+data.edges.length;return}
  const introFade=Math.min(1,(factor-.72)/.28);
  data.edges.forEach(e=>{
    const a=getNeuron(e.sourceNeuron),b=getNeuron(e.targetNeuron);if(!a||!b)return;
    const pa=neuronScreenPosition(a,performance.now()),pb=neuronScreenPosition(b,performance.now());const energy=Math.max(a.energy,b.energy);
    const alpha=(.018+e.weight*.10+energy*.45+pulse*.025)*introFade;const color=COLOR_MAP[a.primaryTheme]||"#46d2ff";
    ctx.beginPath();ctx.moveTo(pa.x,pa.y);ctx.lineTo(pb.x,pb.y);ctx.strokeStyle=hexToRgba(color,alpha);ctx.lineWidth=(.25+e.weight*1.5+energy*1.3)*(0.9+pulse*.15);ctx.stroke();
  });
  synapseCountText.textContent="SINAPSIS: "+data.edges.length;
}
function hexToRgba(hex,alpha){const h=hex.replace("#","");const r=parseInt(h.substring(0,2),16),g=parseInt(h.substring(2,4),16),b=parseInt(h.substring(4,6),16);return `rgba(${r},${g},${b},${Math.max(0,Math.min(1,alpha))})`}

function drawNeurons(time,pulse){
  const visible=[];
  neurons.forEach(n=>{
    n.energy*=.94;const p=neuronScreenPosition(n,time);const dx=n.x-(mouseX-CX)/Math.max(cameraZoom,.001);const dy=n.y-(mouseY-CY)/Math.max(cameraZoom,.001);const distance=Math.sqrt(dx*dx+dy*dy);const heartbeat=Math.sin(time*.003+n.phase)*.5+.5;
    const pulseSize=1+heartbeat*.25+n.energy*2.2+brainPulse*.10;const radius=n.radius*pulseSize*p.scale;visible.push({n,p,radius,distance});
  });
  visible.sort((a,b)=>a.p.depth-b.p.depth);
  visible.forEach(item=>{const n=item.n,p=item.p,radius=item.radius;const color=COLOR_MAP[n.primaryTheme]||"#62e8ff";ctx.beginPath();ctx.arc(p.x,p.y,radius*(4+brainPulse*2),0,Math.PI*2);ctx.fillStyle=hexToRgba(color,.025+n.energy*.15+brainPulse*.025);ctx.fill();ctx.beginPath();ctx.arc(p.x,p.y,Math.max(radius,.5),0,Math.PI*2);ctx.fillStyle=n.energy>.15?"#ffffff":color;ctx.shadowBlur=8+n.energy*25+brainPulse*8;ctx.shadowColor=color;ctx.fill();ctx.shadowBlur=0});
}
function updateSignals(){
  for(let i=signals.length-1;i>=0;i--){const s=signals[i];s.progress+=s.speed;const x=s.source.x+(s.target.x-s.source.x)*s.progress;const y=s.source.y+(s.target.y-s.source.y)*s.progress;const z=s.source.z+(s.target.z-s.source.z)*s.progress;const p=project3D(x,y,z),size=Math.max(2,3.5*p.scale);ctx.beginPath();ctx.arc(p.x,p.y,size,0,Math.PI*2);ctx.fillStyle="#ffffff";ctx.shadowBlur=18+brainPulse*10;ctx.shadowColor="#ffffff";ctx.fill();ctx.shadowBlur=0;if(s.progress>=1){s.target.energy=Math.min(1,s.target.energy+.8);if(Math.random()<.65)fireSynapse(s.target);signals.splice(i,1)}}
  signalCountText.textContent="SEÑALES: "+signals.length;
}
function drawWaves(){
  for(let i=waves.length-1;i>=0;i--){const wave=waves[i];wave.radius+=wave.speed;wave.alpha*=.992;const center=project3D(wave.x,wave.y,wave.z);const radius=wave.radius*center.scale;const intensity=wave.alpha*(.65+brainPulse*.35);drawWaveLayer(center,radius,intensity,0,1.5);drawWaveLayer(center,radius,intensity,2.5,.22);drawWaveLayer(center,radius,intensity,0,.18,.96);if(wave.alpha<.015||wave.radius>wave.maxRadius)waves.splice(i,1)}
}
function drawWaveLayer(center,radius,intensity,offset,alphaFactor,scale=1){ctx.beginPath();for(let a=0;a<Math.PI*2;a+=.05){const distortion=Math.sin(a*8)*7*center.scale;const r=radius*scale+distortion+offset*center.scale;const x=center.x+Math.cos(a)*r,y=center.y+Math.sin(a)*r*.6;if(a===0)ctx.moveTo(x,y);else ctx.lineTo(x,y)}ctx.closePath();ctx.strokeStyle=`rgba(0,220,255,${intensity*alphaFactor})`;ctx.lineWidth=(1.5+brainPulse*1.2)*center.scale;ctx.shadowBlur=14+brainPulse*18;ctx.shadowColor="#00eaff";ctx.stroke();ctx.shadowBlur=0}
function drawQuantumParticles(time,pulse){quantumParticles.forEach(p=>{p.angle+=p.speed;const radius=p.radius+Math.sin(time*.0008+p.phase)*25;const x=Math.cos(p.angle)*radius,y=Math.sin(p.angle)*radius*.55,z=p.z+Math.sin(time*.0005+p.phase)*100;const screen=project3D(x,y,z);const alpha=.08+pulse*.12+brainPulse*.06;ctx.beginPath();ctx.arc(screen.x,screen.y,Math.max(.4,p.size*screen.scale),0,Math.PI*2);ctx.fillStyle=`rgba(0,200,255,${alpha})`;ctx.fill()})}

canvas.addEventListener("click",e=>{
  if(didDrag){didDrag=false;return}
  if(cameraAnimating)return;
  let closest=null,closestDistance=32;neurons.forEach(n=>{const p=neuronScreenPosition(n);const dx=e.clientX-p.x,dy=e.clientY-p.y,d=Math.sqrt(dx*dx+dy*dy);if(d<closestDistance){closest=n;closestDistance=d}});
  if(!closest)return;selectNeuron(closest);
});

function selectNeuron(n){
  selectedNeuron=n;selectedNeuron.energy=1;
  const neighbors=edgesByNeuron.get(n.neuron)||[];const projectUrl=n.projectLink||"";
  selectedInfo.innerHTML=`<strong>${escapeHtml(n.projectName)}</strong><br>`+
    `${escapeHtml(n.country)} · ${escapeHtml(n.location||"")} · ${escapeHtml(n.team)}<br>`+
    `TEMA: <span style="color:${COLOR_MAP[n.primaryTheme]||"#00eaff"}">${escapeHtml(prettyTheme(n.primaryTheme))}</span><br>`+
    `DESAFÍO: ${escapeHtml(n.challenge||"") }<br>`+
    `CONCEPTOS: ${escapeHtml((n.concepts||[]).join(" · "))}<br>`+
    `SINAPSIS: ${neighbors.length}<br>`+
    (projectUrl?`PROYECTO: <span style="opacity:.75;user-select:text">${escapeHtml(projectUrl)}</span>`:"");
  copyNeuron.disabled=false;
  document.body.classList.add("selected");
  for(let i=0;i<Math.min(12,Math.max(3,neighbors.length));i++)fireSynapse(selectedNeuron);
  createWave(selectedNeuron.x,selectedNeuron.y,selectedNeuron.z);
  cameraAnimating=true;animationStart=performance.now();targetOrbitX=orbitX+Math.PI*2;targetOrbitY=0;targetZoom=4.5;
}

copyNeuron.addEventListener("click",async()=>{
  if(!selectedNeuron)return;
  const n=selectedNeuron;
  const text=[
    `KALEB | NEURONA ${n.neuron}`,
    `Proyecto: ${n.projectName}`,
    `Equipo: ${n.team}`,
    `País: ${n.country}`,
    `Ubicación: ${n.location||""}`,
    `Tema: ${prettyTheme(n.primaryTheme)}`,
    `Temas relacionados: ${(n.secondaryThemes||[]).map(prettyTheme).join(", ")}`,
    `Desafío: ${n.challenge||""}`,
    `Conceptos: ${(n.concepts||[]).join(", ")}`,
    `Sinapsis: ${(edgesByNeuron.get(n.neuron)||[]).length}`,
    `Proyecto: ${n.projectLink||""}`
  ].join("\n");
  try{
    await navigator.clipboard.writeText(text);
    copyNeuron.textContent="INFORMACIÓN COPIADA ✓";
    setTimeout(()=>copyNeuron.textContent="COPIAR INFORMACIÓN",1400);
  }catch(err){
    const ta=document.createElement("textarea");ta.value=text;document.body.appendChild(ta);ta.select();document.execCommand("copy");ta.remove();copyNeuron.textContent="INFORMACIÓN COPIADA ✓";setTimeout(()=>copyNeuron.textContent="COPIAR INFORMACIÓN",1400);
  }
});

function escapeHtml(value){return String(value??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]))}
function updateCamera(time){
  if(cameraAnimating){const elapsed=time-animationStart,duration=2400,progress=Math.min(elapsed/duration,1);const ease=1-Math.pow(1-progress,3);orbitX+=(targetOrbitX-orbitX)*.06;orbitY+=(targetOrbitY-orbitY)*.06;cameraZoom=1+(4.5-1)*ease;if(progress>=1){cameraAnimating=false;orbitX=targetOrbitX;orbitY=targetOrbitY;targetZoom=cameraZoom}return}
  orbitX+=(targetOrbitX-orbitX)*.10;orbitY+=(targetOrbitY-orbitY)*.10;cameraZoom+=(targetZoom-cameraZoom)*.12;
}
function animate(time){
  ctx.clearRect(0,0,W,H);
  updateBrainPulse(time);
  const pulse=Math.sin(time*.002)*.5+.5;
  currentIntroFactor(time);
  if(introActive){
    const elapsed=time-introStart;
    const bootText=document.getElementById("bootText");
    if(bootText){
      if(elapsed<INTRO_FORM_END)bootText.textContent="FORMANDO CEREBRO NEURAL...";
      else if(elapsed<INTRO_HOLD_END)bootText.textContent="SINAPSIS INICIALIZANDO...";
      else if(elapsed<INTRO_EXPAND_END)bootText.textContent="EXPANDIENDO 342 NEURONAS...";
    }
  }
  if(time-lastAutomaticWave>AUTOMATIC_WAVE_INTERVAL){createWave(0,0,0);lastAutomaticWave=time}
  if(!introActive && autoSpin && !isDragging && !cameraAnimating){orbitX+=0.00045;targetOrbitX=orbitX;orbitY*=.995}
  updateCamera(time);
  ctx.save();
  drawQuantumParticles(time,pulse);
  drawConnections(pulse);
  drawNeurons(time,pulse);
  updateSignals();
  drawWaves();
  ctx.restore();
  requestAnimationFrame(animate);
}

init();
