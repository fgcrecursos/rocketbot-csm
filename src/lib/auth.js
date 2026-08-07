/* ==========================================================================
   AUTENTICACIÓN DEL EQUIPO
   --------------------------------------------------------------------------
   Sesión de equipo interno con Supabase Auth. El alta es de auto-registro:
   cualquiera que llegue a login.html puede crearse una cuenta con nombre,
   email, puesto y contraseña — no hay aprobación de un admin ni restricción
   de dominio de correo. Es la política que se acordó al conectar la base: más
   simple para que el equipo se sume solo, a cambio de que quien conozca la URL
   de la plataforma pueda darse de alta.

   En modo localStorage no hay nada que autenticar: todas las funciones de acá
   resuelven a "no hay sesión" sin tocar red, y montarShell() no exige login.
   ========================================================================== */

import { modo, clienteSupabase } from './almacen.js';

export const requiereLogin = modo === 'supabase';

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
  const sb = await clienteSupabase();
  const { data, error } = await sb.auth.signInWithPassword({ email, password });
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
 */
export async function registrarse({ nombre, email, puesto, password }) {
  const sb = await clienteSupabase();
  const { data, error } = await sb.auth.signUp({
    email,
    password,
    options: { data: { nombre, puesto: puesto || '' } },
  });
  if (error) throw error;
  return { session: data.session, confirmarEmail: !data.session };
}

export async function cerrarSesion() {
  if (!requiereLogin) return;
  const sb = await clienteSupabase();
  await sb.auth.signOut();
}
