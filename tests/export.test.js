/* Export engine: asserts the PDF and DOCX files are structurally valid, not just non-throwing. */
const fs = require('fs');
global.window = {};
require('../resume-export.js');
const X = global.window.ResumeExport;

const DATA = {
  name: 'Jordan Taylor', headline: 'Medical Office Assistant', city: 'Escanaba, MI',
  phone: '(906) 555-0142', email: 'jordan.taylor@email.com',
  summary: 'Dependable professional — with an em dash and a 20% improvement figure.',
  experiences: [
    { title: 'Shift Lead', org: 'Walmart', dates: '2021 – Present', bullets: 'Trained 6 associates • bullet glyph\nSaved 20% of handling time' }
  ],
  skills: ['Scheduling', 'Data Entry'], edu: 'Diploma, 2018'
};

const out = [];
const chk = (n, ok, x) => out.push([n, !!ok, x || '']);

(async () => {
  const pdf = Buffer.from(await (await X.buildResumePDF(DATA)).arrayBuffer());
  const docx = Buffer.from(await (await X.buildResumeDOCX(DATA)).arrayBuffer());
  const txt = await (await X.buildResumeTXT(DATA)).text();
  const html = X.buildResumeHTML(DATA);

  chk('PDF starts with %PDF-', pdf.slice(0, 5).toString() === '%PDF-');
  chk('PDF ends with %%EOF', pdf.toString('latin1').trimEnd().endsWith('%%EOF'));
  chk('PDF declares an xref table', pdf.toString('latin1').includes('\nxref\n'));
  chk('PDF has WinAnsi bullet (0x95) not "?"', pdf.toString('latin1').includes('\\225'));
  chk('PDF has en-dash mapping (0x96)', pdf.toString('latin1').includes('\\226'));
  chk('PDF embeds Helvetica core fonts', pdf.toString('latin1').includes('/BaseFont /Helvetica'));

  chk('DOCX is a ZIP (PK header)', docx[0] === 0x50 && docx[1] === 0x4B);
  chk('DOCX contains document.xml', docx.toString('latin1').includes('word/document.xml'));
  chk('DOCX contains [Content_Types].xml', docx.toString('latin1').includes('[Content_Types].xml'));
  chk('DOCX contains _rels/.rels', docx.toString('latin1').includes('_rels/.rels'));
  chk('DOCX has w:body', docx.toString('latin1').includes('<w:body>'));

  chk('TXT includes the name', txt.includes('Jordan Taylor'));
  chk('TXT includes a bullet', txt.includes('- Trained 6 associates'));
  chk('HTML is a full document', html.startsWith('<!DOCTYPE html>') && html.includes('</html>'));
  chk('HTML escapes markup', !html.includes('<script'));

  // pagination: long resume must spill to multiple pages rather than overflow
  const long = JSON.parse(JSON.stringify(DATA));
  long.experiences = Array.from({ length: 16 }, (_, i) => ({
    title: 'Role ' + (i + 1), org: 'Employer', dates: '2010 – 2015',
    bullets: 'A long bullet describing responsibilities and results in detail so that wrapping and pagination are exercised\nAnother bullet with 42 percent and 1,200 units'
  }));
  const longPdf = Buffer.from(await (await X.buildResumePDF(long)).arrayBuffer()).toString('latin1');
  const pageCount = (longPdf.match(/\/Type \/Page\b/g) || []).length;
  chk('long resume paginates (>=2 pages)', pageCount >= 2, pageCount + ' pages');
  chk('no "?" placeholders in long PDF', !/\(\?\)/.test(longPdf.replace(/\\\d{3}/g, '')));

  out.forEach(([n, ok, x]) => console.log((ok ? 'PASS' : 'FAIL').padEnd(5), n, x));
  const pass = out.every(r => r[1]);
  console.log(pass ? '\nEXPORT ENGINE: PASS' : '\nEXPORT ENGINE: FAIL');
  process.exit(pass ? 0 : 1);
})();
