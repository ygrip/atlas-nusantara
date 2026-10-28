import { compile } from '@inlang/paraglide-js';
await compile({
  project: './project.inlang',
  outdir: './src/lib/paraglide',
  strategy: ['url', 'baseLocale'],
  emitTsDeclarations: true
});
console.log('Paraglide messages compiled');
