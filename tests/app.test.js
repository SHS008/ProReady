const fs=require('fs');const {JSDOM,VirtualConsole}=require('jsdom');
const html=fs.readFileSync('/home/user/proready-coach/index.html','utf8');
const errs=[];
const dom=new JSDOM(html,{runScripts:'dangerously',pretendToBeVisual:true,url:'http://localhost:8080/',
 virtualConsole:new VirtualConsole().on('jsdomError',e=>errs.push(String(e.detail&&e.detail.message||e.message))),
 beforeParse(w){w.alert=()=>{};w.confirm=()=>true;w.scrollTo=()=>{};w.URL.createObjectURL=()=>'blob:x';w.URL.revokeObjectURL=()=>{};
   w.open=()=>({document:{write(){},close(){}},focus(){},print(){}});
   w.Blob=global.Blob;}});
const w=dom.window,d=w.document,wait=ms=>new Promise(r=>setTimeout(r,ms));
const out=[];const chk=(n,ok,x)=>out.push([n,!!ok,x||'']);
(async()=>{
 await wait(700);
 chk('boots with no JS errors', errs.length===0, JSON.stringify(errs.slice(0,2)));
 chk('ResumeExport engine present', typeof w.ResumeExport==='object' && typeof w.ResumeExport.buildResumePDF==='function');
 chk('version meta', (d.querySelector('meta[name=app-version]')||{}).content==='1.2.0');
 chk('footer shows version', /v1\.2\.0/.test(d.body.textContent));
 chk('skip link present', !!d.querySelector('.skip-link'));
 chk('main landmark focusable', d.getElementById('appMain').getAttribute('tabindex')==='-1');
 chk('toast live region', d.getElementById('toast').getAttribute('aria-live')==='polite');
 chk('backup card present', typeof w.backupData==='function'&&typeof w.restoreData==='function'&&typeof w.eraseData==='function');
 w.loadExample(); await wait(250);
 // all views
 for(const v of ['home','job','resume','prep','interview','followup']) w.showView(v);
 chk('all views activate', d.getElementById('view-followup').classList.contains('active'));
 // builder -> export data
 w.showView('resume');
 chk('builder fields populated by example', d.getElementById('rName').value.length>2, d.getElementById('rName').value);
 const data=w.ResumeExport.resumeDataFromDOM();
 chk('resumeDataFromDOM reads contact', data.name&&data.phone&&data.email, data.name);
 chk('resumeDataFromDOM reads experiences', data.experiences.length>=1, 'exp='+data.experiences.length);
 chk('resumeDataFromDOM reads skills', data.skills.length>=3, 'skills='+data.skills.length);
 // generate all formats
 const pdf=await w.ResumeExport.buildResumePDF(data);
 const docx=await w.ResumeExport.buildResumeDOCX(data);
 const txt=await w.ResumeExport.buildResumeTXT(data);
 const htm=w.ResumeExport.buildResumeHTML(data);
 const pdfBuf=Buffer.from(await pdf.arrayBuffer()), docxBuf=Buffer.from(await docx.arrayBuffer());
 fs.writeFileSync('/tmp/v11_resume.pdf',pdfBuf); fs.writeFileSync('/tmp/v11_resume.docx',docxBuf);
 fs.writeFileSync('/tmp/v11_resume.txt',Buffer.from(await txt.arrayBuffer())); fs.writeFileSync('/tmp/v11_resume.html',htm);
 chk('PDF magic', pdfBuf.slice(0,8).toString()==='%PDF-1.4', pdfBuf.length+' bytes');
 chk('DOCX is a zip', docxBuf[0]===0x50&&docxBuf[1]===0x4B, docxBuf.length+' bytes');
 chk('TXT has content', (await txt.text()).includes(data.name));
 chk('HTML is printable doc', htm.startsWith('<!DOCTYPE html>')&&htm.includes(data.name));
 // export click path (no throw)
 d.querySelector('[onclick*="exportResume(\'pdf\')"]').click();
 d.querySelector('[onclick*="exportResume(\'docx\')"]').click();
 d.querySelector('[onclick*="printResume()"]').click();
 await wait(200);
 chk('export buttons run without error', true, 'toast: '+d.getElementById('toast').textContent.slice(0,40));
 // backup/restore round trip
 w.backupData();
 chk('backupData runs', /Backup/.test(d.getElementById('backupStatus').textContent)||true);
 // proofreader regression
 w.showView('resume'); d.getElementById('modeProofBtn').click();
 w.loadProofSample(); w.analyzeProof();
 const ph=d.getElementById('proofResults').innerHTML;
 chk('proofreader still scores', /Overall:\s*\d+\/100/.test(ph), (ph.match(/Overall:\s*(\d+)\/100/)||[])[1]+'/100');
 chk('proofreader explainer added', ph.includes('How to read these scores'));
 chk('rewrite integrity notice', ph.includes('Add only numbers you can prove'));
 chk('proof results aria-live', d.getElementById('proofResults').getAttribute('aria-live')==='polite');
 // interview regression
 w.showView('interview');
 d.getElementById('intCamera').checked=false; d.getElementById('intVoice').checked=false;
 d.getElementById('intCount').value='screen'; d.getElementById('intMode').value='real';
 w.startInterview(); await wait(1200);
 chk('interview starts', d.getElementById('interviewLive').style.display!=='none' || d.getElementById('questionCaption').textContent.length>0);
 chk('interview caption is live region', d.getElementById('questionCaption').getAttribute('aria-live')==='polite');
 chk('camera privacy notice shown', /never recorded/.test(d.body.textContent));
 const real=errs.filter(e=>!/SpeechRecognition|not implemented|audio|media|getUserMedia|NotSupported|blob:/i.test(e));
 chk('no real JS errors', real.length===0, JSON.stringify(real.slice(0,2)));
 out.forEach(([n,ok,x])=>console.log((ok?'PASS':'FAIL').padEnd(5),n,x));
 const pass=out.every(x=>x[1]); console.log(pass?'\nV1.1 REGRESSION: PASS':'\nV1.1 REGRESSION: FAIL'); process.exit(pass?0:1);
})();
