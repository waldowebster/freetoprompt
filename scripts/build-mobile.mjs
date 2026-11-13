import { mkdir, readFile, writeFile, copyFile, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

process.chdir(fileURLToPath(new URL('..', import.meta.url)));
await rm('dist', { recursive: true, force: true });
await mkdir('dist');
// Deliberate allowlist: credentials, repository files, and tooling never enter the app.
for (const file of ['app.js', 'styles.css', 'favicon.svg', 'favicon.ico', 'privacy.html', 'support.html', 'policy.css']) {
  await copyFile(file, `dist/${file}`);
}
const html = (await readFile('index.html', 'utf8'))
  .replace('<script src="app.js" defer></script>', '<script src="native.js" defer></script>\n  <script src="app.js" defer></script>');
await writeFile('dist/index.html', html);
await build({
  entryPoints: ['mobile/bridge.mjs'], outfile: 'dist/native.js', bundle: true,
  format: 'iife', target: ['safari15', 'chrome95'], minify: true, legalComments: 'eof',
});
console.log('Built offline mobile assets in dist/');
