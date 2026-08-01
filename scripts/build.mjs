import { mkdir } from 'node:fs/promises';
import { build } from 'esbuild';

await mkdir(new URL('../Jellyfin.Plugin.Iina/Web', import.meta.url), { recursive: true });
await build({
  entryPoints: [new URL('../src/main.js', import.meta.url).pathname],
  outfile: new URL('../Jellyfin.Plugin.Iina/Web/client.js', import.meta.url).pathname,
  bundle: true,
  format: 'iife',
  target: ['safari15', 'chrome100', 'firefox100'],
  legalComments: 'none',
  minify: false
});
