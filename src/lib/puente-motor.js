/* ==========================================================================
   PUENTE CON LOS MOTORES
   --------------------------------------------------------------------------
   Los cuatro motores de cálculo se conservan tal como venían. Para enterarse
   de que el usuario cambió algo sin meter mano adentro, se envuelven desde
   afuera las funciones que ya existen y que cada motor llama al mutar su
   estado. Es la única manera de agregar autoguardado sin tocar el cálculo.
   ========================================================================== */

/**
 * Envuelve funciones globales del motor para que, además de lo suyo, avisen.
 * Devuelve una función que deshace el parcheo.
 */
export function alCambiar(nombres, cb) {
  const originales = new Map();
  for (const n of nombres) {
    const fn = window[n];
    if (typeof fn !== 'function') {
      console.warn(`[puente] ${n} no es una función del motor; no se engancha`);
      continue;
    }
    originales.set(n, fn);
    window[n] = function (...args) {
      const r = fn.apply(this, args);
      try {
        cb(n, args);
      } catch (e) {
        console.error('[puente] falló el aviso de cambio', e);
      }
      return r;
    };
  }
  return () => originales.forEach((fn, n) => (window[n] = fn));
}

/**
 * Copia `origen` sobre `destino` respetando la identidad de `destino`.
 *
 * Importa que sea así: los motores capturaron referencias a su objeto de
 * estado en clausuras al cargarse. Reemplazar el objeto entero dejaría al
 * motor mirando el viejo, y la herramienta se vería vacía aunque los datos
 * estuvieran cargados.
 */
export function fusionarEstado(destino, origen) {
  if (!origen || typeof origen !== 'object' || !destino) return destino;
  for (const [k, v] of Object.entries(origen)) {
    if (Array.isArray(v)) {
      destino[k] = v.slice();
    } else if (v && typeof v === 'object' && destino[k] && typeof destino[k] === 'object' && !Array.isArray(destino[k])) {
      fusionarEstado(destino[k], v);
    } else {
      destino[k] = v;
    }
  }
  return destino;
}

/**
 * Como `fusionarEstado`, pero ignora los campos vacíos del origen.
 *
 * Se usa para poner el perfil de la cuenta encima de lo que la herramienta
 * tenía guardado. La cuenta manda —es el único lugar donde el dato es común a
 * las cuatro—, pero un campo que la cuenta todavía no tiene no debe borrar el
 * que la herramienta sí cargó.
 */
export function solapar(destino, origen) {
  if (!origen || typeof origen !== 'object' || !destino) return destino;
  for (const [k, v] of Object.entries(origen)) {
    if (v === '' || v === null || v === undefined) continue;
    if (v && typeof v === 'object' && !Array.isArray(v) && destino[k] && typeof destino[k] === 'object') {
      solapar(destino[k], v);
    } else {
      destino[k] = v;
    }
  }
  return destino;
}

/** Copia profunda serializable, para guardar sin arrastrar referencias vivas. */
export const instantanea = (o) => JSON.parse(JSON.stringify(o));

export const parametro = (n) => new URLSearchParams(location.search).get(n);
