/* PDF import: extraction engine + the app's real import path.
   Uses PDFs generated to mimic what Word / Google Docs / Canva / scans actually produce. */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { JSDOM } = require('jsdom');
const PdfText = require(__dirname + '/../pdf-text.js');

const out = []; const chk = (n, ok, x) => out.push([n, !!ok, x || '']);

/* ---------- minimal PDF builders (no dependencies) ---------- */
function pdfDoc(objects, extraTrailer) {
  let body = '%PDF-1.5\n%\xE2\xE3\xCF\xD3\n', offsets = [];
  objects.forEach((o, i) => {
    offsets.push(body.length);
    body += (i + 1) + ' 0 obj\n' + o + '\nendobj\n';
  });
  const xref = body.length;
  body += 'xref\n0 ' + (objects.length + 1) + '\n0000000000 65535 f \n';
  offsets.forEach(o => { body += String(o).padStart(10, '0') + ' 00000 n \n'; });
  body += 'trailer\n<< /Size ' + (objects.length + 1) + ' /Root 1 0 R ' + (extraTrailer || '') + ' >>\nstartxref\n' + xref + '\n%%EOF';
  return Buffer.from(body, 'latin1');
}

const esc = s => s.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
function contentStream(lines, compressed) {
  const content = lines.map(l => `BT /F1 11 Tf 1 0 0 1 56 ${l.y} Tm (${esc(l.t)}) Tj ET`).join('\n');
  if (!compressed) return `<< /Length ${content.length} >>\nstream\n${content}\nendstream`;
  const z = zlib.deflateSync(Buffer.from(content, 'latin1'));
  return Buffer.concat([
    Buffer.from(`<< /Length ${z.length} /Filter /FlateDecode >>\nstream\n`, 'latin1'),
    z,
    Buffer.from('\nendstream', 'latin1')
  ]).toString('latin1');
}

const RESUME_LINES = [
  { y: 740, t: 'JORDAN ELLIS' },
  { y: 722, t: 'Customer Service Representative' },
  { y: 706, t: 'Escanaba, MI 49829  (906) 555-0142  jordan.ellis@example.com' },
  { y: 686, t: 'SUMMARY' },
  { y: 670, t: 'Five years of high-volume call centre experience with a focus on accuracy.' },
  { y: 650, t: 'EXPERIENCE' },
  { y: 634, t: 'Customer Service Representative - Bay Area Credit Union Jan 2021 - Present' },
  { y: 618, t: 'Handled 40+ inbound calls daily regarding accounts, fees and disputes' },
  { y: 602, t: 'Trained 3 new hires and wrote the call-handling checklist' },
  { y: 586, t: 'Front Desk Associate - Delta Hotel Mar 2018 - Dec 2020' },
  { y: 570, t: 'Checked in up to 90 guests per shift and resolved billing errors' },
  { y: 550, t: 'SKILLS' },
  { y: 534, t: 'Customer de-escalation, Salesforce CRM, scheduling, data entry' },
  { y: 514, t: 'EDUCATION' },
  { y: 498, t: 'Associate of Applied Science, Business Administration - Bay College, 2018' }
];

function simplePdf(compressed) {
  return pdfDoc([
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>',
    contentStream(RESUME_LINES, compressed),
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>'
  ]);
}

function ascii85Pdf() {
  const raw = contentStream(RESUME_LINES, false)
    .replace(/^<< \/Length \d+ >>\nstream\n/, '').replace(/\nendstream$/, '');
  return pdfDoc([
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>',
    '__A85__' + raw,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'
  ]).toString('latin1').replace(
    /stream\n([\s\S]*?)\nendstream/,
    (m, inner) => {
      const b = Buffer.from(inner, 'latin1');
      let s = '', i = 0;
      while (i < b.length) {
        const chunk = b.subarray(i, i + 4);
        if (chunk.length === 4 && chunk[0] === 0 && chunk[1] === 0 && chunk[2] === 0 && chunk[3] === 0) { s += 'z'; i += 4; continue; }
        let val = 0;
        for (let k = 0; k < 4; k++) val = val * 256 + (chunk[k] || 0);
        let enc = '';
        for (let k = 0; k < 5; k++) { enc = String.fromCharCode((val % 85) + 33) + enc; val = Math.floor(val / 85); }
        s += enc; i += 4;
      }
      return '';
    }
  ).replace('__A85__', 'stream\n');
}

