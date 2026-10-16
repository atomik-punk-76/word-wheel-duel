"use strict";
const socket=io({transports:["polling"],upgrade:false,timeout:10000,reconnection:true,reconnectionAttempts:Infinity,reconnectionDelay:1000,reconnectionDelayMax:5000}),$=id=>document.getElementById(id);
let state=null,prev=null,mySeat=null,roomCode=null,rotation=0,spinAnimId=null,wheelBusy=false,lastFeedbackId=null,feedbackTimer=null,lastSettleId=null;
const A=window.WWAudio||{sfx:new Proxy({},{get:()=>()=>{}}),music:{play(){},pause(){},toggle(){},next(){},select(){},songs:[],wantsAutoplay:()=>false},prefs:{sfx:70,music:45},ensure(){},setSfxVolume(){},setMusicVolume(){}};
const sfx=A.sfx;
const money=n=>"$"+Number(n||0).toLocaleString("en-US");
const COLORS=["#ff4f8b","#ffc93c","#19d3c5","#9b5cff","#ff9f1c","#3ee08f","#3a8cff","#ff6b4a","#e85cff"];

/* ---------- static UI ---------- */
$("alphabet").innerHTML="BCDFGHJKLMNPQRSTVWXYZ".split("").map(l=>`<button class="letter" data-letter="${l}">${l}</button>`).join("");
$("vowelButtons").innerHTML="AEIOU".split("").map(l=>`<button class="vowel" data-vowel="${l}">${l}</button>`).join("");
(function bulbs(){const b=$("bulbs");let h="";for(let i=0;i<28;i++){const a=i/28*2*Math.PI;h+=`<i class="bulb" style="left:${50+48.4*Math.sin(a)}%;top:${50-48.4*Math.cos(a)}%"></i>`}b.innerHTML=h})();

/* ---------- notifications ---------- */
function note(msg,kind="info",ms=3200){const el=document.createElement("div");el.className="note "+kind;el.textContent=msg;$("toastStack").appendChild(el);while($("toastStack").children.length>4)$("toastStack").firstChild.remove();setTimeout(()=>{el.classList.add("out");setTimeout(()=>el.remove(),400)},ms)}
function toast(m){note(m,"info")}
const popQueue=[];let popBusy=false;
function popup(text,cls,ms=1700){popQueue.push({text,cls,ms});if(!popBusy)nextPop()}
function nextPop(){const p=popQueue.shift();if(!p){popBusy=false;return}popBusy=true;const el=$("landPopup");el.className="land-popup";void el.offsetWidth;el.textContent=p.text;el.className="land-popup show "+p.cls+(p.ms>2000?" long":"");setTimeout(()=>{el.className="land-popup";nextPop()},p.ms)}

/* ---------- confetti ---------- */
const cv=$("confetti"),cx=cv.getContext("2d");let bits=[],confettiRaf=null;
function confetti(n=160){cv.width=innerWidth;cv.height=innerHeight;for(let i=0;i<n;i++)bits.push({x:innerWidth/2+(Math.random()-.5)*200,y:innerHeight*.45,vx:(Math.random()-.5)*16,vy:-Math.random()*16-6,r:Math.random()*Math.PI,vr:(Math.random()-.5)*.3,c:COLORS[i%COLORS.length],w:6+Math.random()*8,h:4+Math.random()*6,life:0});if(!confettiRaf)confettiRaf=requestAnimationFrame(drawConfetti)}
function drawConfetti(){cx.clearRect(0,0,cv.width,cv.height);bits=bits.filter(b=>b.y<cv.height+40&&b.life<400);bits.forEach(b=>{b.vy+=.35;b.vx*=.99;b.x+=b.vx;b.y+=b.vy;b.r+=b.vr;b.life++;cx.save();cx.translate(b.x,b.y);cx.rotate(b.r);cx.fillStyle=b.c;cx.fillRect(-b.w/2,-b.h/2,b.w,b.h*Math.abs(Math.cos(b.r*2)));cx.restore()});confettiRaf=bits.length?requestAnimationFrame(drawConfetti):(cx.clearRect(0,0,cv.width,cv.height),null)}

