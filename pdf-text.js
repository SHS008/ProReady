/* ProReady Coach — PDF text extraction (single source of truth)
   ------------------------------------------------------------------
   Reads the text layer out of a PDF on the user's device. Nothing is
   uploaded. Handles the cases real resume PDFs actually hit:

     • uncompressed streams                 (the old reader's only case)
     • FlateDecode, with ASCII85/ASCIIHex/RunLength in front
     • object streams (/Type /ObjStm)        — Word, Canva, LaTeX, Google Docs
     • cross-reference streams               — PDF 1.5+
     • Type0 subset fonts + ToUnicode CMaps  — the usual "garbage characters" trap
     • multi-page documents                  (page tree order, not file order)
     • WinAnsi / Latin-1 fallback when a font has no ToUnicode

   Deliberately NOT handled, reported honestly instead:
     • encrypted PDFs (cannot be read without the password)
     • scanned image-only PDFs (no text layer — needs OCR, which we don't do)

   Evaluated against real exported PDFs in tests/pdf-import.test.js.
*/
(function (root, factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.PdfText = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  /* ---------- byte helpers ---------- */
  function toBytes(buf) {
    if (buf instanceof Uint8Array) return buf;
    if (buf instanceof ArrayBuffer) return new Uint8Array(buf);
    if (buf && buf.buffer) return new Uint8Array(buf.buffer, buf.byteOffset || 0, buf.byteLength);
    if (typeof buf === 'string') {
      var u = new Uint8Array(buf.length);
      for (var i = 0; i < buf.length; i++) u[i] = buf.charCodeAt(i) & 255;
      return u;
    }
    throw new Error('pdf-buffer');
  }

  function latin1(u8) {
    var CH = 0x8000, out = '';
    for (var i = 0; i < u8.length; i += CH) {
      out += String.fromCharCode.apply(null, u8.subarray(i, Math.min(i + CH, u8.length)));
    }
    return out;
  }

  function utf8(u8) {
    try { return new TextDecoder('utf-8').decode(u8); }
    catch (e) { return latin1(u8); }
  }

  function concat(a, b) {
    var out = new Uint8Array(a.length + b.length);
    out.set(a, 0); out.set(b, a.length);
    return out;
  }

  /* ---------- filters ---------- */
  function ascii85(data) {
    var s = latin1(data).replace(/\s+/g, '');
    if (s.slice(0, 2) === '<~') s = s.slice(2);
    var end = s.indexOf('~>');
    if (end >= 0) s = s.slice(0, end);
    var out = [], i = 0;
    while (i < s.length) {
      if (s[i] === 'z' && i === 0) { out.push(0, 0, 0, 0); i++; continue; }
      if (s[i] === 'z') { out.push(0, 0, 0, 0); i++; continue; }
      var chunk = s.slice(i, i + 5), pad = 5 - chunk.length, val = 0;
      if (pad) chunk += 'uuuu'.slice(0, pad);
      for (var k = 0; k < 5; k++) val = val * 85 + (chunk.charCodeAt(k) - 33);
      var bytes = [(val >>> 24) & 255, (val >>> 16) & 255, (val >>> 8) & 255, val & 255];
      for (var j = 0; j < 4 - pad; j++) out.push(bytes[j]);
      i += 5;
    }
    return new Uint8Array(out);
  }

  function asciiHex(data) {
    var s = latin1(data).replace(/[^0-9A-Fa-f]/g, '');
    if (s.length % 2) s += '0';
    var out = new Uint8Array(s.length / 2);
    for (var i = 0; i < out.length; i++) out[i] = parseInt(s.substr(i * 2, 2), 16);
    return out;
  }

  function runLength(data) {
    var out = [], i = 0;
    while (i < data.length) {
      var n = data[i++];
      if (n === 128) break;
      if (n < 128) { for (var k = 0; k <= n && i < data.length; k++) out.push(data[i++]); }
      else { var v = data[i++]; for (var k2 = 0; k2 < 257 - n; k2++) out.push(v); }
    }
    return new Uint8Array(out);
  }

  /* ---------- minimal DEFLATE decoder (RFC 1951) ----------
     Fallback for browsers without DecompressionStream. iOS only gained it in
     16.4 and Android WebView support varies, so older phones land here. */
  var LBASE=[3,4,5,6,7,8,9,10,11,13,15,17,19,23,27,31,35,43,51,59,67,83,99,115,131,163,195,227,258];
  var LEXTRA=[0,0,0,0,0,0,0,0,1,1,1,1,2,2,2,2,3,3,3,3,4,4,4,4,5,5,5,5,0];
  var DBASE=[1,2,3,4,5,7,9,13,17,25,33,49,65,97,129,193,257,385,513,769,1025,1537,2049,3073,4097,6145,8193,12289,16385,24577];
  var DEXTRA=[0,0,0,0,1,1,2,2,3,3,4,4,5,5,6,6,7,7,8,8,9,9,10,10,11,11,12,12,13,13];
  var CLORDER=[16,17,18,0,8,7,9,6,10,5,11,4,12,3,13,2,14,1,15];

  function inflateRawJS(src){
    var pos=0, bitBuf=0, bitCnt=0, out=[], i;
    function bits(n){
      while(bitCnt<n){
        if(pos>=src.length) throw new Error('inflate-eof');
        bitBuf |= src[pos++]<<bitCnt; bitCnt+=8;
      }
      var v=bitBuf&((1<<n)-1); bitBuf>>>=n; bitCnt-=n; return v;
    }
    function buildTree(lengths){
      var maxBits=0, blCount={}, code=0, nextCode={}, map={};
      for(i=0;i<lengths.length;i++) if(lengths[i]>maxBits) maxBits=lengths[i];
      for(i=0;i<=maxBits;i++) blCount[i]=0;
      for(i=0;i<lengths.length;i++) if(lengths[i]) blCount[lengths[i]]++;
      for(i=1;i<=maxBits;i++){ code=(code+(blCount[i-1]||0))<<1; nextCode[i]=code; }
      for(i=0;i<lengths.length;i++){
        var len=lengths[i]; if(!len) continue;
        map[len+':'+(nextCode[len]++)]=i;
      }
      return {map:map,maxBits:maxBits};
    }
    function decodeSym(t){
      var code=0;
      for(var len=1;len<=t.maxBits;len++){
        code=(code<<1)|bits(1);
        var v=t.map[len+':'+code];
        if(v!==undefined) return v;
      }
      throw new Error('inflate-badcode');
    }
    var fixedLit=null, fixedDist=null;
    function fixedTrees(){
      if(fixedLit) return;
      var l=[],d=[];
      for(i=0;i<288;i++) l[i] = i<144?8 : i<256?9 : i<280?7 : 8;
      for(i=0;i<30;i++) d[i]=5;
      fixedLit=buildTree(l); fixedDist=buildTree(d);
    }
    var last=false;
    while(!last){
      last = bits(1)===1;
      var type=bits(2);
      if(type===0){
        bitBuf=0; bitCnt=0;
        var len=src[pos]|(src[pos+1]<<8); pos+=4;
        for(var k=0;k<len;k++) out.push(src[pos++]);
      } else if(type===1||type===2){
        var lit, dist;
        if(type===1){ fixedTrees(); lit=fixedLit; dist=fixedDist; }
        else{
          var hlit=bits(5)+257, hdist=bits(5)+1, hclen=bits(4)+4;
          var clLens=[];
          for(i=0;i<19;i++) clLens[i]=0;
          for(i=0;i<hclen;i++) clLens[CLORDER[i]]=bits(3);
          var clTree=buildTree(clLens);
          var lens=[];
          while(lens.length<hlit+hdist){
            var sym=decodeSym(clTree);
            if(sym<16) lens.push(sym);
            else if(sym===16){ var prev=lens[lens.length-1]; var rep=bits(2)+3; while(rep--) lens.push(prev); }
            else if(sym===17){ var r2=bits(3)+3; while(r2--) lens.push(0); }
            else { var r3=bits(7)+11; while(r3--) lens.push(0); }
          }
          lit=buildTree(lens.slice(0,hlit));
          dist=buildTree(lens.slice(hlit,hlit+hdist));
        }
        for(;;){
          var s2=decodeSym(lit);
          if(s2<256){ out.push(s2); continue; }
          if(s2===256) break;
          var li=s2-257;
          var length=LBASE[li]+bits(LEXTRA[li]);
          var ds=decodeSym(dist);
          var distance=DBASE[ds]+bits(DEXTRA[ds]);
          var start=out.length-distance;
          if(start<0) throw new Error('inflate-baddist');
          for(var c=0;c<length;c++) out.push(out[start+c]);
        }
      } else throw new Error('inflate-btype');
    }
    return new Uint8Array(out);
  }


  /* FlateDecode: zlib-wrapped deflate. Tries platform streams, then Node zlib
     (tests), then a pure-JS inflater so old iOS/Android still work. */
  function inflate(data) {
    function stripZlib(u8) {
      /* 0x78 => zlib header + 4-byte Adler-32 trailer */
      if (u8.length > 2 && (u8[0] & 0x0f) === 8 && ((u8[0] << 8) | u8[1]) % 31 === 0) {
        return u8.subarray(2, Math.max(2, u8.length - 4));
      }
      return u8;
    }
    function viaJS() { return Promise.resolve(inflateRawJS(stripZlib(data))); }
    var DS = typeof DecompressionStream !== 'undefined' ? DecompressionStream : null;
    var attempts = [];
    if (DS) {
      attempts.push(function () {
        return new Response(new Blob([data]).stream().pipeThrough(new DS('deflate'))).arrayBuffer()
          .then(function (ab) { return new Uint8Array(ab); });
      });
      attempts.push(function () {
        return new Response(new Blob([data]).stream().pipeThrough(new DS('deflate-raw'))).arrayBuffer()
          .then(function (ab) { return new Uint8Array(ab); });
      });
    }
    if (typeof require === 'function') {
      attempts.push(function () {
        var zlib = require('zlib');
        return new Promise(function (res, rej) {
          zlib.inflate(data, function (e, o) { if (e) return rej(e); res(new Uint8Array(o)); });
        });
      });
    }
    attempts.push(viaJS);
    return attempts.reduce(function (p, fn) {
      return p.catch(function () { return fn(); });
    }, Promise.reject(new Error('start'))).catch(function () { throw new Error('pdf-flate'); });
  }

  function decodeWithFilters(data, filters) {
    return filters.reduce(function (p, f) {
      return p.then(function (buf) {
        switch (f) {
          case 'ASCII85Decode': case 'A85': return ascii85(buf);
          case 'ASCIIHexDecode': case 'AHx': return asciiHex(buf);
          case 'RunLengthDecode': case 'RL': return runLength(buf);
          case 'FlateDecode': case 'Fl': return inflate(buf);
          case 'Crypt': return buf;
          default: throw new Error('pdf-filter:' + f);
        }
      });
    }, Promise.resolve(data));
  }

  /* ---------- object parsing ---------- */
  function parseDictAt(text, start) {
    /* start points at '<<'. Returns {dict, end} with balanced << >>. */
    var depth = 0, i = start;
    while (i < text.length) {
      if (text[i] === '<' && text[i + 1] === '<') { depth++; i += 2; continue; }
      if (text[i] === '>' && text[i + 1] === '>') {
        depth--; i += 2;
        if (depth === 0) return { dict: text.slice(start, i), end: i };
        continue;
      }
      i++;
    }
    return { dict: text.slice(start), end: text.length };
  }

  function dictGet(dict, key) {
    /* Value as raw text for /Key, honouring nested dicts and arrays. */
    var re = new RegExp('/' + key + '(?![A-Za-z0-9])\\s*', 'g');
    var m = re.exec(dict);
    if (!m) return null;
    var i = m.index + m[0].length;
    if (dict.slice(i, i + 2) === '<<') {
      var d = parseDictAt(dict, i);
      return { type: 'dict', value: d.dict, ref: null };
    }
    if (dict[i] === '[') {
      var depth = 0, j = i;
      while (j < dict.length) {
        if (dict[j] === '[') depth++;
        else if (dict[j] === ']') { depth--; if (!depth) { j++; break; } }
        j++;
      }
      return { type: 'array', value: dict.slice(i, j) };
    }
    if (dict[i] === '/') {                       /* name value, e.g. /Filter /FlateDecode */
      var nm = /^\/[^\s\/<>\[\]()]*/.exec(dict.slice(i));
      return nm ? { type: 'name', value: nm[0].slice(1) } : null;
    }
    var v = /^[^\s\/<>\[\]()]+/.exec(dict.slice(i));
    if (!v) return null;
    var raw = v[0];
    var refM = /^(\d+)\s+(\d+)\s+R$/.exec(raw + (/^\d+\s+\d+\s+R/.test(dict.slice(i)) ? ' ' + dict.slice(i).split(/\s+/).slice(1, 3).join(' ') : ''));
    if (/^\d+$/.test(raw)) {
      var rest = dict.slice(i + raw.length);
      if (/^\s+\d+\s+R/.test(rest)) return { type: 'ref', value: parseInt(raw, 10) };
      return { type: 'num', value: parseFloat(raw) };
    }
    if (raw[0] === '/') return { type: 'name', value: raw.slice(1) };
    return { type: 'raw', value: raw };
  }

  function parseObjects(text) {
    /* Map object number -> {dict, stream:{start,end} | null}. Scans the whole
       file, so missing/broken xref tables and object streams are irrelevant. */
    var objs = {}, re = /(\d+)\s+(\d+)\s+obj\b/g, m;
    while ((m = re.exec(text))) {
      var num = parseInt(m[1], 10);
      var i = m.index + m[0].length;
      while (i < text.length && /\s/.test(text[i])) i++;
      var dict = '', dictEnd = i;
      if (text.slice(i, i + 2) === '<<') {
        var d = parseDictAt(text, i);
        dict = d.dict; dictEnd = d.end;
      } else if (text[i] === '[') {
        var j = i, depth = 0;
        while (j < text.length) {
          if (text[j] === '[') depth++;
          else if (text[j] === ']') { depth--; if (!depth) { j++; break; } }
          j++;
        }
        dict = text.slice(i, j); dictEnd = j;
      }
      var after = text.slice(dictEnd, dictEnd + 20);
      var stream = null;
      if (/^\s*stream/.test(after)) {
        var sStart = dictEnd + after.indexOf('stream') + 'stream'.length;
        if (text[sStart] === '\r') sStart++;
        if (text[sStart] === '\n') sStart++;
        var endIdx = -1, declared = null;
        var lm = /\/Length\s+(\d+)(?:\s+\d+\s+R)?/.exec(dict);
        if (lm) {
          if (/\/Length\s+\d+\s+\d+\s+R/.test(dict)) declared = null; /* indirect: resolve later */
          else declared = parseInt(lm[1], 10);
        }
        if (declared != null && declared >= 0 && text.substr(sStart + declared, 10).indexOf('endstream') >= 0) {
          endIdx = sStart + declared;
        } else {
          endIdx = text.indexOf('endstream', sStart);
          if (endIdx < 0) endIdx = text.length;
        }
        stream = { start: sStart, end: endIdx };
      }
      objs[num] = { num: num, dict: dict, stream: stream };
    }
    return objs;
  }

  async function expandObjectStreams(objs, fileBytes) {
    /* PDF 1.5+ packs objects inside compressed object streams. Without this the
       page tree is invisible and the file looks like a scanned image. */
    var added = 0;
    var nums = Object.keys(objs);
    for (var i = 0; i < nums.length; i++) {
      var o = objs[nums[i]];
      if (!o.stream || !/\/Type\s*\/ObjStm/.test(o.dict)) continue;
      var decoded;
      try { decoded = await decodeWithFilters(fileBytes.subarray(o.stream.start, o.stream.end), filtersOf(o.dict)); }
      catch (e) { continue; }
      var body = latin1(decoded);
      var nEntry = dictGet(o.dict, 'N'), firstEntry = dictGet(o.dict, 'First');
      var n = nEntry ? nEntry.value : 0, first = firstEntry ? firstEntry.value : 0;
      if (!n || first == null) continue;
      var header = body.slice(0, first).trim().split(/\s+/).map(Number);
      for (var k = 0; k < n; k++) {
        var onum = header[k * 2], off = header[k * 2 + 1];
        if (isNaN(onum) || isNaN(off)) continue;
        if (objs[onum]) continue;
        var startAt = first + off;
        var nextOff = (k + 1 < n) ? first + header[(k + 1) * 2 + 1] : body.length;
        var chunk = body.slice(startAt, nextOff);
        /* balanced << >> — a nested /Resources dict would truncate a non-greedy match */
        var at = chunk.indexOf('<<');
        var dictTxt = at >= 0 ? parseDictAt(chunk, at).dict : '';
        objs[onum] = { num: onum, dict: dictTxt, stream: null };
        added++;
      }
    }
    return added;
  }

  function resolve(objs, entry) {
    if (!entry) return null;
    if (entry.type === 'ref') return objs[entry.value] || null;
    return entry;
  }

  function filtersOf(dict) {
    var f = dictGet(dict, 'Filter');
    if (!f) return [];
    if (f.type === 'name') return [f.value];
    if (f.type === 'array') {
      var names = (f.value.match(/\/[A-Za-z0-9]+/g) || []).map(function (s) { return s.slice(1); });
      return names;
    }
    if (f.type === 'ref') return [];
    return [];
  }

  /* ---------- ToUnicode CMaps ---------- */
  function hexToStr(h) {
    h = h.replace(/[^0-9A-Fa-f]/g, '');
    if (h.length % 2) h += '0';
    var out = '';
    for (var i = 0; i < h.length; i += 4) {
      var code = parseInt(h.substr(i, 4), 16);
      if (isNaN(code)) continue;
      out += String.fromCharCode(code);
    }
    return out;
  }

  function parseCMap(txt) {
    var map = {};
    var reChar = /beginbfchar([\s\S]*?)endbfchar/g, m;
    while ((m = reChar.exec(txt))) {
      var pairs = m[1].match(/<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>/g) || [];
      pairs.forEach(function (p) {
        var mm = /<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>/.exec(p);
        if (mm) map[mm[1].toUpperCase().replace(/^0+/, '') || '0'] = hexToStr(mm[2]);
      });
    }
    var reRange = /beginbfrange([\s\S]*?)endbfrange/g;
    while ((m = reRange.exec(txt))) {
      var body = m[1];
      var trip = /<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>\s*(<([0-9A-Fa-f]+)>|\[([\s\S]*?)\])/g, t;
      while ((t = trip.exec(body))) {
        var lo = parseInt(t[1], 16), hi = parseInt(t[2], 16);
        if (t[4]) {
          var base = t[4];
          var baseStr = hexToStr(base);
          var baseCode = baseStr.charCodeAt(baseStr.length - 1);
          for (var c = lo; c <= hi && c - lo < 65535; c++) {
            var ch = baseStr.slice(0, -1) + String.fromCharCode(baseCode + (c - lo));
            map[(c).toString(16).toUpperCase().replace(/^0+/, '') || '0'] = ch;
          }
        } else if (t[5]) {
          var items = t[5].match(/<([0-9A-Fa-f]+)>/g) || [];
          items.forEach(function (h, idx) {
            map[(lo + idx).toString(16).toUpperCase().replace(/^0+/, '') || '0'] = hexToStr(h.slice(1, -1));
          });
        }
      }
    }
    return map;
  }

  function fontMapsFor(pageDict, objs, cache) {
    /* Build {F1: cmap|null} for a page. Missing ToUnicode => null (Latin-1 fallback). */
    var res = dictGet(pageDict, 'Resources');
    var resObj = resolve(objs, res);
    var resDict = resObj && (resObj.value || resObj.dict) ? (resObj.value || resObj.dict) : (res && res.type === 'dict' ? res.value : '');
    if (!resDict) return {};
    var fontsEntry = dictGet(resDict, 'Font');
    var fontDict = '';
    if (fontsEntry) {
      if (fontsEntry.type === 'dict') fontDict = fontsEntry.value;
      else if (fontsEntry.type === 'ref') {
        var fo = objs[fontsEntry.value];
        fontDict = fo ? fo.dict : '';
      }
    }
    if (!fontDict) return {};
    var maps = {};
    var re = /\/([A-Za-z0-9#+._-]+)\s+(\d+)\s+\d+\s+R/g, m;
    while ((m = re.exec(fontDict))) {
      var name = m[1], onum = parseInt(m[2], 10);
      if (cache[name] !== undefined) { maps[name] = cache[name]; continue; }
      var fo2 = objs[onum];
      if (!fo2) { maps[name] = null; continue; }
      var tu = dictGet(fo2.dict, 'ToUnicode');
      if (!tu || tu.type !== 'ref') {
        /* Type0 fonts without ToUnicode cannot be decoded reliably. */
        var subtype = dictGet(fo2.dict, 'Subtype');
        cache[name] = null; maps[name] = null;
        continue;
      }
      var tuObj = objs[tu.value];
      if (!tuObj || !tuObj.stream) { cache[name] = null; maps[name] = null; continue; }
      /* decode async later; stash ref */
      maps[name] = { pending: tuObj };
      cache[name] = maps[name];
    }
    return maps;
  }

  async function materialiseMaps(maps, fileBytes, objs) {
    var out = {};
    for (var name in maps) {
      var v = maps[name];
      if (!v || !v.pending) { out[name] = null; continue; }
      try {
        var dict = v.pending.dict, s = v.pending.stream;
        var raw = fileBytes.subarray(s.start, s.end);
        var decoded = await decodeWithFilters(raw, filtersOf(dict));
        out[name] = parseCMap(utf8(decoded));
      } catch (e) { out[name] = null; }
    }
    return out;
  }

  /* ---------- content stream text extraction ---------- */
  var TOKEN = new RegExp([
    '/([A-Za-z0-9#+._-]+)\\s+[\\d.]+\\s+Tf',                         // 0 font select
    '(\\((?:\\\\.|[^\\\\)])*\\)|<[0-9A-Fa-f\\s]*>)\\s*(Tj|TJ|\'|")', // 1,2 show text
    '\\[((?:[^\\[\\]]|\\\\.)*)\\]\\s*TJ',                            // 3 array
    '(-?[\\d.]+)\\s+(-?[\\d.]+)\\s+T[dD]',                           // 4,5 move
    '(-?[\\d.]+)\\s+(-?[\\d.]+)\\s+(-?[\\d.]+)\\s+(-?[\\d.]+)\\s+(-?[\\d.]+)\\s+(-?[\\d.]+)\\s+Tm', // 6..11
    '(T\\*)',                                                        // 12
    '(ET)'                                                           // 13
  ].join('|'), 'g');

  function unescapePdfString(s) {
    return s.replace(/\\([nrtbf()\\]|[0-7]{1,3})/g, function (m, c) {
      switch (c) {
        case 'n': return '\n'; case 'r': return '\r'; case 't': return '\t';
        case 'b': return '\b'; case 'f': return '\f';
        case '(': return '('; case ')': return ')'; case '\\': return '\\';
        default: return String.fromCharCode(parseInt(c, 8));
      }
    });
  }

  function decodeShown(lit, cmap) {
    /* lit is either (…) or <…> */
    var raw;
    if (lit[0] === '(') raw = unescapePdfString(lit.slice(1, -1));
    else {
      var h = lit.slice(1, -1).replace(/[^0-9A-Fa-f]/g, '');
      if (h.length % 2) h += '0';
      raw = '';
      for (var i = 0; i < h.length; i += 2) raw += String.fromCharCode(parseInt(h.substr(i, 2), 16));
    }
    if (!cmap) return raw; /* WinAnsi / Latin-1 is close enough for résumé text */
    var out = '', i = 0;
    while (i < raw.length) {
      var two = raw.substr(i, 2);
      var key2 = ((raw.charCodeAt(i) << 8) | (raw.charCodeAt(i + 1) || 0)).toString(16).toUpperCase();
      var key1 = raw.charCodeAt(i).toString(16).toUpperCase();
      if (cmap[key2] != null && two.length === 2) { out += cmap[key2]; i += 2; }
      else if (cmap[key1] != null) { out += cmap[key1]; i += 1; }
      else { out += raw[i]; i += 1; }
    }
    return out;
  }

  function extractFromContent(content, fontMaps) {
    var lines = [], cur = '', curFont = null, lastY = null, lastX = null, x = 0, y = 0;
    function push() { if (cur.trim() !== '') lines.push(cur.replace(/[ \t]+/g, ' ').trim()); cur = ''; }
    var m;
    TOKEN.lastIndex = 0;
    while ((m = TOKEN.exec(content))) {
      if (m[1]) { curFont = m[1]; continue; }
      if (m[2]) {
        var shown = decodeShown(m[2], curFont ? fontMaps[curFont] : null);
        if (m[3] === "'" || m[3] === '"') { push(); }
        cur += shown;
        continue;
      }
      if (m[4] != null && m[4] !== '') {
        var arr = m[4], item = /\((?:\\.|[^\\)])*\)|<[0-9A-Fa-f\s]*>|-?[\d.]+/g, it;
        while ((it = item.exec(arr))) {
          var tok = it[0];
          if (tok[0] === '(' || tok[0] === '<') {
            cur += decodeShown(tok, curFont ? fontMaps[curFont] : null);
          } else {
            var n = parseFloat(tok);
            if (n <= -120) cur += ' ';
          }
        }
        continue;
      }
      if (m[5] != null && m[5] !== '') {
        var ny = parseFloat(m[6]);
        y += ny;
        if (ny !== 0) { push(); lastY = null; lastX = null; }
        continue;
      }
      if (m[7] != null && m[7] !== '') {
        var newY = parseFloat(m[12]);          /* Tm f = vertical position */
        var newX = parseFloat(m[11]);          /* Tm e = horizontal position */
        if (lastY === null || Math.abs(newY - lastY) > 0.6) { push(); }
        else if (lastX !== null && newX - lastX > 12 && cur && !/\s$/.test(cur)) { cur += ' '; }
        lastY = newY; lastX = newX;
        continue;
      }
      if (m[13]) { push(); lastY = null; lastX = null; continue; }
    }
    push();
    return lines;
  }

  function pageOrder(objs, text) {
    /* Walk /Pages /Kids when possible; fall back to object order. */
    var pages = [];
    var catalog = null;
    for (var k in objs) {
      if (/\/Type\s*\/Catalog/.test(objs[k].dict)) { catalog = objs[k]; break; }
    }
    var seen = {};
    function walk(num, depth) {
      if (depth > 30 || seen[num]) return;
      seen[num] = 1;
      var o = objs[num];
      if (!o) return;
      if (/\/Type\s*\/Pages/.test(o.dict)) {
        var kids = dictGet(o.dict, 'Kids');
        if (kids && kids.type === 'array') {
          (kids.value.match(/(\d+)\s+\d+\s+R/g) || []).forEach(function (r) {
            walk(parseInt(r, 10), depth + 1);
          });
        }
      } else if (/\/Type\s*\/Page\b/.test(o.dict)) {
        pages.push(o);
      }
    }
    if (catalog) {
      var pagesRef = dictGet(catalog.dict, 'Pages');
      if (pagesRef && pagesRef.type === 'ref') walk(pagesRef.value, 0);
    }
    if (!pages.length) {
      for (var n in objs) if (/\/Type\s*\/Page\b/.test(objs[n].dict)) pages.push(objs[n]);
    }
    return pages;
  }

  /* ---------- main ---------- */
  async function extract(input) {
    var fileBytes = toBytes(input);
    var text = latin1(fileBytes);
    var result = { text: '', words: 0, pages: 0, encrypted: false, needsOcr: false, warnings: [], engine: 'pdf-text/1' };

    if (text.slice(0, 5) !== '%PDF-') throw new Error('not-pdf');
    result.encrypted = /\/Encrypt\b/.test(text);
    if (result.encrypted) {
      result.warnings.push('encrypted');
      return result;
    }

    var objs = parseObjects(text);
    await expandObjectStreams(objs, fileBytes);
    var cache = {};
    var pages = pageOrder(objs, text);
    result.pages = pages.length;
    var allLines = [];

    for (var p = 0; p < pages.length; p++) {
      var page = pages[p];
      var maps = await materialiseMaps(fontMapsFor(page.dict, objs, cache), fileBytes, objs);
      var contents = dictGet(page.dict, 'Contents');
      var refs = [];
      if (contents) {
        if (contents.type === 'ref') refs = [contents.value];
        else if (contents.type === 'array') {
          refs = (contents.value.match(/(\d+)\s+\d+\s+R/g) || []).map(function (r) { return parseInt(r, 10); });
        }
      }
      for (var r = 0; r < refs.length; r++) {
        var so = objs[refs[r]];
        if (!so || !so.stream) continue;
        var decoded;
        try {
          decoded = await decodeWithFilters(fileBytes.subarray(so.stream.start, so.stream.end), filtersOf(so.dict));
        } catch (e) {
          result.warnings.push('stream:' + (e.message || 'decode'));
          continue;
        }
        allLines = allLines.concat(extractFromContent(latin1(decoded), maps));
      }
    }

    /* Fallback: no page tree resolved — treat any BT/Tj-bearing stream as content. */
    if (!allLines.length) {
      var cmapUnion = {};
      for (var n2 in objs) {
        var o2 = objs[n2];
        if (!o2.stream) continue;
        if (/\/Subtype\s*\/Image|\/Type\s*\/Font|\/FontFile|\/Type\s*\/ObjStm|\/Type\s*\/XRef/.test(o2.dict)) continue;
        var dec2;
        try {
          dec2 = await decodeWithFilters(fileBytes.subarray(o2.stream.start, o2.stream.end), filtersOf(o2.dict));
        } catch (e) { continue; }
        var asStr = latin1(dec2);
        if (/\bBT\b/.test(asStr) && /(Tj|TJ)/.test(asStr)) {
          allLines = allLines.concat(extractFromContent(asStr, cmapUnion));
        }
      }
    }

    var out = allLines.join('\n').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').replace(/[ \t]{2,}/g, ' ').trim();
    result.text = out;
    result.words = (out.match(/\S+/g) || []).length;
    result.needsOcr = result.words < 25;
    if (result.needsOcr) result.warnings.push('no-text-layer');
    return result;
  }

  return { extract: extract, version: 'pdf-text/1' };
});
