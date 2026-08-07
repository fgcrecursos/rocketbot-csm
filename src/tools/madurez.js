/* ==========================================================================
   02 · AI Readiness Assessment
   ========================================================================== */

import '../styles/tokens.css';
import '../styles/shell.css';
import '../styles/tools/madurez.css';
import '../styles/parches.css';

import { montarShell } from '../lib/shell.js';
import { alCambiar, fusionarEstado, solapar, instantanea } from '../lib/puente-motor.js';

const ctx = await montarShell({ herramienta: 'madurez' });
await import('./madurez.motor.js');

if (ctx.cuenta) {
  // Lo guardado acá primero; el perfil de la cuenta encima, porque es donde el
  // dato compartido queda más al día.
  if (ctx.evaluacion && ctx.evaluacion.datos) fusionarEstado(window.state, ctx.evaluacion.datos);
  solapar(window.state.empresa, ctx.perfilParaMotor());
  window.render();
}

function resumen() {
  const R = window.calcular();
  return {
    nivel: R.nivel,
    nivelNombre: window.NIVELES[R.nivel - 1].nombre,
    global: R.global,
    nivelPotencial: R.nivelPotencial,
    cuelloDeBotella: R.bloqueo ? R.bloqueo.fallan.map((f) => f.pilar) : null,
    pilares: Object.fromEntries(R.pilares.map((p) => [p.id, p.score])),
    productos: R.productos.items.map((p) => ({ nombre: p.nombre, fase: p.fase, prioridad: p.prioridad })),
    respondidas: R.pilares.reduce((s, p) => s + p.respondidas, 0),
    totalPreguntas: R.pilares.reduce((s, p) => s + p.total, 0),
  };
}

let pendiente = null;
function agendarGuardado() {
  clearTimeout(pendiente);
  pendiente = setTimeout(async () => {
    const r = resumen();
    await ctx.guardar({
      datos: instantanea(window.state),
      resultado: r,
      estado: r.respondidas >= r.totalPreguntas * 0.8 ? 'completa' : 'borrador',
      perfil: window.state.empresa,
    });
  }, 900);
}

alCambiar(['setResp', 'setMulti', 'ir'], agendarGuardado);

ctx.montarAcciones(`
  <button class="rbp-btn" id="rbpJson">Exportar JSON</button>
  <button class="rbp-btn rbp-btn-primario" id="rbpPdf">Exportar PDF</button>
`);
document.getElementById('rbpJson').addEventListener('click', () => window.exportarJSON());
document.getElementById('rbpPdf').addEventListener('click', () => window.print());