/* ---------- audio controls ---------- */
const tSel=$("trackSelect");tSel.innerHTML=A.music.songs.map((t,i)=>`<option value="${i}">${String(i+1).padStart(2,"0")}. ${t}</option>`).join("");
function syncMusicUI(){$("musicToggle").textContent=A.music.playing?"❚❚":"▶";$("trackName").textContent=A.music.playing?A.music.songs[A.music.current]:"Music paused";tSel.value=A.music.current}
A.music.onChange=syncMusicUI;
$("sfxVol").value=A.prefs.sfx;$("sfxVolOut").textContent=A.prefs.sfx;$("musicVol").value=A.prefs.music;$("musicVolOut").textContent=A.prefs.music;
$("sfxVol").oninput=e=>{A.ensure();A.setSfxVolume(e.target.value);$("sfxVolOut").textContent=e.target.value};
$("sfxVol").onchange=()=>sfx.ding(0);
$("musicVol").oninput=e=>{A.setMusicVolume(e.target.value);$("musicVolOut").textContent=e.target.value};
tSel.onchange=e=>{A.music.select(+e.target.value);if(!A.music.playing)A.music.play()};
$("musicToggle").onclick=()=>{A.music.toggle()};
$("musicNext").onclick=()=>{A.music.next();if(!A.music.playing)A.music.play()};
$("settingsBtn").onclick=e=>{e.stopPropagation();const p=$("settingsPanel"),open=p.classList.toggle("hidden")===false;$("settingsBtn").setAttribute("aria-expanded",open);if(open)sfx.ui()};
document.addEventListener("click",e=>{if(!e.target.closest("#settingsPanel,#settingsBtn"))$("settingsPanel").classList.add("hidden")});
let audioUnlocked=false;
document.addEventListener("pointerdown",()=>{if(audioUnlocked)return;audioUnlocked=true;A.ensure();if(A.music.wantsAutoplay())A.music.play();syncMusicUI()},{capture:true});
syncMusicUI();

