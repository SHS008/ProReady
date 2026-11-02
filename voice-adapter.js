/* ============================================================================
   ProReady Coach — speech adapter
   ----------------------------------------------------------------------------
   ONE speech interface for three very different environments:

     browser (Chrome/Edge/Safari)  -> Web Speech API
     Android app (Capacitor)       -> @capacitor-community/speech-recognition
                                      @capacitor-community/text-to-speech
     iOS app (Capacitor/WKWebView) -> same plugins (SFSpeechRecognizer / AVSpeech)

   Why this file exists: iOS WKWebView *exposes* window.webkitSpeechRecognition but
   does not implement it (WebKit bug 239816), so feature detection gives a false
   positive. Android WebView omits it entirely. Platform detection plus plugin
   availability is the only reliable gate.

   Detection order for listening:
     1. native plugin available  -> use it
     2. native shell but no plugin -> report unavailable (do NOT trust the Web API)
     3. browser with Web Speech API, not an iOS home-screen app -> use it
     4. otherwise -> unavailable

   This file is the single source of truth. tools/sync_export.py inlines it into
   index.html between the VoiceAdapter markers.
   ========================================================================= */
(function (root) {
  'use strict';

  var cached = null;

  function cap() {
    try { return root.Capacitor || null; } catch (e) { return null; }
  }

  function pluginNames(c) {
    // Capacitor 6/7: plugins registered via registerPlugin land on Capacitor.Plugins
    var out = { stt: null, tts: null };
    var reg = (root && root.ProReadyNative) || {};
    try {
      if (c && c.Plugins) {
        out.stt = c.Plugins.SpeechRecognition || null;
        out.tts = c.Plugins.TextToSpeech || null;
      }
    } catch (e) {}
    // plugins registered later via Capacitor.registerPlugin() are held here, so the
    // standard window.SpeechRecognition global is never overwritten
    if (!out.stt) out.stt = reg.SpeechRecognition || null;
    if (!out.tts) out.tts = reg.TextToSpeech || null;
    return out;
  }

  function platformOf() {
    var c = cap();
    try {
      if (c && typeof c.getPlatform === 'function') {
        var p = c.getPlatform();
        if (p && p !== 'web') return p;
      }
      if (c && typeof c.isNativePlatform === 'function' && c.isNativePlatform()) return 'native';
    } catch (e) {}
    var ua = (root.navigator && root.navigator.userAgent) || '';
    if (/Android/i.test(ua)) return /;\s*wv\)/.test(ua) ? 'android-webview' : 'android-browser';
    if (/iPhone|iPad|iPod/i.test(ua)) return 'ios-browser';
    return 'web';
  }

  function isNativeShell() {
    var c = cap();
    try {
      if (c && typeof c.isNativePlatform === 'function') return !!c.isNativePlatform();
      if (c && typeof c.getPlatform === 'function') return c.getPlatform() !== 'web';
    } catch (e) {}
    var p = platformOf();
    return p === 'android-webview' || p === 'ios-webview';
  }

  function webSTT() {
    return root.SpeechRecognition || root.webkitSpeechRecognition || null;
  }

  function webTTS() {
    return (root.speechSynthesis && root.SpeechSynthesisUtterance) ? root.speechSynthesis : null;
  }

  function isIosHomeScreenApp() {
    // Added-to-home-screen web apps on iOS do not get speech recognition either.
    try {
      return !!(root.navigator && root.navigator.standalone === true);
    } catch (e) { return false; }
  }

  function detect(force) {
    if (cached && !force) return cached;
    var c = cap();
    var plugs = pluginNames(c);
    var native = isNativeShell();
    var sttCtor = webSTT();

    var listenMode, reason;
    if (plugs.stt) {
      listenMode = 'native';
      reason = 'native-plugin';
    } else if (native) {
      listenMode = 'unavailable';
      reason = 'native-without-plugin';
    } else if (sttCtor && !isIosHomeScreenApp()) {
      listenMode = 'web';
      reason = 'web-speech-api';
    } else if (isIosHomeScreenApp()) {
      listenMode = 'unavailable';
      reason = 'ios-home-screen-app';
    } else {
      listenMode = 'unavailable';
      reason = 'no-web-speech-api';
    }

    var speakMode;
    if (plugs.tts) speakMode = 'native';
    else if (webTTS()) speakMode = 'web';
    else speakMode = 'unavailable';

    cached = {
      platform: platformOf(),
      nativeShell: native,
      plugins: { stt: !!plugs.stt, tts: !!plugs.tts },
      listen: { mode: listenMode, reason: reason },
      speak: { mode: speakMode },
      canListen: listenMode !== 'unavailable',
      canSpeak: speakMode !== 'unavailable'
    };
    return cached;
  }

  /* ------------------------------------------------------------------ listen */
  var session = null;   // { stop:fn }
  var state = { active: false, heard: false };

  function onPlugin(target, event, handler) {
    try {
      if (target && typeof target.addListener === 'function') {
        var h = target.addListener(event, handler);
        if (h && typeof h.then === 'function') return h;
        return h;
      }
    } catch (e) {}
    return null;
  }

  function removeListener(handle) {
    try { if (handle && typeof handle.remove === 'function') handle.remove(); } catch (e) {}
  }

  function listen(opts) {
    opts = opts || {};
    var d = detect(true);
    var c = cap();
    var plugs = pluginNames(c);

    if (!d.canListen) {
      if (opts.onUnavailable) opts.onUnavailable(d.listen.reason);
      return { stop: function () {} };
    }

    state.active = true;
    state.heard = false;
    var handles = [];

    // ---------------- native path ----------------
    if (d.listen.mode === 'native' && plugs.stt) {
      var plugin = plugs.stt;
      var finish = function () {
        state.active = false;
        handles.forEach(removeListener);
        if (opts.onEnd) opts.onEnd();
      };

      handles.push(onPlugin(plugin, 'partialResults', function (ev) {
        var text = (ev && ev.matches && ev.matches[0]) || '';
        if (!text) return;
        state.heard = true;
        if (opts.onPartial) opts.onPartial(text);
      }));

      (function begin() {
        var ready = (typeof plugin.checkPermissions === 'function')
          ? plugin.checkPermissions().then(function (p) {
              if (p && p.speechRecognition === 'granted') return true;
              return plugin.requestPermissions().then(function (r) {
                return !!(r && r.speechRecognition === 'granted');
              });
            })
          : Promise.resolve(true);

        ready.then(function (granted) {
          if (!granted) {
            state.active = false;
            if (opts.onError) opts.onError('not-allowed');
            if (opts.onEnd) opts.onEnd();
            return;
          }
          return plugin.start({
            language: 'en-US',
            maxResults: 3,
            partialResults: true,
            popup: false
          }).then(function () {
            if (opts.onStart) opts.onStart();
          }).catch(function (err) {
            state.active = false;
            var msg = String((err && err.message) || err || 'unknown');
            if (opts.onError) opts.onError(/denied|permission/i.test(msg) ? 'not-allowed' : msg);
            if (opts.onEnd) opts.onEnd();
          });
        }).catch(function () {
          state.active = false;
          if (opts.onError) opts.onError('plugin-error');
          if (opts.onEnd) opts.onEnd();
        });
      })();

      return {
        stop: function () {
          try { plugin.stop().then(finish).catch(finish); } catch (e) { finish(); }
        }
      };
    }

    // ---------------- web path ----------------
    var SR = webSTT();
    var rec = null;
    var base = '';
    var finished = false;
    var finish = function () {
      if (finished) return;
      finished = true;
      state.active = false;
      if (opts.onEnd) opts.onEnd();
    };

    try {
      rec = new SR();
      rec.lang = (opts.language || 'en-US');
      rec.interimResults = true;
      rec.continuous = true;

      rec.onresult = function (e) {
        var finalTxt = '', interimTxt = '';
        for (var i = e.resultIndex; i < e.results.length; i++) {
          var chunk = e.results[i][0].transcript;
          if (e.results[i].isFinal) finalTxt += chunk;
          else interimTxt += chunk;
        }
        if (finalTxt) {
          base += finalTxt;
          state.heard = true;
          if (opts.onResult) opts.onResult((base + ' ' + interimTxt).trim(), false);
        } else if (interimTxt) {
          state.heard = true;
          if (opts.onPartial) opts.onPartial((base + ' ' + interimTxt).trim());
        }
      };
      rec.onspeechstart = function () { state.heard = true; };
      rec.onerror = function (e) {
        var code = (e && e.error) || 'unknown';
        if (opts.onError) opts.onError(code);
        finish();
      };
      rec.onend = finish;
      rec.start();
    } catch (err) {
      state.active = false;
      if (opts.onError) opts.onError('start-failed');
      finish();
      return { stop: function () {} };
    }

    return {
      stop: function () {
        try { rec.stop(); } catch (e) { finish(); }
      }
    };
  }

  /* ------------------------------------------------------------------- speak */
  var speaking = false;

  function speak(text, opts) {
    opts = opts || {};
    var d = detect(true);
    if (!d.canSpeak || !text) {
      if (opts.onEnd) opts.onEnd();
      return false;
    }
    var c = cap();
    var plugs = pluginNames(c);

    if (d.speak.mode === 'native' && plugs.tts) {
      speaking = true;
      try {
        if (opts.onStart) opts.onStart();
        plugs.tts.speak({
          text: String(text),
          lang: 'en-US',
          rate: opts.rate == null ? 1.0 : opts.rate,
          pitch: opts.pitch == null ? 1.0 : opts.pitch,
          volume: 1.0,
          category: 'playback'
        }).then(function () {
          speaking = false;
          if (opts.onEnd) opts.onEnd();
        }).catch(function () {
          speaking = false;
          if (opts.onEnd) opts.onEnd();
        });
      } catch (e) {
        speaking = false;
        if (opts.onEnd) opts.onEnd();
      }
      return true;
    }

    var synth = webTTS();
    try {
      synth.cancel();
      var u = new root.SpeechSynthesisUtterance(String(text));
      u.rate = opts.rate == null ? 1.0 : opts.rate;
      u.pitch = opts.pitch == null ? 1.0 : opts.pitch;
      if (opts.onStart) u.onstart = opts.onStart;
      u.onend = function () { if (opts.onEnd) opts.onEnd(); };
      u.onerror = function () { if (opts.onEnd) opts.onEnd(); };
      synth.speak(u);
      return true;
    } catch (e) {
      if (opts.onEnd) opts.onEnd();
      return false;
    }
  }

  function cancelSpeak() {
    var c = cap();
    var plugs = pluginNames(c);
    try { if (plugs.tts && typeof plugs.tts.stop === 'function') plugs.tts.stop(); } catch (e) {}
    try { if (root.speechSynthesis) root.speechSynthesis.cancel(); } catch (e) {}
    speaking = false;
  }

  /* --------------------------------------------------------------- messaging */
  function describe() {
    var d = detect(true);
    if (d.canListen) {
      if (d.listen.mode === 'native') {
        return { ok: true, text: '🎤 Voice answers use your phone\u2019s built-in speech recognition. You can always type instead.' };
      }
      return { ok: true, text: '🎤 Voice answers use your browser\u2019s speech recognition (work best in Chrome, Edge or Safari). You can always type instead.' };
    }
    var text;
    if (d.listen.reason === 'native-without-plugin') {
      text = '🎤 <b>Voice input is not available in the phone app.</b> Type your answers \u2014 the notes, follow-up questions and scoring are identical. For voice practice, open the app in Chrome, Edge or Safari.';
    } else if (d.listen.reason === 'ios-home-screen-app') {
      text = '🎤 <b>Voice input is unavailable in an iPhone home-screen app.</b> Type your answers \u2014 scoring and notes work identically. Opening this page in Safari enables voice.';
    } else {
      text = '🎤 <b>Voice answers are not available in this browser.</b> Type your answers \u2014 the notes, scoring and report work identically. For voice practice, open this page in Chrome, Edge or Safari.';
    }
    return { ok: false, text: text, reason: d.listen.reason };
  }

  root.VoiceAdapter = {
    detect: detect,
    describe: describe,
    listen: listen,
    speak: speak,
    cancelSpeak: cancelSpeak,
    isNativeShell: isNativeShell,
    platform: platformOf,
    isListening: function () { return state.active; },
    hasHeardSpeech: function () { return state.heard; },
    isSpeaking: function () { return speaking; }
  };
})(typeof window !== 'undefined' ? window : this);
