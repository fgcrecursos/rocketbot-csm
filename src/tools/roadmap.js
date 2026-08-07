/* ==========================================================================
   04 · Roadmap de Automatización
   Además del armazón, esta herramienta importa los procesos que ya detectó el
   Opportunity Finder para la misma cuenta.
   ========================================================================== */

import '../styles/tokens.css';
import '../styles/shell.css';
import '../styles/tools/roadmap.css';
import '../styles/parches.css';

import { montarShell, aplicarTema } from '../lib/shell.js';
import { almacen } from '../lib/almacen.js';
import { alCambiar, fusionarEstado, solapar, instantanea } from '../lib/puente-motor.js';

const ctx = await montarShell({ herramienta: 'roadmap' });
await import('./roadmap.motor.js');

/* El motor trae una línea suelta que fuerza el tema oscuro si el sistema
   operativo lo prefiere, y corre al importarlo, o sea después de que el
   armazón aplicó el tema elegido. Resultado: quien pedía claro en un equipo
   configurado en oscuro veía la página en oscuro igual. La preferencia del
   sistema ya se respeta como valor inicial en almacen.tema(); acá se vuelve a
   imponer lo que la plataforma decidió. */
aplicarTema(almacen.tema());

if (ctx.cuenta) {
  if (ctx.evaluacion && ctx.evaluacion.datos) fusionarEstado(window.state, ctx.evaluacion.datos);
  solapar(window.state.cliente, ctx.perfilParaMotor());
  window.renderNav();
  window.render();
}

function resumen() {
  const A = window.analisis();
  return {
    procesos: A.total,
    horasMes: Math.round(A.horasMes),
    ahorroMinMes: Math.round(A.ahMin),
    ahorroMaxMes: Math.round(A.ahMax),
    impactoPromedio: Math.round(A.impProm),
    complejidadPromedio: Math.round(A.cxProm),
    nivelCartera: A.nivelGeneral.l,
    semanasTotal: A.semanasTotal,
    productos: A.prodOrden.map((p) => p.n),
    cuadrantes: {
      ganarRapido: A.q.qw.length,
      proyectoEstrategico: A.q.sp.length,
      completarDespues: A.q.fi.length,
      evitarPorAhora: A.q.av.length,
    },
  };
}

let pendiente = null;
function agendarGuardado() {
  clearTimeout(pendiente);
  pendiente = setTimeout(async () => {
    await ctx.guardar({
      datos: instantanea(window.state),
      resultado: resumen(),
      estado: window.state.procesos.length ? 'completa' : 'borrador',
      perfil: window.state.cliente,
    });
  }, 900);
}

alCambiar(['setC', 'setB', 'setEval', 'toggleCar', 'guardar', 'borrar', 'nuevo', 'ir'], agendarGuardado);

/* --------------------------------------------------------------------------
   Importar desde el Opportunity Finder
   --------------------------------------------------------------------------
   Trae nombre, área y volumetría, que es lo que el Finder ya relevó. Los dos
   bloques de criterios quedan en 3, el punto medio: el Finder no los mide y
   dejarlos en un valor alto inventaría un impacto que nadie evaluó. La cuenta
   de procesos importados se avisa para que quede claro que falta calificarlos.
   -------------------------------------------------------------------------- */

const AREAS_ROADMAP = ['Finanzas', 'Recursos Humanos', 'Comercial', 'Tecnología', 'Compras', 'Operaciones', 'Atención al Cliente'];

function mapearArea(nombre) {
  const n = String(nombre || '').toLowerCase();
  if (n.includes('finanz') || n.includes('administra')) return 'Finanzas';
  if (n.includes('human') || n.includes('rrhh') || n.includes('personas')) return 'Recursos Humanos';
  if (n.includes('comercial') || n.includes('venta') || n.includes('marketing')) return 'Comercial';
  if (n.includes('tecnolog') || n.includes(' ti') || n.startsWith('ti')) return 'Tecnología';
  if (n.includes('compra') || n.includes('abastec')) return 'Compras';
  if (n.includes('cliente') || n.includes('atención') || n.includes('soporte')) return 'Atención al Cliente';
  if (n.includes('operac') || n.includes('logíst') || n.includes('producc')) return 'Operaciones';
  return AREAS_ROADMAP.includes(nombre) ? nombre : 'Operaciones';
}

/* El Finder da volumen mensual; el Roadmap pide una frecuencia declarada. */
function frecuenciaDesdeVolumen(v) {
  const n = Number(v) || 0;
  if (n >= 400) return 'f1'; // varias veces al día
  if (n >= 20) return 'f2'; // diario
  if (n >= 4) return 'f3'; // semanal
  if (n >= 1) return 'f4'; // mensual
  return 'f5'; // eventual
}

async function importarDelFinder() {
  if (!ctx.cuenta) return;
  const ev = await almacen.obtenerEvaluacion(ctx.cuenta.id, 'oportunidades');
  const procesos = ev && ev.resultado && ev.resultado.procesos;
  if (!procesos || !procesos.length) {
    ctx.avisar('El Opportunity Finder todavía no tiene procesos para esta cuenta', 'error', 3500);
    return;
  }

  const yaEstan = new Set(window.state.procesos.map((p) => p.nombre.toLowerCase().trim()));
  const nuevos = procesos.filter((p) => !yaEstan.has(p.titulo.toLowerCase().trim()));
  if (!nuevos.length) {
    ctx.avisar('Todos los procesos del Finder ya están cargados', 'info', 3000);
    return;
  }

  for (const p of nuevos) {
    const b = window.nuevoBorrador();
    b.id = 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    b.nombre = p.titulo;
    b.area = mapearArea(p.area);
    b.desc = 'Importado del Opportunity Finder. Falta calificar impacto y complejidad.';
    b.frecuencia = frecuenciaDesdeVolumen(p.volumen);
    b.volumen = p.volumen ?? '';
    b.minutos = p.minutos ?? '';
    b.personas = String(p.personas ?? 1);
    window.state.procesos.push(b);
  }

  window.state.borrador = null;
  window.state.editando = null;
  window.renderNav();
  window.render();
  agendarGuardado();
  ctx.avisar(
    `${nuevos.length} proceso${nuevos.length > 1 ? 's' : ''} importado${nuevos.length > 1 ? 's' : ''} · falta calificarlos`,
    'ok',
    4000
  );
}

ctx.montarAcciones(`
  <button class="rbp-btn" id="rbpImportar" title="Traer los procesos relevados en la herramienta 03">Importar del Finder</button>
  <button class="rbp-btn" id="rbpCsv">CSV</button>
  <button class="rbp-btn rbp-btn-primario" id="rbpPdf">Exportar PDF</button>
`);
document.getElementById('rbpImportar').addEventListener('click', importarDelFinder);
document.getElementById('rbpCsv').addEventListener('click', () => window.exportarCSV());
document.getElementById('rbpPdf').addEventListener('click', () => window.print());