/* ---------- connection ---------- */
function conn(text,online){$("connection").classList.toggle("online",!!online);$("connection").querySelector("span").textContent=text}
socket.on("disconnect",reason=>{conn("DISCONNECTED");$("lobbyError").textContent="Lost connection to the game server ("+reason+"). Reconnecting…";note("Connection lost — reconnecting…","bad")});
socket.on("connect_error",err=>{conn("CONNECTING…");$("lobbyError").textContent="Waking up the game server… this can take up to a minute. "+(err?.message?"("+err.message+")":"")});
socket.on("connect",()=>{conn("CONNECTED",true);$("lobbyError").textContent=""});
socket.io.on("reconnect_attempt",()=>conn("RECONNECTING"));
socket.on("errorMessage",m=>{$("lobbyError").textContent=m;nameOk(false);note(m,"bad");sfx.buzzer()});
socket.on("joined",d=>{roomCode=d.code;mySeat=d.seat;$("createBtn").disabled=false;$("joinBtn").disabled=false;$("lobby").classList.add("hidden");$("game").classList.remove("hidden");document.body.classList.add("in-game");fitGame();$("roomLabel").textContent=roomCode;history.replaceState(null,"",`?room=${roomCode}`);note("Joined room "+roomCode,"good");sfx.whoosh()});
socket.on("state",s=>{if(state&&s.revision<state.revision)return;prev=state;state=s;render()});
function requestRoom(eventName,payload){
  $("lobbyError").textContent="";
  if(!socket.connected){$("lobbyError").textContent="Still connecting to the game server — give it a few seconds and try again.";return}
  $("createBtn").disabled=true;$("joinBtn").disabled=true;$("lobbyError").textContent="Connecting to room…";
  socket.timeout(8000).emit(eventName,payload,err=>{if(err){nameOk(false);$("lobbyError").textContent="The server did not respond. Refresh the page and try again."}});
}
/* players must enter a name before creating or joining */
function cleanName(){return $("playerName").value.replace(/[<>]/g,"").trim()}
function nameOk(show){const ok=cleanName().length>0;$("playerName").classList.toggle("bad",!ok&&show);$("nameHint").classList.toggle("bad",!ok&&show);$("nameHint").textContent=ok?"Looking good, "+cleanName()+"!":"Enter a name to create or join a room.";$("createBtn").disabled=!ok;$("joinBtn").disabled=!ok;return ok}
function needName(){if(nameOk(true))return false;sfx.buzzer();const n=$("playerName");n.classList.remove("shake");void n.offsetWidth;n.classList.add("shake");n.focus();return true}
try{$("playerName").value=localStorage.getItem("wwd-name")||""}catch(e){}
$("playerName").oninput=()=>nameOk(false);nameOk(false);
document.querySelector(".lobby").addEventListener("pointerdown",e=>{if(e.target.closest(".join-row,.lobby-actions")&&!cleanName())needName()});
function goName(){const n=cleanName();try{localStorage.setItem("wwd-name",n)}catch(e){}return n}
$("createBtn").onclick=()=>{if(needName())return;sfx.ui();requestRoom("createRoom",{name:goName()})};
$("joinBtn").onclick=()=>{if(needName())return;if(!$("roomCode").value){$("lobbyError").textContent="Enter the 5-letter room code.";return}sfx.ui();requestRoom("joinRoom",{code:$("roomCode").value,name:goName()})};
$("playerName").onkeydown=e=>{if(e.key==="Enter"){e.preventDefault();$("roomCode").value?$("joinBtn").click():$("createBtn").click()}};
$("roomCode").oninput=e=>e.target.value=e.target.value.toUpperCase().replace(/[^A-Z0-9]/g,"").slice(0,5);
$("copyBtn").onclick=async()=>{try{await navigator.clipboard.writeText(`Join my Word Wheel Duel room ${roomCode}: ${location.origin}/?room=${roomCode}`);note("Invite link copied!","good")}catch{note("Share room code: "+roomCode)}sfx.ui()};
function doSpin(){if(!wheelBusy&&!$("spinBtn").disabled){A.ensure();socket.emit("spin")}}
$("spinBtn").onclick=doSpin;document.querySelector(".hub").onclick=doSpin;
$("startBtn").onclick=()=>{sfx.ui();socket.emit("startMatch")};$("nextBtn").onclick=()=>{sfx.ui();socket.emit("nextRound")};$("newMatchBtn").onclick=()=>{sfx.ui();socket.emit("newMatch")};
$("alphabet").onclick=e=>{const b=e.target.closest("[data-letter]");if(b&&!b.disabled){sfx.click();socket.emit("guessConsonant",{letter:b.dataset.letter})}};
$("vowelButtons").onclick=e=>{const b=e.target.closest("[data-vowel]");if(b&&!b.disabled){sfx.click();socket.emit("buyVowel",{letter:b.dataset.vowel})}};
$("solveForm").onsubmit=e=>{e.preventDefault();const v=$("solveInput").value.trim();if(!v)return;socket.emit("solve",{answer:v});$("solveInput").value=""};
document.addEventListener("keydown",e=>{if(e.target.tagName==="INPUT"||!state||state.status!=="playing"||state.turn!==mySeat)return;const k=e.key.toUpperCase();if(k===" "&&!state.turnValue){e.preventDefault();doSpin();return}const b=document.querySelector(`[data-letter="${k}"],[data-vowel="${k}"]`);if(b&&!b.disabled)b.click()});

