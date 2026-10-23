// Dedicated artifact: never copies legacy probe HTML/manifest/bridges.
import { build } from 'vite';
import { generateSW } from 'workbox-build';
import { writeFile,copyFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { deflateSync } from 'node:zlib';
import { tokens } from '../../app/src/theme/tokens.ts';
import { pt } from '../src/i18n/pt-BR.ts';
await build({configFile:resolve('vite.iphone.config.ts')});
const root=resolve('dist-iphone'),t=tokens('dark','holo');
// A simple technical marker drawn from tokens; no new product logo or image dependency.
const rgb=hex=>[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16));
const crc=buffer=>{let c=0xffffffff;for(const b of buffer){c^=b;for(let n=0;n<8;n++)c=(c>>>1)^((c&1)?0xedb88320:0);}return (c^0xffffffff)>>>0;};
function chunk(type,data) {const label=Buffer.from(type),size=Buffer.alloc(4),checksum=Buffer.alloc(4);size.writeUInt32BE(data.length);checksum.writeUInt32BE(crc(Buffer.concat([label,data])));return Buffer.concat([size,label,data,checksum]);}
const glyph=['111101111','100100001','100101111','100101000','111101111'];
for(const size of [192,512]) {
  const raw=Buffer.alloc((size*3+1)*size),header=Buffer.alloc(13);header.writeUInt32BE(size);header.writeUInt32BE(size,4);header[8]=8;header[9]=2;
  const cell=Math.floor(size/t.space.large),left=Math.floor((size-glyph[0].length*cell)/2),top=Math.floor((size-glyph.length*cell)/2);
  for(let y=0;y<size;y++)for(let x=0;x<size;x++) {
    const column=Math.floor((x-left)/cell),row=Math.floor((y-top)/cell),on=glyph[row]?.[column]==='1';
    const color=rgb(on?t.accent.fill:t.bg.base);for(let c=0;c<3;c++)raw[y*(size*3+1)+1+x*3+c]=color[c];
  }
  await writeFile(resolve(root,`icon-${size}.png`),Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',header),chunk('IDAT',deflateSync(raw)),chunk('IEND',Buffer.alloc(0))]));
}
await writeFile(resolve(root,'manifest.webmanifest'),JSON.stringify({id:'/ensaio/',name:pt.iphone.title,short_name:pt.iphone.title,lang:'pt-BR',start_url:'/ensaio/',scope:'/ensaio/',display:'standalone',background_color:t.bg.base,theme_color:t.bg.base,icons:[192,512].map(size=>({src:`/ensaio/icon-${size}.png`,sizes:`${size}x${size}`,type:'image/png',purpose:'any'}))},null,2));
for(const name of ['chakra-petch-OFL.txt','jetbrains-mono-OFL.txt'])await copyFile(resolve('../app/assets/licenses',name),resolve(root,name));
const result=await generateSW({globDirectory:root,globPatterns:['**/*.{html,js,css,ttf,png,txt,webmanifest}'],swDest:resolve(root,'sw.js'),cacheId:'ritmo-02c',modifyURLPrefix:{'':'/ensaio/'},navigateFallback:'/ensaio/index.html',navigateFallbackAllowlist:[/^\/ensaio\/(?:index\.html)?$/],skipWaiting:false,clientsClaim:false,sourcemap:false});
if(result.warnings.length)throw new Error(result.warnings.join('\n'));
console.log(`Dedicated02c precache: ${result.count} assets; ${result.size} bytes`);
