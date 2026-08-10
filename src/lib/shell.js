/* ==========================================================================
   ARMAZÓN
   --------------------------------------------------------------------------
   Dibuja la barra lateral y la barra superior, y le entrega a cada herramienta
   la cuenta activa junto con su evaluación. También resuelve el tema, el aviso
   de guardado y el cambio de cuenta.

   Las herramientas no importan el almacén directamente: reciben de acá un
   objeto `ctx` con lo que necesitan. Así, si mañana cambia dónde se guarda, no
   hay que tocar cuatro archivos.
   ========================================================================== */

import { almacen } from './almacen.js';
import { HERRAMIENTAS, herramienta, iniciales, PUENTES } from './modelo.js';
import { requiereLogin, sesionActual, perfilActual, cerrarSesion, esSupervisor } from './auth.js';

const LOGO_BLANCO = '/assets/logos/logo-header-white.png';

/* --------------------------------------------------------------------------
   Tema
   -------------------------------------------------------------------------- */

export function aplicarTema(t) {
  const raiz = document.documentElement;

  /* Las transiciones se apagan mientras se cambia el atributo. Varias reglas
     heredadas animan el atajo `background` con un valor `var(...)` adentro
     —`.btn`, `.layer`, `.prod`—, y cuando la variable cambia en mitad de esa
     transición el fondo se queda congelado en el color del tema anterior. Se
     veía como texto claro sobre tarjeta clara, y no se recuperaba ni volviendo
     a cambiar de tema. De paso, el cambio deja de ser un fundido de 200 ms de
     toda la página. */
  raiz.classList.add('rbp-sin-transicion');
  raiz.setAttribute('data-theme', t);
  void raiz.offsetHeight; // fuerza el recálculo con las transiciones apagadas
  requestAnimationFrame(() => raiz.classList.remove('rbp-sin-transicion'));

  almacen.fijarTema(t);
  document.querySelectorAll('[data-rbp-tema-txt]').forEach((el) => {
    el.textContent = t === 'dark' ? 'Modo claro' : 'Modo oscuro';
  });
  // Para las herramientas que pintan con colores calculados en JavaScript y no
  // pueden enterarse por CSS de que cambió el tema.
  document.dispatchEvent(new CustomEvent('rbp:tema', { detail: { tema: t } }));
}

export function temaInicial() {
  aplicarTema(almacen.tema());
}

/* --------------------------------------------------------------------------
   Avisos
   -------------------------------------------------------------------------- */

export function avisar(msg, tipo = 'info', ms = 2600) {
  let cont = document.querySelector('.rbp-avisos');
  if (!cont) {
    cont = document.createElement('div');
    cont.className = 'rbp-avisos';
    document.body.appendChild(cont);
  }
  const el = document.createElement('div');
  el.className = 'rbp-aviso';
  el.dataset.t = tipo;
  el.textContent = msg;
  cont.appendChild(el);
  setTimeout(() => el.remove(), ms);
}

/* --------------------------------------------------------------------------
   Marcado
   -------------------------------------------------------------------------- */

const CHEVRON =
  '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>';