/* ---------- wheel ---------- */
function buildWheel(labels){
  const n=labels.length,seg=360/n,R=200,c=200;let s=`<svg viewBox="0 0 400 400" xmlns="http://www.w3.org/2000/svg" aria-label="Prize wheel"><defs><radialGradient id="sheen" cx="50%" cy="35%" r="70%"><stop offset="0" stop-color="#fff" stop-opacity=".22"/><stop offset=".55" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".25"/></radialGradient></defs>`;
  let ci=0;
  labels.forEach((lab,i)=>{
    const a0=(i*seg-90)*Math.PI/180,a1=((i+1)*seg-90)*Math.PI/180;
    const x0=c+R*Math.cos(a0),y0=c+R*Math.sin(a0),x1=c+R*Math.cos(a1),y1=c+R*Math.sin(a1);
    const bk=lab==="BANKRUPT",lt=lab==="LOSE TURN";let fill,ink="#1b0f2e",stroke="rgba(0,0,0,.35)";
    if(bk){fill="#0b0b0f";ink="#ffffff"}else if(lt){fill="#f4f1ea";ink="#1b0f2e"}else{fill=COLORS[ci++%COLORS.length]}
    s+=`<path d="M${c},${c} L${x0.toFixed(2)},${y0.toFixed(2)} A${R},${R} 0 0 1 ${x1.toFixed(2)},${y1.toFixed(2)} Z" fill="${fill}" stroke="${stroke}" stroke-width="1.5"/>`;
    const text=/^\d+$/.test(lab)?"$"+lab:lab,len=text.length,size=bk||lt?(len>8?15:16):(len>=5?27:30);
    s+=`<g transform="rotate(${i*seg+seg/2} ${c} ${c})"><text x="${c}" y="${18}" transform="rotate(90 ${c} 18)" font-family="Bowlby One, Impact, sans-serif" font-size="${size}" fill="${ink}" ${bk?'stroke="#ff3b3b" stroke-width=".6"':""} dominant-baseline="central" letter-spacing="${bk||lt?1:0}" style="paint-order:stroke">${text.replace(" "," ")}</text></g>`;
  });
  s+=`<circle cx="${c}" cy="${c}" r="${R-1}" fill="url(#sheen)" pointer-events="none"/></svg>`;
  $("wheel").innerHTML=s;$("wheel").dataset.ready="yes";
}
let tickRaf=null;
function trackTicks(seg){cancelAnimationFrame(tickRaf);const w=$("wheel");let last=null,acc=0;
  const frame=()=>{const m=getComputedStyle(w).transform;let ang=0;if(m&&m!=="none"){const v=m.match(/matrix\(([^)]+)\)/);if(v){const p=v[1].split(",").map(Number);ang=Math.atan2(p[1],p[0])*180/Math.PI}}
    if(last!==null){let d=ang-last;if(d<-180)d+=360;if(d>180)d-=360;acc+=Math.abs(d);if(acc>=seg){acc%=seg;sfx.tick()}}last=ang;if(wheelBusy)tickRaf=requestAnimationFrame(frame)};
  tickRaf=requestAnimationFrame(frame)}

/* ---------- puzzle board ---------- */
let boardKey="";
function renderBoard(){
  const P=state.phrase,old=prev&&prev.category===state.category&&prev.phrase.length===P.length&&boardKey===state.category+P.length?prev.phrase:null;
  if(!P.length){$("puzzle").innerHTML='<div class="board-empty">The puzzle appears when the match begins.</div>';boardKey="";return}
  boardKey=state.category+P.length;
  const words=[];let cur=[];P.forEach((c,i)=>{if(c===" "){if(cur.length)words.push(cur);cur=[]}else cur.push(i)});if(cur.length)words.push(cur);
  let reveals=0;
  $("puzzle").innerHTML=words.map(w=>`<div class="word">${w.map(i=>{const c=P[i],isNew=old&&old[i]===null&&c!==null;const d=isNew?reveals++*.28:0;return `<div class="tile ${c===null?"hidden-letter":""} ${isNew?"reveal":""}" ${isNew?`style="animation-delay:${d}s,${d}s"`:""}>${c||""}</div>`}).join("")}</div>`).join("");
  for(let k=0;k<reveals&&k<12;k++)setTimeout(()=>sfx.ding(k),k*280);
  return reveals;
}

