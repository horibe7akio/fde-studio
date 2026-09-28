import { defineConfig } from 'vite';
import { readdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// Every page of the 「3Dでわかる」 series is an HTML file: the portal at the root, and one
// folder per explainer. New folders are picked up without editing this file.
const root = fileURLToPath(new URL('.', import.meta.url));
const skip = new Set(['node_modules', 'dist', 'public', 'src', 'tools', 'output', 'presentations', '_evidence', '_versions', '.git', '.github', '.claude', '.playwright-cli', 'assets']);
const input = { main: `${root}index.html` };
for (const dir of readdirSync(root, { withFileTypes: true })) {
  if (!dir.isDirectory() || skip.has(dir.name) || dir.name.startsWith('.')) continue;
  for (const file of readdirSync(`${root}${dir.name}`)) {
    if (file.endsWith('.html')) input[`${dir.name}/${file.replace(/\.html$/, '')}`] = `${root}${dir.name}/${file}`;
  }
}
if (!existsSync(input.main)) throw new Error('index.html (portal) is missing');

export default defineConfig({
  build: { rollupOptions: { input } },
});
