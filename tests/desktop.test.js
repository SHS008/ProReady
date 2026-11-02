const {JSDOM,VirtualConsole}=require('jsdom');
const fs=require('fs');
const errs=[];
const vc=new VirtualConsole().on('jsdomError',e=>errs.push(String(e.detail&&e.detail.message||e.message)))
  .on('error',e=>errs.push('console.error: '+e));
(async()=>{
const dom=await JSDOM.fromURL('http://127.0.0.1:8080/desktop.html',{
  runScripts:'dangerously',pretendToBeVisual:true,resources:'usable',virtualConsole:vc,
  beforeParse(w){w.alert=()=>{};w.confirm=()=>true;w.scrollTo=()=>{};w.URL.createObjectURL=()=>'blob:x';
    w.URL.revokeObjectURL=()=>{};w.open=()=>({document:{write(){},close(){}},focus(){},print(){}});
    w.Blob=global.Blob;
    w.addEventListener('load',()=>{});}});
const w=dom.window,d=dom.window.document;
await new Promise(r=>setTimeout(r,900));
const out=[];const chk=(n,ok,x)=>out.push([n,!!ok,x||'']);
const $=id=>d.getElementById(id);

chk('page loads with no JS errors', errs.length===0, JSON.stringify(errs.slice(0,2)));
chk('ResumeExport loaded from external file', typeof w.ResumeExport==='object');
chk('version shown', /v1\.3\.0/.test(d.body.textContent) && d.querySelector('meta[name="app-version"]').content === '1.3.0');
chk('skip link', !!d.querySelector('.skip-link'));

// typing updates preview + score
$('rName').value='Jordan Taylor'; $('rName').dispatchEvent(new w.Event('input',{bubbles:true}));
chk('preview reflects name', $('resumePreview').textContent.includes('Jordan Taylor'));
chk('score below 100 when incomplete', parseInt($('scoreTxt').textContent)<100, $('scoreTxt').textContent);

// load example
w.loadExample();
await new Promise(r=>setTimeout(r,120));
chk('example fills fields', $('rName').value==='Jordan Taylor'&&$('rEmail').value.includes('@'));
chk('example adds jobs', d.querySelectorAll('#expList .exp').length===2, d.querySelectorAll('#expList .exp').length+' jobs');
chk('score high with example', parseInt($('scoreTxt').textContent)>=75, $('scoreTxt').textContent);
chk('page-fit estimate present', /Estimated length/.test($('pageFit').textContent));
chk('skills suggestions render', d.querySelectorAll('#skillSuggest .chip').length>0);

// EXPORTS
const data=w.exportedData();
chk('exportedData has experiences', data.experiences.length===2 && data.experiences[0].title.length>2, data.experiences[0].title);
chk('exportedData reads employer + dates', data.experiences[0].org.includes('Walmart') && data.experiences[0].dates.length>3);
const pdf=await w.ResumeExport.buildResumePDF(data);
const docx=await w.ResumeExport.buildResumeDOCX(data);
const pb=Buffer.from(await pdf.arrayBuffer()), db=Buffer.from(await docx.arrayBuffer());
fs.writeFileSync('/tmp/desktop_resume.pdf',pb); fs.writeFileSync('/tmp/desktop_resume.docx',db);
chk('PDF valid header', pb.slice(0,8).toString()==='%PDF-1.4', pb.length+' bytes');
chk('DOCX valid zip', db[0]===0x50&&db[1]===0x4B, db.length+' bytes');
$('tabPreviewBtn').click();
w.exportAs('pdf'); w.exportAs('docx'); w.exportAs('txt');
chk('export buttons do not throw', true, 'toast="'+$('toast').textContent.slice(0,42)+'"');
w.printResume();
chk('print path does not throw', true);

// persistence
const saved=w.localStorage.getItem('proready_desktop_v1');
chk('autosaves to localStorage', !!saved && saved.includes('Jordan Taylor'));

// backup round trip
w.backup();
chk('backup runs', true);

// proofreader tab
$('tabProofBtn').click();
chk('proof tab shows', !$('paneProof').hidden && $('panePreview').hidden);
w.loadProofSample(); w.runProof();
const pr=$('proofResults').innerHTML;
chk('proofreader scores sample', /\d+\/100/.test(pr), (pr.match(/(\d+)\/100/)||[])[1]+'/100');
chk('catches misspelling custmers', /custmers|customers/i.test(pr));
chk('catches references line', /References available/i.test(pr));
chk('catches first-person + duty language', pr.includes('First-person') && pr.includes('describe duties'));
chk('integrity notice present', pr.includes('Add only numbers you can prove'));
chk('score explainer present', pr.includes('How to read these scores'));

// keyboard reachability: every visible control has label or aria-label
const ctrls=[...d.querySelectorAll('input,textarea,select')].filter(c=>c.type!=='hidden');
const unlabelled=ctrls.filter(c=>{
  if(c.getAttribute('aria-label'))return false;
  if(c.id&&d.querySelector('label[for="'+c.id+'"]'))return false;
  if(c.closest('label'))return false;
  return true;
});
chk('all controls labelled', unlabelled.length===0, unlabelled.map(c=>c.id||c.className).join(','));

const real=errs.filter(e=>!/blob:|NotSupported|not implemented/i.test(e));
chk('no real JS errors', real.length===0, JSON.stringify(real.slice(0,2)));
out.forEach(([n,ok,x])=>console.log((ok?'PASS':'FAIL').padEnd(5),n,x));
const pass=out.every(x=>x[1]);console.log(pass?'\nDESKTOP: PASS':'\nDESKTOP: FAIL');process.exit(pass?0:1);
})();
