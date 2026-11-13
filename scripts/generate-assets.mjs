import { readFile, writeFile, mkdir, readdir, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

process.chdir(fileURLToPath(new URL('..', import.meta.url)));
const mark = await readFile('favicon.svg', 'utf8');
function artwork(size, fraction = 0.56, transparent = false) {
  const inset = size * (1 - fraction) / 2;
  const nested = mark.replace('<svg ', `<svg x="${inset}" y="${inset}" width="${size * fraction}" height="${size * fraction}" `);
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">${transparent ? '' : `<rect width="100%" height="100%" fill="#050817"/>`}${nested}</svg>`);
}
await mkdir('store/assets', { recursive: true });
await sharp(artwork(1024)).removeAlpha().png().toFile('store/assets/app-icon-1024.png');
await sharp(artwork(512)).removeAlpha().png().toFile('store/assets/play-icon-512.png');
await sharp(artwork(1024)).removeAlpha().png().toFile('ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png');
for (const file of ['splash-2732x2732.png', 'splash-2732x2732-1.png', 'splash-2732x2732-2.png']) {
  await sharp(artwork(2732, 0.13)).removeAlpha().png().toFile(`ios/App/App/Assets.xcassets/Splash.imageset/${file}`);
}
const res = 'android/app/src/main/res';
for (const [density, scale] of Object.entries({ mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 })) {
  for (const name of ['ic_launcher', 'ic_launcher_round']) {
    const size = 48 * scale;
    const shape = name.endsWith('_round')
      ? `<circle cx="${size / 2}" cy="${size / 2}" r="${size * 0.47}" fill="white"/>`
      : `<rect x="${size * 0.03}" y="${size * 0.03}" width="${size * 0.94}" height="${size * 0.94}" rx="${size * 0.2}" fill="white"/>`;
    const mask = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">${shape}</svg>`);
    await sharp(artwork(size)).composite([{ input: mask, blend: 'dest-in' }]).png().toFile(`${res}/mipmap-${density}/${name}.png`);
  }
  await sharp(artwork(108 * scale, 0.46, true)).png().toFile(`${res}/mipmap-${density}/ic_launcher_foreground.png`);
}
for (const dir of await readdir(res)) {
  if (!dir.startsWith('drawable')) continue;
  for (const file of await readdir(`${res}/${dir}`)) {
    if (file !== 'splash.png') continue;
    // The native launch theme uses a scalable layer list instead of template bitmaps.
    await rm(`${res}/${dir}/${file}`);
  }
}
await writeFile(`${res}/values/ic_launcher_background.xml`, '<?xml version="1.0" encoding="utf-8"?>\n<resources><color name="ic_launcher_background">#050817</color></resources>\n');
console.log('Generated iOS, Android, and store icons from favicon.svg');
