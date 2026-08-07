/**
 * Genera las páginas de entrada de las cuatro herramientas a partir de los
 * cuerpos extraídos, quitándoles la barra de marca propia: esa función ahora la
 * cumple el armazón compartido.
 *
 * Igual que el extractor, se corre una vez para arrancar. Después las páginas
 * generadas son la fuente y se editan a mano.
 *
 *   node scripts/generar-paginas.mjs
 */
import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const PAGINAS = [
  { id: 'health', titulo: 'Health Score' },
  { id: 'madurez', titulo: 'AI Readiness Assessment' },
  { id: 'oportunidades', titulo: 'Automation Opportunity Finder' },
  { id: 'roadmap', titulo: 'Roadmap de Automatización' },
];

const FUENTES = `<link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@500;600;700;800&family=Mulish:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;700&display=swap" rel="stylesheet">`;

for (const { id, titulo } of PAGINAS) {
  let cuerpo = readFileSync(resolve(raiz, `src/tools/cuerpos/${id}.html`), 'utf8');

  // La barra de marca de cada herramienta la reemplaza el armazón.
  const antes = cuerpo.length;
  cuerpo = cuerpo.replace(/<header class="topbar">[\s\S]*?<\/header>\s*/g, '');
  cuerpo = cuerpo.replace(/<div class="side-brand">[\s\S]*?<\/div>\s*<\/div>\s*/g, '');

  const html = `<!DOCTYPE html>
<html lang="es" data-theme="light">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${titulo} — Rocketbot</title>
  <meta name="robots" content="noindex, nofollow">
  <link rel="icon" href="/assets/logos/favicon.svg">
  ${FUENTES}
</head>
<body>

${cuerpo.trim()}

<script type="module" src="/src/tools/${id}.js"></script>
</body>
</html>
`;

  writeFileSync(resolve(raiz, `${id}.html`), html);
  console.log(`${id.padEnd(15)} ${antes} → ${cuerpo.trim().length} caracteres de cuerpo`);
}
