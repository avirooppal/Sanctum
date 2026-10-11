/** Verify bundled faces actually decode/load under the unchanged gateway CSP. */
import {createRequire} from 'node:module';
import {writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const [packagePath,output]=process.argv.slice(2);
const require=createRequire(import.meta.url);const {chromium}=require(packagePath);
const base=new URL(process.env.SANCTUM_BASE_URL ?? 'http://127.0.0.1:8769');
const browser=await chromium.launch({headless:true});const context=await browser.newContext({reducedMotion:'reduce'});
const foreign=[];const fontResponses=[];
await context.route('**/*',route=>{
  const url=new URL(route.request().url());
  if(url.origin !== base.origin){foreign.push(url.origin);return route.abort();}
  return route.continue();
});
try{
  const page=await context.newPage();
  page.on('response',response=>{const url=new URL(response.url());if(url.pathname.startsWith('/fonts/'))fontResponses.push({path:url.pathname,status:response.status()});});
  const response=await page.goto(base.href);
  const csp=response.headers()['content-security-policy'];
  assert.equal(csp,"default-src 'self'; style-src 'self'; connect-src 'self'; media-src blob:; frame-ancestors 'none'");
  const loaded=await page.evaluate(async()=>{
    const families=['Spectral','Archivo','League Gothic','VT323','JetBrains Mono'];
    const result=[];
    for(const family of families){
      const faces=await document.fonts.load(`16px "${family}"`);
      if(!faces.length || faces.some(face=>face.status !== 'loaded'))throw Error(`Bundled face did not load: ${family}`);
      result.push({family,faces:faces.length,status:faces[0].status});
    }
    return result;
  });
  const tiers=await page.evaluate(()=>({
    wordmark:getComputedStyle(document.querySelector('.ui-wordmark')).fontFamily,
    page:getComputedStyle(document.querySelector('main h1')).fontFamily,
    technical:getComputedStyle(document.querySelector('.ui-licenses')).fontFamily,
    shell:getComputedStyle(document.querySelector('main')).fontFamily,
    no_horizontal_overflow:document.documentElement.scrollWidth <= innerWidth,
  }));
  assert(tiers.wordmark.includes('Spectral'));assert(tiers.page.includes('Archivo'));
  assert(tiers.technical.includes('JetBrains Mono'));assert(!tiers.shell.includes('Spectral'));
  assert(tiers.no_horizontal_overflow);assert.equal(foreign.length,0);
  assert.equal(fontResponses.length,5);assert(fontResponses.every(r=>r.status === 200));
  const report={suite:'real-browser-bundled-fonts-v1',loaded,tiers,font_responses:fontResponses,foreign_http_origins:foreign,csp};
  writeFileSync(output,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
}finally{await context.close();await browser.close();}
