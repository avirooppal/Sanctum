/** Real dashboard failure clearing and saved-profile CRUD; no fake API replies. */
import {createRequire} from 'node:module';
import {readFileSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const [pkg,tokenFile,output]=process.argv.slice(2);
const {chromium}=createRequire(import.meta.url)(pkg);
const browser=await chromium.launch({headless:true});const context=await browser.newContext();
const base=new URL(process.env.SANCTUM_BASE_URL??'http://127.0.0.1:8769');
const foreign=[],errors=[];const token=readFileSync(tokenFile,'utf8').trim();
await context.route('**/*',r=>{const u=new URL(r.request().url());if(u.origin!==base.origin){foreign.push(u.origin);return r.abort();}return r.continue();});
await context.routeWebSocket('**/*',s=>{const u=new URL(s.url());u.protocol=u.protocol==='wss:'?'https:':'http:';if(u.origin!==base.origin){foreign.push(u.origin);s.close();}else s.connectToServer();});
const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
const name='Workflow fixture '+Date.now();let created=null,clicks=0,entries=0;const started=performance.now();
async function click(locator){await locator.click();clicks++;}
try {
 await page.goto(base.href);await page.getByLabel('Local access key').fill(token);entries++;
 await click(page.getByRole('button',{name:'Unlock',exact:true}));
 await click(page.getByRole('button',{name:'Dashboard',exact:true}));
 const main=page.getByRole('main');await main.getByText('Startup denial checks passed. Ledger unavailable.',{exact:true}).waitFor();
 assert(!(await main.innerText()).includes('~450 MB'));
 await page.route('**/healthz',r=>r.abort('failed'));
 await click(page.getByRole('button',{name:'Refresh',exact:true}));
 await page.getByRole('alert').filter({hasText:'Sanctum is unavailable.'}).waitFor();
 await main.getByText('Startup checks: unknown. Ledger unavailable.',{exact:true}).waitFor();
 assert(!(await main.innerText()).includes('Startup denial checks passed'));
 await page.unroute('**/healthz');
 await click(page.getByRole('button',{name:'← Chat',exact:true}));
 await click(page.getByRole('button',{name:'Preferences',exact:true}));
 const dialog=page.getByRole('dialog');
 await page.route('**/v1/profiles',r=>r.request().method()==='GET'?r.abort('failed'):r.continue());
 await click(dialog.getByRole('button',{name:'Assistant Profiles',exact:true}));
 await dialog.getByText('Sanctum is unavailable. Start the local runtime, then check again.',{exact:true}).waitFor();
 assert.equal(await dialog.getByText('No assistant profiles configured yet.',{exact:true}).count(),0);
 await page.unroute('**/v1/profiles');
 await click(dialog.getByRole('button',{name:'Appearance & Theme',exact:true}));
 await click(dialog.getByRole('button',{name:'Assistant Profiles',exact:true}));
 await click(dialog.getByRole('button',{name:'+ New Profile',exact:true}));
 await page.getByLabel('Profile name',{exact:true}).fill(name);entries++;
 await page.getByLabel('Profile system prompt',{exact:true}).fill('Test definition;not applied automatically.');entries++;
 const saved=page.waitForResponse(r=>new URL(r.url()).pathname==='/v1/profiles'&&r.request().method()==='POST');
 await click(dialog.getByRole('button',{name:'Save Profile',exact:true}));
 const response=await saved;assert.equal(response.status(),200,'Profile write must be admitted');created=(await response.json()).id;
 const row=dialog.locator('div').filter({has:page.getByText(name,{exact:false})}).filter({has:page.getByRole('button',{name:'Edit',exact:true})}).last();
 await page.getByText(name,{exact:false}).waitFor();
 await click(row.getByRole('button',{name:'Edit',exact:true}));
 await page.getByLabel('Profile name',{exact:true}).fill(name+' revised');entries++;
 await click(dialog.getByRole('button',{name:'Save Profile',exact:true}));
 await page.getByText(name+' revised',{exact:false}).waitFor();
 const updated=dialog.locator('div').filter({has:page.getByText(name+' revised',{exact:false})}).filter({has:page.getByRole('button',{name:'Delete',exact:true})}).last();
 await click(updated.getByRole('button',{name:'Delete',exact:true}));
 await page.getByText(name+' revised',{exact:false}).waitFor({state:'hidden'});created=null;
 assert.deepEqual(foreign,[]);assert.deepEqual(errors,[]);
 const record={suite:'real-dashboard-profile-subflow',journeys:['J9','J11','J12'],status:'PASS',clicks,text_entries:entries,elapsed_ms:performance.now()-started,foreign_requests:foreign.length,page_errors:errors,full_journey_verified:false,ledger_verified:false};
 writeFileSync(output,JSON.stringify(record,null,2)+'\n');console.log(JSON.stringify(record));
}finally{
 if(created)await context.request.post(new URL('/v1/profiles',base).href,{headers:{Authorization:'Bearer '+token},data:{operation:'delete',id:created}});
 await browser.close();
}
