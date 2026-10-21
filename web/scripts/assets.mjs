import { mkdir, copyFile } from 'node:fs/promises';
// Reuse the exact licensed native font files; no font CDN or Expo runtime in the web bundle.
const target = new URL('../public/assets/', import.meta.url);
await mkdir(target, { recursive: true });
for (const [family, weight, name] of [
  ['chakra-petch', '400Regular', 'ChakraPetch_400Regular'],
  ['chakra-petch', '600SemiBold', 'ChakraPetch_600SemiBold'],
  ['jetbrains-mono', '400Regular', 'JetBrainsMono_400Regular'],
]) {
  await copyFile(new URL(`../../app/node_modules/@expo-google-fonts/${family}/${weight}/${name}.ttf`, import.meta.url), new URL(`${name}.ttf`, target));
}
for (const name of ['check', 'habits', 'briefing']) {
  await copyFile(new URL(`../../app/assets/icons/${name}.png`, import.meta.url), new URL(`${name}.png`, target));
}
for (const name of ['chakra-petch-OFL.txt', 'jetbrains-mono-OFL.txt']) {
  await copyFile(new URL(`../../app/assets/licenses/${name}`, import.meta.url), new URL(name, target));
}
