const fs=require('fs');const {JSDOM}=require('jsdom');
const html=fs.readFileSync('/home/user/proready-coach/index.html','utf8');
function make(pre){
  return new JSDOM(html,{runScripts:'dangerously',pretendToBeVisual:true,url:'http://localhost:8080/',
    beforeParse(w){w.alert=m=>(w.__alert=m);w.confirm=()=>true;w.scrollTo=()=>{};pre&&pre(w);}});
}
const wait=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
  const out=[];const chk=(n,ok,x)=>out.push([n,!!ok,x||'']);
  // 1. native shell: no SpeechRecognition at all, Capacitor present
  {
    const dom=make(w=>{ w.Capacitor={isNativePlatform:()=>true,getPlatform:()=>'android'}; });
    const w=dom.window,d=w.document; await wait(600);
    w.showView('interview');
    w.toggleRecording();
    chk('native shell: explains instead of pretending', /not available in the phone app/i.test(w.__alert||''), (w.__alert||'').slice(0,48)+'…');
    chk('native shell: does not enter recording state', d.getElementById('recBtn').textContent.includes('Start Speaking'));
    chk('native shell: notice is shell-aware', /not available in the phone app/i.test(d.getElementById('voiceSupportNote').textContent));
  }
  // 2. browser without the API
  {
    const dom=make();const w=dom.window,d=w.document;await wait(600);
    w.showView('interview'); w.toggleRecording();
    chk('no-API browser: explains + offers typing', /not available in this browser/i.test(w.__alert||'') && /type your answer/i.test(w.__alert||''), (w.__alert||'').slice(0,44));
    chk('no-API browser: no stuck record state', d.getElementById('recBtn').textContent.includes('Start Speaking'));
  }
  // 3. iOS WKWebView false positive: constructor EXISTS but throws / never fires
  {
    const dom=make(w=>{
      w.Capacitor={isNativePlatform:()=>true,getPlatform:()=>'ios'};
      class FakeSR{ constructor(){this.lang='';}
        start(){ throw new Error('SpeechRecognition not available'); }
        stop(){} }
      w.webkitSpeechRecognition=FakeSR;
    });
    const w=dom.window,d=w.document;await wait(600);
    w.showView('interview'); w.toggleRecording();
    chk('iOS false-positive: shell rule wins over feature detection', /not available in the phone app/i.test(w.__alert||''));
  }
  // 4. working browser: starts, then watchdog fires if nothing is heard
  {
    const dom=make(w=>{
      let inst=null;
      class FakeSR{ constructor(){inst=this;this.lang='';this.interimResults=false;this.continuous=false;}
        start(){ w.__started=true; } stop(){ if(this.onend)this.onend(); } }
      w.webkitSpeechRecognition=FakeSR; w.__inst=()=>inst;
    });
    const w=dom.window,d=w.document;await wait(600);
    w.showView('interview'); w.toggleRecording();
    chk('working browser: enters recording state', d.getElementById('recBtn').textContent.includes('Stop Recording'));
    chk('working browser: status says listening', /Listening/.test(d.getElementById('recStatus').textContent));
    await wait(7800);
    chk('watchdog clears fake listening state', /No speech was detected/i.test(d.getElementById('recStatus').textContent), d.getElementById('recStatus').textContent.slice(0,44)+'…');
    chk('watchdog resets the button', d.getElementById('recBtn').textContent.includes('Start Speaking'));
  }
  out.forEach(([n,ok,x])=>console.log((ok?'PASS':'FAIL').padEnd(5),n,x));
  const pass=out.every(r=>r[1]);console.log(pass?'\nVOICE HANDLING: PASS':'\nVOICE HANDLING: FAIL');process.exit(pass?0:1);
})();