/* ---------- counters ---------- */
const shown={};
function countTo(el,key,target){const from=shown[key]??target;shown[key]=target;if(from===target){el.textContent=money(target);return}
  el.classList.remove("bump","drain");void el.offsetWidth;el.classList.add(target>from?"bump":"drain");
  const t0=performance.now(),dur=700;const step=now=>{const k=Math.min(1,(now-t0)/dur),e=1-Math.pow(1-k,3);el.textContent=money(Math.round(from+(target-from)*e));if(k<1)requestAnimationFrame(step)};requestAnimationFrame(step)}

/* ---------- main render ---------- */
function render(){if(!state)return;
  const mine=state.turn===mySeat,active=state.status==="playing";
  $("roomLabel").textContent=state.code;$("roundLabel").textContent=`ROUND ${state.round} / ${state.maxRounds}`;
  for(let i=0;i<2;i++){const el=$("contestant"+i),p=state.players[i];el.querySelector(".player-name").textContent=p?.name||"Waiting…";el.querySelector(".you-tag").classList.toggle("hidden",i!==mySeat);
    countTo(el.querySelector(".score"),"bank"+i,p?.score??0);countTo($("roundCash"+i),"round"+i,p?.roundScore??0);el.classList.toggle("active",active&&state.turn===i)}
  // turn banner
  const tb=$("turnBanner"),who=state.players[state.turn]?.name||"Opponent";
  tb.className="turn-banner "+(active?(mine?"mine":"theirs t"+state.turn):"idle");
  $("turnBannerText").textContent=active?(mine?"YOUR TURN — "+(state.turnValue?"PICK A CONSONANT":"SPIN, BUY OR SOLVE"):`${who.toUpperCase()}'S TURN`):state.status==="lobby"?(state.players.length<2?"WAITING FOR A SECOND PLAYER":"READY — HOST CAN START"):state.status==="roundOver"?"ROUND OVER":state.status==="matchOver"?"MATCH OVER":"";
  document.body.classList.toggle("my-turn",active&&mine);
  // message
  if(prev?.message!==state.message){$("message").classList.remove("flash");void $("message").offsetWidth;$("message").classList.add("flash")}
  $("message").textContent=state.message;$("category").textContent=state.category||"CATEGORY";
  const reveals=renderBoard()||0;
  // controls
  $("spinBtn").disabled=!(mine&&active&&!state.turnValue&&!state.spin&&!wheelBusy);
  $("spinBtn").textContent=state.turnValue&&mine?"PICK A CONSONANT ↓":"SPIN THE WHEEL ↻";
  $("turnValue").textContent=state.turnValue?`WORTH ${money(state.turnValue)} EACH`:"SPIN FIRST";
  $("turnNote").textContent=state.status==="lobby"?(state.players.length<2?"Share the room code with a friend to begin.":"Both players ready. Host can start."):state.status==="matchOver"?"Match complete.":(mine?"Tip: press SPACE to spin, or type a letter.":`${who} is playing…`);
  document.querySelectorAll("[data-letter]").forEach(b=>{const used=state.guessed.includes(b.dataset.letter);b.classList.toggle("used",used);b.disabled=!(mine&&active&&state.turnValue)||used});
  document.querySelectorAll("[data-vowel]").forEach(b=>{const used=state.guessed.includes(b.dataset.vowel);b.classList.toggle("used",used);b.disabled=!(mine&&active&&!state.turnValue&&!state.spin&&state.players[mySeat]?.roundScore>=250)||used});
  $("solveInput").disabled=!(mine&&active&&!state.spin);$("solveForm").querySelector("button").disabled=!(mine&&active&&!state.spin);
  $("startBtn").classList.toggle("hidden",!(state.canStart&&state.hostIndex===mySeat));$("nextBtn").classList.toggle("hidden",!(state.status==="roundOver"&&state.hostIndex===mySeat));$("newMatchBtn").classList.toggle("hidden",!(state.status==="matchOver"&&state.hostIndex===mySeat));
  // value display
  const vd=$("wheelResult");if(!wheelBusy){vd.className="";if(state.turnValue)vd.textContent=money(state.turnValue);else if(state.lastAction?.type==="spin"&&!state.spin&&/BANKRUPT|LOSE TURN/.test(state.lastAction.label)){vd.textContent=state.lastAction.label;vd.className=state.lastAction.label==="BANKRUPT"?"bankrupt":"lose"}else vd.textContent="—"}
  // wheel
  if($("wheel").dataset.ready!=="yes")buildWheel(state.wheel.map(w=>w.label));
  if(state.spin&&state.spin.id!==spinAnimId)animateSpin();
  // player joined
  if(prev&&prev.players.length<2&&state.players.length===2&&state.status==="lobby"){note(state.players[1-mySeat]?.name+" joined the room!","good");sfx.yourTurn()}
  if(prev&&prev.players.length===2&&state.players.length<2){note("Your opponent left the room.","bad")}
  // match start / new round
  if(prev&&(prev.status!=="playing"||prev.round!==state.round)&&active){popup(`ROUND ${state.round}`,"announce",1500);sfx.whoosh()}
  // turn change
  else if(prev&&active&&prev.status==="playing"&&prev.turn!==state.turn){if(mine){popup("YOUR TURN!","announce",1500);setTimeout(()=>sfx.yourTurn(),popBusy?900:0)}else{note(`${who}'s turn`,"info",2000);sfx.theirTurn()}}
  // guess / vowel / solve feedback
  if(state.lastAction&&state.lastAction.id!==lastFeedbackId&&["guess","vowel","solve"].includes(state.lastAction.type)){
    lastFeedbackId=state.lastAction.id;const act=state.lastAction,wrong=act.count===0||act.correct===false,lr=$("letterResult");
    lr.textContent=wrong?(act.letter?`NO ${act.letter}'s`:"INCORRECT!"):(act.letter?`${act.count} ${act.letter}${act.count>1?"'s":""}${act.type==="guess"&&prev?.turnValue?" · +"+money(prev.turnValue*act.count):""}`:"SOLVED!");
    lr.classList.toggle("wrong",wrong);lr.classList.add("show");clearTimeout(feedbackTimer);feedbackTimer=setTimeout(()=>lr.classList.remove("show"),2400);
    if(wrong){sfx.buzzer();const bf=document.querySelector(".board-frame");bf.classList.remove("shake");void bf.offsetWidth;bf.classList.add("shake")}else if(act.type==="guess"&&prev?.turnValue)setTimeout(()=>sfx.cash(),Math.min(reveals,12)*280)}
  // round / match over
  if(prev&&prev.status==="playing"&&state.status==="roundOver"){const w=state.winner,wn=w!=null?state.players[w]?.name:null;popup(w===mySeat?"YOU WIN THE ROUND!":wn?`${wn.toUpperCase()} WINS THE ROUND`:"ROUND OVER","winner",2600);if(w===mySeat){sfx.fanfare(false);confetti()}else sfx.theirTurn()}
  if(prev&&prev.status!=="matchOver"&&state.status==="matchOver"){const a=state.players[0]?.score??0,b=state.players[1]?.score??0,w=a===b?null:(a>b?0:1);popup(w===null?"IT'S A TIE!":w===mySeat?"YOU WIN THE MATCH!":`${state.players[w].name.toUpperCase()} WINS!`,"winner",3200);if(w===mySeat||w===null){sfx.fanfare(true);confetti(280)}}
  prev=state;// later re-renders of the same state must not replay effects
}

