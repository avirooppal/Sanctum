/** Real gateway chat hierarchy;no injected responses or product mock data. */
import {createRequire} from 'node:module';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import assert from 'node:assert/strict';
const [pkg,keyFile,out]=process.argv.slice(2);const {chromium}=createRequire(import.meta.url)(pkg);
const base='http://127.0.0.1:8769';const token=readFileSync(keyFile,'utf8').trim();
mkdirSync(out,{recursive:true});const browser=await chromium.launch();const context=await browser.newContext();
const foreign=[];const errors=[];const measurements=[];
await context.route('**/*',r=>{if(new URL(r.request().url()).origin!==base){foreign.push(new URL(r.request().url()).origin);return r.abort();}return r.continue();});
await context.routeWebSocket('**/*',s=>{const u=new URL(s.url());u.protocol=u.protocol==='wss:'?'https:':'http:';if(u.origin!==base){foreign.push(u.origin);s.close();}else s.connectToServer();});
const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
try{
 await page.goto(base);await page.getByLabel('Local access key',{exact:true}).fill(token);await page.getByRole('button',{name:'Unlock',exact:true}).click();await page.getByLabel('Message',{exact:true}).waitFor();
 const recovery=page.getByRole('button',{name:'Dismiss notification',exact:true});if(await recovery.isVisible())await recovery.click();
 await page.getByLabel('Message',{exact:true}).fill('Say hello in one short sentence.');await page.getByRole('button',{name:'Send ↑',exact:true}).click();await page.getByRole('button',{name:'Stop generation',exact:true}).waitFor({state:'hidden'});
 assert((await page.locator('article[data-role=assistant]').last().innerText()).length>5);
 assert.equal(await page.getByRole('button',{name:'Model picker',exact:true}).count(),0,'duplicate model picker is undisclosed');
 assert.equal(await page.getByRole('button',{name:/^Rename /}).count(),0,'history mutation controls are undisclosed');
 for(const width of [1440,820,390]){
  await page.setViewportSize({width,height:900});
  const metrics=await page.evaluate(()=>{const box=document.querySelector('.chat-compose-surface').getBoundingClientRect();const input=document.querySelector('textarea[aria-label=Message]').getBoundingClientRect();return {width:innerWidth,composer_width:box.width,composer_height:box.height,composer_bottom:box.bottom,input_visible:input.top>=0&&input.bottom<=innerHeight,root_overflow:document.documentElement.scrollWidth>innerWidth,outer_scroll:document.querySelector('.app-body').scrollHeight>document.querySelector('.app-body').clientHeight+1};});
  assert(metrics.composer_width<=800);assert(metrics.composer_height<=160);assert(metrics.input_visible);assert(!metrics.root_overflow);assert(!metrics.outer_scroll);measurements.push(metrics);
  for(const name of ['Attach document to Knowledge','Start dictation','Toggle right rail']){
   const box=await page.getByRole('button',{name,exact:true}).boundingBox();assert(box&&box.width>=44&&box.height>=44,`${name} must retain a44px target`);
  }
  await page.screenshot({path:out+`/conversation-${width}.png`});
 }
 await page.setViewportSize({width:1440,height:900});await page.getByRole('button',{name:'＋ New conversation',exact:true}).click();await page.getByRole('heading',{name:'What’s on your mind?',exact:true}).waitFor();await page.screenshot({path:out+'/empty-1440.png'});
 await page.getByLabel('Runtime details',{exact:true}).focus();await page.keyboard.press('Enter');assert(await page.getByRole('button',{name:'Model picker',exact:true}).isVisible());await page.screenshot({path:out+'/runtime-expanded.png'});await page.keyboard.press('Enter');
 const actions=page.locator('.history-actions summary').first();await actions.focus();await page.keyboard.press('Enter');assert(await page.getByRole('button',{name:/^Rename /}).first().isVisible());await page.screenshot({path:out+'/history-actions.png'});await actions.press('Enter');
 await page.getByText('Local speech',{exact:true}).click();const speech=await page.locator('.chat-tools>details[open]').boundingBox();assert(speech&&speech.width>=700,'expanded speech uses the available desktop width');
 await page.setViewportSize({width:390,height:900});assert(!await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth));await page.screenshot({path:out+'/speech-expanded-390.png'});
 assert.deepEqual(foreign,[]);assert.deepEqual(errors,[]);
 const result={suite:'real-focused-chat-layout',journeys:['J3','J9'],measurements,foreign,errors,real_engine_answer:true,whole_redesign_verified:false};writeFileSync(out+'/result.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
}catch(error){console.error(String(error.stack??error).split(token).join('[REDACTED]'));process.exitCode=1;}finally{await browser.close();}
