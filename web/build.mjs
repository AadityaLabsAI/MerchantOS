// MerchantOS web build — esbuild (JS) + tailwindcss (CSS).
import { build } from 'esbuild';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import postcss from 'postcss';
import tailwindcss from 'tailwindcss';
import autoprefixer from 'autoprefixer';

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

  console.log('[build] processing CSS with Tailwind...');
  const css = await readFile('src/index.css', 'utf-8');
  const out = await postcss([tailwindcss(), autoprefixer()]).process(css, { from: 'src/index.css', to: 'dist/app.css' });
  await writeFile('dist/app.css', out.css);
  console.log(`[build]   dist/app.css ${(out.css.length / 1024).toFixed(1)}kb`);

  console.log('[build] writing index.html...');
  const html = await readFile('src/index.html', 'utf-8');
  await writeFile('dist/index.html', html);
  console.log('[build] done.');
}
go().catch((e) => { console.error(e); process.exit(1); });
