/* Proofreading guard: generated interview questions must be grammatical for ANY job title.
   Regression test for "the this position position" (blank title) and related duplicates. */
const fs = require('fs');
const { JSDOM } = require('jsdom');
const html = fs.readFileSync(__dirname + '/../index.html', 'utf8');
const out = []; const chk = (n, ok, x) => out.push([n, !!ok, x || '']);
const ANSWER = 'At my last job I worked the service desk for three years, handling about forty calls a day. I resolved billing questions and trained two new hires, which cut our callback backlog by twenty percent. I want to bring that reliability to this role.';

const BAD = [
  [/\bthe this\b/i,              'the this'],
  [/\bposition position\b/i,     'position position'],
  [/\brole role\b/i,             'role role'],
  [/\borganization organization\b/i, 'organization organization'],
  [/\bthe the\b/i,               'the the'],
  [/\bcompany company\b/i,       'company company'],
  [/\bjob job\b/i,               'job job'],
  [/\bposition,? this team\?/i,  'dangling "this team?"'],
  [/\bPosition position/i,       'Position position'],
];

function scan(label, qs) {
  const hits = [];
  qs.forEach(q => BAD.forEach(([re, why]) => { if (re.test(q)) hits.push(why + ' :: ' + q.slice(0, 90)); }));
  chk(label + ': no repeated words', hits.length === 0, hits[0] || '');
  chk(label + ': every question is a complete sentence', qs.every(q => q && /[.?]$/.test(q.trim())));
  return qs;
}

const dom = new JSDOM(html, {
  runScripts: 'dangerously', pretendToBeVisual: true, url: 'http://localhost/',
  beforeParse(w) {
    w.alert = () => {}; w.confirm = () => true; w.scrollTo = () => {};
    w.speechSynthesis = { speak: () => {}, cancel: () => {} };
    w.SpeechSynthesisUtterance = function () {};
    w.webkitSpeechRecognition = function () { this.start = () => {}; this.stop = () => {}; };
  }
});

setTimeout(() => {
  const w = dom.window, d = dom.window.document;
  const ask = (title, company, fmt, style) => {
    d.getElementById('jobTitle').value = title;
    d.getElementById('jobCompany').value = company;
    d.getElementById('jobLevel').value = 'Some related experience';
    if (w.saveJob) w.saveJob();
    d.getElementById('intCount').value = fmt;
    d.getElementById('intStyle').value = style;
    d.getElementById('interviewSetup').style.display = 'block';
    w.startInterview();
    const qs = [];
    for (let i = 0; i < 40; i++) {
      const cap = d.getElementById('questionCaption').textContent.trim();
      if (cap) qs.push(cap.replace(/\s+/g, ' '));
      if (d.getElementById('interviewLive').style.display === 'none') break;
      d.getElementById('answerText').value = ANSWER;
      try { w.submitAnswer(); } catch (e) {}
      if (d.getElementById('interviewLive').style.display === 'none') break;
      try { w.nextQ(); } catch (e) {}
      if (d.getElementById('interviewLive').style.display === 'none') break;
    }
    try { w.endInterview(true); } catch (e) {}
    d.getElementById('interviewSetup').style.display = 'block';
    return qs;
  };

  // the reported bug: no job title at all
  const blank = scan('blank title', ask('', '', 'full', 'standard'));
  chk('blank title: never says "the this position"', !blank.some(q => /the this/i.test(q)));
  chk('blank title: falls back to "this position"', blank.some(q => /for this position\./.test(q)));
  chk('blank title: no invented company name', !blank.some(q => /at the organization\?/.test(q)));

  // a title that is only a generic noun
  const generic = scan('generic title', ask('Position', 'Acme', 'full', 'standard'));
  chk('generic title: not spoken back as a job title', !generic.some(q => /Position position|for the Position/.test(q)));

  // redundant role noun already in the title
  const redundant = scan('redundant noun', ask('Store Manager Position', 'Target', 'screen', 'standard'));
  chk('redundant noun: deduplicated to "Store Manager"', redundant.some(q => /the Store Manager position/.test(q)));

  // normal titles, every format
  scan('CSP/full/standard', ask('Customer Service Representative', 'Acme Health', 'full', 'standard'));
  scan('RN/final/tough',    ask('Registered Nurse', 'Mercy Hospital', 'final', 'tough'));
  scan('sales/screen/tough', ask('Sales', '', 'screen', 'tough'));
  scan('vowel title',       ask('Operations Analyst', '', 'final', 'standard'));

  // no repeated "do you have any questions" at the close
  const screenQs = ask('Sales', '', 'screen', 'standard');
  const qCount = screenQs.filter(q => /do you have any questions/i.test(q)).length;
  chk('no duplicate candidate-questions prompt', qCount <= 1, 'found ' + qCount);

  // resume-driven titles still work
  const withExp = ask('Line Cook', 'Bistro 41', 'full', 'standard');
  chk('lengths stay sane', withExp.length >= 8 && withExp.length <= 16, withExp.length + ' questions');

  // tidyTitle unit behaviour through the UI layer
  chk('tidyTitle strips trailing role nouns', w.tidyTitle('Store Manager Position') === 'Store Manager');
  chk('tidyTitle rejects bare generic nouns', w.tidyTitle('Role') === '');
  chk('tidyTitle keeps real titles', w.tidyTitle('  Registered   Nurse ') === 'Registered Nurse');

  out.forEach(([n, ok, x]) => console.log((ok ? 'PASS' : 'FAIL').padEnd(5), n, x));
  const pass = out.every(r => r[1]);
  console.log(pass ? '\nINTERVIEW COPY: PASS' : '\nINTERVIEW COPY: FAIL');
  process.exit(pass ? 0 : 1);
}, 900);
