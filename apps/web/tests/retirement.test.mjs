import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,readFileSync,readdirSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'../../..');
test('retired product entrypoints and reference environment cannot return',()=>{
 for(const name of ['apps/web/index.html','apps/web/website.html','apps/web/docs.html','tools/reference/runner.mjs']) assert(!existsSync(resolve(root,name)),name);
 const pkg=JSON.parse(readFileSync(resolve(root,'apps/web/package.json'),'utf8'));
 const allDeps={...pkg.dependencies,...pkg.devDependencies};
 for(const name of ['electron','framer-motion','lucide-react','@hermes/shared','@nous-research/ui','node-pty','xterm','@xterm/xterm','three','@react-three/fiber']) assert(!allDeps[name],name);
});
test('retained sources cannot import the old reference environment',()=>{
 const visit=dir=>{for(const entry of readdirSync(dir,{withFileTypes:true})){
  const path=resolve(dir,entry.name);if(entry.isDirectory())visit(path);
  else assert(!/\.sanctum\/upstream|tools\/reference/.test(readFileSync(path,'utf8')),path);
 }};visit(resolve(root,'apps/web/src'));
});
test('every archived UI-only path is absent from the active checkout',()=>{
 const manifest=JSON.parse(readFileSync(resolve(root,'docs/legacy-ui-removal.json'),'utf8'));
 const activeDocs = new Set(['docs/ui-deviations.md', 'docs/ui-fidelity.md', 'docs/ui-provenance.md', 'docs/ui-inventory.md']);
 for(const {path} of manifest.removed) {
  if (activeDocs.has(path)) continue;
  assert(!existsSync(resolve(root,path)),path);
 }
});
