// UUIDv7 identity generation is independent from storage and runs before a transaction.
export function uuid7() {
  const bytes=crypto.getRandomValues(new Uint8Array(16));let timestamp=Date.now();
  for(let i=5;i>=0;i--) {bytes[i]=timestamp%256;timestamp=Math.floor(timestamp/256);}
  bytes[6]=(bytes[6]!&15)|112;bytes[8]=(bytes[8]!&63)|128;
  const hex=[...bytes].map(byte=>byte.toString(16).padStart(2,'0')).join('');
  return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
}
