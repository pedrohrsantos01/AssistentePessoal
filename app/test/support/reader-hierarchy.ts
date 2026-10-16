export type ReaderNode=Record<string,string>;
const decode=(s:string)=>s.replace(/&#(?:x([0-9a-f]+)|([0-9]+));/gi,(_m,h:string|undefined,d:string|undefined)=>String.fromCodePoint(Number.parseInt(h??d!,h?16:10))).replace(/&quot;/g,'"').replace(/&apos;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&');
// Android XmlSerializer may choose either delimiter, notably for JSON diagnostics containing quotes.
const attributes=(s:string):ReaderNode=>Object.fromEntries([...s.matchAll(/([\w-]+)=(["'])([\s\S]*?)\2/g)].map(m=>[m[1]!,decode(m[3]!)]));
export function parseReaderHierarchy(xml:string){
 const allNodes=[...xml.matchAll(/<node\s+([^>]+)>?/g)].map(m=>attributes(m[1]!));
 return {nodes:allNodes.filter(n=>n['topmost-window']!=='false'),allNodes,windows:[...xml.matchAll(/<window\s+([^>]+)>?/g)].map(m=>attributes(m[1]!)),meta:attributes(xml.match(/<hierarchy\s+([^>]+)>/)?.[1]??'')};
}
