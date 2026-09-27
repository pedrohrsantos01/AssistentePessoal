import fs from 'node:fs';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import standaloneCode from 'ajv/dist/standalone/index.js';
const doc=JSON.parse(fs.readFileSync(new URL('../../contracts/primeiro-marco/openapi.json',import.meta.url),'utf8'));
function compatible(value) {
  if(Array.isArray(value)) return value.map(compatible);
  if(value && typeof value==='object') return Object.fromEntries(Object.entries(value).filter(([key])=>key!=='additionalProperties').map(([key,v])=>[key,compatible(v)]));
  return value;
}
const ajv=new Ajv2020({strict:false,code:{source:true,esm:false}});
addFormats(ajv);
ajv.addSchema({$id:'ritmo',components:compatible(doc.components)},'ritmo');
const names=['PushResponse','PullResponse','SnapshotManifest','SnapshotPage','ReceiptsResponse','SessionResponse','RefreshResponse'];
const validators=Object.fromEntries(names.map(name=>[name,'ritmo#/components/schemas/'+name]));
const target=new URL('../src/core/sync/generated/',import.meta.url);
fs.mkdirSync(target,{recursive:true});
fs.writeFileSync(new URL('validate.cjs',target),standaloneCode(ajv,validators));
fs.writeFileSync(new URL('validate.d.cts',target),names.map(name=>'export declare const '+name+': (data:unknown)=>boolean;').join('\n')+'\n');
