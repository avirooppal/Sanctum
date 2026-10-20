import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {writeFileSync} from 'node:fs';
import React from '../apps/web/node_modules/react/index.js';
import {renderToStaticMarkup} from '../apps/web/node_modules/react-dom/server.node.js';
import {SafeMarkdown} from '../apps/web/build/tests/ui/SafeMarkdown.js';
const [packagePath, output] = process.argv.slice(2);
const require=createRequire(import.meta.url);
const {chromium}=require(packagePath);
const browser=await chromium.launch({headless:true});
const record={suite:'retired-ui-and-markdown',passed:[],release_complete:false};
try {
 const page=await browser.newPage();
 for(const path of ['/', '/index.html', '/website.html', '/docs.html','/assets/missing.js']) {
  const response=await page.request.get((process.env.SANCTUM_BASE_URL||'http://127.0.0.1:8769')+path);
  assert.equal(response.status(),404,path); record.passed.push('retired '+path);
 }
 const base=process.env.SANCTUM_BASE_URL||'http://127.0.0.1:8769';
 assert.equal((await page.request.get(base+'/healthz')).status(),200);
 assert.equal((await page.request.get(base+'/v1/models')).status(),401);
 record.passed.push('health and API authentication preserved');
 const requests=[]; page.on('request',r=>requests.push(r.url()));
 const hostile='<script>window.injected=true</script>\n<img src=x onerror="window.injected=true">\n![remote](https://foreign.invalid/image)\n[bad](javascript:alert(1))\n[safe](https://example.com)\n\n```html\n<script>bad()</script>\n```';
 await page.setContent(renderToStaticMarkup(React.createElement(SafeMarkdown,{content:hostile})));
 assert.equal(await page.locator('script,img,iframe').count(),0);
 assert.equal(await page.evaluate(()=>window.injected),undefined);
 assert.equal(await page.locator('a[href^="javascript:"]').count(),0);
 assert.deepEqual(requests,[]);
 record.passed.push('browser Markdown injection and passive network denial');
} catch(error) {record.failed=String(error);throw error;}
finally {await browser.close();writeFileSync(output,JSON.stringify(record,null,2)+'\n');}
