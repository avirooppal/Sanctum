/** Compare local dev-only font specimens. Never load upstream application code. */
import {createRequire} from 'node:module';
import {readFileSync, writeFileSync, mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {join} from 'node:path';
import assert from 'node:assert/strict';
import {changedPixelFraction} from './ui_font_metrics.mjs';

const [playwrightPath, referenceDirectory, candidateDirectory, outputDirectory] = process.argv.slice(2);
assert(playwrightPath && referenceDirectory && candidateDirectory && outputDirectory,
  'Usage: node evals/ui_font_compare.mjs PLAYWRIGHT_PACKAGE REFERENCE_FONTS CANDIDATES OUTPUT');
const require = createRequire(import.meta.url);
const {chromium} = require(playwrightPath);
const browser = await chromium.launch({headless:true, args:['--disable-background-networking']});
const context = await browser.newContext({viewport:{width:1440,height:900}, reducedMotion:'reduce'});
const foreignAttempts = [];
await context.route('**/*', route => {
  foreignAttempts.push(route.request().url());
  return route.abort();
});
const fonts = [
  ['Collapse', join(referenceDirectory,'Collapse-Regular.woff2')],
  ['RulesExpanded', join(referenceDirectory,'RulesExpanded-Regular.woff2')],
  ['RulesCompressed', join(referenceDirectory,'RulesCompressed-Regular.woff2')],
  ['Mondwest', join(referenceDirectory,'Mondwest-Regular.woff2')],
  ['Neuebit', join(referenceDirectory,'Neuebit-Bold.woff2')],
  ['Inter', join(candidateDirectory,'inter.ttf')],
  ['Archivo', join(candidateDirectory,'archivo.ttf')],
  ['VT323', join(candidateDirectory,'vt323.ttf')],
  ['Pixelify', join(candidateDirectory,'pixelifysans.ttf')],
  ['JetBrainsMono', join(candidateDirectory,'jetbrainsmono.ttf')],
  ['Spectral', join(candidateDirectory,'spectral.ttf')],
  ['SourceSerif', join(candidateDirectory,'sourceserif4.ttf')],
  ['InstrumentSerif', join(candidateDirectory,'instrumentserif.ttf')],
  ['BarlowCondensed', join(candidateDirectory,'barlowcondensed.ttf')],
  ['LeagueGothic', join(candidateDirectory,'leaguegothic.ttf')],
].map(([family,path]) => {
  const bytes = readFileSync(path);
  return {family, path, sha256:createHash('sha256').update(bytes).digest('hex'), bytes:bytes.toString('base64')};
});
const comparisons = [
  ['Collapse','Inter','normal'],
  ['Collapse','InstrumentSerif','normal'],
  ['Collapse','Spectral','normal'],
  ['RulesExpanded','Archivo','expanded'],
  ['RulesExpanded','Inter','normal'],
  ['RulesCompressed','Archivo','condensed'],
  ['RulesCompressed','Inter','normal'],
  ['RulesCompressed','BarlowCondensed','normal'],
  ['RulesCompressed','LeagueGothic','normal'],
  ['Mondwest','VT323','normal'],
  ['Mondwest','Pixelify','normal'],
  ['Mondwest','Spectral','normal'],
  ['Mondwest','SourceSerif','normal'],
  ['Neuebit','VT323','normal'],
  ['Neuebit','Pixelify','normal'],
];
mkdirSync(outputDirectory,{recursive:true});
try {
  const page = await context.newPage();
  await page.setContent('<!doctype html><html><head><meta charset="UTF-8"></head><body></body></html>');
  await page.evaluate(async entries => {
    for (const entry of entries) {
      const bytes = Uint8Array.from(atob(entry.bytes), c => c.charCodeAt(0));
      const face = new FontFace(entry.family, bytes,
        entry.family === 'Archivo' ? {weight:'100 900',stretch:'62% 125%'} : {});
      await face.load();
      document.fonts.add(face);
    }
  },fonts);
  const rows = await page.evaluate(({comparisons, metric}) => {
    const difference = (0,eval)(`(${metric})`);
    document.body.style.cssText = 'background:#fff;color:#111;margin:24px;font:14px system-ui';
    const heading = document.createElement('h1');
    heading.textContent = 'Local font comparison — reference / candidate';
    document.body.append(heading);
    const results = [];
    for (const [reference,candidate,stretch] of comparisons) {
      const title = document.createElement('h2');
      title.textContent = `${reference} / ${candidate} (${stretch})`;
      const section = document.createElement('section');
      section.append(title);
      document.body.append(section);
      for (const size of [12,14,18,24]) {
        for (const weight of [400,700]) {
          const text = 'Knowledge / Models 0123456789';
          const row = document.createElement('div');
          row.style.cssText = 'display:flex;gap:12px;margin:2px 0';
          const rasters = [];
          const widths = [];
          for (const [family,fontStretch] of [[reference,'normal'],[candidate,stretch]]) {
            const canvas = document.createElement('canvas');
            canvas.width=600; canvas.height=64;
            const ctx = canvas.getContext('2d');
            ctx.fillStyle='#fff'; ctx.fillRect(0,0,600,64);
            ctx.fillStyle='#111'; ctx.font=`${weight} ${size}px "${family}"`;
            ctx.fontStretch=fontStretch;
            const width = ctx.measureText(text).width;
            if (width > 590) throw Error('Font specimen overflows the fixed canvas');
            ctx.fillText(text,4,42);
            widths.push(width);
            rasters.push(ctx.getImageData(0,0,600,64).data);
            row.append(canvas);
          }
          section.append(row);
          results.push({reference,candidate,stretch,size,weight,reference_width:widths[0],
            candidate_width:widths[1],relative_width_difference:Math.abs(widths[1]-widths[0])/widths[0],
            changed_pixel_fraction:difference(rasters[0],rasters[1])});
        }
      }
    }
    return results;
  },{comparisons,metric:changedPixelFraction.toString()});
  await page.screenshot({path:join(outputDirectory,'font-specimens.png'),fullPage:true});
  for (let i=0;i<comparisons.length;i++) {
    const [reference,candidate] = comparisons[i];
    await page.locator('section').nth(i).screenshot({
      path:join(outputDirectory,`${reference}-${candidate}.png`)});
  }
  assert.equal(foreignAttempts.length,0,'Font comparison attempted network access');
  const report = {suite:'ui-font-comparison-v1',diagnostic_only:true,
    fonts:fonts.map(({bytes,...entry}) => entry),foreign_attempts:foreignAttempts,rows};
  writeFileSync(join(outputDirectory,'font-comparison.json'),JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify({comparisons:rows.length,foreign_attempts:foreignAttempts.length,
    output:join(outputDirectory,'font-comparison.json')}));
} finally {
  await context.close();
  await browser.close();
}