function barraLateral(idActiva, cuenta, cuentas, estado, perfil) {
  const ini = cuenta ? iniciales(cuenta.nombre) : '—';
  const nombre = cuenta ? cuenta.nombre || 'Cuenta sin nombre' : 'Sin cuenta activa';
  const sub = cuenta
    ? [cuenta.industria, cuenta.pais].filter(Boolean).join(' · ') || 'Perfil incompleto'
    : 'Elegí una cuenta';

  const opciones = cuentas.length
    ? cuentas
        .map(
          (c) => `<button class="rbp-cuenta-op" role="option" data-id="${c.id}"
             aria-current="${c.id === (cuenta && cuenta.id)}">
             ${esc(c.nombre || 'Sin nombre')}
             <span class="sub">${esc([c.industria, c.pais].filter(Boolean).join(' · ') || 'Perfil incompleto')}</span>
           </button>`
        )
        .join('')
    : '<div style="padding:10px 12px;font-size:12.5px;color:var(--ink-3)">Todavía no hay cuentas.</div>';

  return `
  <aside class="rbp-side no-print">
    <div class="rbp-brand">
      <img src="${LOGO_BLANCO}" alt="Rocketbot">
      <div class="txt">
        <div class="t">Centro CSM</div>
        <div class="s">Customer Success</div>
      </div>
    </div>

    <div class="rbp-cuenta" id="rbpCuenta">
      <button class="rbp-cuenta-btn" id="rbpCuentaBtn" aria-haspopup="listbox" aria-expanded="false">
        <span class="rbp-cuenta-ini">${esc(ini)}</span>
        <span class="rbp-cuenta-txt">
          <span class="n">${esc(nombre)}</span>
          <span class="m">${esc(sub)}</span>
        </span>
        <span class="rbp-cuenta-cv">${CHEVRON}</span>
      </button>
      <div class="rbp-cuenta-menu" role="listbox" aria-label="Cuentas">
        ${opciones}
        <div class="rbp-cuenta-sep"></div>
        <button class="rbp-cuenta-op nueva" id="rbpNuevaCuenta">+ Cuenta nueva</button>
        <a class="rbp-cuenta-op" href="/">Ver toda la cartera</a>
      </div>
    </div>

    <nav class="rbp-nav" aria-label="Herramientas">
      <div class="rbp-nav-tit">Herramientas</div>
      ${HERRAMIENTAS.map((h) => {
        const tiene = estado && estado[h.id];
        return `<a class="rbp-nav-i ${tiene ? 'con-datos' : ''}" data-c="${h.n}"
                   href="${h.pagina}" ${h.id === idActiva ? 'aria-current="page"' : ''}
                   title="${esc(h.nombre)}">
                  <span class="rbp-nav-n">0${h.n}</span>${esc(h.corto)}
                  <span class="rbp-nav-pt" title="Con datos cargados"></span>
                </a>`;
      }).join('')}
      <div class="rbp-nav-tit">Cartera</div>
      <a class="rbp-nav-i" href="/" ${idActiva === 'panel' ? 'aria-current="page"' : ''}>
        <span class="rbp-nav-n">◫</span>Panel
      </a>
      ${
        esSupervisor(perfil)
          ? `<a class="rbp-nav-i" href="/equipo" ${idActiva === 'equipo' ? 'aria-current="page"' : ''}>
               <span class="rbp-nav-n">☺</span>Equipo
             </a>`
          : ''
      }
    </nav>

    <div class="rbp-side-pie">
      ${
        perfil
          ? `<div class="rbp-perfil">
               <div class="n">${esc(perfil.nombre)}</div>
               <div class="p">${esc(perfil.puesto || perfil.email)}</div>
             </div>`
          : ''
      }
      <button class="rbp-side-btn" id="rbpTema"><span data-rbp-tema-txt>Modo oscuro</span></button>
      ${requiereLogin ? '<button class="rbp-side-btn" id="rbpSalir">Cerrar sesión</button>' : ''}
    </div>
  </aside>`;
}

function barraSuperior(h, idHerr) {
  const titulo = h ? h.nombre : idHerr === 'equipo' ? 'Equipo' : 'Centro CSM';
  const sub = h ? 'Herramienta 0' + h.n : idHerr === 'equipo' ? 'Estado de las cuentas' : 'Cartera de cuentas';
  return `
  <header class="rbp-top no-print">
    <div class="rbp-top-tit">${esc(titulo)}<small>${esc(sub)}</small></div>
    <div class="rbp-top-sp"></div>
    <div class="rbp-estado" id="rbpEstado" data-e="limpio"><i></i><span>Sin cambios</span></div>
    <div class="rbp-top-acc" id="rbpAcciones"></div>
  </header>`;
}

const esc = (s) =>
  String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/* --------------------------------------------------------------------------
   Arranque
   -------------------------------------------------------------------------- */

