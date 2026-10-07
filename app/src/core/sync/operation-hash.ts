import {sha256} from '@noble/hashes/sha2.js';
import {bytesToHex,utf8ToBytes} from '@noble/hashes/utils.js';
import type {Operation} from './protocol.ts';

type JsonValue=null|boolean|number|string|JsonValue[]|{[key:string]:JsonValue};
function canonical(value:JsonValue):string {
  if(typeof value==='number'&&!Number.isFinite(value)) throw new Error('invalid_operation_json');
  if(typeof value==='string') for(let i=0;i<value.length;i++) {
    const unit=value.charCodeAt(i);
    if(unit>=0xd800&&unit<=0xdbff) {
      const next=value.charCodeAt(++i);
      if(!(next>=0xdc00&&next<=0xdfff)) throw new Error('invalid_operation_json');
    } else if(unit>=0xdc00&&unit<=0xdfff) throw new Error('invalid_operation_json');
  }
  if(value===null||typeof value!=='object') return JSON.stringify(value);
  if(Array.isArray(value)) return '['+value.map(canonical).join(',')+']';
  return '{'+Object.keys(value).sort().map(key=>canonical(key)+':'+canonical(value[key]!)).join(',')+'}';
}
export function operationHash(operation:Operation):string {
  // Serialize exactly the wire envelope: absent optional properties are not null.
  const wire=JSON.parse(JSON.stringify(operation,(_key,value:unknown)=>{
    if(typeof value==='number'&&!Number.isFinite(value)) throw new Error('invalid_operation_json');
    return value;
  })) as JsonValue;
  return bytesToHex(sha256(utf8ToBytes(canonical(wire))));
}
