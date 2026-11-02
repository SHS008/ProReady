/* ============================================================================
   ProReady Coach — resume & report export engine
   ----------------------------------------------------------------------------
   Real PDF and DOCX output with no external libraries, so it works offline,
   inside the Capacitor wrapper, and from file:// .

   This file is the single source of truth. It is inlined into index.html by
   tools/sync_export.py and loaded directly by desktop.html.

   Public API
     ResumeExport.buildResumePDF(data)  -> Blob (application/pdf)
     ResumeExport.buildResumeDOCX(data) -> Blob (WordprocessingML)
     ResumeExport.buildResumeTXT(data)  -> Blob (text/plain)
     ResumeExport.buildResumeHTML(data) -> string (print view)
     ResumeExport.buildTextPDF({title,subtitle,body}) -> Blob
     ResumeExport.resumeDataFromDOM()   -> data object from the builder fields
     ResumeExport.save(blob, filename)
     ResumeExport.filename(ext)
   ========================================================================= */
(function (root) {
  'use strict';

  /* ---------------------------------------------------------------- metrics */
  // Helvetica / Helvetica-Bold advance widths for ASCII 32..126 (per 1000 units).
  var W_REG = [278,278,355,556,556,889,667,191,333,333,389,584,278,333,278,278,
    556,556,556,556,556,556,556,556,556,556,278,278,584,584,584,556,1015,
    667,667,722,722,667,611,778,722,278,500,667,556,833,722,778,667,778,722,667,611,722,667,944,667,667,611,
    278,278,278,469,556,333,
    556,556,500,556,556,278,556,556,222,222,500,222,833,556,556,556,556,333,500,278,556,500,722,500,500,500,
    334,260,334,584];
  var W_BOLD = [278,333,474,556,556,889,722,238,333,333,389,584,278,333,278,278,
    556,556,556,556,556,556,556,556,556,556,333,333,584,584,584,611,975,
    722,722,722,722,667,611,778,722,278,556,722,611,833,722,778,667,778,722,667,611,722,667,944,667,667,611,
    333,278,333,584,556,333,
    556,611,556,611,556,333,611,611,278,278,556,278,889,611,611,611,611,389,556,333,611,556,778,556,556,500,
    389,280,389,584];

  function charWidth(code, size, bold) {
    var table = bold ? W_BOLD : W_REG;
    var i = code - 32;
    var w = (i >= 0 && i < table.length) ? table[i] : 500;
    return w * size / 1000;
  }

  function textWidth(str, size, bold) {
    var t = 0, i;
    for (i = 0; i < str.length; i++) t += charWidth(str.charCodeAt(i), size, bold);
    return t;
  }

  /* -------------------------------------------------------------- pdf helpers */
  // Typographic characters have no place in a single-byte core font unless we map them
  // to their WinAnsiEncoding slot. Without this, bullets and dashes print as "?".
  var WINANSI = {
    0x2013: 0x96, 0x2014: 0x97, 0x2018: 0x91, 0x2019: 0x92,
    0x201A: 0x82, 0x201C: 0x93, 0x201D: 0x94, 0x201E: 0x84,
    0x2020: 0x86, 0x2021: 0x87, 0x2022: 0x95, 0x2026: 0x85,
    0x2030: 0x89, 0x2039: 0x8B, 0x203A: 0x9B, 0x20AC: 0x80,
    0x2122: 0x99, 0x0160: 0x8A, 0x0161: 0x9A, 0x0178: 0x9F,
    0x017D: 0x8E, 0x017E: 0x9E, 0x0192: 0x83, 0x02C6: 0x88,
    0x02DC: 0x98, 0x2028: 0x20, 0x2029: 0x20
  };

  function pdfEscape(str) {
    var out = '', i, c, code;
    for (i = 0; i < str.length; i++) {
      c = str.charAt(i);
      code = str.charCodeAt(i);
      if (WINANSI[code] != null) code = WINANSI[code];
      if (c === '\\' || c === '(' || c === ')') out += '\\' + c;
      else if (code < 32) out += ' ';
      else if (code < 127) out += String.fromCharCode(code);
      else if (code < 256) out += '\\' + ('000' + code.toString(8)).slice(-3);
      else out += '?'; // anything unmappable stays a safe placeholder
    }
    return out;
  }

  function wrapText(str, size, bold, maxWidth) {
    var words = String(str).replace(/\s+/g, ' ').trim().split(' ');
    var lines = [], line = '', i, test;
    for (i = 0; i < words.length; i++) {
      test = line ? line + ' ' + words[i] : words[i];
      if (textWidth(test, size, bold) <= maxWidth || !line) {
        line = test;
      } else {
        lines.push(line);
        line = words[i];
      }
      // hard-break a single word that cannot fit
      while (textWidth(line, size, bold) > maxWidth && line.length > 1) {
        var cut = line.length - 1;
        while (cut > 1 && textWidth(line.slice(0, cut), size, bold) > maxWidth) cut--;
        lines.push(line.slice(0, cut));
        line = line.slice(cut);
      }
    }
    if (line) lines.push(line);
    return lines.length ? lines : [''];
  }

  var PAGE_W = 612, PAGE_H = 792;      // US Letter, points
  var MARGIN = 54;                     // 0.75"
  var RIGHT = PAGE_W - MARGIN;
  var BOTTOM = MARGIN + 18;

  var COL = {
    ink:   [0.13, 0.10, 0.08],
    body:  [0.19, 0.15, 0.12],
    muted: [0.42, 0.36, 0.31],
    sage:  [0.37, 0.44, 0.38],
    rule:  [0.80, 0.78, 0.74]
  };

  function PDFWriter() {
    this.pages = [];
    this.ops = null;
    this.y = 0;
    this.newPage();
  }
  PDFWriter.prototype.newPage = function () {
    this.ops = [];
    this.pages.push(this.ops);
    this.y = PAGE_H - MARGIN;
  };
  PDFWriter.prototype.space = function (pt) {
    this.y -= pt;
    if (this.y < BOTTOM) this.newPage();
  };
  PDFWriter.prototype.color = function (rgb, stroke) {
    var n = rgb.map(function (v) { return (+v).toFixed(3).replace(/0+$/, '').replace(/\.$/, '') || '0'; });
    this.ops.push(n.join(' ') + (stroke ? ' RG' : ' rg'));
  };
  PDFWriter.prototype.text = function (str, opts) {
    opts = opts || {};
    var size = opts.size || 10;
    var bold = !!opts.bold;
    var x = (opts.x == null) ? MARGIN : opts.x;
    if (opts.right != null) x = opts.right - textWidth(str, size, bold);
    this.color(opts.color || COL.body);
    // baseline: y is the top of the line box
    var baseline = this.y - size * 0.78;
    this.ops.push('BT /' + (bold ? 'F2' : 'F1') + ' ' + size + ' Tf 1 0 0 1 ' +
      x.toFixed(2) + ' ' + baseline.toFixed(2) + ' Tm (' + pdfEscape(str) + ') Tj ET');
  };
  PDFWriter.prototype.rule = function (yOffsetFromTop) {
    var y = this.y - (yOffsetFromTop == null ? 2 : yOffsetFromTop);
    this.color(COL.rule, true);
    this.ops.push('0.7 w ' + MARGIN + ' ' + y.toFixed(2) + ' m ' + RIGHT + ' ' + y.toFixed(2) + ' l S');
  };

  function buildPDF(writer) {
    // build font + page objects with correct xref offsets
    var objects = [];
    function add(body) { objects.push(body); return objects.length; } // 1-based ids

    var fontReg = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
    var fontBold = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');

    var pageIds = [], contentIds = [];
    var pagesIdPlaceholder = objects.length + 1 + writer.pages.length * 2; // reserved later
    // We must know ids before writing page dicts: reserve order
    // layout: [f1,f2] then for each page: content, page. then pages tree, then catalog.
    var nextId = objects.length + 1;
    var contentIdFor = [], pageIdFor = [];
    writer.pages.forEach(function () {
      contentIdFor.push(nextId++);
      pageIdFor.push(nextId++);
    });
    var pagesId = nextId++;
    var catalogId = nextId++;

    writer.pages.forEach(function (ops, i) {
      var stream = ops.join('\n');
      objects[contentIdFor[i] - 1] = '<< /Length ' + byteLen(stream) + ' >>\nstream\n' + stream + '\nendstream';
      objects[pageIdFor[i] - 1] = '<< /Type /Page /Parent ' + pagesId + ' 0 R /MediaBox [0 0 ' +
        PAGE_W + ' ' + PAGE_H + '] /Resources << /Font << /F1 ' + fontReg + ' 0 R /F2 ' + fontBold +
        ' 0 R >> >> /Contents ' + contentIdFor[i] + ' 0 R >>';
    });
    objects[pagesId - 1] = '<< /Type /Pages /Count ' + writer.pages.length +
      ' /Kids [' + pageIdFor.map(function (id) { return id + ' 0 R'; }).join(' ') + '] >>';
    objects[catalogId - 1] = '<< /Type /Catalog /Pages ' + pagesId + ' 0 R >>';

    var out = '%PDF-1.4\n%\u00E2\u00E3\u00CF\u00D3\n';
    var offsets = [];
    objects.forEach(function (body, idx) {
      offsets.push(byteLen(out));
      out += (idx + 1) + ' 0 obj\n' + body + '\nendobj\n';
    });
    var xrefStart = byteLen(out);
    out += 'xref\n0 ' + (objects.length + 1) + '\n0000000000 65535 f \n';
    offsets.forEach(function (off) {
      out += ('0000000000' + off).slice(-10) + ' 00000 n \n';
    });
    out += 'trailer\n<< /Size ' + (objects.length + 1) + ' /Root ' + catalogId + ' 0 R >>\nstartxref\n' +
      xrefStart + '\n%%EOF\n';
    return out;
  }

  function byteLen(str) {
    // count UTF-8 bytes without depending on TextEncoder (older Safari)
    var n = 0, i, c;
    for (i = 0; i < str.length; i++) {
      c = str.charCodeAt(i);
      if (c < 128) n += 1;
      else if (c < 2048) n += 2;
      else n += 3;
    }
    return n;
  }

  /* ------------------------------------------------------- resume structure */
  function normLines(v) {
    return String(v == null ? '' : v).split(/\r?\n/).map(function (s) { return s.trim(); })
      .filter(function (s) { return s.length; });
  }

  function cleanBullet(s) {
    return String(s).replace(/^[-–—•*·]\s*/, '').trim();
  }

  function buildResumeDoc(data) {
    data = data || {};
    var doc = [];
    doc.push({ t: 'name', text: data.name || 'Your Name' });
    if (data.headline) doc.push({ t: 'headline', text: data.headline });
    var contact = [];
    if (data.city) contact.push(data.city);
    if (data.phone) contact.push(data.phone);
    if (data.email) contact.push(data.email);
    if (contact.length) doc.push({ t: 'contact', text: contact.join('  ·  ') });

    if (data.summary && String(data.summary).trim()) {
      doc.push({ t: 'h2', text: 'Professional Summary' });
      normLines(data.summary).forEach(function (p) { doc.push({ t: 'p', text: p }); });
    }
    var exps = (data.experiences || []).filter(function (e) { return e && (e.title || e.org); });
    if (exps.length) {
      doc.push({ t: 'h2', text: 'Experience' });
      exps.forEach(function (e) {
        doc.push({ t: 'job', title: e.title || '', org: e.org || '', dates: e.dates || '' });
        normLines(e.bullets).forEach(function (b) {
          var c = cleanBullet(b);
          if (c) doc.push({ t: 'bullet', text: c });
        });
      });
    }
    var skills = (data.skills || []).filter(function (s) { return String(s).trim(); });
    if (skills.length) {
      doc.push({ t: 'h2', text: 'Skills' });
      doc.push({ t: 'p', text: skills.join('  ·  ') });
    }
    var edu = normLines(data.edu);
    if (edu.length) {
      doc.push({ t: 'h2', text: 'Education, Training & Certifications' });
      edu.forEach(function (l) { doc.push({ t: 'p', text: l }); });
    }
    return doc;
  }

  /* ------------------------------------------------------------- PDF resume */
  function buildResumePDF(data) {
    var doc = buildResumeDoc(data);
    var w = new PDFWriter();
    var i, op, lines, k;
    for (i = 0; i < doc.length; i++) {
      op = doc[i];
      if (op.t === 'name') {
        w.space(6);
        w.text(op.text, { size: 20, bold: true, color: COL.ink });
        w.space(23);
      } else if (op.t === 'headline') {
        w.text(op.text, { size: 10.5, bold: true, color: COL.sage });
        w.space(14);
      } else if (op.t === 'contact') {
        w.text(op.text, { size: 9, color: COL.muted });
        w.space(13);
      } else if (op.t === 'h2') {
        w.space(9);
        w.text(String(op.text).toUpperCase(), { size: 9.5, bold: true, color: COL.ink });
        w.rule(3.5);
        w.space(15);
      } else if (op.t === 'job') {
        w.space(7);
        var titleTxt = op.title + (op.org ? ' — ' + op.org : '');
        var datesW = op.dates ? textWidth(op.dates, 9, false) : 0;
        var maxW = RIGHT - MARGIN - (datesW ? datesW + 14 : 0);
        lines = wrapText(titleTxt, 10.5, true, maxW);
        lines.forEach(function (ln, idx) {
          w.text(ln, { size: 10.5, bold: true, color: COL.ink });
          if (idx === 0 && op.dates) w.text(op.dates, { size: 9, right: RIGHT, color: COL.muted });
          w.space(13);
        });
      } else if (op.t === 'bullet') {
        w.text('•', { size: 9.8, x: MARGIN + 3, color: COL.body });
        lines = wrapText(op.text, 9.8, false, RIGHT - (MARGIN + 14));
        lines.forEach(function (ln, idx) {
          w.text(ln, { size: 9.8, x: idx === 0 ? MARGIN + 14 : MARGIN + 14, color: COL.body });
          w.space(12.4);
        });
      } else if (op.t === 'p') {
        lines = wrapText(op.text, 9.8, false, RIGHT - MARGIN);
        lines.forEach(function (ln) {
          w.text(ln, { size: 9.8, color: COL.body });
          w.space(12.4);
        });
      }
    }
    return new Blob([buildPDF(w)], { type: 'application/pdf' });
  }

  /* ------------------------------------------------------------ DOCX resume */
  var CRC_TABLE = (function () {
    var t = [], c, n, k;
    for (n = 0; n < 256; n++) {
      c = n;
      for (k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      t[n] = c >>> 0;
    }
    return t;
  })();

  function crc32(bytes) {
    var c = 0xFFFFFFFF, i;
    for (i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xFF] ^ (c >>> 8);
    return (c ^ 0xFFFFFFFF) >>> 0;
  }

  function utf8(str) {
    var out = [], i, c;
    for (i = 0; i < str.length; i++) {
      c = str.charCodeAt(i);
      if (c < 0x80) out.push(c);
      else if (c < 0x800) out.push(0xC0 | (c >> 6), 0x80 | (c & 63));
      else if (c < 0xD800 || c >= 0xE000) out.push(0xE0 | (c >> 12), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
      else { // surrogate pair
        var hi = c, lo = str.charCodeAt(++i);
        var cp = 0x10000 + ((hi - 0xD800) << 10) + (lo - 0xDC00);
        out.push(0xF0 | (cp >> 18), 0x80 | ((cp >> 12) & 63), 0x80 | ((cp >> 6) & 63), 0x80 | (cp & 63));
      }
    }
    return new Uint8Array(out);
  }

  function makeZip(files) {
    // files: [{name, data:Uint8Array}]  — stored (no compression), valid zip
    var chunks = [], central = [], offset = 0, i;
    function u16(n) { return [n & 255, (n >> 8) & 255]; }
    function u32(n) { return [n & 255, (n >> 8) & 255, (n >> 16) & 255, (n >>> 24) & 255]; }

    for (i = 0; i < files.length; i++) {
      var f = files[i];
      var nameBytes = utf8(f.name);
      var crc = crc32(f.data);
      var local = [].concat(u32(0x04034b50), u16(20), u16(0), u16(0), u16(0), u16(0),
        u32(crc), u32(f.data.length), u32(f.data.length), u16(nameBytes.length), u16(0));
      var localBytes = new Uint8Array(local);
      chunks.push(localBytes, nameBytes, f.data);
      central.push({
        name: nameBytes, crc: crc, size: f.data.length, offset: offset
      });
      offset += localBytes.length + nameBytes.length + f.data.length;
    }
    var centralStart = offset, centralChunks = [];
    for (i = 0; i < central.length; i++) {
      var c = central[i];
      var hdr = [].concat(u32(0x02014b50), u16(20), u16(20), u16(0), u16(0), u16(0), u16(0),
        u32(c.crc), u32(c.size), u32(c.size), u16(c.name.length), u16(0), u16(0), u16(0), u16(0),
        u32(0), u32(c.offset));
      centralChunks.push(new Uint8Array(hdr), c.name);
      /* eslint-disable no-loop-func */
    }
    var centralSize = 0;
    centralChunks.forEach(function (ch) { centralSize += ch.length; });
    var end = new Uint8Array([].concat(
      u32(0x06054b50), u16(0), u16(0), u16(central.length), u16(central.length),
      u32(centralSize), u32(centralStart), u16(0)
    ));
    var all = chunks.concat(centralChunks, [end]);
    var total = 0;
    all.forEach(function (ch) { total += ch.length; });
    var buf = new Uint8Array(total), pos = 0;
    all.forEach(function (ch) { buf.set(ch, pos); pos += ch.length; });
    return buf;
  }

  function xmlEscape(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&apos;');
  }

  function para(runs, opts) {
    opts = opts || {};
    var pPr = '<w:pPr>';
    if (opts.spaceBefore) pPr += '<w:spacing w:before="' + opts.spaceBefore + '"/>';
    if (opts.spaceAfter != null) pPr += '<w:spacing w:after="' + opts.spaceAfter + '"/>';
    if (opts.indent) pPr += '<w:ind w:left="' + opts.indent + '" w:hanging="' + (opts.hanging || 0) + '"/>';
    if (opts.border) pPr += '<w:pBdr><w:bottom w:val="single" w:sz="6" w:space="1" w:color="C9C4BC"/></w:pBdr>';
    pPr += '</w:pPr>';
    var body = runs.map(function (r) {
      var rPr = '<w:rPr><w:rFonts w:ascii="' + (r.font || 'Calibri') + '" w:hAnsi="' + (r.font || 'Calibri') + '"/>';
      if (r.bold) rPr += '<w:b/>';
      if (r.color) rPr += '<w:color w:val="' + r.color + '"/>';
      if (r.size) rPr += '<w:sz w:val="' + r.size + '"/><w:szCs w:val="' + r.size + '"/>';
      rPr += '</w:rPr>';
      return '<w:r>' + rPr + '<w:t xml:space="preserve">' + xmlEscape(r.text) + '</w:t></w:r>';
    }).join('');
    return '<w:p>' + pPr + body + '</w:p>';
  }

  function buildResumeDOCX(data) {
    var doc = buildResumeDoc(data);
    var body = doc.map(function (op) {
      if (op.t === 'name') return para([{ text: op.text, bold: true, size: 40, color: '1F1A14' }], { spaceAfter: 40 });
      if (op.t === 'headline') return para([{ text: op.text, bold: true, size: 21, color: '5F7161' }], { spaceAfter: 40 });
      if (op.t === 'contact') return para([{ text: op.text, size: 18, color: '6B5B4E' }], { spaceAfter: 80 });
      if (op.t === 'h2') return para([{ text: String(op.text).toUpperCase(), bold: true, size: 19, color: '1F1A14' }],
        { spaceBefore: 200, spaceAfter: 60, border: true });
      if (op.t === 'job') {
        var runs = [{ text: op.title + (op.org ? ' — ' + op.org : ''), bold: true, size: 21, color: '1F1A14' }];
        if (op.dates) runs.push({ text: '   ' + op.dates, size: 18, color: '6B5B4E' });
        return para(runs, { spaceBefore: 120, spaceAfter: 20 });
      }
      if (op.t === 'bullet') return para([{ text: '•  ' + op.text, size: 20 }], { indent: 360, hanging: 180, spaceAfter: 20 });
      return para([{ text: op.text, size: 20 }], { spaceAfter: 20 });
    }).join('');

    var documentXml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">' +
      '<w:body>' + body +
      '<w:sectPr><w:pgSz w:w="12240" w:h="15840"/>' +
      '<w:pgMar w:top="1080" w:right="1080" w:bottom="1080" w:left="1080" w:header="720" w:footer="720" w:gutter="0"/>' +
      '</w:sectPr></w:body></w:document>';

    var contentTypes = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
      '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
      '<Default Extension="xml" ContentType="application/xml"/>' +
      '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>' +
      '</Types>';

    var rels = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>' +
      '</Relationships>';

    var zip = makeZip([
      { name: '[Content_Types].xml', data: utf8(contentTypes) },
      { name: '_rels/.rels', data: utf8(rels) },
      { name: 'word/document.xml', data: utf8(documentXml) }
    ]);
    return new Blob([zip], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
  }

  /* --------------------------------------------------------- plain text/html */
  function buildResumeTXT(data) {
    var doc = buildResumeDoc(data);
    var out = [];
    doc.forEach(function (op) {
      if (op.t === 'name') { out.push(op.text, ''); }
      else if (op.t === 'headline') out.push(op.text);
      else if (op.t === 'contact') { out.push(op.text, ''); }
      else if (op.t === 'h2') { out.push('', String(op.text).toUpperCase(), '-'.repeat(Math.min(48, String(op.text).length + 8))); }
      else if (op.t === 'job') out.push('', op.title + (op.org ? ' — ' + op.org : '') + (op.dates ? '   (' + op.dates + ')' : ''));
      else if (op.t === 'bullet') out.push('- ' + op.text);
      else out.push(op.text);
    });
    return new Blob([out.join('\n') + '\n'], { type: 'text/plain' });
  }

  function buildResumeHTML(data) {
    var doc = buildResumeDoc(data);
    var esc = function (s) {
      return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    };
    var parts = [];
    doc.forEach(function (op) {
      if (op.t === 'name') parts.push('<h1>' + esc(op.text) + '</h1>');
      else if (op.t === 'headline') parts.push('<p class="hl">' + esc(op.text) + '</p>');
      else if (op.t === 'contact') parts.push('<p class="ct">' + esc(op.text) + '</p>');
      else if (op.t === 'h2') parts.push('<h2>' + esc(String(op.text).toUpperCase()) + '</h2>');
      else if (op.t === 'job') parts.push('<p class="job"><b>' + esc(op.title) +
        (op.org ? ' — ' + esc(op.org) : '') + '</b><span>' + esc(op.dates) + '</span></p>');
      else if (op.t === 'bullet') parts.push('<div class="b"><span>•</span><p>' + esc(op.text) + '</p></div>');
      else parts.push('<p>' + esc(op.text) + '</p>');
    });
    return '<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>' +
      esc((data && data.name) || 'Resume') + ' — Resume</title><style>' +
      '*{box-sizing:border-box}body{font-family:Georgia,"Times New Roman",serif;color:#1F1A14;max-width:7.6in;' +
      'margin:0.6in auto;padding:0 0.4in;line-height:1.45;font-size:11pt}' +
      'h1{font-size:22pt;margin:0 0 2pt;letter-spacing:-.01em}' +
      '.hl{font-family:Helvetica,Arial,sans-serif;font-weight:700;color:#5F7161;margin:0 0 4pt;font-size:11pt}' +
      '.ct{font-family:Helvetica,Arial,sans-serif;font-size:9.5pt;color:#6B5B4E;margin:0 0 14pt}' +
      'h2{font-family:Helvetica,Arial,sans-serif;font-size:9.5pt;letter-spacing:.09em;text-transform:uppercase;' +
      'border-bottom:1px solid #C9C4BC;padding-bottom:3pt;margin:16pt 0 6pt}' +
      '.job{margin:9pt 0 3pt;font-size:11pt}.job span{float:right;font-family:Helvetica,Arial,sans-serif;' +
      'font-size:9pt;color:#6B5B4E;font-weight:400}' +
      '.b{display:flex;gap:7pt;margin:0 0 2.5pt}.b span{color:#5F7161}.b p{margin:0}' +
      'p{margin:0 0 4pt}@media print{body{margin:0.5in;padding:0}}' +
      '</style></head><body>' + parts.join('') + '</body></html>';
  }

  /* ------------------------------------------------------- generic text PDF */
  function buildTextPDF(opts) {
    opts = opts || {};
    var w = new PDFWriter();
    var body = String(opts.body || '');
    w.space(8);
    if (opts.title) { w.text(opts.title, { size: 16, bold: true, color: COL.ink }); w.space(20); }
    if (opts.subtitle) { w.text(opts.subtitle, { size: 9.5, color: COL.muted }); w.space(18); }
    w.rule(2);
    w.space(14);
    body.split(/\r?\n/).forEach(function (line) {
      if (!line.trim()) { w.space(7); return; }
      var bold = /^[A-Z][A-Z0-9 &/,'()\-]{3,}$/.test(line.trim());
      var wrapped = wrapText(line, 9.6, bold, RIGHT - MARGIN);
      wrapped.forEach(function (ln) {
        w.text(ln, { size: 9.6, bold: bold, color: bold ? COL.ink : COL.body });
        w.space(12.2);
      });
    });
    return new Blob([buildPDF(w)], { type: 'application/pdf' });
  }

  /* ------------------------------------------------------------------ saving */
  function save(blob, filename) {
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(function () {
      try { document.body.removeChild(a); URL.revokeObjectURL(url); } catch (e) {}
    }, 1500);
  }

  function safeName(s) {
    return String(s || 'Resume').replace(/[^\w\s-]/g, '').replace(/\s+/g, '_').slice(0, 40) || 'Resume';
  }

  function resumeDataFromDOM() {
    var val = function (id) {
      var el = document.getElementById(id);
      return el ? el.value : '';
    };
    var exps = [];
    var list = document.getElementById('expList');
    if (list) {
      Array.prototype.forEach.call(list.children, function (row) {
        var q = function (sel) { var el = row.querySelector(sel); return el ? el.value : ''; };
        var inputs = row.querySelectorAll('input,textarea');
        exps.push({
          title: q('.eTitle') || (inputs[0] ? inputs[0].value : ''),
          org: q('.eOrg') || (inputs[1] ? inputs[1].value : ''),
          dates: q('.eDates') || (inputs[2] ? inputs[2].value : ''),
          bullets: q('.eBullets') || (inputs[3] ? inputs[3].value : '')
        });
      });
    }
    return {
      name: val('rName'),
      headline: val('rHeadline'),
      city: val('rCity'),
      phone: val('rPhone'),
      email: val('rEmail'),
      summary: val('rSummary'),
      skills: String(val('rSkills') || '').split(',').map(function (s) { return s.trim(); }).filter(Boolean),
      edu: val('rEdu'),
      experiences: exps
    };
  }

  root.ResumeExport = {
    buildResumePDF: buildResumePDF,
    buildResumeDOCX: buildResumeDOCX,
    buildResumeTXT: buildResumeTXT,
    buildResumeHTML: buildResumeHTML,
    buildTextPDF: buildTextPDF,
    buildResumeDoc: buildResumeDoc,
    resumeDataFromDOM: resumeDataFromDOM,
    save: save,
    safeName: safeName,
    textWidth: textWidth,
    _makeZip: makeZip,
    _buildPDF: buildPDF,
    _PDFWriter: PDFWriter
  };
})(typeof window !== 'undefined' ? window : this);