function animateSpin(){
  const sp=state.spin,wheel=$("wheel"),wrap=document.querySelector(".wheel-wrap");spinAnimId=sp.id;wheelBusy=true;
  const duration=sp.duration,segment=360/state.wheel.length,target=sp.index*segment+(sp.offset??segment/2);
  const current=((rotation%360)+360)%360,desired=(360-target)%360,delta=(desired-current+360)%360,laps=5+Math.floor(Math.random()*4);
  rotation+=laps*360+delta;wheel.style.transitionDuration=`${duration}ms`;wheel.style.transform=`rotate(${rotation}deg)`;
  wrap.classList.add("spinning");$("wheelResult").textContent="…";$("wheelResult").className="";sfx.whoosh();trackTicks(segment);$("spinBtn").disabled=true;
  const settledId=sp.id,label=sp.label;
  setTimeout(()=>{if(spinAnimId!==settledId)return;wrap.classList.remove("spinning");wheelBusy=false;socket.emit("spinSettled",{id:settledId});
    if(label==="BANKRUPT"){popup("BANKRUPT!","bankrupt");sfx.bankrupt()}else if(label==="LOSE TURN"){popup("LOSE A TURN","lose-turn");sfx.loseTurn()}else{popup("$"+Number(label).toLocaleString("en-US"),"cash");sfx.cash()}
    render()},duration+25);
}

