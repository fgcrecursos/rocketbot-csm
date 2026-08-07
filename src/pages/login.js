/* ==========================================================================
   LOGIN / REGISTRO
   --------------------------------------------------------------------------
   Puerta de entrada del equipo interno. Solo existe cuando la plataforma
   corre contra Supabase: en modo localStorage no hay sesión que iniciar, así
   que esta página redirige derecho al panel.
   ========================================================================== */

import '../styles/tokens.css';
import '../styles/shell.css';
import '../styles/login.css';

import { requiereLogin, sesionActual, iniciarSesion, registrarse } from '../lib/auth.js';

const volver = new URLSearchParams(location.search).get('volver') || '/index.html';

if (!requiereLogin) {
  location.replace(volver);
} else {
  arrancar();
}

async function arrancar() {
  // Si ya hay sesión (por ejemplo, se llegó acá desde un link viejo), no tiene
  // sentido mostrar el formulario de nuevo.
  const sesion = await sesionActual();
  if (sesion) {
    location.replace(volver);
    return;
  }

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

  document.body.innerHTML = `
    <div class="lg-caja">
      <img src="/assets/logos/logo-header.png" alt="Rocketbot" class="lg-logo">
      <div class="lg-tarjeta">
        <div class="lg-tabs" role="tablist">
          <button class="lg-tab" role="tab" id="tabEntrar" aria-selected="true">Iniciar sesión</button>
          <button class="lg-tab" role="tab" id="tabCrear" aria-selected="false">Crear cuenta</button>
        </div>
        <div id="zona"></div>
      </div>
      <p class="lg-nota">Centro CSM · uso interno de Rocketbot</p>
    </div>`;

  const zona = document.getElementById('zona');
  const tabEntrar = document.getElementById('tabEntrar');
  const tabCrear = document.getElementById('tabCrear');

  const activar = (tab) => {
    tabEntrar.setAttribute('aria-selected', String(tab === 'entrar'));
    tabCrear.setAttribute('aria-selected', String(tab === 'crear'));
    zona.innerHTML = tab === 'entrar' ? formEntrar() : formCrear();
    cablear(tab);
  };

  tabEntrar.addEventListener('click', () => activar('entrar'));
  tabCrear.addEventListener('click', () => activar('crear'));
  activar('entrar');
}

function formEntrar() {
  return `
    <form id="fEntrar">
      <div class="lg-campo">
        <label for="eEmail">Email</label>
        <input id="eEmail" type="email" required autocomplete="email" autofocus>
      </div>
      <div class="lg-campo">
        <label for="ePass">Contraseña</label>
        <input id="ePass" type="password" required autocomplete="current-password">
      </div>
      <button class="lg-btn" type="submit">Entrar</button>
      <div id="msg"></div>
    </form>`;
}

function formCrear() {
  return `
    <form id="fCrear">
      <div class="lg-campo">
        <label for="cNombre">Nombre</label>
        <input id="cNombre" type="text" required autocomplete="name" autofocus>
      </div>
      <div class="lg-campo">
        <label for="cEmail">Email</label>
        <input id="cEmail" type="email" required autocomplete="email">
      </div>
      <div class="lg-campo">
        <label for="cPuesto">Puesto</label>
        <input id="cPuesto" type="text" placeholder="CSM, Account Manager, etc." autocomplete="organization-title">
      </div>
      <div class="lg-campo">
        <label for="cPass">Contraseña</label>
        <input id="cPass" type="password" required autocomplete="new-password" minlength="8">
      </div>
      <button class="lg-btn" type="submit">Crear cuenta</button>
      <div id="msg"></div>
    </form>`;
}

function mensaje(tipo, texto) {
  const el = document.getElementById('msg');
  if (el) el.innerHTML = `<div class="lg-msg" data-t="${tipo}">${texto}</div>`;
}

/** Supabase Auth devuelve mensajes en inglés; se traducen los más comunes. */
function traducirError(e) {
  const m = String(e && e.message || e);
  if (/Invalid login credentials/i.test(m)) return 'Email o contraseña incorrectos.';
  if (/User already registered/i.test(m)) return 'Ya existe una cuenta con ese email. Iniciá sesión.';
  if (/Password should be at least/i.test(m)) return 'La contraseña necesita al menos 8 caracteres.';
  if (/Unable to validate email address/i.test(m)) return 'Ese email no es válido.';
  return m;
}

function cablear(tab) {
  const form = document.getElementById(tab === 'entrar' ? 'fEntrar' : 'fCrear');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = form.querySelector('button');
    btn.disabled = true;
    try {
      if (tab === 'entrar') {
        await iniciarSesion(document.getElementById('eEmail').value.trim(), document.getElementById('ePass').value);
        location.href = volver;
      } else {
        const { confirmarEmail } = await registrarse({
          nombre: document.getElementById('cNombre').value.trim(),
          email: document.getElementById('cEmail').value.trim(),
          puesto: document.getElementById('cPuesto').value.trim(),
          password: document.getElementById('cPass').value,
        });
        if (confirmarEmail) {
          mensaje('ok', 'Cuenta creada. Revisá tu correo y confirmá el email antes de iniciar sesión.');
          btn.disabled = false;
        } else {
          location.href = volver;
        }
      }
    } catch (err) {
      console.error('[login]', err);
      mensaje('error', traducirError(err));
      btn.disabled = false;
    }
  });
}
