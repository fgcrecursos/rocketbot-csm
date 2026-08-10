/* ==========================================================================
   MODELO DE DOMINIO
   --------------------------------------------------------------------------
   El problema que resuelve este archivo: las cuatro herramientas nacieron
   sueltas y cada una pide por su cuenta la industria, el país, el tamaño de
   la empresa y el costo hora, con listas de opciones que no coinciden entre
   sí. Health Score ofrece 12 industrias, Opportunity Finder 14, y algunas
   están escritas distinto ("Retail" contra "Retail y consumo masivo").

   Acá vive la versión canónica de esos catálogos y la forma de una cuenta.
   Cada herramienta lee de la cuenta activa en vez de volver a preguntar.
   ========================================================================== */

export const HERRAMIENTAS = [
  {
    id: 'health',
    n: 1,
    corto: 'Health Score',
    nombre: 'Customer Automation Health Score',
    linea: 'Qué tan saludable está la cuenta, en un número de 0 a 100.',
    pagina: '/health',
    color: 'var(--rb-red)',
    publica: false,
  },
  {
    id: 'madurez',
    n: 2,
    corto: 'Madurez IA',
    nombre: 'AI Readiness Assessment',
    linea: 'Si una iniciativa de IA va a funcionar en esta organización.',
    pagina: '/madurez',
    color: 'var(--rb-blue)',
    publica: true,
  },
  {
    id: 'oportunidades',
    n: 3,
    corto: 'Oportunidades',
    nombre: 'Automation Opportunity Finder',
    linea: 'Qué procesos conviene automatizar primero.',
    pagina: '/oportunidades',
    color: 'var(--rb-green)',
    publica: true,
  },
  {
    id: 'roadmap',
    n: 4,
    corto: 'Roadmap',
    nombre: 'Roadmap de Automatización',
    linea: 'En qué orden se hacen los procesos y cómo se presentan.',
    pagina: '/roadmap',
    color: 'var(--rb-amber)',
    publica: false,
  },
];

export const herramienta = (id) => HERRAMIENTAS.find((h) => h.id === id);

/* Las mismas bandas que usa el Health Score, para que un 72 signifique lo
   mismo en cualquier lista que se arme fuera de la herramienta (Panel,
   Equipo). Se usan las variantes -txt de cada color: la banda se pinta como
   texto sobre un fondo tenue del mismo tono, y los accents de marca en su
   valor base no llegan al contraste mínimo en ese uso. */
export const BANDAS = [
  { min: 85, n: 'Saludable', c: 'var(--rb-green-txt)' },
  { min: 70, n: 'Estable', c: 'var(--rb-blue-txt)' },
  { min: 50, n: 'Observación', c: 'var(--rb-amber-txt)' },
  { min: 0, n: 'En riesgo', c: 'var(--rb-red-txt)' },
];
export const bandaDe = (s) => BANDAS.find((b) => s >= b.min) || BANDAS[BANDAS.length - 1];

/* --------------------------------------------------------------------------
   Catálogos canónicos
   -------------------------------------------------------------------------- */

export const INDUSTRIAS = [
  'Banca y servicios financieros',
  'Seguros',
  'Retail y consumo masivo',
  'Manufactura',
  'Salud',
  'Logística y transporte',
  'Minería y energía',
  'Telecomunicaciones',
  'Educación',
  'Servicios profesionales',
  'Sector público',
  'Agroindustria',
  'Construcción e inmobiliaria',
  'Otra',
];

/* Las herramientas viejas guardaron industrias con otros nombres. Al abrir una
   cuenta se normalizan contra el catálogo para que los informes no muestren
   dos etiquetas distintas para lo mismo. */
const SINONIMOS_INDUSTRIA = {
  'Banca y Servicios Financieros': 'Banca y servicios financieros',
  Retail: 'Retail y consumo masivo',
  'Consumo Masivo (CPG)': 'Retail y consumo masivo',
  Logística: 'Logística y transporte',
  'Minería y Energía': 'Minería y energía',
};

export function normalizarIndustria(v) {
  if (!v) return '';
  if (INDUSTRIAS.includes(v)) return v;
  return SINONIMOS_INDUSTRIA[v] || 'Otra';
}

