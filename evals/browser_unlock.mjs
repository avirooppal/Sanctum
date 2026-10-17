import {createRequire} from 'node:module';import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';import assert from 'node:assert/strict';
const [pkg,keyFile,output]=process.argv.slice(2);const {chromium}=createRequire(import.meta.url)(pkg);
const {contrastRatio}=await import('../apps/web/build/tests/ui/color.js');
const base=process.env.SANCTUM_BASE_URL??'http://127.0.0.1:8769';const token=readFileSync(keyFile,'utf8').trim();mkdirSync(output,{recursive:true});
const browser=await chromium.launch({headless:true});const measurements=[],foreign=[],errors=[];
try{
 for(const mode of ['light','dark']){
 const context=await browser.newContext({colorScheme:mode});
 await context.route('**/*',r=>{if(new URL(r.request().url()).origin!==base){foreign.push(new URL(r.request().url()).origin);return r.abort();}return r.continue();});
 await context.routeWebSocket('**/*',s=>{const u=new URL(s.url());u.protocol=u.protocol==='wss:'?'https:':'http:';if(u.origin!==base){foreign.push(u.origin);s.close();}else s.connectToServer();});
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
 for(const viewport of [{width:1440,height:900},{width:820,height:1180},{width:390,height:844}]){
 await page.setViewportSize(viewport);await page.goto(base);await page.evaluate(()=>document.fonts.ready);
 await page.waitForFunction(mode=>document.documentElement.dataset.mode===mode,mode);
 assert.equal(await page.locator('.app-shell').count(),0);assert.equal(await page.getByRole('button',{name:'Preferences',exact:true}).count(),0);
 assert.equal(await page.locator('[data-ui-button="primary"]').count(),1);
 const unlock=page.getByRole('button',{name:'Unlock',exact:true});assert(await unlock.isDisabled());
 await page.keyboard.press('Control+,');await page.keyboard.press('Control+k');assert.equal(await page.getByRole('dialog').count(),0);
 const text=await page.locator('body').innerText();assert(!/hermes|\bnous\b|100%|zero.*telemetry|Paste local.token/i.test(text));
 const dimensions=await page.locator('.unlock-card').evaluate(el=>{const r=el.getBoundingClientRect();return {x:r.x,width:r.width,view:innerWidth,overflow:document.documentElement.scrollWidth>innerWidth};});
 assert(!dimensions.overflow);assert(Math.abs(dimensions.x+dimensions.width/2-dimensions.view/2)<1);
 await page.getByLabel('Local access key',{exact:true}).fill('public-test-value');
 const colors=await unlock.evaluate(el=>{const s=getComputedStyle(el);const r=el.getBoundingClientRect();return {ink:s.color,background:s.backgroundColor,width:r.width,height:r.height};});
 const ratio=contrastRatio(colors.ink,colors.background);assert(ratio>=4.5);assert(colors.height>=44);
 await page.getByLabel('Local access key',{exact:true}).fill('');
 await page.screenshot({path:`${output}/${mode}-locked-${viewport.width}.png`});
 measurements.push({mode,viewport,dimensions,primary_contrast:ratio,target_height:colors.height});
 }
 const unlock=page.getByRole('button',{name:'Unlock',exact:true});
 await page.getByText('Where do I find my key?',{exact:true}).click();await page.getByText('When Sanctum starts, it prints the location',{exact:false}).waitFor();
 await page.getByRole('button',{name:'Review local setup',exact:true}).click();await page.getByRole('region',{name:'First-run setup',exact:true}).waitFor();assert.equal(await page.locator('.app-shell').count(),0);
 await page.getByRole('button',{name:'Back to unlock',exact:true}).click();assert(await page.getByLabel('Local access key',{exact:true}).evaluate(el=>el===document.activeElement));
 await page.getByLabel('Local access key',{exact:true}).fill('redesign-invalid-key');await unlock.click();
 await page.getByRole('alert').waitFor();assert.equal(await page.locator('.app-shell').count(),0);
 await page.screenshot({path:`${output}/${mode}-auth-error-390.png`});
 await page.getByLabel('Local access key',{exact:true}).fill(token);await unlock.click();await page.getByLabel('Message',{exact:true}).waitFor();
 assert.equal(await page.locator('.unlock-page').count(),0);assert.equal(await page.locator('.app-shell').count(),1);
 assert.equal(await page.evaluate(()=>Object.keys(localStorage).length+Object.keys(sessionStorage).length),0);
 await context.close();
 }
 assert.deepEqual(foreign,[]);assert.deepEqual(errors,[]);
 const result={suite:'real-focused-unlock',journeys:['J2','J9','J12'],measurements,foreign,errors,passed:['one_primary','no_locked_shell','no_locked_shortcuts','safe_copy','centered_card','real_rejected_key','setup_back_focus','real_owner_unlock','no_browser_storage'],full_redesign_verified:false};
 writeFileSync(output+'/result.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
}finally{await browser.close();}
