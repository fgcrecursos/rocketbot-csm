/* ==========================================================================
   ESTADO DEL EQUIPO
   --------------------------------------------------------------------------
   Pantalla solo para supervisores. Combina dos fuentes:
   - csm_estado_equipo(): actividad de acceso (¿se registró?, ¿confirmó el
     email?, último ingreso) más el id de auth.users de cada persona. La base
     rechaza a cualquiera que no sea supervisor — el chequeo de acá es solo
     para no mostrar la pantalla vacía a quien de todas formas no puede pedir
     los datos.
   - almacen.listarCuentas(): el trabajo real de CS. Cada cuenta tiene un
     owner (uuid de auth.users) desde que la cartera dejó de ser compartida;
     acá se cruzan por ese id, no por texto. Un supervisor ve todas las
     cuentas de todo el mundo por RLS (política csm_cuentas_supervisor_ver en
     schema.sql) — el resto del equipo, con almacen.misCuentas(), solo ve las
     propias.
   ========================================================================== */

import '../styles/tokens.css';
import '../styles/shell.css';
import '../styles/panel.css';

import { montarShell, avisar } from '../lib/shell.js';
import { perfilActual, esSupervisor, estadoEquipo } from '../lib/auth.js';
import { almacen } from '../lib/almacen.js';
import { HERRAMIENTAS, bandaDe } from '../lib/modelo.js';

const ctx = await montarShell({ herramienta: 'equipo', exigeCuenta: false });

const esc = (s) =>
  String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = (n) => new Intl.NumberFormat('es-CL', { maximumFractionDigits: 0 }).format(Math.round(n || 0));

const fechaHora = (iso) =>
  iso
    ? new Date(iso).toLocaleString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    : '—';

function estadoCuenta(f) {
  if (!f.cuenta_creada) return { txt: 'Todavía no se registró', c: 'var(--rb-red-txt)' };
  if (!f.email_confirmado) return { txt: 'Falta confirmar el email', c: 'var(--rb-amber-txt)' };
  return { txt: 'Activa', c: 'var(--rb-green-txt)' };
}

/* ---------- Cuentas de cliente que cargó cada persona ---------- */

function celdaScore(e) {
  const h = e.health?.resultado;
  return h && typeof h.score === 'number'
    ? `<span class="pn-score" style="--b:${bandaDe(h.score).c}">${h.score}<small>${esc(h.banda)}</small></span>`
    : '<span class="pn-vacio">—</span>';
}
function celdaMadurez(e) {
  const m = e.madurez?.resultado;
  return m ? `<span class="pn-nivel">N${m.nivel} · ${esc(m.nivelNombre)}</span>` : '<span class="pn-vacio">—</span>';
}
function celdaAhorro(e) {
  const o = e.oportunidades?.resultado;
  return o && o.ahorroMaxMes ? `${fmt(o.ahorroMinMes)}–${fmt(o.ahorroMaxMes)} h` : '<span class="pn-vacio">—</span>';
}
function celdaRoadmap(e) {
  const r = e.roadmap?.resultado;
  return r && r.procesos ? `${r.procesos} proc.` : '<span class="pn-vacio">—</span>';
}

function filaCuenta(c, e) {
  const botones = HERRAMIENTAS.map(
    (h) => `<a class="pn-h ${e[h.id] ? 'lleno' : ''}" data-c="${h.n}" data-abrir="${c.id}" data-pagina="${h.pagina}"
               href="${h.pagina}" title="${esc(h.nombre)}${e[h.id] ? ' · con datos' : ''}">0${h.n}</a>`
  ).join('');
  return `
  <tr>
    <td>${esc(c.nombre || 'Sin nombre')}</td>
    <td>${celdaScore(e)}</td>
    <td>${celdaMadurez(e)}</td>
    <td class="num">${celdaAhorro(e)}</td>
    <td class="num">${celdaRoadmap(e)}</td>
    <td><div class="pn-acc">${botones}</div></td>
  </tr>`;
}

function detalleCuentas(f, cuentas, estados) {
  const propias = cuentas.filter((c) => c.owner === f.id);
  const cuerpo = propias.length
    ? `<div class="pn-scroll"><table class="pn-tabla">
        <thead><tr>
          <th>Cuenta</th><th>Health Score</th><th>Madurez IA</th>
          <th class="num">Ahorro / mes</th><th class="num">Roadmap</th>
          <th style="text-align:right">Herramientas</th>
        </tr></thead>
        <tbody>${propias.map((c) => filaCuenta(c, estados.get(c.id) || {})).join('')}</tbody>
      </table></div>`
    : `<p style="font-size:12.5px;color:var(--ink-3);margin:0">Todavía no cargó ninguna cuenta.</p>`;
  return `<tr class="rbp-detalle" data-detalle="${esc(f.email)}" style="display:none">
    <td colspan="4" style="background:var(--surface-2);padding:14px 16px">${cuerpo}</td>
  </tr>`;
}