/**
 * Monta el armazón alrededor del contenido que ya está en el documento.
 *
 * @param {object} opciones
 * @param {string} opciones.herramienta  id de la herramienta, o 'panel'
 * @param {boolean} [opciones.exigeCuenta=true]  si sin cuenta activa hay que
 *        tapar el contenido con un aviso en vez de dejar operar en el vacío
 * @returns {Promise<object>} contexto para la herramienta
 */
export async function montarShell({ herramienta: idHerr, exigeCuenta = true }) {
  // La guardia va antes que cualquier otra cosa: sin sesión no hay cuentas que
  // mostrar. Si redirige, se cuelga a propósito con una promesa que nunca
  // resuelve — el llamador tiene un `await montarShell(...)` seguido de más
  // trabajo (cargar el motor, restaurar datos), y nada de eso debe correr
  // mientras el navegador procesa el redirect.
  if (requiereLogin && !(await sesionActual())) {
    location.replace('/login?volver=' + encodeURIComponent(location.pathname + location.search));
    await new Promise(() => {});
  }
  perfilCache = requiereLogin ? await perfilActual() : null;

  temaInicial();

  const h = idHerr === 'panel' || idHerr === 'equipo' ? null : herramienta(idHerr);
  const cuentas = await almacen.listarCuentas();
  let cuenta = await almacen.cuentaActiva();

  // Si no hay cuenta activa pero sí cuentas, se toma la última tocada. Obligar
  // a elegir cuando hay una sola opción razonable es fricción sin ganancia.
  if (!cuenta && cuentas.length) {
    cuenta = cuentas[0];
    almacen.fijarCuentaActiva(cuenta.id);
  }

  const estado = cuenta ? await almacen.estadoDeCuenta(cuenta.id) : null;

  // El contenido original de la página pasa a ser el cuerpo del armazón.
  const cuerpo = document.createElement('div');
  cuerpo.className = 'rbp-cuerpo';
  while (document.body.firstChild) cuerpo.appendChild(document.body.firstChild);

  document.body.innerHTML = `<div class="rbp">${barraLateral(idHerr, cuenta, cuentas, estado, perfilCache)}
    <div class="rbp-main">${barraSuperior(h, idHerr)}</div></div>`;
  document.querySelector('.rbp-main').appendChild(cuerpo);

  herrActual = idHerr;
  cablearBarra();
  aplicarTema(almacen.tema());

  if (!cuenta && exigeCuenta) {
    cuerpo.style.display = 'none';
    const aviso = document.createElement('div');
    aviso.className = 'rbp-sin-cuenta';
    aviso.innerHTML = `
      <h2>Elegí una cuenta para empezar</h2>
      <p>Esta herramienta trabaja sobre una cuenta concreta. El perfil que cargues
         acá queda disponible para las otras tres.</p>
      <button class="rbp-btn rbp-btn-primario" id="rbpCrear">Crear la primera cuenta</button>`;
    document.querySelector('.rbp-main').appendChild(aviso);
    aviso.querySelector('#rbpCrear').addEventListener('click', crearCuenta);
  }

  const ev = cuenta && h ? await almacen.evaluacionDe(cuenta.id, idHerr) : null;

  return {
    cuenta,
    evaluacion: ev,
    herramienta: h,
    cuerpo,
    modo: almacen.modo,
    /** Perfil de la cuenta con los nombres de campo que espera este motor. */
    perfilParaMotor: () => (cuenta && PUENTES[idHerr] ? PUENTES[idHerr].aMotor(cuenta) : {}),
    marcarEstado,
    avisar,
    montarAcciones(html) {
      const cont = document.getElementById('rbpAcciones');
      if (cont) cont.innerHTML = html;
      return cont;
    },
    /** Guarda el trabajo de la herramienta. Devuelve false si no hay cuenta. */
    async guardar({ datos, resultado, estado: est, perfil }) {
      if (!cuenta) return false;
      marcarEstado('guardando');
      try {
        await almacen.guardarTrabajo(cuenta.id, idHerr, { datos, resultado, estado: est, perfil });
        marcarEstado('guardado');
        return true;
      } catch (e) {
        console.error('[armazón] falló el guardado', e);
        marcarEstado('error');
        avisar('No se pudo guardar. Revisá la consola.', 'error', 4000);
        return false;
      }
    },
  };
}

