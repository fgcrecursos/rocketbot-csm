/* ==========================================================================
   01 · Customer Automation Health Score
   Envoltorio: arma el armazón, carga el motor, restaura lo guardado y
   autoguarda. El cálculo del score no se toca.
   ========================================================================== */

import '../styles/tokens.css';
import '../styles/shell.css';
import '../styles/tools/health.css';
import '../styles/parches.css';

import { montarShell } from '../lib/shell.js';
import { fusionarEstado, solapar, instantanea } from '../lib/puente-motor.js';

const ctx = await montarShell({ herramienta: 'health' });
await import('./health.motor.js');

/* El motor arranca con DOMContentLoaded. Este módulo usa await de nivel
   superior, así que puede empezar a correr con el evento ya disparado; en ese
   caso nadie llamaría a init(). Se cubren los dos casos sin llamarlo dos
   veces: si el evento todavía no pasó, el motor se encarga —su escucha se
   registró antes que esta— y acá solo se espera. */
if (document.readyState === 'loading') {
  await new Promise((r) => document.addEventListener('DOMContentLoaded', r, { once: true }));
} else {
  window.init();
}

/* -------- Colores según el tema --------
   Esta herramienta pinta el medidor, las barras por pilar, las insignias de la
   tabla y el chip de la barra superior desde JavaScript, con hexadecimales
   escritos a mano en BANDS y PILLARS. Son los valores del tema claro: sobre
   fondo oscuro el rojo #BC0017 queda en 2.2:1 y ninguna de las cifras se lee.
   El CSS no puede corregirlo porque van como estilo en línea y son literales,
   no variables.

   Se resuelve traduciendo esos hexadecimales al equivalente del tema activo,
   que es un dato de presentación y no toca el cálculo del score.

   Los dos temas necesitan corrección, y en sentidos opuestos. El color casi
   siempre va como texto sobre una insignia teñida con ese mismo tono al 18%:
   eso aclara el fondo y se come medio punto de contraste. Sobre blanco, el
   azul de marca queda en 3.0:1 y hay que profundizarlo; sobre el fondo oscuro
   queda en 2.2:1 y hay que aclararlo. Con estos valores, las cifras van de
   4.8:1 a 7:1 en los dos temas. */
const PALETA = {
  '#1D9E75': { light: '#0F5C42', dark: '#4EDBA8' }, // verde
  '#378ADD': { light: '#1A5FC8', dark: '#8CC0F5' }, // azul
  '#BA7517': { light: '#8A5610', dark: '#EDB253' }, // ámbar
  '#BC0017': { light: '#BC0017', dark: '#FF8C99' }, // rojo
  '#5F717A': { light: '#4A5A62', dark: '#A3B2B9' }, // gris de "datos insuficientes"
};

/* Cualquier valor conocido —el original o el de cualquiera de los dos temas—
   vuelve a su clave, así el cambio de tema se puede repetir sin acumular. */
const A_ORIGEN = new Map();
for (const [base, v] of Object.entries(PALETA)) {
  for (const hex of [base, v.light, v.dark]) A_ORIGEN.set(hex.toUpperCase(), base);
}

/* La banda "Datos insuficientes" no sale de BANDS: displayBand la arma en el
   momento con el hexadecimal adentro, así que el remapeo de abajo no la
   alcanza. Importa porque es el estado en que arranca toda evaluación nueva.
   Se corrige sobre el DOM, y solo ese gris exacto.

   Va declarado antes de pintarSegunTema a propósito: pintarSegunTema lo llama
   y corre apenas se carga el módulo, así que una `const` declarada más abajo
   caería en su zona muerta temporal y la excepción cortaría el resto del
   archivo —restauración, autoguardado y botones incluidos. */
const esGrisOriginal = (v) => /rgb\(\s*95,\s*113,\s*122\s*\)/.test(v) || v.toUpperCase() === '#5F717A';

