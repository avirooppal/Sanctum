/** Actual responsive shell geometry and keyboard behavior, without mock APIs. */
import {createRequire} from 'node:module';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import assert from 'node:assert/strict';
const [packagePath,output,tokenFile=process.env.SANCTUM_TOKEN_FILE]=process.argv.slice(2);
if(!tokenFile)throw Error('An owner token FILE is required for authenticated UI verification');
const key=readFileSync(tokenFile,'utf8').trim();
const require=createRequire(import.meta.url);const {chromium}=require(packagePath);
const base=new URL(process.env.SANCTUM_BASE_URL ?? 'http://127.0.0.1:8769');
const browser=await chromium.launch({headless:true});const results=[];let resizeState;
mkdirSync('.sanctum/ui-shell',{recursive:true});
const apiContext=await browser.newContext();let originalPreferences;
async function unlock(page){
 assert.equal(await page.locator('.app-shell').count(),0);
 await page.getByLabel('Local access key',{exact:true}).fill(key);
 await page.getByRole('button',{name:'Unlock',exact:true}).click();
 await page.getByLabel('Message',{exact:true}).waitFor();
}
try{
 originalPreferences=(await (await apiContext.request.get(new URL('/v1/preferences',base).href,{headers:{Authorization:`Bearer ${key}`}})).json()).preferences;
  for(const viewport of [{width:1440,height:900},{width:820,height:1180},{width:390,height:844},{width:639,height:900},{width:640,height:900}]){
    const context=await browser.newContext({viewport,reducedMotion:'reduce'});const page=await context.newPage();
    await page.goto(base.href);
    const loginBottom=await page.getByLabel('Local access key',{exact:true}).evaluate(el=>el.getBoundingClientRect().bottom);
    await unlock(page);
    const metrics=await page.evaluate(loginBottom=>({
      sidebar_width:document.querySelector('aside').getBoundingClientRect().width,
      login_bottom:loginBottom,
      no_horizontal_overflow:document.documentElement.scrollWidth <= innerWidth,
      document_height:document.documentElement.scrollHeight,
    }),loginBottom);
    assert(metrics.no_horizontal_overflow);assert(metrics.login_bottom <= viewport.height);
    await page.screenshot({path:`.sanctum/ui-shell/${viewport.width}.png`});
    assert(metrics.document_height <= viewport.height+1,'Outer document grows beyond viewport');
    if(viewport.width >= 640){assert(Math.abs(metrics.sidebar_width-237) <= 1);}
    else{
      assert.equal(await page.locator('aside').isVisible(),false);
      const opener=page.getByRole('button',{name:'Open navigation',exact:true});
      await opener.focus();await page.keyboard.press('Enter');
      const navigation=page.getByRole('dialog',{name:'Navigation',exact:true});await navigation.waitFor({state:'visible'});
      await page.screenshot({path:`.sanctum/ui-shell/${viewport.width}-navigation.png`});
      assert.equal(await page.locator('main').evaluate(node=>node.inert),true);
      await page.keyboard.press('Shift+Tab');
      assert.equal(await navigation.evaluate(node=>node.contains(document.activeElement)),true);
      await page.keyboard.press('Escape');await navigation.waitFor({state:'hidden'});
      assert.equal(await opener.evaluate(node=>document.activeElement===node),true);
      assert.equal(await page.locator('main').evaluate(node=>node.inert),false);
    }
    results.push({viewport,...metrics});await context.close();
  }
  const context=await browser.newContext({viewport:{width:1440,height:900},reducedMotion:'reduce'});
  const page=await context.newPage();await page.goto(base.href);await unlock(page);
  await page.getByLabel('Theme',{exact:true}).selectOption('rose');
  await page.setViewportSize({width:390,height:844});
  await page.getByRole('button',{name:'Open navigation',exact:true}).click();
  assert.equal(await page.getByLabel('Theme',{exact:true}).inputValue(),'rose');
  assert.equal(await page.getByLabel('Theme',{exact:true}).count(),1);
  await page.keyboard.press('Escape');
  await page.setViewportSize({width:1440,height:900});
  await page.locator('aside').waitFor({state:'visible'});
  assert.equal(await page.getByLabel('Theme',{exact:true}).inputValue(),'rose');
  resizeState={desktop_mobile_desktop:true,theme_retained:'rose',sidebar_instances:await page.locator('aside').count()};
  await context.close();
  writeFileSync(output,JSON.stringify({suite:'real-browser-shell-v1',results,resize_state:resizeState},null,2)+'\n');
  console.log(JSON.stringify({viewports:results.length,passed:true}));
}catch(error){console.error(String(error.stack??error).split(key).join('[REDACTED]'));process.exitCode=1;}
finally{
 if(originalPreferences)await apiContext.request.post(new URL('/v1/preferences',base).href,{headers:{Authorization:`Bearer ${key}`},data:originalPreferences});
 await browser.close();
}
