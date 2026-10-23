import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import doc from '../../../contracts/pwa-m1/openapi.json';
// Match the native client's forward compatibility: optional response fields are tolerated.
// Required fields and known effect variants remain validated. Local records stay strict.
function compatible(value:unknown):unknown {
  if(Array.isArray(value)) return value.map(compatible);
  if(value&&typeof value==='object') return Object.fromEntries(Object.entries(value).filter(([key])=>key!=='additionalProperties').map(([key,item])=>[key,compatible(item)]));
  return value;
}
const ajv=new Ajv2020({strict:false});addFormats(ajv);ajv.addSchema({$id:'wire',components:compatible(doc.components)},'wire');
export function checkWire(name:string,value:unknown) {
  if(!ajv.getSchema(`wire#/components/schemas/${name}`)?.(value)) throw new Error('invalid_remote_response');
}


type Schema={$ref?:string;oneOf?:Schema[];anyOf?:Schema[];properties?:Record<string,Schema>;items?:Schema};
const schemas=doc.components.schemas as unknown as Record<string,Schema>;
const branches=new WeakMap<Schema,ReturnType<typeof ajv.compile>>();
function absolute(value:unknown):unknown {
  if(Array.isArray(value)) return value.map(absolute);
  if(value&&typeof value==='object') return Object.fromEntries(Object.entries(value).filter(([key])=>key!=='additionalProperties').map(([key,item])=>[key,key==='$ref'&&typeof item==='string'&&item.startsWith('#/')?'wire'+item:absolute(item)]));
  return value;
}
function known(value:unknown,schema:Schema):unknown {
  if(schema.$ref) return known(value,schemas[schema.$ref.split('/').at(-1)!]!);
  const alternatives=schema.oneOf??schema.anyOf;
  if(alternatives) {
    const branch=alternatives.find(candidate=>{
      let validator=branches.get(candidate);
      if(!validator) {validator=ajv.compile(absolute(candidate) as Parameters<typeof ajv.compile>[0]);branches.set(candidate,validator);}
      return validator(value);
    });
    if(!branch) throw new Error('invalid_remote_response');return known(value,branch);
  }
  if(Array.isArray(value)&&schema.items) return value.map(item=>known(item,schema.items!));
  if(value&&typeof value==='object'&&schema.properties) return Object.fromEntries(Object.entries(value).filter(([key])=>Object.hasOwn(schema.properties!,key)).map(([key,item])=>[key,known(item,schema.properties![key]!)]));
  return value;
}
export function decodeWire<T>(name:string,value:unknown):T {
  checkWire(name,value);
  // Drop unknown optional metadata after validation, so strict local records remain in V1.
  // Known required effects, account fields and receipt hashes are never dropped.
  return known(value,schemas[name]!) as T;
}
