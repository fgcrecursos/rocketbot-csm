/* ==========================================================================
   VISTA DEL CLIENTE INVITADO
   --------------------------------------------------------------------------
   Misma herramienta, sin la plataforma alrededor. El cliente entra con un
   token en la URL, completa la evaluación y lo que responde vuelve a la cuenta
   del equipo de Rocketbot.

   Acá no hay selector de cuentas ni cartera: quien abre este link solo puede
   ver y escribir lo de su propia invitación.
   ========================================================================== */

import '../styles/tokens.css';
import '../styles/shell.css';
import '../styles/publico.css';
import '../styles/parches.css';

import { almacen } from '../lib/almacen.js';
import { fusionarEstado, instantanea, parametro } from '../lib/puente-motor.js';
import { herramienta } from '../lib/modelo.js';

const token = parametro('t');
const raiz = document.getElementById('raiz');

document.documentElement.setAttribute('data-theme', 'light');

/* --------------------------------------------------------------------------
   Pantallas de borde
   -------------------------------------------------------------------------- */
function pantalla(titulo, texto) {
  raiz.innerHTML = `
    <div class="pu-borde">
      <img src="/assets/logos/logo-header.png" alt="Rocketbot" class="pu-logo-borde">
      <h1>${titulo}</h1>
      <p>${texto}</p>
    </div>`;
}

if (!token) {
  pantalla(
    'Falta el enlace completo',
    'Esta página se abre con un enlace personal. Pedile a tu contacto en Rocketbot que te lo reenvíe.'
  );
} else {
  arrancar();
}

/* --------------------------------------------------------------------------
   Arranque
   -------------------------------------------------------------------------- */
async function arrancar() {
  let inv;
  try {
    inv = await almacen.abrirInvitacion(token);
  } catch (e) {
    console.error('[público] no se pudo abrir la invitación', e);
    pantalla('No pudimos abrir tu evaluación', 'Volvé a intentarlo en unos minutos o escribinos.');
    return;
  }

  if (!inv) {
    pantalla(
      'Este enlace ya no está disponible',
      'Puede haber vencido o haber sido reemplazado por uno nuevo. Escribile a tu contacto en Rocketbot para que te genere otro.'
    );
    return;
  }

  const h = herramienta(inv.herramienta);
  if (!h || !h.publica) {
    pantalla('Enlace no válido', 'La herramienta asociada a este enlace no está disponible para completar en línea.');
    return;
  }

  document.title = `${h.nombre} — ${inv.cuenta_nombre}`;
  montar(h, inv);
}

/* --------------------------------------------------------------------------
   Montaje de la herramienta
   -------------------------------------------------------------------------- */
async function montar(h, inv) {
  // El motor espera exactamente este marcado; es el mismo de las páginas
  // internas menos la barra de marca.
  raiz.innerHTML = `
    <header class="pu-top">
      <img src="/assets/logos/logo-header.png" alt="Rocketbot" class="pu-logo">
      <div class="pu-top-txt">
        <div class="t">${esc(h.nombre)}</div>
        <div class="s">${esc(inv.cuenta_nombre)}</div>
      </div>
      <div class="pu-estado" id="puEstado"><i></i><span>Se guarda solo</span></div>
    </header>

    <!-- La clase rbp-cuerpo no es decorativa: es el ámbito con el que
         parches.css corrige los contrastes de las herramientas heredadas. Sin
         ella, el cliente vería las mismas insignias ilegibles que ya se
         arreglaron del lado interno. -->
    <div class="rbp-cuerpo">
      <div class="progress-wrap no-print" id="progressWrap" style="display:none">
        <div class="shell progress-in"><ol class="steps" id="steps"></ol></div>
      </div>

      <main class="shell" id="app"></main>

      <footer class="pu-pie">
        Tus respuestas se guardan automáticamente y quedan disponibles para tu contacto en Rocketbot.
        Podés cerrar esta página y retomar más adelante con el mismo enlace.
      </footer>
    </div>`;

  // CSS y motor de la herramienta que corresponda, en diferido: la página
  // pública no carga las cuatro.
  if (h.id === 'madurez') {
    await import('../styles/tools/madurez.css');
    await import('../tools/madurez.motor.js');
  } else {
    await import('../styles/tools/oportunidades.css');
    await import('../tools/oportunidades.motor.js');
  }

  // Lo que el equipo ya sepa de la empresa se precarga para no volver a
  // preguntárselo al cliente.
  fusionarEstado(window.state.empresa, {
    industria: inv.industria || '',
    pais: inv.pais || '',
  });
  if (inv.datos) fusionarEstado(window.state, inv.datos);
  window.render();

  corregirPrivacidad();
  cablearGuardado(h);
}