/* object-stream PDF: page tree and font hidden inside a compressed /ObjStm */
function objStreamPdf() {
  const inner = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 6 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'
  ].join('\n');
  const header = '2 0 3 0 4 0 '; // dummy offsets fixed below
  const parts = inner.split('\n');
  let offsets = [], pos = 0, bodyText = '';
  parts.forEach(p => { offsets.push(pos); bodyText += p + '\n'; pos = bodyText.length; });
  const hdr = [];
  parts.forEach((p, i) => hdr.push((i + 2) + ' ' + offsets[i]));
  const headerStr = hdr.join(' ');
  const first = headerStr.length + 1;
  const streamRaw = headerStr + ' ' + bodyText;
  const z = zlib.deflateSync(Buffer.from(streamRaw, 'latin1'));
  return Buffer.concat([
    Buffer.from('%PDF-1.5\n%\xE2\xE3\xCF\xD3\n', 'latin1'),
    Buffer.from('1 0 obj\n<< /Type /ObjStm /N 4 /First ' + first + ' /Length ' + z.length + ' /Filter /FlateDecode >>\nstream\n', 'latin1'),
    z,
    Buffer.from('\nendstream\nendobj\n', 'latin1'),
    Buffer.from('5 0 obj\n' + contentStream(RESUME_LINES, false) + '\nendobj\n', 'latin1'),
    Buffer.from('trailer\n<< /Size 7 /Root 2 0 R >>\n%%EOF', 'latin1')
  ]);
}

function encryptedPdf() {
  return pdfDoc([
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>',
    contentStream(RESUME_LINES, false),
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'
  ], '/Encrypt 9 0 R');
}

function scannedPdf() {
  return pdfDoc([
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /XObject << /Im1 5 0 R >> >> /Contents 4 0 R >>',
    '<< /Length 46 >>\nstream\nq 400 0 0 200 56 500 cm /Im1 Do Q\nendstream',
    '<< /Type /XObject /Subtype /Image /Width 8 /Height 8 /ColorSpace /DeviceGray /BitsPerComponent 8 /Length 64 >>\nstream\n' + 'x'.repeat(64) + '\nendstream'
  ]);
}

