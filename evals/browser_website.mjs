/** Public website against the real gateway; no owner token is required. */
import {createRequire} from 'node:module';
import {writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {gzipSync} from 'node:zlib';
const [packagePath,output]=process.argv.slice(2);
const {chromium}=createRequire(import.meta.url)(packagePath);
const browser=await chromium.launch({headless:true});
const base=process.env.SANCTUM_BASE_URL??'http://127.0.0.1:8769';
const foreign=[],sockets=[],errors=[],measurements=[];
try {
  for(const [width,height] of [[1440,900],[820,1180],[390,844]]) {
    const context=await browser.newContext({viewport:{width,height},reducedMotion:'reduce'});
    await context.route('**/*',route=>{
      if(new URL(route.request().url()).origin!==new URL(base).origin){foreign.push(route.request().url());return route.abort();}
      return route.continue();
    });
    await context.routeWebSocket('**/*',ws=>{sockets.push(ws.url());ws.close();});
    const page=await context.newPage();const sizes=[];let collecting=true;
    page.on('response',response=>{if(collecting&&/\.(?:js|ttf)(?:\?|$)/.test(response.url()))sizes.push(response.body().then(body=>({url:new URL(response.url()).pathname,bytes:body.length,gzip:gzipSync(body).length})));});
    page.on('pageerror',e=>errors.push(e.message));
    const response=await page.goto(`${base}/website.html`);
    assert.equal(response.status(),200);
    assert.match(response.headers()['content-security-policy'],/connect-src 'self'/);
    await page.evaluate(()=>document.fonts.ready);
    await page.getByRole('heading',{name:'Think it through.',exact:true}).waitFor();
    assert.equal(await page.locator('#landing-root>section').count(),5);
    assert((await page.locator('h1').evaluate(el=>getComputedStyle(el).fontFamily)).includes('Instrument Serif'));
    assert.equal(await page.locator('body').evaluate(el=>getComputedStyle(el).backgroundColor),'rgb(0, 0, 0)');
    await page.keyboard.press('Tab');
    assert.equal(await page.locator(':focus').textContent(),'Skip to content');
    await page.keyboard.press('Enter');
    for(const summary of await page.locator('summary').all()) {
      await summary.click();
      assert.equal(await summary.evaluate(el=>el.parentElement.open),true);
      await summary.click();
    }
    for(const href of await page.locator('a').evaluateAll(links=>links.map(a=>a.getAttribute('href')))) {
      if(href.startsWith('#'))assert.equal(await page.locator(href).count(),1,`missing target ${href}`);
      else {
        assert(['/','/docs.html'].includes(href),'only application and bundled documentation routes are allowed');
        if(href==='/docs.html') {
          const docs=await page.request.get(`${base}${href}`);
          assert.equal(docs.status(),200);
          assert.match(await docs.text(),/<title>Sanctum Documentation/);
        }
      }
    }
    const measure=await page.evaluate(()=>({
      viewport:innerWidth,scroll:document.documentElement.scrollWidth,
      scripts:document.scripts.length,storage:localStorage.length+sessionStorage.length,
      motion:getComputedStyle(document.documentElement).scrollBehavior,
    }));
    assert(measure.scroll<=width,`overflow at ${width}`);
    assert.equal(measure.scripts,1);assert.equal(measure.storage,0);assert.equal(measure.motion,'auto');
    assert(await page.locator('script').evaluateAll(nodes=>nodes.every(node=>node.type==='module'&&new URL(node.src).origin===location.origin&&!node.textContent.trim())),'only a same-origin module is admitted by ADR0083');
    await page.evaluate(()=>scrollTo(0,0));
    await page.screenshot({path:output.replace(/\.json$/,`-${width}.png`),fullPage:true});
    await page.screenshot({path:output.replace(/\.json$/,`-hero-${width}.png`)});
    collecting=false;const resources=await Promise.all(sizes);const fontBytes=resources.filter(r=>r.url.endsWith('.ttf')).reduce((sum,r)=>sum+r.bytes,0);const jsGzip=resources.filter(r=>r.url.endsWith('.js')).reduce((sum,r)=>sum+r.gzip,0);
    assert(fontBytes>0&&fontBytes<=204800,'landing fonts must meet ADR0083 budget');assert(jsGzip>0&&jsGzip<=245760,'landing JS must meet ADR0083 budget');
    measurements.push({width,height,...measure,font_bytes:fontBytes,js_gzip_bytes:jsGzip});
    await page.getByRole('link',{name:'Open your workspace',exact:false}).click();
    await page.getByLabel('Local access key').waitFor();
    await context.close();
  }
  for(const width of [1440,390]){
    const context=await browser.newContext({viewport:{width,height:900},reducedMotion:'no-preference'});
    await context.route('**/*',route=>{if(new URL(route.request().url()).origin!==new URL(base).origin){foreign.push(route.request().url());return route.abort();}return route.continue();});
    await context.routeWebSocket('**/*',ws=>{sockets.push(ws.url());ws.close();});
    const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));await page.goto(`${base}/website.html`);await page.getByRole('heading',{name:'Think it through.',exact:true}).waitFor();await page.evaluate(()=>document.fonts.ready);
    for(const reveal of await page.locator('#landing-root div[style]').all()){
      await reveal.scrollIntoViewIfNeeded();await page.waitForFunction(node=>Number(getComputedStyle(node).opacity)>.99,await reveal.elementHandle());
    }
    const sections=page.locator('#landing-root>section');
    for(let i=0;i<await sections.count();i++)await sections.nth(i).screenshot({path:output.replace(/\.json$/,`-normal-${width}-${i}.png`)});
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await context.close();
  }
  assert.deepEqual(foreign,[]);assert.deepEqual(sockets,[]);assert.deepEqual(errors,[]);
  const result={suite:'public-website-v2',measurements,normal_motion_viewports:[1440,390],foreign,sockets,errors,passed:true,fidelity_verified:false};
  writeFileSync(output,JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result,null,2));
} finally {await browser.close();}
