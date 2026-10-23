import { defineConfig } from 'vite';
import { resolve } from 'node:path';
export default defineConfig({
  root:resolve(import.meta.dirname,'iphone'),base:'/ensaio/',publicDir:false,
  build:{target:'es2022',outDir:resolve(import.meta.dirname,'dist-iphone'),emptyOutDir:true},
});
