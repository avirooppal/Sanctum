/** First-party built-copy gate;attribution is isolated,not removed. */
import {readdirSync,readFileSync} from 'node:fs';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=new URL('../dist/',import.meta.url);
function files(dir){return readdirSync(dir,{withFileTypes:true}).flatMap(entry=>entry.isDirectory()?files(join(dir,entry.name)):[join(dir,entry.name)]);}
const all=files(fileURLToPath(root));
const notices=all.filter(path=>/THIRD_PARTY_NOTICES-[\w-]+\.js$/.test(path));
if(notices.length!==1)throw Error('One dedicated attribution chunk is required');
const forbidden=/\b(?:hermes|nous)\b|100%\s+(?:on your|local|private)|zero\s+(?:cloud\s+|external\s+)?telemetry|total privacy|never leave loopback/i;
for(const path of all.filter(path=>/\.(js|html)$/.test(path)&&!notices.includes(path))){
 if(forbidden.test(readFileSync(path,'utf8')))throw Error('Unreviewed branding/privacy copy in '+path.split(/[\\/]/).at(-1));
}
console.log('PASS: built app/site copy;attribution retained in its dedicated chunk');
