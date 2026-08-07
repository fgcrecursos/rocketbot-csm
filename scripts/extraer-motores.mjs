/**
 * Parte cada HTML original en tres archivos: CSS, cuerpo y motor JS.
 *
 * La regla del proyecto es que el motor de cálculo no se toca. Este script lo
 * copia tal cual y solo le agrega, al final, un puente que vuelve a poner en
 * `window` las funciones que el HTML llama desde atributos `onclick`, porque
 * un módulo de Vite tiene ámbito propio y ahí esas funciones dejarían de existir.
 *
 * Se corre una sola vez para arrancar. Después se edita el resultado, no esto.
 *
 *   node scripts/extraer-motores.mjs
 */
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const origen = 'C:/Users/frani/Downloads/nuevas tools Rafa';

/* `extras` son declaraciones que el detector automático no ve —objetos de
   estado y catálogos— pero que el envoltorio necesita para leer y restaurar lo
   que la herramienta tiene cargado. */
const FUENTES = [
  { archivo: 'CSM_1_HEALTH.html', id: 'health', extras: ['D', 'PILLARS', 'METRICS', 'PRODUCTS', 'BANDS', 'LAYERS'] },
  { archivo: 'CSM_2_MADURITY_PROFILE.html', id: 'madurez', extras: ['state', 'PILARES', 'NIVELES'] },
  { archivo: 'CSM_3_OPORTUNITY_FINDER.html', id: 'oportunidades', extras: ['state', 'AREAS'] },
  { archivo: 'CSM_4_ROADMAP.html', id: 'roadmap', extras: ['state'] },
];

/** Funciones de nivel superior que el HTML puede invocar desde un atributo. */
function globalesDe(js) {
  const nombres = new Set();
  for (const m of js.matchAll(/^function\s+([A-Za-z_$][\w$]*)\s*\(/gm)) nombres.add(m[1]);
  for (const m of js.matchAll(/^(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:\([^)]*\)|[A-Za-z_$][\w$]*)\s*=>/gm)) nombres.add(m[1]);
  return [...nombres].sort();
}

mkdirSync(resolve(raiz, 'src/styles/tools'), { recursive: true });
mkdirSync(resolve(raiz, 'src/tools'), { recursive: true });
mkdirSync(resolve(raiz, 'src/tools/cuerpos'), { recursive: true });

for (const { archivo, id, extras } of FUENTES) {
  const html = readFileSync(resolve(origen, archivo), 'utf8');

  const css = [...html.matchAll(/<style>([\s\S]*?)<\/style>/g)].map((m) => m[1]).join('\n');
  const js = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]).join('\n');

  let cuerpo = (html.match(/<body[^>]*>([\s\S]*?)<\/body>/) || [, ''])[1];
  cuerpo = cuerpo.replace(/<script>[\s\S]*?<\/script>/g, '').trim();

  const globales = globalesDe(js);
  const declaradas = extras.filter((e) => new RegExp(`^(?:const|let|var)\\s+${e}\\b`, 'm').test(js));
  const faltantes = extras.filter((e) => !declaradas.includes(e));
  if (faltantes.length) console.warn(`  ! ${id}: extras no encontrados → ${faltantes.join(', ')}`);

  const puente =
    `\n\n/* ------------------------------------------------------------------\n` +
    `   Puente hacia window. Lo agrega scripts/extraer-motores.mjs porque el\n` +
    `   motor viene de un <script> clásico y el cuerpo lo llama desde onclick.\n` +
    `   Nada de arriba se modificó: esto solo vuelve a exponer lo que el\n` +
    `   ámbito de módulo dejaría privado.\n` +
    `   ------------------------------------------------------------------ */\n` +
    `Object.assign(window, { ${globales.join(', ')} });\n` +
    (declaradas.length
      ? `/* Estado y catálogos que lee el envoltorio para guardar y restaurar. */\n` +
        `Object.assign(window, { ${declaradas.join(', ')} });\n`
      : '');

  writeFileSync(resolve(raiz, `src/styles/tools/${id}.css`), css.trim() + '\n');
  writeFileSync(resolve(raiz, `src/tools/${id}.motor.js`), js.trim() + puente);
  writeFileSync(resolve(raiz, `src/tools/cuerpos/${id}.html`), cuerpo + '\n');

  console.log(
    `${id.padEnd(15)} css ${String(css.length).padStart(6)}  ` +
      `js ${String(js.length).padStart(6)}  cuerpo ${String(cuerpo.length).padStart(5)}  ` +
      `globales ${globales.length}`
  );
}
