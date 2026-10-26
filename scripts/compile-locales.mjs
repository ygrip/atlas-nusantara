import { compile } from '@inlang/paraglide-js';
await compile({
  project: './project.inlang',
  outdir: './src/lib/paraglide',
  strategy: ['localStorage', 'preferredLanguage', 'baseLocale'],
  emitTsDeclarations: true
});
console.log('Paraglide messages compiled');