/* ---------- tests ---------- */
(async () => {
  const plain = simplePdf(false);
  const flate = simplePdf(true);
  const a85 = Buffer.from(ascii85Pdf(), 'latin1');
  const objstm = objStreamPdf();
  const enc = encryptedPdf();
  const scan = scannedPdf();

  const r1 = await PdfText.extract(plain);
  chk('uncompressed PDF: text extracted', r1.words > 60, r1.words + ' words');
  chk('uncompressed PDF: keeps line breaks', r1.text.split('\n').length >= 8, r1.text.split('\n').length + ' lines');
  chk('uncompressed PDF: contact line intact', /jordan\.ellis@example\.com/.test(r1.text));
  chk('uncompressed PDF: no garbled characters', !/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(r1.text));

  const r2 = await PdfText.extract(flate);
  chk('FlateDecode PDF: decompresses', r2.words > 60, r2.words + ' words');
  chk('FlateDecode PDF: content matches', /Bay Area Credit Union/.test(r2.text));

  const r3 = await PdfText.extract(a85);
  chk('ASCII85-decoded PDF: reads through the filter chain', r3.words > 60, r3.words + ' words');

  const r4 = await PdfText.extract(objstm);
  chk('object-stream PDF: page found inside /ObjStm', r4.words > 60, r4.words + ' words');
  chk('object-stream PDF: content matches', /Delta Hotel/.test(r4.text));

  const r5 = await PdfText.extract(enc);
  chk('encrypted PDF: flagged, not silently empty', r5.encrypted === true && r5.words === 0);

  const r6 = await PdfText.extract(scan);
  chk('scanned PDF: flagged as needing OCR', r6.needsOcr === true && r6.warnings.includes('no-text-layer'));

  let threw = null;
  try { await PdfText.extract(Buffer.from('not a pdf at all', 'latin1')); } catch (e) { threw = e.message; }
  chk('non-PDF input rejected', threw === 'not-pdf', threw || '');

  /* ---------- the app's real import path ---------- */
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const dom = new JSDOM(html, {
    runScripts: 'dangerously', pretendToBeVisual: true, url: 'http://localhost/',
    beforeParse(w) {
      w.alert = () => {}; w.confirm = () => true; w.scrollTo = () => {};
      w.speechSynthesis = { speak: () => {}, cancel: () => {} };
      w.SpeechSynthesisUtterance = function () {};
      w.webkitSpeechRecognition = function () { this.start = () => {}; this.stop = () => {}; };
      w.TextDecoder = TextDecoder;
      w.DecompressionStream = DecompressionStream;
      w.Blob = Blob;
      w.Response = Response;               /* jsdom has no fetch/Response */
      w.fetch = fetch;
      if (!w.navigator.serviceWorker) Object.defineProperty(w.navigator, 'serviceWorker', { value: { register: () => Promise.resolve() } });
    }
  });
  await new Promise(r => setTimeout(r, 900));
  const w = dom.window, d = dom.window.document;

  chk('app: PdfText engine is inlined', typeof w.PdfText === 'object' && typeof w.PdfText.extract === 'function');
  chk('app: import handler exists', typeof w.handleResumeImport === 'function');
  chk('app: resume tab has a file input', !!d.getElementById('importFile'));
  chk('app: input accepts PDF', /\.pdf/.test(d.getElementById('importFile').getAttribute('accept') || ''));

  // drive the real change handler with real PDF bytes
  const buf = simplePdf(true);
  const file = new w.File([new Uint8Array(buf)], 'Jordan Ellis Resume.pdf', { type: 'application/pdf' });
  const input = d.getElementById('importFile');
  Object.defineProperty(input, 'files', { value: [file], configurable: true });
  await w.handleResumeImport(input);
  await new Promise(r => setTimeout(r, 400));

  chk('import: name filled', d.getElementById('rName').value === 'JORDAN ELLIS', JSON.stringify(d.getElementById('rName').value));
  chk('import: email filled', d.getElementById('rEmail').value === 'jordan.ellis@example.com', d.getElementById('rEmail').value);
  chk('import: phone filled', /906/.test(d.getElementById('rPhone').value), d.getElementById('rPhone').value);
  chk('import: city filled', /Escanaba, MI/.test(d.getElementById('rCity').value), d.getElementById('rCity').value);
  chk('import: summary filled', /call centre experience/i.test(d.getElementById('rSummary').value), d.getElementById('rSummary').value.slice(0, 50));
  chk('import: skills filled', /Salesforce CRM/.test(d.getElementById('rSkills').value), d.getElementById('rSkills').value);
  chk('import: education filled', /Bay College/.test(d.getElementById('rEdu').value), d.getElementById('rEdu').value.slice(0, 40));
  const jobCount = d.getElementById('expList').querySelectorAll('input,textarea').length;
  chk('import: two jobs created', jobCount >= 4, jobCount + ' fields');
  const expText = [...d.getElementById('expList').querySelectorAll('textarea')].map(t => t.value).join(' | ');
  chk('import: bullets kept with the right job', /Trained 3 new hires/.test(expText), expText.slice(0, 60));
  chk('import: status message shown', /Imported/.test(d.getElementById('importStatus').textContent), d.getElementById('importStatus').textContent.slice(0, 50));

  // scanned PDF through the same handler => honest message, nothing clobbered
  const scanFile = new w.File([new Uint8Array(scan)], 'scan.pdf', { type: 'application/pdf' });
  Object.defineProperty(input, 'files', { value: [scanFile], configurable: true });
  await w.handleResumeImport(input);
  await new Promise(r => setTimeout(r, 200));
  chk('scan: explains there is no text layer', /scan or a picture|no text inside/i.test(d.getElementById('importStatus').textContent), d.getElementById('importStatus').textContent.slice(0, 60));
  chk('scan: previous data left intact', d.getElementById('rName').value === 'JORDAN ELLIS');

  // encrypted PDF
  const encFile = new w.File([new Uint8Array(enc)], 'locked.pdf', { type: 'application/pdf' });
  Object.defineProperty(input, 'files', { value: [encFile], configurable: true });
  await w.handleResumeImport(input);
  await new Promise(r => setTimeout(r, 200));
  chk('encrypted: explains password protection', /password-protected/i.test(d.getElementById('importStatus').textContent), d.getElementById('importStatus').textContent.slice(0, 60));

  // proofreader path shares the same reader
  const pinput = d.getElementById('proofFile');
  Object.defineProperty(pinput, 'files', { value: [new w.File([new Uint8Array(simplePdf(true))], 'r.pdf', { type: 'application/pdf' })], configurable: true });
  await w.handleProofFile(pinput);
  await new Promise(r => setTimeout(r, 500));
  chk('proofreader: PDF loads into the text box', /Bay Area Credit Union/.test(d.getElementById('proofText').value), d.getElementById('proofText').value.slice(0, 40));

  out.forEach(([n, ok, x]) => console.log((ok ? 'PASS' : 'FAIL').padEnd(5), n, x));
  const pass = out.every(r => r[1]);
  console.log(pass ? '\nPDF IMPORT: PASS' : '\nPDF IMPORT: FAIL');
  process.exit(pass ? 0 : 1);
})();