export const PAISES = [
  'Chile',
  'México',
  'Colombia',
  'Perú',
  'Argentina',
  'Brasil',
  'Ecuador',
  'Uruguay',
  'Costa Rica',
  'Panamá',
  'Estados Unidos',
  'España',
  'Otro',
];

export const ERPS = [
  'SAP',
  'Oracle',
  'Microsoft Dynamics',
  'Softland',
  'Defontana',
  'Totvs',
  'Odoo',
  'Manager / Nubox',
  'Desarrollo propio',
  'No usamos ERP',
  'Otro',
];

export const CRMS = [
  'Salesforce',
  'HubSpot',
  'Microsoft Dynamics',
  'Zoho',
  'Pipedrive',
  'Desarrollo propio',
  'No usamos CRM',
  'Otro',
];

export const PLANES = [
  { v: '7990', l: 'Entry — USD 7.990' },
  { v: '14990', l: 'Standard — USD 14.990' },
  { v: '24990', l: 'Enterprise — USD 24.990' },
  { v: '49990', l: 'Corporate — USD 49.990' },
  { v: 'custom', l: 'Personalizado' },
];

/* Los seis productos de la suite, con los archivos de logo reales del sitio.
   Antes cada herramienta traía su propia lista y sus propios colores. */
export const PRODUCTOS = [
  { k: 'rpa', nombre: 'RPA Studio', capa: 'ejecucion', color: 'var(--rb-red)', logo: '/assets/logos/products/rpa-studio.png', rol: 'Ejecución sobre los sistemas existentes, con o sin API' },
  { k: 'ai', nombre: 'AI Studio', capa: 'ejecucion', color: 'var(--rb-blue)', logo: '/assets/logos/products/ai-studio.png', rol: 'Lectura y clasificación de documentos y texto' },
  { k: 'saturn', nombre: 'Saturn Studio', capa: 'ejecucion', color: 'var(--rb-green)', logo: '/assets/logos/products/saturn-studio.png', rol: 'Orquestación de flujos, APIs y modelos de lenguaje' },
  { k: 'orq', nombre: 'Orquestador', capa: 'control', color: 'var(--rb-secondary)', logo: '/assets/logos/products/orchestrator.png', rol: 'Programación, control y trazabilidad de la ejecución' },
  { k: 'xperience', nombre: 'Xperience', capa: 'entrada', color: 'var(--rb-amber)', logo: '/assets/logos/products/xperience.png', rol: 'Entrada estructurada de solicitudes que disparan automatizaciones' },
  { k: 'nexus', nombre: 'Nexus', capa: 'control', color: 'var(--rb-purple)', logo: '/assets/logos/products/nexus.png', rol: 'Visibilidad ejecutiva de lo automatizado' },
];

export const productoPorNombre = (n) => PRODUCTOS.find((p) => p.nombre === n);

export const TRAMOS_EMPLEADOS = [
  { v: 'e1', l: 'Menos de 50', val: 30 },
  { v: 'e2', l: '50 a 200', val: 120 },
  { v: 'e3', l: '200 a 1.000', val: 500 },
  { v: 'e4', l: '1.000 a 5.000', val: 2500 },
  { v: 'e5', l: 'Más de 5.000', val: 8000 },
];

/* --------------------------------------------------------------------------
   Cuenta
   El perfil que comparten las cuatro herramientas.
   -------------------------------------------------------------------------- */

export function cuentaVacia(nombre = '') {
  return {
    id: 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    nombre,
    industria: '',
    pais: '',
    empleados: '',
    facturacion: '',
    erp: '',
    crm: '',
    sucursales: '',
    equipo_ti: '',
    experiencia_previa: '',
    costo_hora: '',
    plan: '14990',
    csm: '',
    cliente_desde: '',
    renovacion: '',
    notas: '',
    creado: new Date().toISOString(),
    actualizado: new Date().toISOString(),
  };
}

export function iniciales(nombre) {
  const partes = String(nombre || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!partes.length) return '??';
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();
  return (partes[0][0] + partes[1][0]).toUpperCase();
}

