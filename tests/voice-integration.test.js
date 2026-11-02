/* Integration: the real app, with faked native plugins, exercising the paths that matter. */
const fs = require('fs');
const { JSDOM, VirtualConsole } = require('jsdom');
const html = fs.readFileSync(__dirname + '/../index.html', 'utf8');
const wait = ms => new Promise(r => setTimeout(r, ms));

function boot(env) {
  const errs = [];
  const dom = new JSDOM(html, {
    runScripts: 'dangerously', pretendToBeVisual: true, url: 'http://localhost:8080/',
    virtualConsole: new VirtualConsole().on('jsdomError', e => errs.push(String(e.detail && e.detail.message || e.message))),
    beforeParse(w) {
      w.alert = m => { w.__alert = m; };
      w.confirm = () => true;
      w.scrollTo = () => {};
      if (env) env(w);
    }
  });
  return { w: dom.window, d: dom.window.document, errs };
}

function fakePlugins(w, behaviour) {
  const listeners = {};
  const log = { started: 0, stopped: 0, said: [], permAsked: 0 };
  const stt = {
    checkPermissions: async () => ({ speechRecognition: behaviour.permission || 'granted' }),
    requestPermissions: async () => { log.permAsked++; return { speechRecognition: behaviour.permission || 'granted' }; },
    start: async () => { log.started++; },
    stop: async () => { log.stopped++; },
    addListener: (ev, cb) => { listeners[ev] = cb; return { remove() {} }; }
  };
  const tts = {
    speak: async o => { log.said.push(o.text); },
    stop: async () => {}
  };
  w.Capacitor = { isNativePlatform: () => true, getPlatform: () => behaviour.platform || 'android',
                  registerPlugin: name => (name === 'SpeechRecognition' ? stt : tts) };
  return { log, listeners };
}

(async () => {
  const out = []; const chk = (n, ok, x) => out.push([n, !!ok, x || '']);

  // ---------- A. browser (no native) ----------
  {
    const { w, d, errs } = boot(w => {
      class SR { constructor() { w.__sr = this; } start() { w.__started = true; } stop() { this.onend && this.onend(); } }
      w.webkitSpeechRecognition = SR;
      w.SpeechSynthesisUtterance = function (t) { this.text = t; };
      w.speechSynthesis = { speak: u => { w.__spoken = u.text; if (u.onstart) u.onstart(); if (u.onend) u.onend(); }, cancel() {} };
    });
    await wait(700);
    w.showView('interview');
    chk('browser: adapter detects web mode', w.VoiceAdapter.detect(true).listen.mode === 'web');
    chk('browser: notice is positive', /Voice answers use your browser/i.test(d.getElementById('voiceSupportNote').textContent));
    w.toggleRecording();
    chk('browser: mic actually starts', w.__started === true && /Stop Recording/.test(d.getElementById('recBtn').textContent));
    w.toggleRecording();
    chk('browser: mic stops', /Start Speaking/.test(d.getElementById('recBtn').textContent));
    w.speak('Tell me about yourself.');
    chk('browser: question audio routed through adapter', w.__spoken === 'Tell me about yourself.', w.__spoken || '');
    chk('browser: no JS errors', errs.length === 0, JSON.stringify(errs.slice(0, 2)));
  }

  // ---------- B. native app WITH plugins (the shipped build) ----------
  {
    let plug;
    const { w, d, errs } = boot(w => { plug = fakePlugins(w, { platform: 'android', permission: 'granted' }); });
    await wait(700);
    const VA = w.VoiceAdapter;
    chk('native: adapter sees the plugins', VA.detect(true).listen.mode === 'native' && VA.detect(true).speak.mode === 'native');
    chk('native: notice says phone speech is used', /phone’s built-in speech recognition/i.test(d.getElementById('voiceSupportNote').textContent));
    w.showView('interview');
    w.toggleRecording();
    await wait(120);
    chk('native: plugin start called', plug.log.started === 1, 'starts=' + plug.log.started);
    chk('native: recording state on', /Stop Recording/.test(d.getElementById('recBtn').textContent));
    plug.listeners.partialResults && plug.listeners.partialResults({ matches: ['I worked at the service desk'] });
    chk('native: partial text lands in the answer box',
        d.getElementById('answerText').value.includes('service desk'), d.getElementById('answerText').value);
    w.toggleRecording();
    await wait(120);
    chk('native: plugin stop called', plug.log.stopped >= 1, 'stops=' + plug.log.stopped);
    chk('native: recording state off', /Start Speaking/.test(d.getElementById('recBtn').textContent));
    d.getElementById('intVoice').checked = true;
    w.speak('Why do you want this job?');
    await wait(80);
    chk('native: question audio goes to TTS plugin', plug.log.said[0] === 'Why do you want this job?', JSON.stringify(plug.log.said));
    chk('native: no JS errors', errs.length === 0, JSON.stringify(errs.slice(0, 2)));
  }

  // ---------- C. iOS shipped build WITHOUT plugins (the false-positive trap) ----------
  {
    const { w, d } = boot(w => {
      w.webkitSpeechRecognition = function () {};   // exposed but non-functional
      w.Capacitor = { isNativePlatform: () => true, getPlatform: () => 'ios' };
    });
    await wait(700);
    w.showView('interview');
    w.toggleRecording();
    chk('iOS no-plugin: refuses to pretend', /not available in the phone app/i.test(w.__alert || ''), (w.__alert || '').slice(0, 42) + '…');
    chk('iOS no-plugin: never enters recording', /Start Speaking/.test(d.getElementById('recBtn').textContent));
    chk('iOS no-plugin: notice explains the typing path', /not available in the phone app/i.test(d.getElementById('voiceSupportNote').textContent));
  }

  // ---------- D. native permission denied ----------
  {
    let plug;
    const { w, d } = boot(w => { plug = fakePlugins(w, { platform: 'ios', permission: 'denied' }); });
    await wait(700);
    w.showView('interview');
    w.toggleRecording();
    await wait(150);
    chk('denied: shows a permission message, not a fake Listening',
        /permission/i.test(d.getElementById('recStatus').textContent) && !d.getElementById('recBtn').textContent.includes('Stop Recording'),
        d.getElementById('recStatus').textContent.slice(0, 46) + '…');
    chk('denied: recording state stays off', /Start Speaking/.test(d.getElementById('recBtn').textContent));
  }

  out.forEach(([n, ok, x]) => console.log((ok ? 'PASS' : 'FAIL').padEnd(5), n, x));
  const pass = out.every(r => r[1]);
  console.log(pass ? '\nVOICE INTEGRATION: PASS' : '\nVOICE INTEGRATION: FAIL');
  process.exit(pass ? 0 : 1);
})();
