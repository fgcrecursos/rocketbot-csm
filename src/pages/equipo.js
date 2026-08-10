/* ==========================================================================
   ESTADO DEL EQUIPO
   --------------------------------------------------------------------------
   Pantalla solo para supervisores: lista los emails de csm_usuarios_permitidos
   con rol 'equipo' y muestra si ya crearon la cuenta, si confirmaron el email
   y cuándo entraron por última vez. Los datos salen de csm_estado_equipo(),
   que en la base rechaza a cualquiera que no sea supervisor — este chequeo de
   acá es solo para no mostrar la pantalla vacía a quien de todas formas no
   puede pedir los datos.
   ========================================================================== */

import '../styles/tokens.css';
import '../styles/shell.css';
import '../styles/panel.css';

import { montarShell, avisar } from '../lib/shell.js';
import { perfilActual, esSupervisor, estadoEquipo } from '../lib/auth.js';

const ctx = await montarShell({ herramienta: 'equipo', exigeCuenta: false });

const esc = (s) =>
  String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const fechaHora = (iso) =>
  iso
    ? new Date(iso).toLocaleString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    : '—';

function estadoCuenta(f) {
  if (!f.cuenta_creada) return { txt: 'Todavía no se registró', c: 'var(--rb-red-txt)' };
  if (!f.email_confirmado) return { txt: 'Falta confirmar el email', c: 'var(--rb-amber-txt)' };
  return { txt: 'Activa', c: 'var(--rb-green-txt)' };
}

function fila(f) {
  const e = estadoCuenta(f);
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
    <td class="num" style="color:var(--ink-3);font-size:12.5px">${fechaHora(f.creado)}</td>
  </tr>`;
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

function render(filas) {
  ctx.cuerpo.innerHTML = `
  <div class="pn">
    <div class="pn-hero">
      <div>
        <span class="eyebrow">Customer Success</span>
        <h1>Equipo</h1>
        <p>Estado de las cuentas de acceso a Centro CSM.</p>
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
          <th class="num">Último ingreso</th><th class="num">Cuenta creada</th>
        </tr></thead>
        <tbody>${filas.map(fila).join('')}</tbody>
      </table></div>`
          : `<div class="pn-nada"><h3>Sin datos</h3><p>No se pudo leer el estado del equipo. Revisá la consola.</p></div>`
      }
    </div>
  </div>`;
}

async function cargar() {
  let filas = [];
  try {
    filas = await estadoEquipo();
  } catch (e) {
    console.error('[equipo]', e);
    avisar('No se pudo cargar el estado del equipo.', 'error', 4000);
  }
  render(filas);
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
