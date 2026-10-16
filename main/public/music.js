/* Word Wheel Duel — audio engine.
   One shared AudioContext with two volume buses: sound effects and music.
   The soundtrack is 20 original instrumentals synthesized live in the browser
   (electric piano, pads, bass, guitar-ish plucks, lead synth and drums) in a
   smooth 70s jazz-rock / soft-rock spirit. No audio files are downloaded. */
(function(){
"use strict";
let ctx=null,master,sfxBus,musicBus,reverb,reverbSend,noiseBuf;
const prefs={sfx:70,music:45,track:0,musicOn:true};
try{const saved=JSON.parse(localStorage.getItem("wwd-audio")||"{}");Object.assign(prefs,saved)}catch(e){}
function savePrefs(){try{localStorage.setItem("wwd-audio",JSON.stringify(prefs))}catch(e){}}
const curve=v=>Math.pow(Math.max(0,Math.min(100,v))/100,2);

function ensure(){
  if(ctx){if(ctx.state==="suspended")ctx.resume();return ctx}
  const AC=window.AudioContext||window.webkitAudioContext;if(!AC)return null;
  ctx=new AC();
  const comp=ctx.createDynamicsCompressor();comp.threshold.value=-14;comp.ratio.value=4;comp.attack.value=.005;comp.release.value=.2;
  master=ctx.createGain();master.gain.value=.9;master.connect(comp);comp.connect(ctx.destination);
  sfxBus=ctx.createGain();sfxBus.gain.value=curve(prefs.sfx);sfxBus.connect(master);
  musicBus=ctx.createGain();musicBus.gain.value=curve(prefs.music)*.75;musicBus.connect(master);
  // reverb (synthetic impulse) shared by music
  reverb=ctx.createConvolver();const len=ctx.sampleRate*2.4,ir=ctx.createBuffer(2,len,ctx.sampleRate);
  for(let c=0;c<2;c++){const d=ir.getChannelData(c);for(let i=0;i<len;i++)d[i]=(Math.random()*2-1)*Math.pow(1-i/len,3.2)}
  reverb.buffer=ir;reverbSend=ctx.createGain();reverbSend.gain.value=.28;reverbSend.connect(reverb);reverb.connect(musicBus);
  noiseBuf=ctx.createBuffer(1,ctx.sampleRate,ctx.sampleRate);const nd=noiseBuf.getChannelData(0);for(let i=0;i<nd.length;i++)nd[i]=Math.random()*2-1;
  if(ctx.state==="suspended")ctx.resume();
  return ctx;
}
const mtof=m=>440*Math.pow(2,(m-69)/12);
function env(g,t,a,peak,decayTo,dur){g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(Math.max(peak,.0002),t+a);g.gain.exponentialRampToValueAtTime(Math.max(decayTo,.0001),t+dur)}
function out(node,bus,wet){node.connect(bus);if(wet&&reverbSend){const s=ctx.createGain();s.gain.value=wet;node.connect(s);s.connect(reverbSend)}}
function noise(t,dur,filterType,freq,q,vol,bus,wet){const s=ctx.createBufferSource();s.buffer=noiseBuf;const f=ctx.createBiquadFilter();f.type=filterType;f.frequency.value=freq;f.Q.value=q||1;const g=ctx.createGain();env(g,t,.002,vol,.0001,dur);s.connect(f);f.connect(g);out(g,bus,wet);s.start(t);s.stop(t+dur+.05)}

/* ---------------- sound effects ---------------- */
function osc(type,freq,t,dur,vol,bus,opts={}){const o=ctx.createOscillator(),g=ctx.createGain();o.type=type;o.frequency.setValueAtTime(freq,t);if(opts.to)o.frequency.exponentialRampToValueAtTime(opts.to,t+(opts.glide||dur));if(opts.detune)o.detune.value=opts.detune;env(g,t,opts.a||.008,vol,.0001,dur);o.connect(g);out(g,bus,opts.wet);o.start(t);o.stop(t+dur+.05);return o}
const SFX={
  click(){const c=ensure();if(!c)return;const t=c.currentTime;osc("square",1800+Math.random()*300,t,.03,.06,sfxBus);noise(t,.02,"highpass",3000,1,.05,sfxBus)},
  tick(){const c=ensure();if(!c)return;const t=c.currentTime;osc("triangle",2400,t,.025,.09,sfxBus,{to:1400,glide:.02});noise(t,.015,"bandpass",4000,2,.08,sfxBus)},
  ui(){const c=ensure();if(!c)return;const t=c.currentTime;osc("sine",660,t,.08,.08,sfxBus);osc("sine",990,t+.05,.1,.06,sfxBus)},
  ding(i=0){const c=ensure();if(!c)return;const t=c.currentTime;const f=[1318.5,1568,1760,2093][i%4];osc("sine",f,t,.9,.14,sfxBus,{wet:.3});osc("sine",f*2.76,t,.25,.03,sfxBus);osc("triangle",f/2,t,.4,.05,sfxBus)},
  cash(){const c=ensure();if(!c)return;const t=c.currentTime;[0,.07,.14].forEach((d,i)=>osc("square",[1046.5,1318.5,1568][i],t+d,.18,.07,sfxBus));osc("sine",2093,t+.22,.6,.12,sfxBus,{wet:.3});noise(t+.2,.3,"highpass",6000,1,.12,sfxBus)},
  bankrupt(){const c=ensure();if(!c)return;const t=c.currentTime;[0,.32,.64].forEach((d,i)=>osc("sawtooth",[392,370,349][i],t+d,.3,.1,sfxBus,{to:[380,356,262][i],glide:.3}));osc("sawtooth",262,t+.96,.9,.12,sfxBus,{to:150,glide:.9,detune:8});osc("sawtooth",262,t+.96,.9,.08,sfxBus,{to:148,glide:.9,detune:-8})},
  loseTurn(){const c=ensure();if(!c)return;const t=c.currentTime;osc("square",330,t,.18,.09,sfxBus);osc("square",247,t+.2,.35,.09,sfxBus)},
  buzzer(){const c=ensure();if(!c)return;const t=c.currentTime;osc("sawtooth",160,t,.45,.11,sfxBus,{detune:12});osc("sawtooth",164,t,.45,.11,sfxBus,{detune:-12});osc("square",80,t,.45,.06,sfxBus)},
  yourTurn(){const c=ensure();if(!c)return;const t=c.currentTime;[523.25,659.25,783.99,1046.5].forEach((f,i)=>osc("triangle",f,t+i*.08,.35,.1,sfxBus,{wet:.25}))},
  theirTurn(){const c=ensure();if(!c)return;const t=c.currentTime;osc("sine",587,t,.2,.06,sfxBus);osc("sine",440,t+.12,.3,.06,sfxBus)},
  fanfare(big){const c=ensure();if(!c)return;const t=c.currentTime;const seq=big?[[523,0],[659,.12],[784,.24],[1047,.36],[784,.6],[1047,.72],[1319,.84]]:[[523,0],[659,.1],[784,.2],[1047,.32]];seq.forEach(([f,d])=>{osc("sawtooth",f,t+d,.35,.06,sfxBus,{wet:.3});osc("square",f/2,t+d,.3,.04,sfxBus)});const end=seq[seq.length-1][1];[1047,1319,1568].forEach(f=>osc("triangle",f,t+end+.15,1.4,.07,sfxBus,{wet:.4}));noise(t+end+.15,1.2,"highpass",7000,1,.08,sfxBus)},
  whoosh(){const c=ensure();if(!c)return;const t=c.currentTime;const s=ctx.createBufferSource();s.buffer=noiseBuf;const f=ctx.createBiquadFilter();f.type="bandpass";f.Q.value=2;f.frequency.setValueAtTime(400,t);f.frequency.exponentialRampToValueAtTime(3000,t+.35);const g=ctx.createGain();env(g,t,.1,.12,.0001,.45);s.connect(f);f.connect(g);g.connect(sfxBus);s.start(t);s.stop(t+.5)}
};

/* ---------------- music: instruments ---------------- */
function rhodes(m,t,dur,vel){const f=mtof(m),g=ctx.createGain();const a=ctx.createOscillator(),b=ctx.createOscillator(),bg=ctx.createGain();a.type="sine";a.frequency.value=f;b.type="sine";b.frequency.value=f*14.01;bg.gain.value=.12;
  // gentle FM for the bark
  const mod=ctx.createOscillator(),mg=ctx.createGain();mod.frequency.value=f;mg.gain.setValueAtTime(f*1.4*vel,t);mg.gain.exponentialRampToValueAtTime(f*.08,t+.25);mod.connect(mg);mg.connect(a.frequency);
  env(g,t,.006,.11*vel,.012*vel,Math.max(dur,.4));const bgg=ctx.createGain();env(bgg,t,.002,.03*vel,.0001,.18);
  a.connect(g);b.connect(bgg);bgg.connect(g);out(g,musicBus,.35);[a,b,mod].forEach(o=>{o.start(t);o.stop(t+dur+.5)})}
function pad(notes,t,dur,vol,bright){notes.forEach(m=>{[-7,7].forEach(dt=>{const o=ctx.createOscillator(),f=ctx.createBiquadFilter(),g=ctx.createGain();o.type="sawtooth";o.frequency.value=mtof(m);o.detune.value=dt;f.type="lowpass";f.frequency.value=bright||1400;f.Q.value=.5;g.gain.setValueAtTime(.0001,t);g.gain.linearRampToValueAtTime(vol,t+Math.min(.6,dur*.3));g.gain.setValueAtTime(vol,t+dur*.85);g.gain.linearRampToValueAtTime(.0001,t+dur+.3);o.connect(f);f.connect(g);out(g,musicBus,.5);o.start(t);o.stop(t+dur+.4)})})}
function bass(m,t,dur,vel){const f=mtof(m),o=ctx.createOscillator(),s=ctx.createOscillator(),lp=ctx.createBiquadFilter(),g=ctx.createGain();o.type="sawtooth";o.frequency.value=f;s.type="sine";s.frequency.value=f;lp.type="lowpass";lp.Q.value=4;lp.frequency.setValueAtTime(900*vel+200,t);lp.frequency.exponentialRampToValueAtTime(220,t+.18);env(g,t,.005,.2*vel,.05*vel,Math.max(.12,dur));const sg=ctx.createGain();sg.gain.value=.9;o.connect(lp);lp.connect(g);s.connect(sg);sg.connect(g);out(g,musicBus,0);[o,s].forEach(x=>{x.start(t);x.stop(t+dur+.1)})}
function pluck(m,t,dur,vel){const f=mtof(m),o=ctx.createOscillator(),bp=ctx.createBiquadFilter(),g=ctx.createGain();o.type="sawtooth";o.frequency.value=f;bp.type="bandpass";bp.Q.value=3;bp.frequency.setValueAtTime(f*4,t);bp.frequency.exponentialRampToValueAtTime(f*1.5,t+.15);env(g,t,.003,.14*vel,.0001,Math.min(dur,.35));o.connect(bp);bp.connect(g);out(g,musicBus,.3);o.start(t);o.stop(t+dur+.1)}
function lead(m,t,dur,vel,type){const f=mtof(m),o=ctx.createOscillator(),o2=ctx.createOscillator(),lp=ctx.createBiquadFilter(),g=ctx.createGain(),vib=ctx.createOscillator(),vg=ctx.createGain();o.type=type||"square";o2.type="sawtooth";o.frequency.value=f;o2.frequency.value=f;o2.detune.value=9;vib.frequency.value=5.2;vg.gain.setValueAtTime(0,t);vg.gain.linearRampToValueAtTime(f*.012,t+Math.min(.35,dur));vib.connect(vg);vg.connect(o.frequency);vg.connect(o2.frequency);lp.type="lowpass";lp.frequency.value=2600;lp.Q.value=1.5;g.gain.setValueAtTime(.0001,t);g.gain.linearRampToValueAtTime(.055*vel,t+.03);g.gain.setValueAtTime(.05*vel,t+dur*.8);g.gain.linearRampToValueAtTime(.0001,t+dur+.08);o.connect(lp);o2.connect(lp);lp.connect(g);out(g,musicBus,.4);[o,o2,vib].forEach(x=>{x.start(t);x.stop(t+dur+.15)})}
function kick(t,v){const o=ctx.createOscillator(),g=ctx.createGain();o.type="sine";o.frequency.setValueAtTime(140,t);o.frequency.exponentialRampToValueAtTime(45,t+.12);env(g,t,.002,.55*v,.0001,.3);o.connect(g);out(g,musicBus,0);o.start(t);o.stop(t+.35)}
function snare(t,v){noise(t,.18,"bandpass",1800,.8,.22*v,musicBus,.25);const o=ctx.createOscillator(),g=ctx.createGain();o.type="triangle";o.frequency.setValueAtTime(220,t);o.frequency.exponentialRampToValueAtTime(160,t+.06);env(g,t,.002,.14*v,.0001,.1);o.connect(g);out(g,musicBus,.1);o.start(t);o.stop(t+.15)}
function hat(t,v,open){noise(t,open?.22:.045,"highpass",7500,.7,.07*v,musicBus,0)}
function rim(t,v){noise(t,.03,"bandpass",3200,6,.18*v,musicBus,.1)}
function shaker(t,v){noise(t,.06,"bandpass",9000,1.5,.04*v,musicBus,0)}
function conga(t,v,hi){const o=ctx.createOscillator(),g=ctx.createGain();o.type="sine";o.frequency.setValueAtTime(hi?330:220,t);o.frequency.exponentialRampToValueAtTime(hi?300:190,t+.1);env(g,t,.002,.2*v,.0001,.2);o.connect(g);out(g,musicBus,.15);o.start(t);o.stop(t+.25)}

/* ---------------- music: harmony ---------------- */
const CH={maj7:[0,4,7,11],maj9:[0,4,7,11,14],"6/9":[0,4,7,9,14],add9:[0,4,7,14],maj:[0,4,7],mu:[0,2,4,7],"maj7#11":[0,4,7,11,18],
  m:[0,3,7],m7:[0,3,7,10],m9:[0,3,7,10,14],m11:[0,3,7,10,14,17],m6:[0,3,7,9],"m7b5":[0,3,6,10],
  "7":[0,4,7,10],"9":[0,4,7,10,14],"13":[0,4,10,14,21],"7sus4":[0,5,7,10],"9sus4":[0,5,10,14],"7#9":[0,4,10,15],sus2:[0,2,7],sus4:[0,5,7]};
const MINORISH=t=>/^m/.test(t);
function voicing(root,type,center){const iv=CH[type]||CH.maj;let notes=iv.map(i=>root+i);// place near center (e.g. 62)
  notes=notes.map(n=>{while(n<center-7)n+=12;while(n>center+9)n-=12;return n});notes.sort((a,b)=>a-b);return [...new Set(notes)]}
function scaleFor(type){return MINORISH(type)?[0,2,3,5,7,9,10]:/^7|^9|^13/.test(type)?[0,2,4,5,7,9,10]:[0,2,4,7,9,11]}

/* seeded random so each song's melody is the same every time it plays */
function rng(seed){let s=seed>>>0||1;return()=>{s^=s<<13;s>>>=0;s^=s>>17;s^=s<<5;s>>>=0;return s/4294967296}}

/* ---------------- the 20 songs ---------------- */
// prog: [semitones above key, chord type, optional bass offset]
const SONGS=[
 {title:"Velvet Freeway",bpm:96,groove:"shuffle",key:57,A:[[0,"m9"],[5,"9"],[10,"maj7"],[3,"mu"]],B:[[8,"maj7#11"],[7,"7#9"],[0,"m11"],[5,"9sus4"]],lead:"square",keys:"rhodes"},
 {title:"Gold Coast Motel",bpm:118,groove:"straight",key:60,A:[[0,"add9"],[7,"sus2"],[9,"m7"],[5,"maj9"]],B:[[5,"maj7"],[7,"7sus4"],[4,"m7"],[9,"m9"]],lead:"triangle",keys:"pluck"},
 {title:"Hollow Canyon Rain",bpm:84,groove:"halftime",key:62,A:[[0,"maj9"],[4,"m7"],[9,"m9"],[7,"9sus4"]],B:[[5,"maj7#11"],[0,"6/9"],[2,"m9"],[7,"13"]],lead:"triangle",keys:"rhodes"},
 {title:"Neon Gallery Blues",bpm:104,groove:"shuffle",key:53,A:[[0,"9"],[5,"13"],[0,"9"],[7,"7#9"]],B:[[3,"maj7"],[8,"mu"],[10,"9sus4"],[7,"7#9"]],lead:"square",keys:"rhodes"},
 {title:"Ocean Avenue Promise",bpm:122,groove:"straight",key:64,A:[[0,"maj"],[9,"m"],[5,"add9"],[7,"sus4"]],B:[[2,"m7"],[5,"maj7"],[9,"m7"],[7,"7sus4"]],lead:"sawtooth",keys:"pluck"},
 {title:"The Doctor of Delancey",bpm:100,groove:"funk",key:55,A:[[0,"m11"],[0,"m11"],[5,"9"],[3,"maj7#11"]],B:[[8,"maj9"],[10,"13"],[1,"maj7"],[7,"7#9"]],lead:"square",keys:"rhodes"},
 {title:"Tumbleweed Lullaby",bpm:76,groove:"halftime",key:59,A:[[0,"add9"],[5,"maj7"],[0,"add9"],[7,"sus4"]],B:[[9,"m7"],[5,"6/9"],[2,"m9"],[7,"9sus4"]],lead:"triangle",keys:"pad"},
 {title:"Chrome Saxophone Sunday",bpm:92,groove:"shuffle",key:58,A:[[0,"maj9"],[2,"m9"],[4,"m7"],[5,"mu"]],B:[[10,"9sus4"],[3,"maj7#11"],[8,"maj9"],[7,"7#9"]],lead:"square",keys:"rhodes"},
 {title:"Silverlake Second Chance",bpm:112,groove:"straight",key:62,A:[[0,"sus2"],[10,"maj"],[5,"add9"],[0,"maj"]],B:[[9,"m7"],[7,"sus4"],[5,"maj7"],[7,"7sus4"]],lead:"sawtooth",keys:"pluck"},
 {title:"Pontiac Paradox",bpm:108,groove:"funk",key:52,A:[[0,"m9"],[5,"13"],[0,"m9"],[10,"9sus4"]],B:[[3,"mu"],[5,"9"],[8,"maj7#11"],[7,"7#9"]],lead:"square",keys:"rhodes"},
 {title:"Moonstone Highway",bpm:126,groove:"drive",key:57,A:[[0,"m"],[8,"maj"],[10,"sus2"],[0,"m"]],B:[[5,"m7"],[8,"maj7"],[3,"maj"],[10,"7sus4"]],lead:"sawtooth",keys:"pluck"},
 {title:"Café Lucerne",bpm:88,groove:"bossa",key:60,A:[[2,"m9"],[7,"13"],[0,"maj9"],[9,"7#9"]],B:[[4,"m7b5"],[9,"7#9"],[2,"m11"],[7,"9sus4"]],lead:"triangle",keys:"rhodes"},
 {title:"Garden Gate Serenade",bpm:116,groove:"straight",key:65,A:[[0,"maj"],[10,"add9"],[5,"maj7"],[7,"sus4"]],B:[[2,"m7"],[0,"6/9"],[10,"maj7"],[7,"7sus4"]],lead:"triangle",keys:"pluck"},
 {title:"Adjacent Rooms",bpm:98,groove:"shuffle",key:56,A:[[0,"maj7#11"],[2,"mu"],[4,"m11"],[9,"9sus4"]],B:[[5,"maj9"],[7,"13"],[0,"6/9"],[11,"7#9"]],lead:"square",keys:"rhodes"},
 {title:"Desert Bloom Radio",bpm:120,groove:"drive",key:62,A:[[0,"add9"],[7,"maj"],[9,"m7"],[5,"add9"]],B:[[4,"m7"],[5,"maj7"],[2,"m9"],[7,"sus4"]],lead:"sawtooth",keys:"pad"},
 {title:"Lacquer & Lemon Ice",bpm:94,groove:"funk",key:61,A:[[0,"m9"],[3,"maj7"],[5,"m11"],[10,"13"]],B:[[8,"maj9"],[6,"maj7#11"],[5,"9sus4"],[7,"7#9"]],lead:"square",keys:"rhodes"},
 {title:"Lanterns on the Ridge",bpm:72,groove:"ballad",key:60,A:[[0,"add9"],[7,"sus4"],[9,"m7"],[5,"maj7"]],B:[[2,"m9"],[5,"6/9"],[0,"maj9"],[7,"9sus4"]],lead:"triangle",keys:"pluck"},
 {title:"Bodhisattva Boardwalk",bpm:132,groove:"drive",key:55,A:[[0,"9"],[5,"9"],[0,"9"],[7,"7#9"]],B:[[3,"maj7"],[5,"9"],[10,"mu"],[7,"7#9"]],lead:"square",keys:"pluck"},
 {title:"Midnight at the Marina",bpm:86,groove:"bossa",key:63,A:[[0,"maj9"],[9,"m9"],[2,"m11"],[7,"13"]],B:[[5,"maj7#11"],[4,"m7"],[1,"maj7"],[7,"9sus4"]],lead:"triangle",keys:"rhodes"},
 {title:"Polaroid Summer",bpm:110,groove:"straight",key:57,A:[[0,"m7"],[10,"add9"],[8,"maj7"],[10,"sus2"]],B:[[5,"m9"],[8,"maj9"],[3,"6/9"],[7,"7sus4"]],lead:"sawtooth",keys:"pad"}
];

/* Each song: intro (A once, sparse) → A A B A … A melody repeats so it's hummable. */
function buildSong(song,index){
  const r=rng(1009*(index+3)+song.bpm);
  const sections=["A","A","B","A","B","A","A","B"];// 8 sections × 4 bars × 2 (each chord = 1 bar, played twice)
  const melodies={};
  ["A","B"].forEach(sec=>{
    const prog=song[sec],bars=[];let last=song.key+12+7;
    const rhythms=[[0,3,6,8,10,12],[0,2,4,7,10],[2,4,6,10,12,14],[0,4,6,8,12],[0,3,8,11,12],[1,4,8,10,13]];
    for(let b=0;b<prog.length*2;b++){
      const [deg,type]=prog[b%prog.length],root=song.key+deg;
      const rest=r()<.22&&b%2===1;
      const rhy=rest?[]:rhythms[Math.floor(r()*rhythms.length)];
      const notes=[];const sc=scaleFor(type),tones=CH[type]||CH.maj;
      rhy.forEach((step,k)=>{
        const useChord=k===0||r()<.55;
        const pool=[];for(let o=12;o<=24;o+=12){(useChord?tones:sc).forEach(i=>pool.push(root+i+o))}
        const candidates=pool.filter(n=>n>=song.key+12+2&&n<=song.key+24+7);
        candidates.sort((a,b2)=>Math.abs(a-last)-Math.abs(b2-last));
        const pick=candidates[Math.min(candidates.length-1,Math.floor(r()*r()*4))]||last;
        last=pick;const next=rhy[k+1]??16;notes.push({step,m:pick,len:Math.max(1,Math.min(6,next-step))})
      });
      bars.push(notes)
    }
    melodies[sec]=bars
  });
  return {sections,melodies}
}

const music={songs:SONGS.map(s=>s.title),current:prefs.track%SONGS.length,playing:false,onChange:null};
let timer=null,nextTime=0,stepIdx=0,built=null,songBars=0;
const STEPS=16;
function startSong(i){music.current=((i%SONGS.length)+SONGS.length)%SONGS.length;prefs.track=music.current;savePrefs();built=buildSong(SONGS[music.current],music.current);stepIdx=0;songBars=built.sections.length*SONGS[music.current].A.length*2+2;if(ctx)nextTime=ctx.currentTime+.15;music.onChange&&music.onChange()}
function scheduleStep(t){
  const song=SONGS[music.current],spb=60/song.bpm,stepDur=spb/4;
  const totalStep=stepIdx,bar=Math.floor(totalStep/STEPS),s=totalStep%STEPS;
  if(bar>=songBars){startSong(music.current+1);return}
  const intro=bar<2;// two-bar drum-less intro of the first chord
  const body=bar-2;const barsPerSection=song.A.length*2;
  const secIndex=intro?0:Math.floor(body/barsPerSection),sec=intro?"A":built.sections[secIndex%built.sections.length];
  const barInSec=intro?0:body%barsPerSection;const prog=song[sec];const [deg,type,bOff]=prog[barInSec%prog.length];
  const root=song.key+deg,swing=(song.groove==="shuffle"?.62:song.groove==="bossa"?.52:.5);
  let tt=t;if(s%2===1)tt=t+stepDur*2*(swing-.5);
  const outro=bar===songBars-1;
  // harmony
  if(s===0){
    const v=voicing(root,type,64);
    if(song.keys==="pad"||intro||outro)pad(v,tt,spb*4,.016,intro?900:1500);
    if(song.keys==="rhodes"){v.forEach((m,k)=>rhodes(m,tt+k*.012,spb*2,.8))}
  }
  if(song.keys==="rhodes"&&!intro){
    const comp={shuffle:[6,10],funk:[3,6,10,14],bossa:[3,6,11,14],straight:[8],drive:[8],ballad:[8],halftime:[8]}[song.groove]||[8];
    if(comp.includes(s))voicing(root,type,64).forEach((m,k)=>rhodes(m,tt+k*.008,stepDur*2,.55))
  }
  if(song.keys==="pluck"&&!intro){const v=voicing(root,type,67);const pat=[0,2,4,6,8,10,12,14];if(pat.includes(s))pluck(v[(s/2)%v.length],tt,stepDur*2,s%4===0?1:.7)}
  if(song.keys==="pad"&&!intro&&s%4===2){const v=voicing(root,type,70);pluck(v[(s>>2)%v.length]+12,tt,stepDur*3,.5)}
  // bass
  const bassRoot=root+(bOff||0)-24+(root-24<36?12:0),g=song.groove;
  if(!intro){
    const fifth=bassRoot+7,oct=bassRoot+12,tones=CH[type]||CH.maj;
    if(g==="shuffle"){if(s%4===0)bass(s===0?bassRoot:(s===8?bassRoot+tones[2%tones.length]:bassRoot+(s===4?tones[1]:tones[3%tones.length]||10)),tt,stepDur*3,.9)}
    else if(g==="funk"){if([0,3,6,7,10,14].includes(s))bass([bassRoot,oct,bassRoot,fifth,oct,bassRoot+10][[0,3,6,7,10,14].indexOf(s)],tt,stepDur*1.5,s===0?1:.75)}
    else if(g==="bossa"){if(s===0||s===6)bass(bassRoot,tt,stepDur*5,.85);if(s===8||s===14)bass(fifth-12+12,tt,stepDur*2,.75)}
    else if(g==="halftime"||g==="ballad"){if(s===0)bass(bassRoot,tt,spb*2.5,.85);if(s===10)bass(fifth,tt,spb*1.2,.7)}
    else{if(s%2===0)bass(s%8===6?oct:bassRoot,tt,stepDur*1.6,s%4===0?1:.7)}
  }
  // drums
  if(!intro&&!outro){
    if(g==="shuffle"){if(s===0||s===10)kick(tt,1);if(s===4||s===12)snare(tt,1);if(s%2===1&&Math.random()<.35)snare(tt,.18);if(s%2===0)hat(tt,s%4===0?1:.7);else hat(tt,.35)}
    else if(g==="funk"){if([0,6,10].includes(s))kick(tt,1);if(s===4||s===12)snare(tt,1);if([7,9,15].includes(s))snare(tt,.2);hat(tt,s%2?.45:.9,s===14)}
    else if(g==="bossa"){if(s===0||s===8)kick(tt,.7);if([0,3,6,10,12].includes(s))rim(tt,.8);shaker(tt,s%2?.6:1)}
    else if(g==="halftime"){if(s===0||s===11)kick(tt,1);if(s===8)snare(tt,1);if(s%2===0)hat(tt,.8)}
    else if(g==="ballad"){if(s===0)kick(tt,.8);if(s===8)rim(tt,.9);if(s%4===0)shaker(tt,.7)}
    else if(g==="drive"){if(s%4===0)kick(tt,1);if(s===4||s===12)snare(tt,1);hat(tt,s%2?.5:.9,s%4===2);if(s===14&&bar%4===3)conga(tt,.8,true)}
    else{if(s===0||s===6||s===8)kick(tt,1);if(s===4||s===12)snare(tt,1);hat(tt,s%2?.5:.85);if(s%4===3)shaker(tt,.5)}
  }
  // melody (not in intro; drops out every other A section for breathing room)
  if(!intro&&!outro){
    const sectionLoopSkip=sec==="A"&&secIndex===0;
    if(!sectionLoopSkip){const notes=built.melodies[sec][barInSec]||[];notes.forEach(n=>{if(n.step===s)lead(n.m,tt,n.len*stepDur*.95,.85,song.lead)})}
  }
  if(outro&&s===0)rhodes(root+12,tt,spb*4,.6);
}
function tick(){if(!ctx)return;while(nextTime<ctx.currentTime+.15){scheduleStep(nextTime);const song=SONGS[music.current];nextTime+=60/song.bpm/4;stepIdx++}}
music.play=function(){if(!ensure())return;if(music.playing)return;if(!built)startSong(music.current);nextTime=ctx.currentTime+.1;music.playing=true;prefs.musicOn=true;savePrefs();timer=setInterval(tick,25);musicBus.gain.cancelScheduledValues(ctx.currentTime);musicBus.gain.setTargetAtTime(curve(prefs.music)*.75,ctx.currentTime,.1);music.onChange&&music.onChange()};
music.pause=function(){if(!music.playing)return;music.playing=false;prefs.musicOn=false;savePrefs();clearInterval(timer);timer=null;if(ctx){musicBus.gain.setTargetAtTime(.0001,ctx.currentTime,.08);setTimeout(()=>{if(!music.playing&&musicBus)musicBus.gain.value=curve(prefs.music)*.75},600)}music.onChange&&music.onChange()};
music.toggle=()=>music.playing?music.pause():music.play();
music.select=i=>{const was=music.playing;if(was){clearInterval(timer);music.playing=false}startSong(i);if(was)music.play()};
music.next=()=>music.select(music.current+1);
music.wantsAutoplay=()=>prefs.musicOn!==false;

/* ---------------- announcer voice clips (play through the sound-effects volume) ---------------- */
const CLIPS={solveCorrect:"/sfx/solve-correct.mp3",wrongLetter:"/sfx/wrong-letter.mp3",solveWrong:"/sfx/solve-wrong.mp3",solvePress:"/sfx/solve-press.mp3",gameStart:"/sfx/game-start.mp3"};
const clipBufs={},clipLoads={};let activeClip=null;
function loadClip(name){if(clipBufs[name])return Promise.resolve(clipBufs[name]);if(clipLoads[name])return clipLoads[name];if(!ensure()||!CLIPS[name])return Promise.resolve(null);
  clipLoads[name]=fetch(CLIPS[name]).then(r=>r.arrayBuffer()).then(b=>new Promise((ok,no)=>ctx.decodeAudioData(b,ok,no))).then(buf=>clipBufs[name]=buf).catch(()=>{delete clipLoads[name];return null});return clipLoads[name]}
function preloadClips(){Object.keys(CLIPS).forEach(loadClip)}
function playClip(name,delay=0){const c=ensure();if(!c)return;loadClip(name).then(buf=>{if(!buf)return;
  if(activeClip){try{activeClip.stop()}catch(e){}}
  const src=ctx.createBufferSource(),g=ctx.createGain();src.buffer=buf;g.gain.value=1.6;src.connect(g);g.connect(sfxBus);const t=ctx.currentTime+delay;src.start(t);activeClip=src;
  // duck the music under the announcer
  if(music.playing){const lvl=curve(prefs.music)*.75;musicBus.gain.cancelScheduledValues(t);musicBus.gain.setTargetAtTime(lvl*.3,t,.08);musicBus.gain.setTargetAtTime(lvl,t+buf.duration,.4)}
  src.onended=()=>{if(activeClip===src)activeClip=null}})}
window.WWAudio={
  ensure,sfx:SFX,music,prefs,clip:playClip,preloadClips,
  setSfxVolume(v){prefs.sfx=+v;savePrefs();if(sfxBus)sfxBus.gain.setTargetAtTime(curve(v),ctx.currentTime,.03)},
  setMusicVolume(v){prefs.music=+v;savePrefs();if(musicBus&&music.playing)musicBus.gain.setTargetAtTime(curve(v)*.75,ctx.currentTime,.03)}
};
})();
