/* ==========================================================================
   PANEL DE CARTERA
   --------------------------------------------------------------------------
   Reemplaza al lanzador de cuatro tarjetas. La unidad de trabajo dejó de ser
   la herramienta y pasó a ser la cuenta: cada fila muestra en qué estado está
   esa cuenta en las cuatro herramientas y permite abrir cualquiera sin pasar
   por un selector previo.
   ========================================================================== */

import '../styles/tokens.css';
import '../styles/shell.css';
import '../styles/panel.css';

import { montarShell, avisar, refrescarBarra } from '../lib/shell.js';
import { almacen } from '../lib/almacen.js';
import { HERRAMIENTAS, INDUSTRIAS, PAISES, iniciales, cuentaVacia, bandaDe } from '../lib/modelo.js';

const ctx = await montarShell({ herramienta: 'panel', exigeCuenta: false });

const esc = (s) =>
  String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = (n) => new Intl.NumberFormat('es-CL', { maximumFractionDigits: 0 }).format(Math.round(n || 0));

const ICONO = {
  link: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 007.5.5l3-3a5 5 0 00-7-7l-1.7 1.7"/><path d="M14 11a5 5 0 00-7.5-.5l-3 3a5 5 0 007 7l1.7-1.7"/></svg>',
  lapiz: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4z"/></svg>',
  tacho: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/></svg>',
};

let cuentas = [];
let estados = new Map();

async function cargar() {
  cuentas = await almacen.listarCuentas();
  estados = new Map();
  for (const c of cuentas) estados.set(c.id, await almacen.estadoDeCuenta(c.id));
}

/* --------------------------------------------------------------------------
   Indicadores de cartera
   -------------------------------------------------------------------------- */
function kpis() {
  const scores = cuentas
    .map((c) => estados.get(c.id)?.health?.resultado?.score)
    .filter((s) => typeof s === 'number');
  const promedio = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;
  const enRiesgo = scores.filter((s) => s < 50).length;

  const ahorro = cuentas.reduce((s, c) => {
    const o = estados.get(c.id)?.oportunidades?.resultado;
    return s + (o ? o.ahorroMaxMes || 0 : 0);
  }, 0);

  // Renovaciones dentro de 90 días, que es la ventana en la que todavía se
  // puede hacer algo con lo que el score muestre.
  const hoy = new Date();
  const proximas = cuentas.filter((c) => {
    if (!c.renovacion) return false;
    const d = (new Date(c.renovacion) - hoy) / 864e5;
    return d >= 0 && d <= 90;
  }).length;

  return `
  <div class="pn-kpis">
    <div class="pn-kpi" style="--acc:var(--rb-blue)">
      <div class="l">Cuentas en cartera</div>
      <div class="v">${cuentas.length}</div>
      <div class="s">${scores.length} con Health Score</div>
    </div>
    <div class="pn-kpi" style="--acc:${promedio === null ? 'var(--line)' : bandaDe(promedio).c}">
      <div class="l">Health Score promedio</div>
      <div class="v">${promedio === null ? '—' : promedio}</div>
      <div class="s">${promedio === null ? 'Sin evaluaciones' : bandaDe(promedio).n}</div>
    </div>
    <div class="pn-kpi" style="--acc:var(--rb-red)">
      <div class="l">En riesgo</div>
      <div class="v">${enRiesgo}</div>
      <div class="s">Score bajo 50</div>
    </div>
    <div class="pn-kpi" style="--acc:var(--rb-green)">
      <div class="l">Ahorro identificado</div>
      <div class="v">${ahorro ? fmt(ahorro) + ' h' : '—'}</div>
      <div class="s">Horas al mes · tope del rango${proximas ? ` · ${proximas} renueva${proximas > 1 ? 'n' : ''} en 90 días` : ''}</div>
    </div>
  </div>`;
}

/* --------------------------------------------------------------------------
   Fila de cuenta
   -------------------------------------------------------------------------- */
