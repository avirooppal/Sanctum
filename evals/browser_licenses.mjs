/** Native licenses dialog checks against the actual served application. */
import {createRequire} from 'node:module';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const [packagePath,output] = process.argv.slice(2);
const require=createRequire(import.meta.url);
const {chromium}=require(packagePath);
const base=new URL(process.env.SANCTUM_BASE_URL ?? 'http://127.0.0.1:8769');
const notice=readFileSync('THIRD_PARTY_NOTICES.md','utf8');
const browser=await chromium.launch({headless:true});
const results=[];
mkdirSync('.sanctum/ui-licenses',{recursive:true});
try {
  for(const viewport of [{width:1440,height:900},{width:820,height:1180},{width:390,height:844}]) {
    const context=await browser.newContext({viewport,reducedMotion:'reduce'});
    const foreign=[];
    await context.route('**/*',route=>{
      const origin=new URL(route.request().url()).origin;
      if(origin !== base.origin){foreign.push(origin);return route.abort();}
      return route.continue();
    });
    const page=await context.newPage();
    const errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    await page.goto(base.href);
    const opener=page.getByRole('button',{name:'Licenses',exact:true});
    await opener.focus(); await page.keyboard.press('Enter');
    const dialog=page.getByRole('dialog',{name:'Licenses',exact:true});
    await dialog.waitFor({state:'visible'});
    assert.equal(await dialog.locator('pre').textContent(),notice);
    assert.equal(await page.evaluate(()=>document.activeElement?.getAttribute('aria-label')),'Close Licenses');
    const measurements=await dialog.evaluate(node=>({
      width:node.getBoundingClientRect().width,
      x:node.getBoundingClientRect().x,
      y:node.getBoundingClientRect().y,
      height:node.getBoundingClientRect().height,
      minimum_font_pixels:Math.min(...[...node.querySelectorAll('h2,button,pre')].map(el=>parseFloat(getComputedStyle(el).fontSize))),
      button_opacity:getComputedStyle(node.querySelector('button')).opacity,
      reduced_motion_transition:getComputedStyle(node.querySelector('button')).transitionDuration,
    }));
    assert(measurements.minimum_font_pixels >= 12);
    assert.equal(measurements.button_opacity,'1');
    assert.equal(measurements.reduced_motion_transition,'0s');
    assert(Math.abs(measurements.x-(viewport.width-measurements.width)/2) <= 1,'Dialog is not centered horizontally');
    assert(Math.abs(measurements.y-(viewport.height-measurements.height)/2) <= 1,'Dialog is not centered vertically');
    await page.screenshot({path:`.sanctum/ui-licenses/${viewport.width}.png`});
    await page.keyboard.press('Escape');
    await dialog.waitFor({state:'hidden'});
    assert.equal(await opener.evaluate(node=>document.activeElement === node),true);
    await opener.click(); await dialog.waitFor({state:'visible'});
    await page.getByRole('button',{name:'Close Licenses',exact:true}).click();
    await dialog.waitFor({state:'hidden'});
    const noOverflow=await page.evaluate(()=>document.documentElement.scrollWidth <= innerWidth);
    assert(noOverflow); assert.equal(foreign.length,0); assert.deepEqual(errors,[]);
    results.push({viewport,...measurements,notice_exact:true,keyboard_escape_and_focus_return:true,
      no_horizontal_overflow:noOverflow,foreign_http_origins:foreign,page_errors:errors});
    await context.close();
  }
  const report={suite:'real-browser-licenses-v1',notice_sha256:createHash('sha256').update(notice).digest('hex'),
    results,scope:'Native legal-notice dialog; not full UI fidelity or axe completion'};
  writeFileSync(output,JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify(report,null,2));
} finally {await browser.close();}
