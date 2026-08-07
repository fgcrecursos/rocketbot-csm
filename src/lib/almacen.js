/* ==========================================================================
   ALMACÉN
   --------------------------------------------------------------------------
   Una sola interfaz con dos implementaciones detrás. Hoy escribe en
   localStorage; cuando existan las credenciales de Supabase en el .env pasa a
   escribir en la base sin que ninguna herramienta se entere.

   Toda la interfaz es asíncrona aunque el respaldo local no lo necesite: si
   fuera síncrona, el día que se enchufe Supabase habría que revisar cada
   llamada del proyecto.
   ========================================================================== */

import {
  cuentaVacia,
  evaluacionVacia,
  fusionarEnCuenta,
  PUENTES,
  HERRAMIENTAS,
} from './modelo.js';

const K = {
  cuentas: 'rbcsm.cuentas',
  evaluaciones: 'rbcsm.evaluaciones',
  invitaciones: 'rbcsm.invitaciones',
  activa: 'rbcsm.cuentaActiva',
  tema: 'rbcsm.tema',
};

/* --------------------------------------------------------------------------
   Respaldo local
   -------------------------------------------------------------------------- */

const leer = (k, def) => {
  try {
    const v = localStorage.getItem(k);
    return v ? JSON.parse(v) : def;
  } catch {
    return def;
  }
};
const escribir = (k, v) => {
  try {
    localStorage.setItem(k, JSON.stringify(v));
    return true;
  } catch (e) {
    console.error('[almacén] no se pudo escribir', k, e);
    return false;
  }
};

const respaldoLocal = {
  nombre: 'local',

  async listarCuentas() {
    return leer(K.cuentas, []).sort((a, b) => (b.actualizado || '').localeCompare(a.actualizado || ''));
  },
  async obtenerCuenta(id) {
    return leer(K.cuentas, []).find((c) => c.id === id) || null;
  },
  async guardarCuenta(c) {
    const cuentas = leer(K.cuentas, []);
    const i = cuentas.findIndex((x) => x.id === c.id);
    const guardada = { ...c, actualizado: new Date().toISOString() };
    if (i >= 0) cuentas[i] = guardada;
    else cuentas.push(guardada);
    escribir(K.cuentas, cuentas);
    return guardada;
  },
  async borrarCuenta(id) {
    escribir(K.cuentas, leer(K.cuentas, []).filter((c) => c.id !== id));
    escribir(K.evaluaciones, leer(K.evaluaciones, []).filter((e) => e.cuenta_id !== id));
    escribir(K.invitaciones, leer(K.invitaciones, []).filter((i) => i.cuenta_id !== id));
  },

  async listarEvaluaciones(cuentaId) {
    const todas = leer(K.evaluaciones, []);
    return cuentaId ? todas.filter((e) => e.cuenta_id === cuentaId) : todas;
  },
  async obtenerEvaluacion(cuentaId, herramientaId) {
    return (
      leer(K.evaluaciones, []).find((e) => e.cuenta_id === cuentaId && e.herramienta === herramientaId) ||
      null
    );
  },
  async guardarEvaluacion(ev) {
    const evs = leer(K.evaluaciones, []);
    const i = evs.findIndex((x) => x.id === ev.id);
    const guardada = { ...ev, actualizado: new Date().toISOString() };
    if (i >= 0) evs[i] = guardada;
    else evs.push(guardada);
    escribir(K.evaluaciones, evs);
    return guardada;
  },

  async listarInvitaciones(cuentaId) {
    const todas = leer(K.invitaciones, []);
    return cuentaId ? todas.filter((i) => i.cuenta_id === cuentaId) : todas;
  },
  async guardarInvitacion(inv) {
    const invs = leer(K.invitaciones, []);
    const i = invs.findIndex((x) => x.token === inv.token);
    if (i >= 0) invs[i] = inv;
    else invs.push(inv);
    escribir(K.invitaciones, invs);
    return inv;
  },
  async obtenerInvitacion(token) {
    return leer(K.invitaciones, []).find((i) => i.token === token) || null;
  },

  /* Lo que ve el cliente al abrir su link. Devuelve solo lo de esa invitación:
     el nombre de su empresa y lo que ya tenga cargado de esa herramienta. */
  async abrirInvitacion(token) {
    const inv = await this.obtenerInvitacion(token);
    if (!inv || new Date(inv.expira) < new Date()) return null;
    const cuenta = await this.obtenerCuenta(inv.cuenta_id);
    if (!cuenta) return null;
    const ev = await this.obtenerEvaluacion(inv.cuenta_id, inv.herramienta);
    return {
      cuenta_nombre: cuenta.nombre,
      industria: cuenta.industria,
      pais: cuenta.pais,
      herramienta: inv.herramienta,
      datos: ev ? ev.datos : null,
      completada: inv.completada,
    };
  },

  async guardarPorToken(token, { datos, resultado, estado }) {
    const inv = await this.obtenerInvitacion(token);
    if (!inv || new Date(inv.expira) < new Date()) return false;
    const ev = (await this.obtenerEvaluacion(inv.cuenta_id, inv.herramienta)) ||
      evaluacionVacia(inv.cuenta_id, inv.herramienta);
    await this.guardarEvaluacion({ ...ev, datos, resultado, estado, origen: 'cliente' });
    if (estado === 'completa') await this.guardarInvitacion({ ...inv, completada: true });
    return true;
  },
};

