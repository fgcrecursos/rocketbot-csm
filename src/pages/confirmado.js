/* ==========================================================================
   CONFIRMACIÓN DE EMAIL
   --------------------------------------------------------------------------
   A esta página vuelve el link que Supabase manda por correo al registrarse.
   El propio cliente de Supabase ya validó el token contra el servidor antes
   de redirigir acá — si el link era inválido o venció, Supabase ni siquiera
   llega a redirigir, muestra su propio error. Lo que queda por resolver acá
   es leer el resultado de esa validación, que llega de dos formas posibles
   según el tipo de flujo del proyecto:

     · Implícito (el default de este proyecto): la sesión viaja en el hash de
       la URL (#access_token=...). `createClient()` la detecta y la guarda
       sola apenas se instancia — acá solo hace falta confirmar que quedó.
     · PKCE: viaja como `?code=...` y hay que cambiarlo por sesión a mano con
       `exchangeCodeForSession`.

   Se cubren los dos casos porque cuál de ellos use un proyecto de Supabase no
   está fijado en el código de esta plataforma, sino en la configuración del
   proyecto — y esa configuración puede cambiar sin que nadie toque este
   archivo.
   ========================================================================== */

import '../styles/tokens.css';
import '../styles/shell.css';
import '../styles/login.css';

import { requiereLogin } from '../lib/auth.js';
import { clienteSupabase } from '../lib/almacen.js';

/* `arrancar()` corre de inmediato (más abajo) y su primer tramo, antes de
   cualquier await, ya llama a pantalla() — que lee ICONOS. Todo lo que
   pantalla()/traducirError() necesitan tiene que estar declarado antes de esa
   llamada, o cae en la zona muerta temporal de su propio `const` y el módulo
   entero aborta. Mismo bug que ya salió una vez en health.js. */
const ICONOS = {
  espera:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M21 12a9 9 0 11-3.8-7.3"/></svg>',
  ok: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>',
  mal: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>',
};

function pantalla({ icono, titulo, texto, boton }) {
  document.body.innerHTML = `
    <div class="lg-caja">
      <img src="/assets/logos/logo-header.png" alt="Rocketbot" class="lg-logo">
      <div class="lg-tarjeta cf-centro">
        <div class="cf-icono cf-${icono}">${ICONOS[icono]}</div>
        <h1>${titulo}</h1>
        <p>${texto}</p>
        ${boton ? `<button class="lg-btn" id="cfBtn">${boton}</button>` : ''}
      </div>
    </div>`;
}

/** Traduce los `error_description` más comunes que manda Supabase en la URL. */
function traducirError(desc) {
  const d = String(desc || '').toLowerCase();
  if (d.includes('expired') || d.includes('otp')) {
    return 'El enlace venció. Pedí que te reenvíen la confirmación o creá la cuenta de nuevo desde el login.';
  }
  if (d.includes('already') && d.includes('confirm')) {
    return 'Este email ya estaba confirmado. Podés iniciar sesión directamente.';
  }
  return 'El enlace no es válido, ya se usó, o venció. Probá iniciar sesión, o pedí que te reenvíen la confirmación.';
}

if (!requiereLogin) {
  // Sin Supabase no hay nada que confirmar: login.html hace el mismo chequeo
  // y de ahí cae al panel.
  location.replace('/login.html');
} else {
  arrancar();
}

async function arrancar() {
  document.documentElement.setAttribute(
    'data-theme',
    (() => {
      try {
        return localStorage.getItem('rbcsm.tema') || 'light';
      } catch {
        return 'light';
      }
    })()
  );

  pantalla({ icono: 'espera', titulo: 'Confirmando tu cuenta…', texto: 'Un segundo.' });

  // Supabase manda los errores (link vencido, ya usado) como parámetros de la
  // URL en vez de redirigir con sesión; pueden venir en la query o en el hash
  // según el paso donde haya fallado.
  const query = new URLSearchParams(location.search);
  const hash = new URLSearchParams(location.hash.replace(/^#/, ''));
  const errorDescripcion = query.get('error_description') || hash.get('error_description');
  const code = query.get('code');

  let confirmada = false;

  if (!errorDescripcion) {
    try {
      const sb = await clienteSupabase();
      if (code) {
        const { error } = await sb.auth.exchangeCodeForSession(code);
        confirmada = !error;
      } else {
        // Flujo implícito: si el token era válido, el cliente ya guardó la
        // sesión al instanciarse, antes de que este código corriera.
        const {
          data: { session },
        } = await sb.auth.getSession();
        confirmada = !!session;
      }
    } catch (e) {
      console.error('[confirmado] error validando la confirmación', e);
      confirmada = false;
    }
  }

  // El hash con el token no debe quedar visible ni reusable en el historial.
  history.replaceState(null, '', location.pathname);

  if (confirmada) {
    pantalla({
      icono: 'ok',
      titulo: 'Cuenta confirmada',
      texto: 'Ya podés entrar al Centro CSM con tu email y tu contraseña.',
      boton: 'Ir a iniciar sesión',
    });
  } else {
    pantalla({
      icono: 'mal',
      titulo: 'No pudimos confirmar tu cuenta',
      texto: traducirError(errorDescripcion),
      boton: 'Ir a iniciar sesión',
    });
  }

  document.getElementById('cfBtn').addEventListener('click', () => {
    location.href = '/login.html';
  });
}
