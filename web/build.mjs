import { build } from 'esbuild';
import { cp, mkdir, writeFile, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';

async function go() {
  await mkdir('dist', { recursive: true });
  console.log('[build] bundling JS...');
  const r = await build({
    entryPoints: ['src/main.tsx'],
    bundle: true,
    outfile: 'dist/app.js',
    format: 'esm',
    target: ['es2020'],
    minify: true,
    sourcemap: false,
    jsx: 'automatic',
    loader: { '.png': 'file', '.svg': 'file' },
    define: { 'process.env.NODE_ENV': '"production"' },
    alias: { '@': './src' },
    logLevel: 'info',
    treeShaking: true,
    legalComments: 'none',
  });
  if (r.errors.length) { console.error(r.errors); process.exit(1); }
  console.log('[build] bundling CSS...');
  const css = await build({
    entryPoints: ['src/index.css'],
    bundle: true,
    outfile: 'dist/app.css',
    minify: true,
    loader: { '.png': 'file' },
    logLevel: 'info',
  });
  if (css.errors.length) { console.error(css.errors); process.exit(1); }
  console.log('[build] writing index.html...');
  const html = await readFile('src/index.html', 'utf-8');
  await writeFile('dist/index.html', html);
  if (existsSync('public')) await cp('public', 'dist', { recursive: true });
  console.log('[build] done.');
}
go().catch((e) => { console.error(e); process.exit(1); });
