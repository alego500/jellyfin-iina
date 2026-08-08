import { execFileSync } from 'node:child_process';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const legacy = process.argv.includes('--legacy');
const targetAbi = legacy ? '10.7.7.0' : '10.11.11.0';
const buildDirectory = legacy ? 'plugin-10.7.7' : 'plugin';
const archiveName = legacy
  ? 'JellyfinIina_0.1.1.0_jf10.7.7.zip'
  : 'JellyfinIina_0.1.1.0.zip';
const staging = path.join(root, 'artifacts', legacy ? 'package-10.7.7' : 'package');
const outputDirectory = path.join(root, 'out');
const output = path.join(outputDirectory, archiveName);

await rm(staging, { recursive: true, force: true });
await mkdir(staging, { recursive: true });
await mkdir(outputDirectory, { recursive: true });
await rm(output, { force: true });

const meta = {
  category: 'General',
  changelog: 'Prevent the launcher from overriding playback position; resume is delegated to the recommended IINA Jellyfin companion plugin.',
  description: 'Adds an Open in IINA action to video More menus across Jellyfin Web.',
  guid: '1586dd40-c469-4ed5-a71d-714b745adbb9',
  name: 'IINA Launcher',
  overview: 'Open Jellyfin videos directly in IINA',
  owner: 'yxwyoyoyo',
  targetAbi,
  timestamp: new Date().toISOString(),
  version: '0.1.1.0'
};

await writeFile(path.join(staging, 'meta.json'), `${JSON.stringify(meta, null, 2)}\n`);
execFileSync('cp', [path.join(root, 'artifacts', buildDirectory, 'Jellyfin.Plugin.Iina.dll'), staging]);
execFileSync('zip', ['-q', '-j', output, path.join(staging, 'meta.json'), path.join(staging, 'Jellyfin.Plugin.Iina.dll')]);

console.log(output);
