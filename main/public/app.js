// Use HTTP long-polling rather than WebSockets. This is more compatible with
// temporary HTTP tunnel services that sometimes fail WebSocket upgrades.
const socket=io({transports:["polling"],upgrade:false,timeout:10000,reconnection:true,reconnectionAttempts:Infinity,reconnectionDelay:1000,reconnectionDelayMax:5000}),$=id=>document.getElementById(id);let state=null,mySeat=null,roomCode=null,rotation=0,toastTimer,audioContext=null,spinAnimId=null,wheelBusy=false,lastFeedbackId=null,feedbackTimer=null,spinSoundTimer=null,landPopupTimer=null;
$("alphabet").innerHTML="BCDFGHJKLMNPQRSTVWXYZ".split("").map(l=>`<button class="letter" data-letter="${l}">${l}</button>`).join("");
$("vowelButtons").innerHTML="AEIOU".split("").map(l=>`<button class="vowel" data-vowel="${l}">${l}</button>`).join("");
function toast(m){$("toast").textContent=m;$("toast").classList.add("show");clearTimeout(toastTimer);toastTimer=setTimeout(()=>$("toast").classList.remove("show"),2300)}
function audio(){try{audioContext=audioContext||new(window.AudioContext||window.webkitAudioContext)();if(audioContext.state==="suspended")audioContext.resume();return audioContext}catch{return null}}function tone(freq,duration,type="sine",volume=.045){const ac=audio();if(!ac)return;const now=ac.currentTime,osc=ac.createOscillator(),gain=ac.createGain();osc.type=type;osc.frequency.setValueAtTime(freq,now);gain.gain.setValueAtTime(.0001,now);gain.gain.exponentialRampToValueAtTime(volume,now+.012);gain.gain.exponentialRampToValueAtTime(.0001,now+duration);osc.connect(gain);gain.connect(ac.destination);osc.start(now);osc.stop(now+duration+.02)}function buzzer(){tone(180,.22,"sawtooth",.07);setTimeout(()=>tone(130,.24,"sawtooth",.065),130)}function spinSound(duration){clearTimeout(spinSoundTimer);const end=Date.now()+duration;let delay=42;function tick(){if(Date.now()>=end)return;tone(950+Math.random()*180,.025,"square",.018);delay=Math.min(230,delay*1.055);spinSoundTimer=setTimeout(tick,delay)}tick()}

