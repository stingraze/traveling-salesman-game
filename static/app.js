const API = window.location.origin + "/api";
let cities = [], route = [], currentGame = null;
const $ = s => document.querySelector(s);
const $$ = s => document.querySelectorAll(s);
const canvas = $("#canvas"), ctx = canvas.getContext("2d"), statusEl = $("#status");
function setStatus(m){statusEl.textContent=m}

function canvasXY(e){
  const r=canvas.getBoundingClientRect();
  return {x:(e.clientX-r.left)/r.width*canvas.width, y:(e.clientY-r.top)/r.height*canvas.height};
}
function dist(a,b){return Math.hypot(a.x-b.x,a.y-b.y)}
function totalDist(r){let d=0;for(let i=1;i<r.length;i++)d+=dist(cities[r[i-1]],cities[r[i]]);return d}

function draw(){
  ctx.clearRect(0,0,canvas.width,canvas.height);
  ctx.strokeStyle="#1e293b";ctx.lineWidth=1;
  for(let x=0;x<canvas.width;x+=50){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,canvas.height);ctx.stroke()}
  for(let y=0;y<canvas.height;y+=50){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(canvas.width,y);ctx.stroke()}
  if(route.length>1){
    ctx.strokeStyle="#38bdf8";ctx.lineWidth=2.5;ctx.beginPath();
    ctx.moveTo(cities[route[0]].x,cities[route[0]].y);
    for(let i=1;i<route.length;i++)ctx.lineTo(cities[route[i]].x,cities[route[i]].y);
    ctx.stroke();
    ctx.fillStyle="#94a3b8";ctx.font="11px monospace";ctx.textAlign="left";ctx.textBaseline="alphabetic";
    for(let i=1;i<route.length;i++){const a=cities[route[i-1]],b=cities[route[i]];ctx.fillText(dist(a,b).toFixed(1),(a.x+b.x)/2+4,(a.y+b.y)/2-4)}
  }
  cities.forEach((c,i)=>{
    const on=route.includes(i);ctx.beginPath();ctx.arc(c.x,c.y,on?10:7,0,Math.PI*2);
    ctx.fillStyle=on?"#22d3ee":"#f97316";ctx.fill();ctx.strokeStyle="#0f172a";ctx.lineWidth=2;ctx.stroke();
    ctx.fillStyle="#fff";ctx.font="bold 11px sans-serif";ctx.textAlign="center";ctx.textBaseline="middle";ctx.fillText(c.id,c.x,c.y);
  });
  if(route.length>1){ctx.fillStyle="#38bdf8";ctx.font="bold 14px sans-serif";ctx.textAlign="left";ctx.textBaseline="top";ctx.fillText("Distance: "+totalDist(route).toFixed(2),12,10)}
}

canvas.addEventListener("click",e=>{
  const p=canvasXY(e);
  if(currentGame){
    let best=-1,bd=28;cities.forEach((c,i)=>{const d=dist(p,c);if(d<bd){best=i;bd=d}});
    if(best<0)return;route.push(best);$("#btnFinish").disabled=false;
    setStatus("Route: "+route.map(i=>cities[i].id).join(" → ")+"  |  Dist: "+totalDist(route).toFixed(2));
  }else{
    const id=String.fromCharCode(65+cities.length%26)+(cities.length>=26?cities.length:"");
    cities.push({id,x:Math.round(p.x),y:Math.round(p.y)});
    setStatus(cities.length+" cities placed. Click 💾 Save Game when ready.");
  }
  draw();
});

$("#btnClear").addEventListener("click",()=>{cities=[];route=[];currentGame=null;$("#btnFinish").disabled=true;setStatus("Cleared. Place cities on the canvas.");draw()});
$("#btnUndo").addEventListener("click",()=>{route.pop();draw();if(route.length)setStatus("Route: "+route.map(i=>cities[i].id).join(" → ")+"  |  Dist: "+totalDist(route).toFixed(2));else{setStatus("Route cleared. Click cities to build a path.");$("#btnFinish").disabled=true}});

$("#btnSave").addEventListener("click",async()=>{
  if(cities.length<3){setStatus("⚠️ Need at least 3 cities!");return}
  const name=$("#gameName").value.trim()||"Untitled";
  try{const res=await fetch(API+"/games",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({name,cities})});
  if(!res.ok){setStatus("❌ Server error "+res.status);return}
  currentGame=await res.json();route=[];
  setStatus('Game "'+name+'" saved ('+cities.length+' cities). Click cities to build your route!');
  draw();refreshGames();refreshScores()}catch(err){setStatus("❌ Cannot reach server: "+err.message)}
});