function fila(c) {
  const e = estados.get(c.id) || {};
  const activa = c.id === almacen.cuentaActivaId();

  const health = e.health?.resultado;
  const celdaScore = health && typeof health.score === 'number'
    ? `<span class="pn-score" style="--b:${bandaDe(health.score).c}">${health.score}<small>${esc(health.banda)}</small></span>`
    : '<span class="pn-vacio">—</span>';

  const mad = e.madurez?.resultado;
  const celdaMadurez = mad
    ? `<span class="pn-nivel">N${mad.nivel} · ${esc(mad.nivelNombre)}</span>`
    : '<span class="pn-vacio">—</span>';

  const opo = e.oportunidades?.resultado;
  const celdaAhorro = opo && opo.ahorroMaxMes
    ? `${fmt(opo.ahorroMinMes)}–${fmt(opo.ahorroMaxMes)} h`
    : '<span class="pn-vacio">—</span>';

  const rm = e.roadmap?.resultado;
  const celdaRoadmap = rm && rm.procesos ? `${rm.procesos} proc.` : '<span class="pn-vacio">—</span>';

  const botones = HERRAMIENTAS.map(
    (h) => `<a class="pn-h ${e[h.id] ? 'lleno' : ''}" data-c="${h.n}" data-abrir="${c.id}" data-pagina="${h.pagina}"
               href="${h.pagina}" title="${esc(h.nombre)}${e[h.id] ? ' · con datos' : ''}">0${h.n}</a>`
  ).join('');

  return `
  <tr data-id="${c.id}">
    <td>
      <div class="pn-cuenta ${activa ? 'activa' : ''}">
        <span class="ini">${esc(iniciales(c.nombre))}</span>
        <span style="min-width:0">
          <span class="n">${esc(c.nombre || 'Sin nombre')}</span>
          <span class="m">${esc([c.industria, c.pais].filter(Boolean).join(' · ') || 'Perfil incompleto')}</span>
        </span>
      </div>
    </td>
    <td>${celdaScore}</td>
    <td>${celdaMadurez}</td>
    <td class="num">${celdaAhorro}</td>
    <td class="num">${celdaRoadmap}</td>
    <td class="num" style="color:var(--ink-3);font-size:11.5px">${
      c.actualizado ? new Date(c.actualizado).toLocaleDateString('es-CL') : '—'
    }</td>
    <td>
      <div class="pn-acc">
        ${botones}
        <span class="pn-sep"></span>
        <button class="pn-ic" data-link="${c.id}" title="Link para que lo complete el cliente">${ICONO.link}</button>
        <button class="pn-ic" data-editar="${c.id}" title="Editar el perfil de la cuenta">${ICONO.lapiz}</button>
        <button class="pn-ic peligro" data-borrar="${c.id}" title="Eliminar la cuenta y sus evaluaciones">${ICONO.tacho}</button>
      </div>
    </td>
  </tr>`;
}

/* --------------------------------------------------------------------------
   Lanzador para la cuenta activa
   -------------------------------------------------------------------------- */
function lanzador() {
  const id = almacen.cuentaActivaId();
  const c = cuentas.find((x) => x.id === id);
  if (!c) return '';
  const e = estados.get(c.id) || {};

  const resumenDe = (h) => {
    const r = e[h.id]?.resultado;
    if (!r) return { txt: 'Sin datos', vacio: true };
    if (h.id === 'health') return { txt: typeof r.score === 'number' ? `Score ${r.score} · ${r.banda}` : 'Borrador' };
    if (h.id === 'madurez') return { txt: `Nivel ${r.nivel} · ${r.nivelNombre}` };
    if (h.id === 'oportunidades')
      return { txt: r.procesosDeclarados ? `${r.procesosDeclarados} procesos · ${fmt(r.ahorroMaxMes)} h/mes` : 'Borrador' };
    return { txt: r.procesos ? `${r.procesos} procesos evaluados` : 'Borrador' };
  };

  return `
  <h2 class="pn-sec" style="margin-top:34px">Herramientas · ${esc(c.nombre)}</h2>
  <div class="pn-tools">
    ${HERRAMIENTAS.map((h) => {
      const r = resumenDe(h);
      return `<a class="pn-tool" data-c="${h.n}" data-n="0${h.n}" href="${h.pagina}">
        <h3>${esc(h.nombre)}</h3>
        <p>${esc(h.linea)}</p>
        <div class="est ${r.vacio ? 'vacio' : ''}">${esc(r.txt)}</div>
      </a>`;
    }).join('')}
  </div>`;
}

/* --------------------------------------------------------------------------
   Render
   -------------------------------------------------------------------------- */