function corregirGrisSinDatos() {
  const destino = PALETA['#5F717A'][document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light'];
  document.querySelectorAll('#scorePanel [style*="color"], #tbVal, .gauge text').forEach((el) => {
    if (esGrisOriginal(el.style.color || '')) el.style.color = destino;
    if (esGrisOriginal(el.getAttribute('fill') || '')) el.setAttribute('fill', destino);
  });
}

function pintarSegunTema(tema) {
  const k = tema === 'dark' ? 'dark' : 'light';
  for (const col of [window.BANDS, window.PILLARS]) {
    for (const it of col) {
      const base = A_ORIGEN.get(String(it.hex).toUpperCase());
      if (base) it.hex = PALETA[base][k];
    }
  }
  corregirGrisSinDatos();
}

pintarSegunTema(document.documentElement.getAttribute('data-theme'));
document.addEventListener('rbp:tema', (e) => {
  pintarSegunTema(e.detail.tema);
  window.refresh(true);
});

new MutationObserver(corregirGrisSinDatos).observe(document.body, {
  childList: true,
  subtree: true,
  attributeFilter: ['style', 'fill'],
});

/* -------- Restaurar -------- */
if (ctx.cuenta) {
  // Primero lo que esta herramienta tenía guardado, y encima el perfil de la
  // cuenta. Ese orden importa: la cuenta ya absorbió todo lo que la herramienta
  // escribió alguna vez, así que es la versión más nueva del dato compartido.
  // Al revés, un ejemplo cargado hace un mes seguiría mostrando su industria
  // inventada por encima de la real.
  if (ctx.evaluacion && ctx.evaluacion.datos) fusionarEstado(window.D, ctx.evaluacion.datos);
  solapar(window.D, ctx.perfilParaMotor());
  window.syncToForm();
}

/* -------- Resumen que leen el panel y las otras herramientas -------- */
function resumen() {
  const C = window.computeScore(window.D);
  const banda = window.displayBand(C);
  return {
    score: C.total,
    banda: banda.n,
    confianza: Math.round(C.confidence * 100),
    pilares: Object.fromEntries(C.pillars.map((p) => [p.id, p.score === null ? null : Math.round(p.score)])),
    // La suite contratada la consumen Roadmap y Oportunidades para no volver
    // a preguntar qué productos tiene el cliente.
    suite: instantanea(window.D.suite),
    renovacion: window.D.renueva || null,
  };
}

/* -------- Autoguardado --------
   "Cargar ejemplo" y "Cargar" un JSON rellenan el formulario entero, incluido
   el bloque "Contexto de la cuenta". Ese bloque ahora lo posee la plataforma:
   los datos de muestra vienen con otro cliente, otra industria y otras fechas,
   y sin esta corrección alcanzaba con mirar el ejemplo y tocar cualquier campo
   después para que el perfil inventado quedara escrito en la cuenta real.
   La corrección devuelve el contexto de la cuenta encima de lo importado, así
   que lo que se ve en pantalla y lo que se guarda coinciden. */
let pendiente = null;
let contextoAjeno = false;

function recuperarContextoDeLaCuenta() {
  if (!ctx.cuenta) return;
  // Acá sí se copian los campos vacíos, al revés que al restaurar. Si la cuenta
  // no tiene fecha de renovación, la del ejemplo tiene que desaparecer: dejarla
  // sería inventarle una fecha a un cliente real.
  fusionarEstado(window.D, ctx.perfilParaMotor());
  window.syncToForm();
}

async function guardarAhora(estado) {
  if (contextoAjeno) {
    contextoAjeno = false;
    recuperarContextoDeLaCuenta();
  }
  return ctx.guardar({
    datos: instantanea(window.D),
    resultado: resumen(),
    estado: estado || (window.computeScore(window.D).total === null ? 'borrador' : 'completa'),
    perfil: window.D,
  });
}

function agendarGuardado() {
  clearTimeout(pendiente);
  pendiente = setTimeout(guardarAhora, 900);
}

/* Esta herramienta no se puede enganchar envolviendo funciones de `window`,
   como las otras tres. Las otras invocan su estado desde atributos del HTML
   (`onclick="ir(2)"`), que resuelven contra window y por eso admiten un
   envoltorio. Health Score, en cambio, ata sus escuchas con addEventListener y
   referencias directas del módulo: reemplazar `window.refresh` no cambia a
   quién llama el motor por dentro, y el guardado nunca se disparaba.
   La vía que sí funciona es escuchar los eventos ya burbujeados, que llegan
   después de que el motor actualizó D. */
const cuerpo = ctx.cuerpo;
cuerpo.addEventListener('input', () => agendarGuardado());
cuerpo.addEventListener('change', (e) => {
  if (e.target.id === 'fileIn') contextoAjeno = true; // el JSON puede ser de otra cuenta
  agendarGuardado();
});
cuerpo.addEventListener('click', (e) => {
  // Solo los controles que mutan datos; si no, cualquier clic marcaría cambios.
  if (!e.target.closest('#suiteChips [data-prod], #btnDemo, #btnClear, #modeSeg button')) return;
  if (e.target.closest('#btnDemo')) {
    // El motor ya corrió loadDemo() —su escucha está en el botón y esta
    // burbujea después—, así que el contexto de muestra ya está en D.
    contextoAjeno = true;
  }
  agendarGuardado();
});

/* -------- Acciones de la barra superior --------
   El chip con el score y el botón de PDF se mudan desde la barra propia de la
   herramienta, con sus escuchas ya puestas por init(). Mover el nodo conserva
   los listeners; recrearlos acá los duplicaría. */
const acciones = ctx.montarAcciones('<button class="rbp-btn" id="rbpGuardarYa">Guardar ahora</button>');
const barraVieja = document.getElementById('tbHealth');
if (barraVieja && acciones) {
  const chip = barraVieja.querySelector('#tbScore');
  const botones = barraVieja.querySelector('.tb-actions');
  barraVieja.querySelector('#btnTheme')?.remove(); // el tema es de la plataforma
  if (chip) acciones.parentNode.insertBefore(chip, acciones);
  if (botones) acciones.appendChild(botones);
  barraVieja.remove();
}

document.getElementById('rbpGuardarYa').addEventListener('click', async () => {
  clearTimeout(pendiente);
  if (await guardarAhora('completa')) ctx.avisar('Health Score guardado en la cuenta', 'ok');
});