/* ---------- fit to screen ---------- */
let fitOn=true;try{fitOn=localStorage.getItem("wwd-fit")!=="off"}catch(e){}
function setFitUI(){document.body.classList.toggle("fit",fitOn);$("fitBtn").setAttribute("aria-pressed",fitOn);$("fitBtn").title=fitOn?"Fit to screen: ON (click for normal scrolling)":"Fit to screen: OFF (click to fit everything on one screen)"}
let fitting=false,lastFit="";
function fitGame(){const g=$("game");if(!document.body.classList.contains("in-game"))return;
  if(!fitOn){g.style.zoom="";g.style.width="";return}
  fitting=true;const m=$("mainArea"),cs=getComputedStyle(m),W=m.clientWidth-parseFloat(cs.paddingLeft)-parseFloat(cs.paddingRight),H=m.clientHeight-parseFloat(cs.paddingTop)-parseFloat(cs.paddingBottom);
  // lay the game out at width L, measure its height, and zoom it so both fit; repeat a few times to settle
  let z=1,L=Math.min(W,1280);
  for(let i=0;i<5;i++){g.style.zoom="1";g.style.width=L+"px";const h=g.offsetHeight;const nz=Math.max(.3,Math.min(1,H/h,W/L));const nL=Math.min(W/nz,1280);if(Math.abs(nL-L)<2){z=nz;break}z=nz;L=nL}
  g.style.zoom="1";g.style.width=L+"px";z=Math.max(.3,Math.min(1,H/g.offsetHeight,W/L));
  g.style.zoom=String(z);lastFit=W+"x"+H;fitting=false}
setFitUI();
$("fitBtn").onclick=()=>{fitOn=!fitOn;try{localStorage.setItem("wwd-fit",fitOn?"on":"off")}catch(e){}setFitUI();fitGame();sfx.ui();note(fitOn?"Fit to screen ON":"Fit to screen OFF — scroll to see everything","info",1800)};
addEventListener("resize",()=>requestAnimationFrame(fitGame));
let fitTimer=null;new ResizeObserver(()=>{if(fitting)return;clearTimeout(fitTimer);fitTimer=setTimeout(fitGame,60)}).observe($("puzzle"));
if(document.fonts&&document.fonts.ready)document.fonts.ready.then(fitGame);

const q=new URLSearchParams(location.search).get("room");if(q)$("roomCode").value=q.toUpperCase();