function fila(f, cuentas, estados) {
  const e = estadoCuenta(f);
  const propias = cuentas.filter((c) => c.owner === f.id).length;
  return `
  <tr>
    <td>
      <div style="min-width:0">
        <span style="display:block;font-weight:600">${esc(f.nombre || f.email)}</span>
        <span style="display:block;font-size:12px;color:var(--ink-3)">${esc(f.email)}${f.puesto ? ' · ' + esc(f.puesto) : ''}</span>
      </div>
    </td>
    <td><span style="color:${e.c};font-weight:600">${esc(e.txt)}</span></td>
    <td class="num" style="color:var(--ink-3);font-size:12.5px">${fechaHora(f.ultimo_ingreso)}</td>
    <td>
      <button class="rbp-btn" data-ver="${esc(f.email)}" ${propias === 0 ? 'disabled' : ''}>
        Ver cuentas${propias ? ` (${propias})` : ''}
      </button>
    </td>
  </tr>
  ${detalleCuentas(f, cuentas, estados)}`;
}

/* Cuenta cuántas de las filas todavía no se registraron, para explicar en la
   propia pantalla por qué la tabla puede verse "vacía" de datos reales incluso
   cuando la carga funcionó perfecto: nadie del equipo entró todavía. */
function avisoSinRegistrar(filas) {
  const sinRegistrar = filas.filter((f) => !f.cuenta_creada).length;
  if (sinRegistrar === 0) return '';
  const todos = sinRegistrar === filas.length;
  return `
  <div class="pn-nota" style="margin-bottom:16px">
    ${
      todos
        ? 'Ninguna de las 6 personas del equipo creó su cuenta todavía — por eso no hay más datos que el email para mostrar.'
        : `${sinRegistrar} de ${filas.length} personas del equipo todavía no crearon su cuenta.`
    }
    Van a aparecer acá apenas se registren desde <a href="/login">/login</a>.
  </div>`;
}

function render(filas, cuentas, estados) {
  ctx.cuerpo.innerHTML = `
  <div class="pn">
    <div class="pn-hero">
      <div>
        <span class="eyebrow">Customer Success</span>
        <h1>Equipo</h1>
        <p>Estado de las cuentas de acceso a Centro CSM y, por persona, las cuentas de cliente que tiene a cargo.</p>
      </div>
    </div>

    ${filas.length ? avisoSinRegistrar(filas) : ''}

    <h2 class="pn-sec">Cuentas</h2>
    <div class="pn-tabla-caja">
      ${
        filas.length
          ? `<div class="pn-scroll"><table class="pn-tabla">
        <thead><tr>
          <th>Persona</th><th>Estado</th>
          <th class="num">Último ingreso</th><th>Cuentas de cliente</th>
        </tr></thead>
        <tbody>${filas.map((f) => fila(f, cuentas, estados)).join('')}</tbody>
      </table></div>`
          : `<div class="pn-nada"><h3>Sin datos</h3><p>No se pudo leer el estado del equipo. Revisá la consola.</p></div>`
      }
    </div>
  </div>`;

  cablear();
}

function cablear() {
  ctx.cuerpo.querySelectorAll('[data-ver]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const fila = ctx.cuerpo.querySelector(`[data-detalle="${CSS.escape(btn.dataset.ver)}"]`);
      if (!fila) return;
      const abierta = fila.style.display !== 'none';
      fila.style.display = abierta ? 'none' : '';
      btn.setAttribute('aria-expanded', String(!abierta));
    });
  });
  ctx.cuerpo.querySelectorAll('[data-abrir]').forEach((a) =>
    a.addEventListener('click', (ev) => {
      ev.preventDefault();
      almacen.fijarCuentaActiva(a.dataset.abrir);
      location.href = a.dataset.pagina;
    })
  );
}

async function cargar() {
  let filas = [];
  let cuentas = [];
  let estados = new Map();
  try {
    [filas, cuentas] = await Promise.all([estadoEquipo(), almacen.listarCuentas()]);
    for (const c of cuentas) estados.set(c.id, await almacen.estadoDeCuenta(c.id));
  } catch (e) {
    console.error('[equipo]', e);
    avisar('No se pudo cargar el estado del equipo.', 'error', 4000);
  }
  render(filas, cuentas, estados);
}

const perfil = await perfilActual();
if (!esSupervisor(perfil)) {
  ctx.cuerpo.innerHTML = `
    <div class="pn-nada">
      <h3>No tenés acceso a esta pantalla</h3>
      <p>Es solo para supervisores.</p>
    </div>`;
} else {
  await cargar();
}
