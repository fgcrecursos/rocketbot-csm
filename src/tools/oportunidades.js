/* ==========================================================================
   03 · Automation Opportunity Finder
   ========================================================================== */

import '../styles/tokens.css';
import '../styles/shell.css';
import '../styles/tools/oportunidades.css';
import '../styles/parches.css';

import { montarShell } from '../lib/shell.js';
import { alCambiar, fusionarEstado, solapar, instantanea } from '../lib/puente-motor.js';

const ctx = await montarShell({ herramienta: 'oportunidades' });
await import('./oportunidades.motor.js');

if (ctx.cuenta) {
  if (ctx.evaluacion && ctx.evaluacion.datos) fusionarEstado(window.state, ctx.evaluacion.datos);
  solapar(window.state.empresa, ctx.perfilParaMotor());
  window.render();
}

function resumen() {
  const R = window.calcular();
  return {
    scoreGlobal: R.scoreGlobal,
    horasActualesMes: Math.round(R.totalHorasActuales),
    ahorroMinMes: Math.round(R.totalMin),
    ahorroMaxMes: Math.round(R.totalMax),
    procesosDeclarados: R.oportunidades.length,
    procesosRelevantes: R.relevantes.length,
    plan: R.plan ? R.plan.nombre : null,
    poc: R.poc ? R.poc.titulo : null,
    productos: R.productosOrden,
    // Los procesos detectados alimentan el Roadmap, que sin esto obliga a
    // cargarlos de nuevo uno por uno.
    procesos: R.relevantes.map((o) => ({
      titulo: o.titulo,
      area: o.area,
      volumen: o.volumen,
      minutos: o.minutos,
      personas: o.personas,
      horasMes: Math.round(o.horasMes),
      productos: o.productos,
    })),
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
      estado: r.procesosDeclarados > 0 ? 'completa' : 'borrador',
      perfil: window.state.empresa,
    });
  }, 900);
}

alCambiar(['setEmpresa', 'setQual', 'setProc', 'setEstado', 'ir'], agendarGuardado);

ctx.montarAcciones(`
  <button class="rbp-btn" id="rbpJson">Exportar JSON</button>
  <button class="rbp-btn rbp-btn-primario" id="rbpPdf">Exportar PDF</button>
`);
document.getElementById('rbpJson').addEventListener('click', () => window.exportarJSON());
document.getElementById('rbpPdf').addEventListener('click', () => window.print());