function marcarEstado(e) {
  const el = document.getElementById('rbpEstado');
  if (!el) return;
  el.dataset.e = e;
  el.querySelector('span').textContent = {
    limpio: 'Sin cambios',
    guardando: 'Guardando…',
    guardado: 'Guardado',
    error: 'No se guardó',
  }[e] || '';
}

async function crearCuenta() {
  const nombre = prompt('Nombre de la cuenta');
  if (!nombre || !nombre.trim()) return;
  const c = await almacen.crearCuenta(nombre.trim());
  almacen.fijarCuentaActiva(c.id);
  location.reload();
}

/* Qué herramienta está abierta, para poder redibujar la barra sin que quien
   llama tenga que volver a decirlo. */
let herrActual = 'panel';

/* El perfil del usuario logueado, cargado una vez en montarShell(). No cambia
   durante la sesión, así que refrescarBarra() lo reutiliza en vez de
   volver a pedirlo cada vez que se crea o edita una cuenta. */
let perfilCache = null;

/**
 * Redibuja la barra lateral con las cuentas y los estados actuales.
 *
 * Hace falta porque el panel crea y edita cuentas sin recargar la página: sin
 * esto, se creaba una cuenta, quedaba activa, y la barra seguía diciendo "Sin
 * cuenta activa" hasta que el usuario navegara a otro lado.
 */
export async function refrescarBarra() {
  const vieja = document.querySelector('.rbp-side');
  if (!vieja) return;

  const cuentas = await almacen.listarCuentas();
  const cuenta = await almacen.cuentaActiva();
  const estado = cuenta ? await almacen.estadoDeCuenta(cuenta.id) : null;

  const molde = document.createElement('div');
  molde.innerHTML = barraLateral(herrActual, cuenta, cuentas, estado, perfilCache);
  vieja.replaceWith(molde.firstElementChild);
  cablearBarra();
}

function cablearBarra() {
  const tema = document.getElementById('rbpTema');
  if (tema) {
    tema.addEventListener('click', () => {
      aplicarTema(document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark');
    });
  }
  aplicarTema(document.documentElement.getAttribute('data-theme') || almacen.tema());

  const caja = document.getElementById('rbpCuenta');
  const btn = document.getElementById('rbpCuentaBtn');
  if (!caja || !btn) return;

  const cerrar = () => {
    caja.classList.remove('abierto');
    btn.setAttribute('aria-expanded', 'false');
  };

  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    const abierto = caja.classList.toggle('abierto');
    btn.setAttribute('aria-expanded', String(abierto));
  });
  document.addEventListener('click', (e) => {
    if (!caja.contains(e.target)) cerrar();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') cerrar();
  });

  caja.querySelectorAll('.rbp-cuenta-op[data-id]').forEach((op) => {
    op.addEventListener('click', () => {
      almacen.fijarCuentaActiva(op.dataset.id);
      location.reload();
    });
  });
  const nueva = document.getElementById('rbpNuevaCuenta');
  if (nueva) nueva.addEventListener('click', crearCuenta);

  const salir = document.getElementById('rbpSalir');
  if (salir) {
    salir.addEventListener('click', async () => {
      salir.disabled = true;
      await cerrarSesion();
      location.href = '/login';
    });
  }
}

/** Autoguardado con espera: no escribe en cada tecla. */
export function autoguardado(fn, ms = 900) {
  let t = null;
  return (...args) => {
    clearTimeout(t);
    marcarEstado('guardando');
    t = setTimeout(() => fn(...args), ms);
  };
}