/* --------------------------------------------------------------------------
   Respaldo Supabase
   Se carga en diferido: si el proyecto corre sin credenciales, la librería
   ni siquiera se descarga.
   -------------------------------------------------------------------------- */

const respaldoSupabase = {
  nombre: 'supabase',
  _cli: null,

  async cliente() {
    if (this._cli) return this._cli;
    const { createClient } = await import('@supabase/supabase-js');
    this._cli = createClient(
      import.meta.env.VITE_SUPABASE_URL,
      import.meta.env.VITE_SUPABASE_ANON_KEY
    );
    return this._cli;
  },

  async listarCuentas() {
    const sb = await this.cliente();
    const { data, error } = await sb.from('csm_cuentas').select('*').order('actualizado', { ascending: false });
    if (error) throw error;
    return data || [];
  },
  async obtenerCuenta(id) {
    const sb = await this.cliente();
    const { data, error } = await sb.from('csm_cuentas').select('*').eq('id', id).maybeSingle();
    if (error) throw error;
    return data;
  },
  async guardarCuenta(c) {
    const sb = await this.cliente();
    const fila = { ...c, actualizado: new Date().toISOString() };
    const { data, error } = await sb.from('csm_cuentas').upsert(fila).select().single();
    if (error) throw error;
    return data;
  },
  async borrarCuenta(id) {
    const sb = await this.cliente();
    // Las evaluaciones e invitaciones caen por ON DELETE CASCADE (ver schema.sql)
    const { error } = await sb.from('csm_cuentas').delete().eq('id', id);
    if (error) throw error;
  },

  async listarEvaluaciones(cuentaId) {
    const sb = await this.cliente();
    let q = sb.from('csm_evaluaciones').select('*');
    if (cuentaId) q = q.eq('cuenta_id', cuentaId);
    const { data, error } = await q;
    if (error) throw error;
    return data || [];
  },
  async obtenerEvaluacion(cuentaId, herramientaId) {
    const sb = await this.cliente();
    const { data, error } = await sb
      .from('csm_evaluaciones')
      .select('*')
      .eq('cuenta_id', cuentaId)
      .eq('herramienta', herramientaId)
      .maybeSingle();
    if (error) throw error;
    return data;
  },
  async guardarEvaluacion(ev) {
    const sb = await this.cliente();
    const fila = { ...ev, actualizado: new Date().toISOString() };
    const { data, error } = await sb
      .from('csm_evaluaciones')
      .upsert(fila, { onConflict: 'cuenta_id,herramienta' })
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async listarInvitaciones(cuentaId) {
    const sb = await this.cliente();
    let q = sb.from('csm_invitaciones').select('*');
    if (cuentaId) q = q.eq('cuenta_id', cuentaId);
    const { data, error } = await q;
    if (error) throw error;
    return data || [];
  },
  async guardarInvitacion(inv) {
    const sb = await this.cliente();
    const { data, error } = await sb.from('csm_invitaciones').upsert(inv).select().single();
    if (error) throw error;
    return data;
  },
  async obtenerInvitacion(token) {
    const sb = await this.cliente();
    const { data, error } = await sb.from('csm_invitaciones').select('*').eq('token', token).maybeSingle();
    if (error) throw error;
    return data;
  },

  /* El cliente invitado no está autenticado y las tablas tienen RLS sin
     política para `anon`. Estas dos funciones del esquema son la única puerta:
     reciben el token, lo validan del lado del servidor y tocan únicamente la
     fila de esa invitación. */
  async abrirInvitacion(token) {
    const sb = await this.cliente();
    const { data, error } = await sb.rpc('csm_invitacion_abrir', { p_token: token });
    if (error) throw error;
    return data && data.length ? data[0] : null;
  },

  async guardarPorToken(token, { datos, resultado, estado }) {
    const sb = await this.cliente();
    const { data, error } = await sb.rpc('csm_invitacion_guardar', {
      p_token: token,
      p_datos: datos,
      p_resultado: resultado,
      p_estado: estado || 'borrador',
    });
    if (error) throw error;
    return data === true;
  },
};

/* --------------------------------------------------------------------------
   Selección del respaldo
   -------------------------------------------------------------------------- */

const hayCredenciales = Boolean(
  import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY
);
/* Permite forzar el modo local con Supabase configurado, para probar sin
   ensuciar la base. */
const forzadoLocal = (() => {
  try {
    return localStorage.getItem('rbcsm.forzarLocal') === '1';
  } catch {
    return false;
  }
})();

const respaldo = hayCredenciales && !forzadoLocal ? respaldoSupabase : respaldoLocal;

/* --------------------------------------------------------------------------
   API pública
   -------------------------------------------------------------------------- */

export const modo = respaldo.nombre;

/**
 * El cliente de Supabase, para lo que el almacén no cubre (hoy, el login).
 * Devuelve el mismo singleton que usa el resto del almacén — Supabase avisa
 * si hay dos instancias de GoTrue mirando el mismo storage, así que auth.js no
 * crea la suya. En modo local devuelve null: no hay nada que autenticar.
 */
export const clienteSupabase = () => (modo === 'supabase' ? respaldoSupabase.cliente() : null);

export const almacen = {
  modo: respaldo.nombre,

  /* ---- Cuentas ---- */
  listarCuentas: () => respaldo.listarCuentas(),
  obtenerCuenta: (id) => respaldo.obtenerCuenta(id),
  guardarCuenta: (c) => respaldo.guardarCuenta(c),
  borrarCuenta: (id) => respaldo.borrarCuenta(id),

  async crearCuenta(nombre) {
    return respaldo.guardarCuenta(cuentaVacia(nombre));
  },

  /* ---- Cuenta activa ---- */
  cuentaActivaId() {
    try {
      return localStorage.getItem(K.activa) || null;
    } catch {
      return null;
    }
  },
  fijarCuentaActiva(id) {
    try {
      if (id) localStorage.setItem(K.activa, id);
      else localStorage.removeItem(K.activa);
    } catch {
      /* modo incógnito sin storage: la cuenta activa dura lo que la pestaña */
    }
  },
  async cuentaActiva() {
    const id = this.cuentaActivaId();
    if (!id) return null;
    const c = await respaldo.obtenerCuenta(id);
    if (!c) this.fijarCuentaActiva(null); // quedó apuntando a una cuenta borrada
    return c;
  },

  /* ---- Evaluaciones ---- */
  listarEvaluaciones: (cuentaId) => respaldo.listarEvaluaciones(cuentaId),
  obtenerEvaluacion: (cuentaId, herr) => respaldo.obtenerEvaluacion(cuentaId, herr),
  guardarEvaluacion: (ev) => respaldo.guardarEvaluacion(ev),

  /** Devuelve la evaluación existente o crea una vacía sin persistirla todavía. */
  async evaluacionDe(cuentaId, herramientaId) {
    return (
      (await respaldo.obtenerEvaluacion(cuentaId, herramientaId)) ||
      evaluacionVacia(cuentaId, herramientaId)
    );
  },

  /**
   * Guarda el estado de una herramienta y, de paso, sincroniza hacia la cuenta
   * los campos de perfil que esa herramienta haya tocado. Es lo que hace que
   * cargar la industria en una aparezca en las otras tres.
   */
  async guardarTrabajo(cuentaId, herramientaId, { datos, resultado, estado, origen, perfil }) {
    const ev = await this.evaluacionDe(cuentaId, herramientaId);
    const guardada = await respaldo.guardarEvaluacion({
      ...ev,
      datos: datos ?? ev.datos,
      resultado: resultado ?? ev.resultado,
      estado: estado || ev.estado,
      origen: origen || ev.origen,
    });

    if (perfil) {
      const cuenta = await respaldo.obtenerCuenta(cuentaId);
      if (cuenta) {
        const puente = PUENTES[herramientaId];
        const parcial = puente ? puente.aCuenta(perfil) : perfil;
        await respaldo.guardarCuenta(fusionarEnCuenta(cuenta, parcial));
      }
    }
    return guardada;
  },

  /** Resumen por herramienta para el panel y para los puntos de la barra lateral. */
  async estadoDeCuenta(cuentaId) {
    const evs = await respaldo.listarEvaluaciones(cuentaId);
    const out = {};
    for (const h of HERRAMIENTAS) {
      const ev = evs.find((e) => e.herramienta === h.id);
      out[h.id] = ev
        ? { estado: ev.estado, resultado: ev.resultado, actualizado: ev.actualizado, origen: ev.origen }
        : null;
    }
    return out;
  },

  /* ---- Invitaciones (link público al cliente) ---- */
  listarInvitaciones: (cuentaId) => respaldo.listarInvitaciones(cuentaId),
  obtenerInvitacion: (token) => respaldo.obtenerInvitacion(token),

  async crearInvitacion(cuentaId, herramientaId, diasVigencia = 30) {
    const token = nuevoToken();
    const expira = new Date(Date.now() + diasVigencia * 864e5).toISOString();
    return respaldo.guardarInvitacion({
      token,
      cuenta_id: cuentaId,
      herramienta: herramientaId,
      expira,
      completada: false,
      creado: new Date().toISOString(),
    });
  },

  async marcarInvitacionCompletada(token) {
    const inv = await respaldo.obtenerInvitacion(token);
    if (!inv) return null;
    return respaldo.guardarInvitacion({ ...inv, completada: true });
  },

  /** Vista del cliente invitado. Devuelve null si el token no vale o venció. */
  abrirInvitacion: (token) => respaldo.abrirInvitacion(token),
  guardarPorToken: (token, payload) => respaldo.guardarPorToken(token, payload),

  /* ---- Tema ----
     Sin preferencia guardada se toma la del sistema operativo. El motor de
     Roadmap ya hacía esto por su cuenta; acá vale para las cuatro. */
  tema() {
    try {
      const guardado = localStorage.getItem(K.tema);
      if (guardado) return guardado;
    } catch {
      /* sin storage se cae igual a la preferencia del sistema */
    }
    return window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  },
  fijarTema(t) {
    try {
      localStorage.setItem(K.tema, t);
    } catch {
      /* sin storage el tema no se recuerda entre páginas, no es crítico */
    }
  },
};

/** Token de invitación: aleatorio del navegador, no derivado del id de cuenta. */
function nuevoToken() {
  const b = new Uint8Array(16);
  crypto.getRandomValues(b);
  return Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
}