/* --------------------------------------------------------------------------
   Aviso de privacidad
   --------------------------------------------------------------------------
   El motor de AI Readiness declara que "las respuestas no se envían a ningún
   servidor". Era cierto cuando el archivo se abría suelto; acá es falso: todo
   lo que el cliente responde queda guardado contra su cuenta y lo ve el equipo
   de Rocketbot. Decirle lo contrario a quien está completando el formulario no
   es un detalle de redacción.

   Se corrige sobre el DOM en vez de editar el motor, y con un observador
   porque la pantalla de introducción se vuelve a dibujar al navegar entre
   pasos.
   -------------------------------------------------------------------------- */
const VIEJO = 'Las respuestas no se envían a ningún servidor.';
const NUEVO =
  'Lo que respondas se guarda y queda disponible para tu contacto en Rocketbot, ' +
  'que es quien te compartió este enlace.';

function corregirPrivacidad() {
  const app = document.getElementById('app');
  if (!app) return;

  const pasada = () => {
    const paseo = document.createTreeWalker(app, NodeFilter.SHOW_TEXT);
    let n;
    while ((n = paseo.nextNode())) {
      if (n.nodeValue.includes(VIEJO)) n.nodeValue = n.nodeValue.replace(VIEJO, NUEVO);
    }
  };

  pasada();
  new MutationObserver(pasada).observe(app, { childList: true, subtree: true });
}

/* --------------------------------------------------------------------------
   Autoguardado contra el token
   -------------------------------------------------------------------------- */
function cablearGuardado(h) {
  const marcar = (e) => {
    const el = document.getElementById('puEstado');
    if (!el) return;
    el.dataset.e = e;
    el.querySelector('span').textContent = {
      guardando: 'Guardando…',
      guardado: 'Guardado',
      error: 'No se pudo guardar',
    }[e] || 'Se guarda solo';
  };

  function resumen() {
    const R = window.calcular();
    if (h.id === 'madurez') {
      return {
        nivel: R.nivel,
        nivelNombre: window.NIVELES[R.nivel - 1].nombre,
        global: R.global,
        pilares: Object.fromEntries(R.pilares.map((p) => [p.id, p.score])),
        respondidas: R.pilares.reduce((s, p) => s + p.respondidas, 0),
        totalPreguntas: R.pilares.reduce((s, p) => s + p.total, 0),
      };
    }
    return {
      scoreGlobal: R.scoreGlobal,
      horasActualesMes: Math.round(R.totalHorasActuales),
      ahorroMinMes: Math.round(R.totalMin),
      ahorroMaxMes: Math.round(R.totalMax),
      procesosDeclarados: R.oportunidades.length,
      procesosRelevantes: R.relevantes.length,
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

  function completa(r) {
    return h.id === 'madurez'
      ? r.respondidas >= r.totalPreguntas * 0.8
      : r.procesosDeclarados > 0;
  }

  let t = null;
  const agendar = () => {
    clearTimeout(t);
    marcar('guardando');
    t = setTimeout(async () => {
      try {
        const r = resumen();
        const ok = await almacen.guardarPorToken(token, {
          datos: instantanea(window.state),
          resultado: r,
          estado: completa(r) ? 'completa' : 'borrador',
        });
        marcar(ok ? 'guardado' : 'error');
      } catch (e) {
        console.error('[público] falló el guardado', e);
        marcar('error');
      }
    }, 1200);
  };

  const aEnganchar =
    h.id === 'madurez'
      ? ['setResp', 'setMulti', 'ir']
      : ['setEmpresa', 'setQual', 'setProc', 'setEstado', 'ir'];

  for (const n of aEnganchar) {
    const fn = window[n];
    if (typeof fn !== 'function') continue;
    window[n] = function (...args) {
      const r = fn.apply(this, args);
      agendar();
      return r;
    };
  }
}

const esc = (s) =>
  String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
