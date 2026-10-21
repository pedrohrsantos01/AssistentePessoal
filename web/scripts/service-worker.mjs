import { generateSW } from 'workbox-build';
const result = await generateSW({
  globDirectory: 'dist', globPatterns: ['**/*.{html,js,css,ttf,png,txt,webmanifest}'],
  swDest: 'dist/sw.js', navigateFallback: '/index.html',
  navigateFallbackAllowlist: [/^\/probe\/(a|b)\/?$/],
  // No API runtime cache, background sync, forced activation, or domain writes.
  skipWaiting: false, clientsClaim: false, sourcemap: false,
});
if (result.warnings.length) throw new Error(result.warnings.join('\n'));
console.log(`Precache: ${result.count} assets, ${result.size} bytes`);