function render() {
  const cuerpo = ctx.cuerpo;
  cuerpo.innerHTML = `
  <div class="pn">
    <div class="pn-hero">
      <div>
        <span class="eyebrow">Customer Success</span>
        <h1>Cartera de cuentas</h1>
        <p>Cada cuenta guarda un solo perfil y lo comparten las cuatro herramientas.
           Lo que se carga en una queda disponible en las otras tres.</p>
      </div>
      <div class="pn-hero-acc">
        <button class="rbp-btn rbp-btn-primario" id="pnNueva">+ Cuenta nueva</button>
      </div>
    </div>

    ${cuentas.length ? kpis() : ''}

    <h2 class="pn-sec">Cuentas</h2>
    <div class="pn-tabla-caja">
      ${
        cuentas.length
          ? `<div class="pn-scroll"><table class="pn-tabla">
        <thead><tr>
          <th>Cuenta</th><th>Health Score</th><th>Madurez IA</th>
          <th class="num">Ahorro / mes</th><th class="num">Roadmap</th>
          <th class="num">Actualizada</th><th style="text-align:right">Herramientas</th>
        </tr></thead>
        <tbody>${cuentas.map(fila).join('')}</tbody>
      </table></div>`
          : `<div class="pn-nada">
              <h3>Todavía no hay cuentas</h3>
              <p>Creá la primera y el perfil que cargues va a estar disponible en las
                 cuatro herramientas sin volver a pedirlo.</p>
              <button class="rbp-btn rbp-btn-primario" id="pnNueva2">+ Crear la primera cuenta</button>
            </div>`
      }
    </div>

    ${lanzador()}
  </div>

  <dialog class="pn-dlg" id="pnDlg"><div class="pn-dlg-in" id="pnDlgIn"></div></dialog>`;

  cablear();
}

/* --------------------------------------------------------------------------
   Diálogos
   -------------------------------------------------------------------------- */
const dlg = () => document.getElementById('pnDlg');

function abrirDlg(html) {
  document.getElementById('pnDlgIn').innerHTML = html;
  dlg().showModal();
}

function formularioCuenta(c, esNueva) {
  return `
  <h3>${esNueva ? 'Cuenta nueva' : 'Editar cuenta'}</h3>
  <p>Solo el nombre es obligatorio. El resto se completa desde cualquiera de las herramientas.</p>
  <div class="pn-campo">
    <label for="fNombre">Nombre de la cuenta</label>
    <input id="fNombre" type="text" value="${esc(c.nombre)}" placeholder="Razón social" autofocus>
  </div>
  <div class="pn-campo">
    <label for="fInd">Industria</label>
    <select id="fInd">
      <option value="">Sin definir</option>
      ${INDUSTRIAS.map((i) => `<option ${i === c.industria ? 'selected' : ''}>${esc(i)}</option>`).join('')}
    </select>
  </div>
  <div class="pn-campo">
    <label for="fPais">País</label>
    <select id="fPais">
      <option value="">Sin definir</option>
      ${PAISES.map((p) => `<option ${p === c.pais ? 'selected' : ''}>${esc(p)}</option>`).join('')}
    </select>
  </div>
  <div class="pn-campo">
    <label for="fCsm">Responsable de la cuenta</label>
    <input id="fCsm" type="text" value="${esc(c.csm)}" placeholder="CSM / Account Manager">
  </div>
  <div class="pn-dlg-pie">
    <button class="rbp-btn" data-cerrar>Cancelar</button>
    <button class="rbp-btn rbp-btn-primario" id="fGuardar">${esNueva ? 'Crear' : 'Guardar'}</button>
  </div>`;
}

async function guardarFormulario(c, esNueva) {
  const nombre = document.getElementById('fNombre').value.trim();
  if (!nombre) {
    avisar('La cuenta necesita un nombre', 'error');
    return;
  }
  const guardada = await almacen.guardarCuenta({
    ...c,
    nombre,
    industria: document.getElementById('fInd').value,
    pais: document.getElementById('fPais').value,
    csm: document.getElementById('fCsm').value.trim(),
  });
  if (esNueva) almacen.fijarCuentaActiva(guardada.id);
  dlg().close();
  await cargar();
  render();
  await refrescarBarra();
  avisar(esNueva ? 'Cuenta creada' : 'Cuenta actualizada', 'ok');
}