socket.on("disconnect",reason=>{$("connection").classList.remove("online");$("connection").querySelector("span").textContent="DISCONNECTED";$("lobbyError").textContent="Lost connection to the game server ("+reason+"). Check that the server window is still running, then refresh this page."});
socket.on("connect_error",err=>{$("connection").classList.remove("online");$("connection").querySelector("span").textContent="CONNECTION ERROR";$("lobbyError").textContent="Could not connect to the game server. "+(err?.message||"Refresh the page and check the host server window.")});
socket.on("connect",()=>{$("connection").classList.add("online");$("connection").querySelector("span").textContent="CONNECTED";$("lobbyError").textContent=""});
socket.on("reconnect_attempt",()=>{$("connection").classList.remove("online");$("connection").querySelector("span").textContent="RECONNECTING"});
socket.on("reconnect_error",()=>{$("connection").classList.remove("online");$("connection").querySelector("span").textContent="RECONNECTING"});
socket.on("reconnect_failed",()=>{$("connection").classList.remove("online");$("connection").querySelector("span").textContent="OFFLINE";$("lobbyError").textContent="Could not reach the game server. Confirm the host server and tunnel are running, then reopen the current public HTTPS link."});
socket.on("errorMessage",m=>{$("lobbyError").textContent=m;$("createBtn").disabled=false;$("joinBtn").disabled=false});
socket.on("joined",d=>{roomCode=d.code;mySeat=d.seat;$("createBtn").disabled=false;$("joinBtn").disabled=false;$("lobby").classList.add("hidden");$("game").classList.remove("hidden");$("roomLabel").textContent=roomCode;history.replaceState(null,"",`?room=${roomCode}`);toast("Joined room "+roomCode)});
socket.on("state",s=>{if(state&&s.revision<state.revision)return;state=s;render()});
function requestRoom(eventName,payload){
 $("lobbyError").textContent="";
 if(!socket.connected){$("lobbyError").textContent="Not connected to the game server yet. Check the CONNECTING indicator, then refresh the page.";return}
 $("createBtn").disabled=true;$("joinBtn").disabled=true;
 $("lobbyError").textContent="Connecting to room…";
 socket.timeout(6000).emit(eventName,payload,(err)=>{
   if(err){$("createBtn").disabled=false;$("joinBtn").disabled=false;$("lobbyError").textContent="The server did not respond. Make sure the host's server window is still running, then refresh this page."}
 });
}
$("createBtn").onclick=()=>requestRoom("createRoom",{name:$("playerName").value});
$("joinBtn").onclick=()=>requestRoom("joinRoom",{code:$("roomCode").value,name:$("playerName").value});
$("roomCode").oninput=e=>e.target.value=e.target.value.toUpperCase().replace(/[^A-Z0-9]/g,"").slice(0,5);
$("copyBtn").onclick=async()=>{try{await navigator.clipboard.writeText(`Join my Word Wheel Duel room ${roomCode}: ${location.origin}/?room=${roomCode}`);toast("Invite link copied!")}catch{toast("Share room code: "+roomCode)}};
$("startBtn").onclick=()=>socket.emit("startMatch");$("spinBtn").onclick=()=>{if(!wheelBusy){audio();socket.emit("spin")}};$("nextBtn").onclick=()=>socket.emit("nextRound");$("newMatchBtn").onclick=()=>socket.emit("newMatch");
$("alphabet").onclick=e=>{let b=e.target.closest("[data-letter]");if(b)socket.emit("guessConsonant",{letter:b.dataset.letter})};
$("vowelButtons").onclick=e=>{let b=e.target.closest("[data-vowel]");if(b)socket.emit("buyVowel",{letter:b.dataset.vowel})};
$("solveForm").onsubmit=e=>{e.preventDefault();socket.emit("solve",{answer:$("solveInput").value});$("solveInput").value=""};
let lastSpinKey="";
function showLandingAmount(label){const el=$("landPopup");if(!el)return;el.textContent=label==="BANKRUPT"?"BANKRUPT!":label==="LOSE TURN"?"LOSE TURN!":`${label}`;el.className="land-popup show "+(label==="BANKRUPT"?"bankrupt":label==="LOSE TURN"?"lose-turn":"cash");clearTimeout(landPopupTimer);landPopupTimer=setTimeout(()=>el.classList.remove("show"),1000)}\nfunction render(){if(!state)return;$("roomLabel").textContent=state.code;$("roundLabel").textContent=`ROUND ${state.round} / ${state.maxRounds}`;
for(let i=0;i<2;i++){let el=$("contestant"+i),p=state.players[i];el.querySelector(".player-name").textContent=p?.name||"Waiting…";el.querySelector(".score").textContent=p?.score??0;$("roundCash"+i).textContent=`ROUND ${p?.roundScore??0}`;el.classList.toggle("active",state.status==="playing"&&state.turn===i)}
$("message").textContent=state.message;$("category").textContent=state.category||"CATEGORY";
$("puzzle").innerHTML=state.phrase.length?state.phrase.map(c=>c===" "?'<div class="tile blank"></div>':`<div class="tile ${c===null?"hidden-letter":""}">${c||" "}</div>`).join(""):'<div style="color:#71809b;font-size:12px;padding:18px 0">The puzzle appears when the match begins.</div>';
let mine=state.turn===mySeat,active=state.status==="playing";
$("spinBtn").disabled=!(mine&&active&&!state.turnValue&&!state.spin&&!wheelBusy);$("spinBtn").textContent=state.turnValue?"CHOOSE A CONSONANT":"SPIN THE WHEEL ↻";$("turnValue").textContent=state.turnValue?`VALUE: ${state.turnValue}`:"SPIN FIRST";
$("turnNote").textContent=state.status==="lobby"?(state.players.length<2?"Waiting for a second player…":"Both players ready. Host can start."):(mine?"It's your turn. Make it count.":`${state.players[state.turn]?.name||"Opponent"} is playing.`);
document.querySelectorAll("[data-letter]").forEach(b=>b.disabled=!(mine&&active&&state.turnValue)||state.guessed.includes(b.dataset.letter));
document.querySelectorAll("[data-vowel]").forEach(b=>b.disabled=!(mine&&active&&!state.turnValue&&state.players[mySeat]?.roundScore>=250)||state.guessed.includes(b.dataset.vowel));
$("solveInput").disabled=!(mine&&active);$("solveForm").querySelector("button").disabled=!(mine&&active);
$("startBtn").classList.toggle("hidden",!(state.canStart&&state.hostIndex===mySeat));$("nextBtn").classList.toggle("hidden",!(state.status==="roundOver"&&state.hostIndex===mySeat));$("newMatchBtn").classList.toggle("hidden",!(state.status==="matchOver"&&state.hostIndex===mySeat));
if(state.status==="matchOver")$("turnNote").textContent="Match complete.";
let wheel=$("wheel");if(wheel.dataset.labelsReady!=="yes"){state.wheel.forEach((w,i)=>{let label=document.createElement("span");label.className="wheel-label";label.style.setProperty("--angle",`${i*20+10}deg`);label.textContent=w.label;wheel.appendChild(label)});wheel.dataset.labelsReady="yes"}
if(state.spin&&state.spin.id!==spinAnimId){spinAnimId=state.spin.id;wheelBusy=true;const duration=state.spin.duration,segment=360/state.wheel.length,target=state.spin.index*segment+(state.spin.offset??segment/2);const current=((rotation%360)+360)%360;const desired=((360-target)%360);const delta=((desired-current+360)%360);const laps=6+Math.floor(Math.random()*7);rotation+=laps*360+delta;wheel.style.transitionDuration=`${duration}ms`;wheel.style.transform=`rotate(${rotation}deg)`;$("wheelResult").textContent="";spinSound(duration);const settledId=state.spin.id,landedLabel=state.spin.label;setTimeout(()=>{if(spinAnimId!==settledId)return;socket.emit("spinSettled",{id:settledId});wheelBusy=false;showLandingAmount(landedLabel)},duration+25)}
if(state.lastAction&&state.lastAction.id&&state.lastAction.id!==lastFeedbackId&&["guess","vowel","solve"].includes(state.lastAction.type)){lastFeedbackId=state.lastAction.id;const act=state.lastAction,wrong=act.count===0||act.correct===false;$("letterResult").textContent=wrong?(act.letter?`${act.letter} — NO MATCH`:"INCORRECT SOLUTION"):(act.letter?`${act.letter} — ${act.count} FOUND`:"CORRECT!");$("letterResult").classList.toggle("wrong",wrong);$("letterResult").classList.add("show");clearTimeout(feedbackTimer);feedbackTimer=setTimeout(()=>$("letterResult").classList.remove("show"),1900);if(wrong)buzzer();else tone(670,.11)}
if(state.status==="roundOver"&&state.winner===mySeat&&state.lastAction?.type==="solve")tone(880,.2);if(!state.spin&&!wheelBusy&&!state.turnValue)$("wheelResult").textContent=state.lastAction?.type==="guess"?`${state.lastAction.letter}: ${state.lastAction.count} found`:"Ready when you are"}

const q=new URLSearchParams(location.search).get("room");if(q)$("roomCode").value=q.toUpperCase();
