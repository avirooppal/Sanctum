import {createRequire} from 'node:module';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
const [pkg,tokenFile,output]=process.argv.slice(2);
const {chromium}=createRequire(import.meta.url)(pkg);const token=readFileSync(tokenFile,'utf8').trim();
const base='http://127.0.0.1:8769';const browser=await chromium.launch({headless:true});const context=await browser.newContext();
const foreign=[],errors=[],captures=[];mkdirSync(output,{recursive:true});
await context.route('**/*',r=>{if(new URL(r.request().url()).origin!==base){foreign.push(new URL(r.request().url()).origin);return r.abort();}return r.continue();});
await context.routeWebSocket('**/*',s=>{const u=new URL(s.url());u.protocol=u.protocol==='wss:'?'https:':'http:';if(u.origin!==base){foreign.push(u.origin);s.close();}else s.connectToServer();});
const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));const headers={Authorization:`Bearer ${token}`};
const original=(await (await context.request.get(base+'/v1/preferences',{headers})).json()).preferences;
const viewports=[{width:1440,height:900},{width:820,height:1180},{width:390,height:844}];
let theme='sanctum',mode='dark';
async function appearance(){
 for(const [label,value] of [['Theme',theme],['Theme mode',mode]]){
  const control=page.getByLabel(label,{exact:true});if(await control.count())await control.selectOption(value,{force:true});
 }
 await page.evaluate(()=>document.fonts.ready);
}
async function capture(state){
 for(const viewport of viewports){await page.setViewportSize(viewport);await page.screenshot({path:`${output}/${theme}-${mode}-${state}-${viewport.width}.png`});
 captures.push({theme,mode,state,viewport,overflow:await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)});}
}
try{
 for(theme of ['sanctum','catppuccin','everforest'])for(mode of ['light','dark']){
  await page.goto(base);await appearance();await capture('locked');
  await page.getByRole('button',{name:'Start Setup Walkthrough →',exact:true}).click();await capture('walkthrough');
  await page.getByRole('button',{name:'Or enter existing access key directly',exact:true}).click();
  await page.getByLabel('Local access key',{exact:true}).fill(token);await page.getByRole('button',{name:'Open workspace',exact:true}).click();
  await page.getByLabel('Message',{exact:true}).waitFor();await appearance();await capture('empty-chat');
  await page.setViewportSize(viewports[0]);await page.getByRole('button',{name:'Preferences',exact:true}).click();await capture('settings');
  await page.getByRole('button',{name:'Close Preferences',exact:true}).click();
  await page.setViewportSize(viewports[0]);await page.getByRole('button',{name:'Dashboard',exact:true}).click();await page.getByRole('heading',{name:'Runtime Overview & Status',exact:true}).waitFor();await capture('dashboard');
  await page.goto(base+'/website.html');await appearance();await capture('website');
  await page.goto(base+'/docs.html');await appearance();await capture('docs');
 }
 // Actual rejected credential,not an intercepted/fabricated backend response.
 theme='sanctum';mode='dark';await page.goto(base);await appearance();
 await page.getByLabel('Local access key',{exact:true}).fill('redesign-invalid-key');await page.getByRole('button',{name:'Open workspace',exact:true}).click();
 await page.getByRole('alert').waitFor();await capture('auth-error');
 writeFileSync(output+'/manifest.json',JSON.stringify({journeys:['J2','J3','J9','J11','J12'],scope:'before capture;no fake response or injected state',captures,foreign,errors,pending:['streaming code and citations combined','long answer','engine busy','many-conversation grouped sidebar'],product_verified:false},null,2)+'\n');
 console.log(JSON.stringify({captures:captures.length,foreign:foreign.length,errors}));
}finally{
 if(original)await context.request.post(base+'/v1/preferences',{headers,data:original});
 await browser.close();
}