/* --------------------------------------------------------------------------
   Evaluación
   Una por herramienta y por cuenta. `datos` es el estado crudo que maneja el
   motor de esa herramienta —no se interpreta desde afuera— y `resultado` es
   el resumen que sí leen el panel y las otras herramientas.
   -------------------------------------------------------------------------- */

export function evaluacionVacia(cuentaId, herramientaId) {
  return {
    id: 'e' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    cuenta_id: cuentaId,
    herramienta: herramientaId,
    estado: 'borrador',
    origen: 'interno', // 'interno' | 'cliente' (llegó por link público)
    datos: null,
    resultado: null,
    creado: new Date().toISOString(),
    actualizado: new Date().toISOString(),
  };
}

/* --------------------------------------------------------------------------
   Puentes entre el perfil de la cuenta y la forma que espera cada motor.
   Cada herramienta guarda estos campos con su propio nombre; acá se traduce
   en las dos direcciones para no tocar el código de los motores.

   El nombre de la cuenta viaja en un solo sentido, de la cuenta a la
   herramienta. Health Score y Roadmap tienen un campo de texto libre para el
   cliente, y si ese campo escribiera de vuelta bastaría con corregir una tilde
   ahí —o cargar el ejemplo, que trae un nombre inventado— para renombrar la
   cuenta real. La identidad de la cuenta se edita en el panel y solo ahí.
   -------------------------------------------------------------------------- */

export const PUENTES = {
  health: {
    aMotor: (c) => ({
      cliente: c.nombre,
      industria: normalizarIndustria(c.industria),
      plan: c.plan,
      csm: c.csm,
      desde: c.cliente_desde,
      renueva: c.renovacion,
      costoHora: c.costo_hora === '' ? null : Number(c.costo_hora),
    }),
    aCuenta: (d) => ({
      industria: normalizarIndustria(d.industria),
      plan: d.plan,
      csm: d.csm,
      cliente_desde: d.desde,
      renovacion: d.renueva,
      costo_hora: d.costoHora ?? '',
    }),
  },
  madurez: {
    aMotor: (c) => ({
      industria: normalizarIndustria(c.industria),
      pais: c.pais,
      empleados: c.empleados,
    }),
    aCuenta: (e) => ({
      industria: normalizarIndustria(e.industria),
      pais: e.pais,
      empleados: e.empleados,
    }),
  },
  oportunidades: {
    aMotor: (c) => ({
      industria: normalizarIndustria(c.industria),
      pais: c.pais,
      empleados: c.empleados,
      facturacion: c.facturacion,
      erp: c.erp,
      crm: c.crm,
      sucursales: c.sucursales,
      ti: c.equipo_ti,
      previo: c.experiencia_previa,
      costoHora: c.costo_hora,
    }),
    aCuenta: (e) => ({
      industria: normalizarIndustria(e.industria),
      pais: e.pais,
      empleados: e.empleados,
      facturacion: e.facturacion,
      erp: e.erp,
      crm: e.crm,
      sucursales: e.sucursales,
      equipo_ti: e.ti,
      experiencia_previa: e.previo,
      costo_hora: e.costoHora,
    }),
  },
  roadmap: {
    aMotor: (c) => ({
      empresa: c.nombre,
      industria: normalizarIndustria(c.industria),
      pais: c.pais,
      consultor: c.csm,
      costoHora: c.costo_hora,
    }),
    aCuenta: (cl) => ({
      industria: normalizarIndustria(cl.industria),
      pais: cl.pais,
      csm: cl.consultor,
      costo_hora: cl.costoHora,
    }),
  },
};

/* Aplica sobre la cuenta solo los campos que la herramienta trae con valor.
   Un campo vacío en una herramienta no debe borrar lo que otra ya cargó. */
export function fusionarEnCuenta(cuenta, parcial) {
  const out = { ...cuenta };
  for (const [k, v] of Object.entries(parcial)) {
    if (v === '' || v === null || v === undefined) continue;
    out[k] = v;
  }
  out.actualizado = new Date().toISOString();
  return out;
}
