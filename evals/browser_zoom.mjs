/** Genuine Chrome tab zoom in an isolated dev-only profile;never an owner-browser extension. */
import {createRequire} from 'node:module';import {mkdirSync,writeFileSync,readFileSync} from 'node:fs';import {resolve} from 'node:path';import assert from 'node:assert/strict';
const [pkg,output,keyFile]=process.argv.slice(2);const {chromium}=createRequire(import.meta.url)(pkg);
const base='http://127.0.0.1:8769';const extension=resolve('evals/helpers/native-zoom');const profile=resolve('.sanctum/zoom-profiles/'+Date.now());mkdirSync(output,{recursive:true});
const context=await chromium.launchPersistentContext(profile,{headless:true,channel:'chromium',viewport:null,args:['--window-size=1440,900',`--disable-extensions-except=${extension}`,`--load-extension=${extension}`]});
const foreign=[];let token='';
try{
 await context.route('**/*',route=>{const u=new URL(route.request().url());if(['http:','https:'].includes(u.protocol)&&u.origin!==base){foreign.push(u.origin);return route.abort();}return route.continue();});
 await context.routeWebSocket('**/*',s=>{const u=new URL(s.url());u.protocol=u.protocol==='wss:'?'https:':'http:';if(u.origin!==base){foreign.push(u.origin);s.close();}else s.connectToServer();});
 const worker=context.serviceWorkers()[0]??await context.waitForEvent('serviceworker');const page=context.pages()[0]??await context.newPage();await page.goto(base);await page.getByLabel('Local access key',{exact:true}).waitFor();
 const before=await page.evaluate(()=>({width:innerWidth,height:innerHeight,dpr:devicePixelRatio}));
 const factor=await worker.evaluate(async base=>{const tabs=await chrome.tabs.query({});const tab=tabs.find(t=>t.url&&new URL(t.url).origin===base);if(!tab)throw Error('Local test tab unavailable');await chrome.tabs.setZoom(tab.id,2);return chrome.tabs.getZoom(tab.id);},base);
 assert.equal(factor,2);await page.waitForFunction(width=>innerWidth<width,before.width);
 const after=await page.evaluate(()=>({width:innerWidth,height:innerHeight,dpr:devicePixelRatio,overflow:document.documentElement.scrollWidth>innerWidth}));assert(!after.overflow);
 await page.screenshot({path:output+'/unlock-native-200.png'});
 await page.getByRole('button',{name:'Review local setup',exact:true}).focus();await page.keyboard.press('Enter');await page.getByRole('region',{name:'First-run setup',exact:true}).waitFor();assert(!await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth));
 await page.screenshot({path:output+'/setup-native-200.png'});await page.getByRole('button',{name:'Back to unlock',exact:true}).click();
 const screens=['unlock','setup'];
 if(keyFile){
  token=readFileSync(keyFile,'utf8').trim();await page.getByLabel('Local access key',{exact:true}).fill(token);await page.getByRole('button',{name:'Unlock',exact:true}).click();await page.getByLabel('Message',{exact:true}).waitFor();
  assert(!await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth));await page.screenshot({path:output+'/chat-native-200.png'});screens.push('chat');
  await page.getByRole('button',{name:'Preferences',exact:true}).click();await page.getByRole('dialog',{name:'Preferences',exact:true}).waitFor();assert(!await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth));await page.screenshot({path:output+'/settings-native-200.png'});screens.push('settings');
 }
 assert.deepEqual(foreign,[]);const result={suite:'native-chromium-zoom',zoom_factor:factor,before,after,screens,foreign,scope:'Actual Chrome tabs.setZoom(2),not CSS zoom or resized viewport;isolated first-party test helper only'};writeFileSync(output+'/result.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
}catch(error){const safe=String(error.stack??error).split(token||'__NO_KEY__').join('[REDACTED]');writeFileSync(output+'/failed.log',safe+'\n');console.error(safe);process.exitCode=1;}
finally{await context.close();}
