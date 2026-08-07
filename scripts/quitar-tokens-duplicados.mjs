/**
 * Saca de cada CSS de herramienta su bloque propio de variables.
 *
 * Las cuatro traían su paleta completa en `:root`. Como esas hojas se cargan
 * después de tokens.css y `:root` tiene la misma especificidad que
 * `[data-theme="dark"]`, la última declaración ganaba: el tema oscuro se
 * aplicaba en el armazón y no dentro de la herramienta.
 *
 * Antes de borrar nada verifica que cada variable exista en tokens.css, así el
 * arreglo no puede dejar un color sin definir. Los bloques dentro de @media
 * —como la paleta de impresión de Health Score— no se tocan.
 *
 *   node scripts/quitar-tokens-duplicados.mjs
 */
import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const HOJAS = ['health', 'madurez', 'oportunidades', 'roadmap'];

const tokens = readFileSync(resolve(raiz, 'src/styles/tokens.css'), 'utf8');
const definidasEnTokens = new Set([...tokens.matchAll(/(--[\w-]+)\s*:/g)].map((m) => m[1]));

let fallo = false;

for (const id of HOJAS) {
  const ruta = resolve(raiz, `src/styles/tools/${id}.css`);
  let css = readFileSync(ruta, 'utf8');

  // Solo la cabecera, antes del primer @media: ahí viven los bloques de tema.
  const corte = css.search(/@media/);
  const cabeza = corte === -1 ? css : css.slice(0, corte);
  const resto = corte === -1 ? '' : css.slice(corte);

  const bloques = [...cabeza.matchAll(/(^|\n)\s*(:root|\[data-theme=["'][^"']+["']\])\s*\{([^}]*)\}/g)];
  if (!bloques.length) {
    console.log(`${id.padEnd(15)} sin bloques de tema`);
    continue;
  }

  const usadas = new Set();
  for (const b of bloques) {
    for (const m of b[3].matchAll(/(--[\w-]+)\s*:/g)) usadas.add(m[1]);
  }

  const faltantes = [...usadas].filter((v) => !definidasEnTokens.has(v));
  if (faltantes.length) {
    console.error(`${id.padEnd(15)} ABORTA · tokens.css no define: ${faltantes.join(', ')}`);
    fallo = true;
    continue;
  }

  let cabezaLimpia = cabeza;
  for (const b of bloques) cabezaLimpia = cabezaLimpia.replace(b[0], '\n');

  const nota =
    `/* La paleta de esta herramienta se movió a src/styles/tokens.css.\n` +
    `   Estaba declarada acá en :root, que tiene la misma especificidad que\n` +
    `   [data-theme="dark"], y al cargarse después ganaba siempre: el tema\n` +
    `   oscuro no entraba dentro de la herramienta. Los nombres de variable\n` +
    `   que usa este archivo siguen existiendo, definidos allá como alias. */\n`;

  writeFileSync(ruta, nota + cabezaLimpia.replace(/^\n+/, '\n') + resto);
  console.log(`${id.padEnd(15)} ${bloques.length} bloque(s) · ${usadas.size} variables movidas`);
}

if (fallo) process.exit(1);
