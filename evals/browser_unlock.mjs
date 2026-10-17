import {createRequire} from 'node:module';import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';import assert from 'node:assert/strict';
const [pkg,keyFile,output]=process.argv.slice(2);const {chromium}=createRequire(import.meta.url)(pkg);
const {contrastRatio}=await import('../apps/web/build/tests/ui/color.js');
const base=process.env.SANCTUM_BASE_URL??'http://127.0.0.1:8769';const token=readFileSync(keyFile,'utf8').trim();mkdirSync(output,{recursive:true});
const browser=await chromium.launch({headless:true});const measurements=[],foreign=[],errors=[];
try{
 for(const mode of ['light','dark']){
 const context=await browser.newContext({colorScheme:mode,reducedMotion:'reduce'});
 await context.route('**/*',r=>{if(new URL(r.request().url()).origin!==base){foreign.push(new URL(r.request().url()).origin);return r.abort();}return r.continue();});
 await context.routeWebSocket('**/*',s=>{const u=new URL(s.url());u.protocol=u.protocol==='wss:'?'https:':'http:';if(u.origin!==base){foreign.push(u.origin);s.close();}else s.connectToServer();});
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
 for(const viewport of [{width:1440,height:900},{width:820,height:1180},{width:390,height:844}]){
 await page.setViewportSize(viewport);await page.goto(base);await page.evaluate(()=>document.fonts.ready);
 await page.waitForFunction(mode=>document.documentElement.dataset.mode===mode,mode);
 await page.locator('.startup-badge[data-startup-checks="passed"]').waitFor();
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
 const pairColors=await page.locator('.unlock-card').evaluate(el=>{
   const color=value=>{const canvas=document.createElement('canvas');canvas.width=canvas.height=1;const c=canvas.getContext('2d');c.fillStyle=value;c.fillRect(0,0,1,1);const [r,g,b]=c.getImageData(0,0,1,1).data;return `rgb(${r},${g},${b})`;};
   const card=getComputedStyle(el),hint=getComputedStyle(el.querySelector('.unlock-hint')),input=getComputedStyle(el.querySelector('input'));
   return {card:color(card.backgroundColor),ink:color(card.color),secondary:color(hint.color),border:color(input.borderColor),input:color(input.backgroundColor),focus:color(getComputedStyle(document.documentElement).getPropertyValue('--ui-focus')),
    transition:getComputedStyle(el.querySelector('.unlock-submit')).transitionDuration,received_at:el.querySelector('time')?.dateTime};
 });
 const pairs={body:contrastRatio(pairColors.ink,pairColors.card),hint:contrastRatio(pairColors.secondary,pairColors.card),input_boundary:contrastRatio(pairColors.border,pairColors.input),focus:contrastRatio(pairColors.focus,pairColors.card)};
 measurements.push({mode,viewport,dimensions,primary_contrast:ratio,target_height:colors.height,pairs,health_read_at:pairColors.received_at});
 assert(pairs.body>=4.5&&pairs.hint>=4.5);assert(pairs.input_boundary>=3&&pairs.focus>=3);assert.equal(pairColors.transition,'0s');
 }
 const unlock=page.getByRole('button',{name:'Unlock',exact:true});
 const healthUrl=base+'/healthz';await context.route(healthUrl,r=>r.abort('failed'));
 await page.locator('.startup-badge[data-startup-checks="unknown"]').waitFor();
 await page.screenshot({path:`${output}/${mode}-health-network-failure-390.png`});
 await context.unroute(healthUrl);await page.locator('.startup-badge[data-startup-checks="passed"]').waitFor();
 await page.getByText('Where do I find my key?',{exact:true}).click();await page.getByText('When Sanctum starts, it prints the location',{exact:false}).waitFor();
 await page.getByRole('button',{name:'Review local setup',exact:true}).click();await page.getByRole('region',{name:'First-run setup',exact:true}).waitFor();assert.equal(await page.locator('.app-shell').count(),0);
 await page.getByRole('button',{name:'Back to unlock',exact:true}).click();assert(await page.getByLabel('Local access key',{exact:true}).evaluate(el=>el===document.activeElement));
 await page.getByLabel('Local access key',{exact:true}).fill('redesign-invalid-key');await unlock.click();
 await page.getByRole('alert').waitFor();assert.equal(await page.getByLabel('Local access key',{exact:true}).getAttribute('aria-invalid'),'true');assert.equal(await page.locator('.app-shell').count(),0);
 await page.screenshot({path:`${output}/${mode}-auth-error-390.png`});
 await page.getByLabel('Local access key',{exact:true}).fill(token);await unlock.click();await page.getByLabel('Message',{exact:true}).waitFor();
 assert.equal(await page.locator('.unlock-page').count(),0);assert.equal(await page.locator('.app-shell').count(),1);
 assert.equal(await page.evaluate(()=>Object.keys(localStorage).length+Object.keys(sessionStorage).length),0);
 await page.setViewportSize({width:1440,height:900});await page.getByRole('button',{name:'Licenses',exact:true}).click();
 await page.waitForFunction(()=>document.querySelector('.ui-licenses')?.textContent.includes('Nous Research'));
 await page.keyboard.press('Escape');
 await context.close();
 }
 assert.deepEqual(foreign,[]);assert.deepEqual(errors,[]);
 const result={suite:'real-focused-unlock',journeys:['J2','J9','J12'],measurements,foreign,errors,passed:['one_primary','no_locked_shell','no_locked_shortcuts','safe_copy','centered_card','real_rejected_key','setup_back_focus','real_owner_unlock','no_browser_storage','health_fault_clears_passed','health_recovers','attribution_preserved','reduced_motion','field_error_linked'],full_redesign_verified:false};
 writeFileSync(output+'/result.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
 }catch(error){
 const safe=String(error.stack??error).split(token).join('[REDACTED]');
 writeFileSync(output+'/failed.json',JSON.stringify({reason:error.name,detail:safe,measurements,foreign,errors},null,2)+'\n');
 console.error(safe);process.exitCode=1;
}finally{await browser.close();}