$("#btnFinish").addEventListener("click",async()=>{
  if(!currentGame)return;const d=totalDist(route);
  try{const res=await fetch(API+"/runs",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({game_id:currentGame.id,player_name:$("#playerName").value.trim()||"Anon",agent_type:"human",distance:d,route:route.map(i=>cities[i].id),compute_time_ms:0})});
  if(!res.ok){setStatus("❌ Submit failed "+res.status);return}
  setStatus("✅ Route submitted! Distance: "+d.toFixed(2));route=[];$("#btnFinish").disabled=true;draw();refreshScores()}catch(err){setStatus("❌ "+err.message)}
});

/* ── bots ── */
function botGreedy(){const n=cities.length,vis=new Set([0]),p=[0];while(vis.size<n){let l=p[p.length-1],b=-1,bd=Infinity;for(let i=0;i<n;i++)if(!vis.has(i)){const d=dist(cities[l],cities[i]);if(d<bd){b=i;bd=d}}vis.add(b);p.push(b)}p.push(0);return p}
function botNearest(){const n=cities.length;let bp=null,bd=Infinity;for(let s=0;s<n;s++){const vis=new Set([s]),p=[s];while(vis.size<n){let l=p[p.length-1],b=-1,bdd=Infinity;for(let i=0;i<n;i++)if(!vis.has(i)){const d=dist(cities[l],cities[i]);if(d<bdd){b=i;bdd=d}}vis.add(b);p.push(b)}p.push(s);const d=totalDist(p);if(d<bd){bd=d;bp=p}}return bp}
function bot2Opt(init){let p=[...init],imp=true;while(imp){imp=false;for(let i=1;i<p.length-2;i++)for(let j=i+1;j<p.length-1;j++){const np=[...p.slice(0,i),...p.slice(i,j+1).reverse(),...p.slice(j+1)];if(totalDist(np)<totalDist(p)){p=np;imp=true}}}return p}
function botRandom(){const idx=Array.from({length:cities.length},(_,i)=>i);for(let i=idx.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[idx[i],idx[j]]=[idx[j],idx[i]]}idx.push(idx[0]);return idx}

$$(".bot").forEach(btn=>btn.addEventListener("click",async()=>{
  if(!currentGame){setStatus("Save a game first!");return}
  const type=btn.dataset.bot,t0=performance.now();
  let path;if(type==="greedy")path=botGreedy();else if(type==="nearest")path=botNearest();else if(type==="2opt")path=bot2Opt(botNearest());else path=botRandom();
  const ms=Math.round(performance.now()-t0),d=totalDist(path);route=path;draw();
  setStatus("🤖 "+type+": "+d.toFixed(2)+" in "+ms+"ms — submitting…");
  try{await fetch(API+"/runs",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({game_id:currentGame.id,player_name:"Bot-"+type,agent_type:"bot-"+type,distance:d,route:path.map(i=>cities[i].id),compute_time_ms:ms})});
  setStatus("🤖 "+type+": distance "+d.toFixed(2)+" · "+ms+"ms — saved!");refreshScores()}catch(err){setStatus("❌ "+err.message)}
}));

/* ── scoreboard (now shows Cities column) ── */
async function refreshScores(){
  const scope=$("#fScope").value,agent=$("#fAgent").value;
  let url=API+"/highscores?scope="+scope+"&limit=20";
  if(agent)url+="&agent_type="+agent;
  try{const res=await fetch(url);const data=await res.json();
  const tb=document.querySelector("#scores tbody");tb.innerHTML="";
  (data.items||[]).forEach((r,i)=>{
    const tr=document.createElement("tr");
    tr.innerHTML="<td>"+(i+1)+"</td><td>"+esc(r.player_name)+"</td><td>"+esc(r.agent_type)+"</td><td class='cities-col'>"+r.num_cities+"</td><td>"+r.distance.toFixed(2)+"</td><td>"+r.compute_time_ms+"</td>";
    tb.appendChild(tr);
  })}catch(e){}
}
$("#btnScores").addEventListener("click",refreshScores);
$("#fScope").addEventListener("change",refreshScores);
$("#fAgent").addEventListener("change",refreshScores);

async function refreshGames(){
  try{const res=await fetch(API+"/games?limit=50");const data=await res.json();
  const ul=$("#gameList");ul.innerHTML="";
  (data.items||[]).forEach(g=>{
    const li=document.createElement("li");
    li.textContent=g.name+" ("+g.cities.length+" cities)";
    if(currentGame&&g.id===currentGame.id)li.classList.add("active");
    li.addEventListener("click",()=>{currentGame=g;cities=g.cities;route=[];$("#btnFinish").disabled=true;setStatus('Loaded "'+g.name+'". Click cities to build your route.');draw();refreshGames();refreshScores()});
    ul.appendChild(li);
  })}catch(e){}
}
function esc(s){const d=document.createElement("div");d.textContent=s;return d.innerHTML}

draw();refreshGames();refreshScores();
$("#linkExport").href=API+"/export/json";
