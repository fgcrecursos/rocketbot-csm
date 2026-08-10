/* ==========================================================================
   AUTENTICACIÓN DEL EQUIPO
   --------------------------------------------------------------------------
   Sesión de equipo interno con Supabase Auth. El alta y el login están
   restringidos a la whitelist `csm_usuarios_permitidos` de schema.sql — no
   cualquiera que llegue a login.html puede entrar. El chequeo de acá es solo
   para dar un mensaje claro sin gastar un intento contra Supabase Auth: la
   barrera real es el trigger de la base (`csm_verificar_email_permitido`),
   que corre server-side y no se puede saltear llamando a la API directo.

   En modo localStorage no hay nada que autenticar: todas las funciones de acá
   resuelven a "no hay sesión" sin tocar red, y montarShell() no exige login.
   ========================================================================== */

import { modo, clienteSupabase } from './almacen.js';

export const requiereLogin = modo === 'supabase';

const NO_AUTORIZADO = 'CSM_NO_AUTORIZADO';

/** Rol en la whitelist para ese email, o null si no está autorizado. */
async function rolPermitido(email) {
  const sb = await clienteSupabase();
  const { data, error } = await sb
    .from('csm_usuarios_permitidos')
    .select('rol')
    .eq('email', email)
    .maybeSingle();
  if (error) {
    console.error('[auth] no se pudo verificar la whitelist', error);
    return null; // ante la duda, no se deja pasar
  }
  return data ? data.rol : null;
}

/** Sesión activa, o null. En modo local, siempre null. */
export async function sesionActual() {
  if (!requiereLogin) return null;
  const sb = await clienteSupabase();
  const {
    data: { session },
  } = await sb.auth.getSession();
  return session;
}

/** Perfil del equipo (nombre, email, puesto) para el usuario de la sesión activa. */
export async function perfilActual() {
  if (!requiereLogin) return null;
  const sesion = await sesionActual();
  if (!sesion) return null;
  const sb = await clienteSupabase();
  const { data, error } = await sb
    .from('csm_perfiles')
    .select('*')
    .eq('id', sesion.user.id)
    .maybeSingle();
  if (error) {
    console.error('[auth] no se pudo leer el perfil', error);
    return null;
  }
  return data;
}

export async function iniciarSesion(email, password) {
  const correo = email.trim().toLowerCase();
  if (!(await rolPermitido(correo))) throw new Error(NO_AUTORIZADO);
  const sb = await clienteSupabase();
  const { data, error } = await sb.auth.signInWithPassword({ email: correo, password });
  if (error) throw error;
  return data.session;
}

/**
 * Da de alta al usuario y su perfil. `nombre` y `puesto` viajan como metadatos
 * de auth.users; el trigger `csm_crear_perfil` del schema los copia a
 * `csm_perfiles` apenas se crea la fila, así que acá no hay un segundo insert
 * que pueda quedar desincronizado del alta.
 *
 * Si el proyecto de Supabase tiene la confirmación de email activada (es el
 * valor por defecto), `data.session` viene null hasta que la persona confirme
 * desde su correo — se lo señala devolviendo `confirmarEmail:true`.
 *
 * `emailRedirectTo` usa `location.origin` en vez de una URL fija porque el
 * mismo código de alta corre en local (localhost:5187) y en producción
 * (rocketbot-csm.vercel.app); las dos están cargadas en la lista de Redirect
 * URLs del proyecto de Supabase, y una que no esté en esa lista Supabase la
 * ignora silenciosamente y cae al Site URL en su lugar.
 */
export async function registrarse({ nombre, email, puesto, password }) {
  const correo = email.trim().toLowerCase();
  if (!(await rolPermitido(correo))) throw new Error(NO_AUTORIZADO);
  const sb = await clienteSupabase();
  const { data, error } = await sb.auth.signUp({
    email: correo,
    password,
    options: {
      data: { nombre, puesto: puesto || '' },
      emailRedirectTo: `${location.origin}/confirmado.html`,
    },
  });
  if (error) throw error;
  return { session: data.session, confirmarEmail: !data.session };
}

export async function cerrarSesion() {
  if (!requiereLogin) return;
  const sb = await clienteSupabase();
  await sb.auth.signOut();
}

export const esSupervisor = (perfil) => Boolean(perfil && perfil.rol === 'supervisor');

/** Estado de las cuentas del equipo. Solo responde si el perfil de la sesión es 'supervisor'. */
export async function estadoEquipo() {
  const sb = await clienteSupabase();
  const { data, error } = await sb.rpc('csm_estado_equipo');
  if (error) throw error;
  return data || [];
}
