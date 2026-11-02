global.window = {};
require(__dirname + '/../voice-adapter.js');
const A = global.window.VoiceAdapter;
const out=[];const chk=(n,ok,x)=>out.push([n,!!ok,x||'']);
const run=async()=>{
  // 1. plain browser with web speech
  {
    global.window.SpeechRecognition = function(){}; 
    const d=A.detect(true);
    chk('browser: uses web API', d.listen.mode==='web' && d.speak.mode==='unavailable', d.listen.mode);
  }
  // 2. native android WITH plugins
  {
    global.window = {}; delete require.cache[require.resolve(__dirname + '/../voice-adapter.js')];
    require(__dirname + '/../voice-adapter.js');
    global.window.Capacitor = {isNativePlatform:()=>true, getPlatform:()=>'android',
      Plugins:{SpeechRecognition:{start:async()=>{},stop:async()=>{}}, TextToSpeech:{speak:async()=>{},stop:async()=>{}}}};
    const d=window.VoiceAdapter.detect(true);
    chk('android+plugin: native listen', d.listen.mode==='native' && d.canListen);
    chk('android+plugin: native speak', d.speak.mode==='native');
    chk('android+plugin: message is positive', window.VoiceAdapter.describe().ok===true);
  }
  // 3. native iOS WITHOUT plugins but WITH webkitSpeechRecognition (the trap)
  {
    global.window = {}; delete require.cache[require.resolve(__dirname + '/../voice-adapter.js')];
    require(__dirname + '/../voice-adapter.js');
    global.window.webkitSpeechRecognition = function(){};
    global.window.Capacitor = {isNativePlatform:()=>true, getPlatform:()=>'ios'};
    const d=window.VoiceAdapter.detect(true);
    chk('iOS trap: refuses to trust feature detection', d.listen.mode==='unavailable' && d.listen.reason==='native-without-plugin', d.listen.reason);
    chk('iOS trap: describes typing path', /not available in the phone app/i.test(window.VoiceAdapter.describe().text));
  }
  // 4. iOS home-screen web app (standalone) — exposed API must not be trusted
  {
    global.window = {}; delete require.cache[require.resolve(__dirname + '/../voice-adapter.js')];
    require(__dirname + '/../voice-adapter.js');
    global.window.webkitSpeechRecognition=function(){};
    global.window.navigator={standalone:true,userAgent:'Mozilla/5.0 (iPhone)'};
    const d=window.VoiceAdapter.detect(true);
    chk('iOS standalone: reports unavailable', d.listen.mode==='unavailable' && d.listen.reason==='ios-home-screen-app', d.listen.reason);
  }
  // 5. native listen lifecycle: permission accept + partials + end
  {
    global.window = {}; delete require.cache[require.resolve(__dirname + '/../voice-adapter.js')];
    require(__dirname + '/../voice-adapter.js');
    const listeners={}; let stopped=false;
    const stt={ checkPermissions:async()=>({speechRecognition:'prompt'}),
      requestPermissions:async()=>({speechRecognition:'granted'}),
      start:async()=>{ stopped=false; }, stop:async()=>{ stopped=true; },
      addListener:(ev,cb)=>{ listeners[ev]=cb; return {remove(){}}; } };
    global.window.Capacitor={isNativePlatform:()=>true,getPlatform:()=>'android',Plugins:{SpeechRecognition:stt,TextToSpeech:{speak:async()=>{},stop:async()=>{}}}};
    const VA=window.VoiceAdapter;
    let partial='', ended=false, started=false, errored=null;
    const k=VA.listen({onPartial:t=>partial=t,onEnd:()=>ended=true,onStart:()=>started=true,onError:e=>errored=e});
    await new Promise(r=>setTimeout(r,60));
    chk('native: requested permission and started', started===true, 'started='+started);
    if(listeners.partialResults) listeners.partialResults({matches:['I scheduled']});
    chk('native: partial transcript delivered', partial==='I scheduled', partial);
    chk('native: tracks speech heard', VA.hasHeardSpeech()===true);
    k.stop(); await new Promise(r=>setTimeout(r,60));
    chk('native: stop calls plugin and ends', stopped===true && ended===true);
  }
  // 6. native permission denied
  {
    global.window = {}; delete require.cache[require.resolve(__dirname + '/../voice-adapter.js')];
    require(__dirname + '/../voice-adapter.js');
    global.window.Capacitor={isNativePlatform:()=>true,getPlatform:()=>'ios',
      Plugins:{SpeechRecognition:{checkPermissions:async()=>({speechRecognition:'denied'}),
        requestPermissions:async()=>({speechRecognition:'denied'}),start:async()=>{},stop:async()=>{},
        addListener:()=>({remove(){}})},TextToSpeech:{speak:async()=>{},stop:async()=>{}}}};
    let err=null, done=false;
    window.VoiceAdapter.listen({onError:e=>err=e,onEnd:()=>done=true});
    await new Promise(r=>setTimeout(r,60));
    chk('native: denial reported as not-allowed', err==='not-allowed' && done, String(err));
  }
  // 7. speak: native
  {
    global.window = {}; delete require.cache[require.resolve(__dirname + '/../voice-adapter.js')];
    require(__dirname + '/../voice-adapter.js');
    let said=null;
    global.window.Capacitor={isNativePlatform:()=>true,getPlatform:()=>'android',
      Plugins:{SpeechRecognition:null,TextToSpeech:{speak:async o=>{said=o.text;},stop:async()=>{}}}};
    let ended=false;
    const ok=window.VoiceAdapter.speak('Please tell me about yourself.',{onEnd:()=>ended=true});
    await new Promise(r=>setTimeout(r,40));
    chk('native speak: routed to plugin', ok===true && said==='Please tell me about yourself.', said||'');
    chk('native speak: onEnd fires', ended===true);
  }
  // 8. speak: web fallback
  {
    global.window = {}; delete require.cache[require.resolve(__dirname + '/../voice-adapter.js')];
    require(__dirname + '/../voice-adapter.js');
    let spoke=null;
    global.window.SpeechSynthesisUtterance=function(t){this.text=t;};
    global.window.speechSynthesis={speak:u=>{spoke=u.text;},cancel:()=>{}};
    window.VoiceAdapter.speak('Hello there');
    chk('web speak: routed to speechSynthesis', spoke==='Hello there', spoke||'');
  }
  out.forEach(([n,ok,x])=>console.log((ok?'PASS':'FAIL').padEnd(5),n,x));
  const pass=out.every(r=>r[1]);console.log(pass?'\nADAPTER: PASS':'\nADAPTER: FAIL');process.exit(pass?0:1);
};
run();