async function dialogoLink(cuentaId) {
  const c = cuentas.find((x) => x.id === cuentaId);
  const publicas = HERRAMIENTAS.filter((h) => h.publica);
  const previas = await almacen.listarInvitaciones(cuentaId);

  abrirDlg(`
    <h3>Link para el cliente</h3>
    <p>Genera un enlace para que <b>${esc(c.nombre)}</b> complete la evaluación por su cuenta.
       Lo que responda vuelve a esta cuenta.</p>
    <div class="pn-campo">
      <label for="fHerr">Qué se le pide completar</label>
      <select id="fHerr">
        ${publicas.map((h) => `<option value="${h.id}">${esc(h.nombre)}</option>`).join('')}
      </select>
    </div>
    <div class="pn-campo">
      <label for="fDias">Vigencia</label>
      <select id="fDias">
        <option value="7">7 días</option>
        <option value="30" selected>30 días</option>
        <option value="90">90 días</option>
      </select>
    </div>
    ${
      previas.length
        ? `<p style="font-size:12.5px;color:var(--ink-3);margin:0 0 8px">
             Ya hay ${previas.length} link${previas.length > 1 ? 's' : ''} para esta cuenta
             (${previas.filter((i) => i.completada).length} completado${previas.filter((i) => i.completada).length === 1 ? '' : 's'}).</p>`
        : ''
    }
    <div id="fResultado"></div>
    <div class="pn-dlg-pie">
      <button class="rbp-btn" data-cerrar>Cerrar</button>
      <button class="rbp-btn rbp-btn-primario" id="fGenerar">Generar link</button>
    </div>`);

  document.getElementById('fGenerar').addEventListener('click', async () => {
    const herr = document.getElementById('fHerr').value;
    const dias = Number(document.getElementById('fDias').value);
    const inv = await almacen.crearInvitacion(cuentaId, herr, dias);
    const url = `${location.origin}/publico?t=${inv.token}`;

    document.getElementById('fResultado').innerHTML = `
      <div class="pn-link">
        <input id="fUrl" readonly value="${esc(url)}">
        <button class="rbp-btn" id="fCopiar">Copiar</button>
      </div>
      ${
        almacen.modo === 'local'
          ? `<div class="pn-nota"><b>Este link todavía no sirve para mandárselo al cliente.</b>
               La plataforma está guardando en el navegador, así que la invitación solo existe
               en esta máquina y en este navegador. Al conectar Supabase —completando el .env y
               corriendo supabase/schema.sql— el mismo link empieza a funcionar desde afuera
               sin cambiar nada más.</div>`
          : ''
      }`;

    document.getElementById('fCopiar').addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(url);
        avisar('Link copiado', 'ok');
      } catch {
        document.getElementById('fUrl').select();
        avisar('Copialo con Ctrl+C', 'info');
      }
    });
  });
}

/* --------------------------------------------------------------------------
   Eventos
   -------------------------------------------------------------------------- */
function cablear() {
  const cuerpo = ctx.cuerpo;

  cuerpo.querySelectorAll('#pnNueva, #pnNueva2').forEach((b) =>
    b.addEventListener('click', () => {
      const c = cuentaVacia('');
      abrirDlg(formularioCuenta(c, true));
      document.getElementById('fGuardar').addEventListener('click', () => guardarFormulario(c, true));
    })
  );

  // Abrir una herramienta desde la fila fija esa cuenta como activa: si no, se
  // abriría la herramienta con la cuenta de otra fila.
  cuerpo.querySelectorAll('[data-abrir]').forEach((a) =>
    a.addEventListener('click', (ev) => {
      ev.preventDefault();
      almacen.fijarCuentaActiva(a.dataset.abrir);
      location.href = a.dataset.pagina;
    })
  );

  cuerpo.querySelectorAll('[data-editar]').forEach((b) =>
    b.addEventListener('click', () => {
      const c = cuentas.find((x) => x.id === b.dataset.editar);
      abrirDlg(formularioCuenta(c, false));
      document.getElementById('fGuardar').addEventListener('click', () => guardarFormulario(c, false));
    })
  );

  cuerpo.querySelectorAll('[data-link]').forEach((b) =>
    b.addEventListener('click', () => dialogoLink(b.dataset.link))
  );

  cuerpo.querySelectorAll('[data-borrar]').forEach((b) =>
    b.addEventListener('click', async () => {
      const c = cuentas.find((x) => x.id === b.dataset.borrar);
      const e = estados.get(c.id) || {};
      const conDatos = Object.values(e).filter(Boolean).length;
      const aviso = conDatos
        ? `Se van a borrar también ${conDatos} evaluación${conDatos > 1 ? 'es' : ''} de esta cuenta.`
        : 'La cuenta no tiene evaluaciones cargadas.';
      if (!confirm(`Eliminar "${c.nombre}"?\n\n${aviso}\nEsta acción no se puede deshacer.`)) return;
      await almacen.borrarCuenta(c.id);
      if (almacen.cuentaActivaId() === c.id) almacen.fijarCuentaActiva(null);
      await cargar();
      render();
      await refrescarBarra();
      avisar('Cuenta eliminada', 'info');
    })
  );

  // Un click en la fila —fuera de los botones— cambia la cuenta activa.
  cuerpo.querySelectorAll('.pn-tabla tbody tr').forEach((tr) =>
    tr.addEventListener('click', (ev) => {
      if (ev.target.closest('.pn-acc')) return;
      almacen.fijarCuentaActiva(tr.dataset.id);
      location.reload();
    })
  );

  const d = dlg();
  d.addEventListener('click', (ev) => {
    if (ev.target.matches('[data-cerrar]') || ev.target === d) d.close();
  });
}

await cargar();
render();
