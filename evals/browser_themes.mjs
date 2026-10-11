/** Exercise actual in-memory theme controls; no reference fidelity claim. */
import {createRequire} from 'node:module';
import {writeFileSync,mkdirSync} from 'node:fs';
import assert from 'node:assert/strict';
const [packagePath,output]=process.argv.slice(2);
const require=createRequire(import.meta.url);const {chromium}=require(packagePath);
const base=new URL(process.env.SANCTUM_BASE_URL ?? 'http://127.0.0.1:8769');
const browser=await chromium.launch({headless:true});const samples=[];const systemChecks=[];
mkdirSync('.sanctum/ui-themes',{recursive:true});
try {
  for(const viewport of [{width:1440,height:900},{width:820,height:1180},{width:390,height:844}]){
    const context=await browser.newContext({viewport,reducedMotion:'reduce'});const foreign=[];
    await context.route('**/*',route=>{
      const origin=new URL(route.request().url()).origin;
      if(origin !== base.origin){foreign.push(origin);return route.abort();}
      return route.continue();
    });
    const page=await context.newPage();await page.goto(base.href);
    if(viewport.width < 640)await page.getByRole('button',{name:'Open navigation',exact:true}).click();
    assert.equal(await page.getByLabel('Theme', {exact:true}).count(),1,'Actual theme control missing');
    const ids=await page.getByLabel('Theme',{exact:true}).locator('option').evaluateAll(nodes=>nodes.map(n=>n.value));
    assert.equal(ids.length,16);
    for(const id of ids)for(const mode of ['light','dark']){
      await page.getByLabel('Theme',{exact:true}).selectOption(id);
      await page.getByLabel('Theme mode',{exact:true}).selectOption(mode);
      const sample=await page.evaluate(()=>{
        const walker=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);
        let node;let minimumFont=Infinity;let minimumOpacity=1;
        while((node=walker.nextNode())){
          const element=node.parentElement;
          if(!node.textContent.trim() || !element || element.closest('script,style') || !element.getClientRects().length)continue;
          minimumFont=Math.min(minimumFont,parseFloat(getComputedStyle(element).fontSize));
          for(let ancestor=element;ancestor;ancestor=ancestor.parentElement)minimumOpacity=Math.min(minimumOpacity,parseFloat(getComputedStyle(ancestor).opacity));
        }
        return {
        theme:document.documentElement.dataset.theme,
        mode:document.documentElement.dataset.mode,
        background:getComputedStyle(document.body).backgroundColor,
        sidebar:getComputedStyle(document.querySelector('aside')).backgroundColor,
        no_horizontal_overflow:document.documentElement.scrollWidth <= innerWidth,
        storage_entries:localStorage.length+sessionStorage.length,
        minimum_readable_font_pixels:minimumFont,minimum_text_ancestor_opacity:minimumOpacity,
      };});
      assert.equal(sample.theme,id);assert.equal(sample.mode,mode);
      assert(sample.no_horizontal_overflow);assert.equal(sample.storage_entries,0);
      assert(sample.minimum_readable_font_pixels >= 12);assert(sample.minimum_text_ancestor_opacity >= 0.7);
      if(id === 'sanctum' && mode === 'light')assert.equal(sample.sidebar,'rgb(246, 248, 250)');
      samples.push({viewport,...sample});
    }
    await page.getByLabel('Theme',{exact:true}).selectOption('sanctum');
    assert.equal(await page.getByLabel('Theme mode',{exact:true}).locator('option[value="system"]').count(),1,'System mode missing');
    await page.getByLabel('Theme mode',{exact:true}).selectOption('system');
    await page.emulateMedia({colorScheme:'dark'});
    await page.waitForFunction(()=>document.documentElement.dataset.mode === 'dark');
    const darkBackground=await page.evaluate(()=>getComputedStyle(document.body).backgroundColor);
    assert.equal(darkBackground,'rgb(13, 17, 23)');
    await page.emulateMedia({colorScheme:'light'});
    await page.waitForFunction(()=>document.documentElement.dataset.mode === 'light');
    const lightBackground=await page.evaluate(()=>getComputedStyle(document.body).backgroundColor);
    assert.equal(lightBackground,'rgb(255, 255, 255)');
    systemChecks.push({viewport,dark_background:darkBackground,light_background:lightBackground});
    await page.getByLabel('Theme mode',{exact:true}).selectOption('light');
    await page.screenshot({path:`.sanctum/ui-themes/${viewport.width}.png`});
    assert.equal(foreign.length,0);await context.close();
  }
  writeFileSync(output,JSON.stringify({suite:'real-browser-themes-v1',samples,system_mode_checks:systemChecks,
    foreign_http_origins:[],scope:'Color controls only; font tiers/fidelity/axe/WS blocking pending'},null,2)+'\n');
  console.log(JSON.stringify({samples:samples.length,system_mode_checks:systemChecks.length,foreign_http_origins:0}));
}finally{await browser.close();}
