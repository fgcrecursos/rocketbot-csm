"use strict";

/* ==========================================================================
   ROCKETBOT — AUTOMATION OPPORTUNITY FINDER
   Motor de scoring determinista. Sin llamadas externas, sin aleatoriedad.
   Modo interno: agregar ?modo=interno a la URL.
   ========================================================================== */

const MODO_INTERNO = new URLSearchParams(location.search).get('modo') === 'interno';

/* --------------------------------------------------------------------------
   1. TABLAS DE CONVERSIÓN
   Los tramos se traducen a un valor representativo conservador (extremo bajo
   del tramo, no el punto medio) para no sobreestimar el ahorro.
   -------------------------------------------------------------------------- */

const VOLUMEN = {
  v1:{label:'Menos de 50 al mes',        val:30},
  v2:{label:'Entre 50 y 200',            val:110},
  v3:{label:'Entre 200 y 1.000',         val:450},
  v4:{label:'Entre 1.000 y 5.000',       val:2000},
  v5:{label:'Más de 5.000',              val:6500}
};

const TIEMPO = {
  t1:{label:'Menos de 5 minutos',  val:3},
  t2:{label:'Entre 5 y 15 minutos',val:8},
  t3:{label:'Entre 15 y 30 minutos',val:19},
  t4:{label:'Entre 30 y 60 minutos',val:38},
  t5:{label:'Más de 60 minutos',   val:75}
};

// Multiplicadores de automatizabilidad según calidad de las reglas
const F_REGLAS = {
  documentadas:{label:'Sí, están documentadas y son estables', f:1.10, cx:0},
  parciales:   {label:'Parcialmente: hay criterio de la persona', f:0.92, cx:1},
  criterio:    {label:'No: dependen de la experiencia de quien lo hace', f:0.72, cx:2}
};

const F_EXCEPCIONES = {
  bajas:{label:'Menos del 5% de los casos', f:1.08, cx:0},
  medias:{label:'Entre 5% y 20%',           f:0.95, cx:1},
  altas:{label:'Más del 20%',               f:0.78, cx:2}
};

const F_SISTEMAS = {
  s1:{label:'Un solo sistema',      cx:0, mult:0.95},
  s2:{label:'Entre 2 y 3 sistemas', cx:1, mult:1.05},
  s3:{label:'4 o más sistemas',     cx:2, mult:1.10}
};

const ESTADO = {
  no:     {label:'No aplica',        peso:0},
  parcial:{label:'Parcialmente',     peso:0.5},
  total:  {label:'Sí, manual',       peso:1}
};

/* --------------------------------------------------------------------------
   2. CATÁLOGO DE PROCESOS
   `base` = fracción del esfuerzo que es razonable automatizar en condiciones
   normales, según el tipo de proceso. Se ajusta después con los calificadores
   de área. Valores conservadores por diseño.
   -------------------------------------------------------------------------- */

const AREAS = [
  {
    id:'finanzas', nombre:'Finanzas y Administración',
    desc:'Cuentas por pagar, tesorería, contabilidad y reportería financiera.',
    procesos:[
      {id:'fin_facturas', base:0.70, t:'Recepción y procesamiento de facturas de proveedores',
        d:'Llegan por correo o portal y alguien las digita o carga al ERP.', prod:['AI Studio','RPA Studio','Orquestador']},
      {id:'fin_concil', base:0.80, t:'Conciliación bancaria',
        d:'Descarga de cartolas y cruce manual contra los registros contables.', prod:['RPA Studio','Orquestador']},
      {id:'fin_pdf', base:0.65, t:'Extracción de datos desde PDF u otros documentos',
        d:'Comprobantes, certificados, órdenes o estados de cuenta que se leen a mano.', prod:['AI Studio','Saturn Studio']},
      {id:'fin_reportes', base:0.80, t:'Generación de reportes y consolidados en Excel',
        d:'Alguien descarga, pega, cruza y formatea todos los meses lo mismo.', prod:['RPA Studio','Nexus']},
      {id:'fin_pagos', base:0.70, t:'Pagos y trámites en portales web',
        d:'Bancos, autoridad tributaria, tesorería, portales de clientes.', prod:['RPA Studio','Orquestador']},
      {id:'fin_cobranza', base:0.70, t:'Cobranza: envío de estados de cuenta y seguimiento',
        d:'Recordatorios de vencimiento y actualización de estados a mano.', prod:['RPA Studio','Saturn Studio']}
    ]
  },
  {
    id:'rrhh', nombre:'Recursos Humanos',
    desc:'Ciclo de vida de las personas, remuneraciones y administración de personal.',
    procesos:[
      {id:'rh_ingreso', base:0.75, t:'Ingreso manual de datos de personas en sistemas',
        d:'Altas, cambios de cargo, bajas cargadas a mano en uno o varios sistemas.', prod:['RPA Studio','Xperience']},
      {id:'rh_vacaciones', base:0.70, t:'Gestión de vacaciones y permisos en Excel o correo',
        d:'Solicitud, aprobación y registro de saldos fuera de un sistema formal.', prod:['Xperience','Saturn Studio','Orquestador']},
      {id:'rh_nomina', base:0.60, t:'Preparación de insumos para la nómina',
        d:'Consolidar horas, novedades, licencias y descuentos antes de procesar.', prod:['RPA Studio','Orquestador']},
      {id:'rh_usuarios', base:0.75, t:'Creación y baja de usuarios y accesos',
        d:'Onboarding y offboarding de cuentas en correo, ERP, VPN y otros sistemas.', prod:['RPA Studio','Saturn Studio','Xperience']},
      {id:'rh_contratos', base:0.70, t:'Generación de contratos, anexos y certificados',
        d:'Documentos armados desde plantillas con datos que ya están en un sistema.', prod:['Saturn Studio','AI Studio']},
      {id:'rh_cv', base:0.55, t:'Filtrado inicial de currículums y postulaciones',
        d:'Lectura y preclasificación manual de candidatos.', prod:['AI Studio','Saturn Studio']}
    ]
  },
  {
    id:'comercial', nombre:'Comercial y Ventas',
    desc:'Gestión de clientes, cotizaciones, pedidos y datos de CRM.',
    procesos:[
      {id:'co_crm_erp', base:0.80, t:'Traspaso de datos entre CRM y ERP',
        d:'Clientes, pedidos, precios o estados que se copian de un sistema a otro.', prod:['RPA Studio','Saturn Studio']},
      {id:'co_cotiza', base:0.60, t:'Elaboración de cotizaciones y propuestas',
        d:'Armado manual a partir de listas de precios y plantillas.', prod:['Saturn Studio','AI Studio','Xperience']},
      {id:'co_correos', base:0.70, t:'Envío de correos comerciales repetitivos',
        d:'Seguimientos, confirmaciones y recordatorios escritos uno a uno.', prod:['Saturn Studio','Orquestador']},
      {id:'co_oportunidades', base:0.70, t:'Registro y actualización manual de oportunidades',
        d:'El equipo carga en el CRM información que ya existe en otro lado.', prod:['RPA Studio','Xperience']},
      {id:'co_pedidos', base:0.70, t:'Ingreso de pedidos recibidos por correo o portal',
        d:'Órdenes de compra de clientes que se transcriben al sistema.', prod:['AI Studio','RPA Studio']}
    ]
  },
  {
    id:'atencion', nombre:'Atención al Cliente',
    desc:'Canales de entrada, mesa de ayuda y resolución de solicitudes.',
    procesos:[
      {id:'at_email', base:0.60, t:'Solicitudes que llegan por correo y alguien debe leer y derivar',
        d:'Triaje manual de una casilla compartida.', prod:['AI Studio','Saturn Studio']},
      {id:'at_repetitivas', base:0.60, t:'Respuesta a consultas repetitivas',
        d:'Preguntas cuya respuesta ya está en un sistema o documento interno.', prod:['AI Studio','Saturn Studio']},
      {id:'at_tickets', base:0.60, t:'Clasificación y asignación de tickets',
        d:'Categorizar, priorizar y derivar cada caso a mano.', prod:['AI Studio','Orquestador']},
      {id:'at_multisistema', base:0.70, t:'Consulta de varios sistemas para responder una sola solicitud',
        d:'El agente abre 3 o 4 pantallas para armar una respuesta.', prod:['RPA Studio','Saturn Studio','Nexus']},
      {id:'at_reclamos', base:0.65, t:'Registro y seguimiento de reclamos o postventa',
        d:'Casos que se controlan en planillas paralelas al sistema oficial.', prod:['Xperience','Orquestador']}
    ]
  },
  {
    id:'operaciones', nombre:'Operaciones y TI',
    desc:'Flujos transversales entre sistemas, cargas de datos y controles.',
    procesos:[
      {id:'op_reportes_diarios', base:0.85, t:'Descarga de reportes desde sistemas en forma diaria o semanal',
        d:'Rutina fija: entrar, filtrar, exportar, guardar, distribuir.', prod:['RPA Studio','Orquestador']},
      {id:'op_portales', base:0.80, t:'Acceso recurrente a portales web de terceros',
        d:'Clientes, aduanas, organismos públicos, plataformas de proveedores.', prod:['RPA Studio','Orquestador']},
      {id:'op_copiar', base:0.80, t:'Copiado de información entre sistemas no integrados',
        d:'El clásico "de este sistema al otro" hecho a mano.', prod:['RPA Studio','Saturn Studio']},
      {id:'op_excel', base:0.75, t:'Uso de Excel como puente de integración',
        d:'Planillas intermedias que nadie mantiene pero todos necesitan.', prod:['RPA Studio','Saturn Studio']},
      {id:'op_validaciones', base:0.70, t:'Validaciones y controles de calidad de datos a mano',
        d:'Revisión de consistencia, duplicados o campos obligatorios.', prod:['RPA Studio','Orquestador']},
      {id:'op_carga_masiva', base:0.80, t:'Cargas masivas de datos en sistemas',
        d:'Precios, maestros, inventarios o tarifas subidos registro por registro.', prod:['RPA Studio']}
    ]
  },
  {
    id:'compras', nombre:'Compras y Abastecimiento',
    desc:'Requerimientos, proveedores, órdenes de compra y recepción.',
    procesos:[
      {id:'cp_oc', base:0.70, t:'Generación de órdenes de compra',
        d:'Desde el requerimiento hasta la OC emitida en el ERP.', prod:['RPA Studio','Xperience']},
      {id:'cp_proveedores', base:0.70, t:'Alta y mantención de proveedores en el ERP',
        d:'Captura de documentos, validación de datos y creación del registro.', prod:['RPA Studio','Xperience','AI Studio']},
      {id:'cp_cotizaciones', base:0.55, t:'Solicitud y comparación de cotizaciones a proveedores',
        d:'Envío de solicitudes y armado de cuadros comparativos.', prod:['Saturn Studio','AI Studio']},
      {id:'cp_recepcion', base:0.70, t:'Cruce entre recepción, orden de compra y factura',
        d:'Match a tres vías revisado documento por documento.', prod:['RPA Studio','AI Studio']},
      {id:'cp_seguimiento', base:0.65, t:'Seguimiento del estado de pedidos con proveedores',
        d:'Correos y llamadas para saber dónde está cada entrega.', prod:['Saturn Studio','Orquestador']}
    ]
  }
];

const EMPLEADOS = {
  e1:{label:'Menos de 50', val:35},
  e2:{label:'Entre 50 y 200', val:120},
  e3:{label:'Entre 200 y 500', val:340},
  e4:{label:'Entre 500 y 2.000', val:1100},
  e5:{label:'Más de 2.000', val:3000}
};

const FACTURACION = {
  f0:{label:'Prefiero no indicarlo'},
  f1:{label:'Menos de USD 5 millones'},
  f2:{label:'Entre USD 5 y 25 millones'},
  f3:{label:'Entre USD 25 y 100 millones'},
  f4:{label:'Entre USD 100 y 500 millones'},
  f5:{label:'Más de USD 500 millones'}
};

const INDUSTRIAS = ['Banca y servicios financieros','Seguros','Retail y consumo masivo','Manufactura','Salud','Logística y transporte','Minería y energía','Telecomunicaciones','Educación','Servicios profesionales','Sector público','Agroindustria','Construcción e inmobiliaria','Otra'];
const PAISES = ['Chile','México','Colombia','Perú','Argentina','Brasil','Ecuador','Uruguay','Costa Rica','Panamá','Estados Unidos','España','Otro'];
const ERPS = ['SAP','Oracle','Microsoft Dynamics','Softland','Defontana','Totvs','Odoo','Manager / Nubox','Desarrollo propio','No usamos ERP','Otro'];
const CRMS = ['Salesforce','HubSpot','Microsoft Dynamics','Zoho','Pipedrive','Desarrollo propio','No usamos CRM','Otro'];

/* --------------------------------------------------------------------------
   3. ESTADO
   -------------------------------------------------------------------------- */

const state = {
  paso:0, // 0 = intro, 1 = empresa, 2..7 = áreas, 8 = resultados
  empresa:{industria:'',pais:'',empleados:'',facturacion:'',erp:'',crm:'',sucursales:'',ti:'',previo:'',costoHora:''},
  areas:{},
  contacto:{nombre:'',email:'',empresa:''}
};
AREAS.forEach(a=>{
  state.areas[a.id]={sistemas:'s2',reglas:'parciales',excepciones:'medias',procesos:{}};
  a.procesos.forEach(p=>{ state.areas[a.id].procesos[p.id]={estado:'no',vol:'v2',tiempo:'t2',personas:'1'}; });
});

const TOTAL_PASOS = 1 + AREAS.length; // empresa + áreas

/* --------------------------------------------------------------------------
   4. MOTOR DE CÁLCULO
   -------------------------------------------------------------------------- */

function clamp(v,min,max){ return Math.max(min, Math.min(max, v)); }
function round(v,d=0){ const m=Math.pow(10,d); return Math.round(v*m)/m; }
function fmt(n){ return new Intl.NumberFormat('es-CL',{maximumFractionDigits:0}).format(Math.round(n)); }

function calcular(){
  const empRef = EMPLEADOS[state.empresa.empleados]?.val || 120;
  const costoHora = parseFloat(state.empresa.costoHora) || 0;

  const resultadoAreas = [];
  const oportunidades = [];

  AREAS.forEach(area=>{
    const st = state.areas[area.id];
    const fReglas = F_REGLAS[st.reglas].f;
    const fExc = F_EXCEPCIONES[st.excepciones].f;
    const complejidadPts = F_SISTEMAS[st.sistemas].cx + F_REGLAS[st.reglas].cx + F_EXCEPCIONES[st.excepciones].cx;
    const complejidad = complejidadPts <= 1 ? 'Baja' : (complejidadPts <= 3 ? 'Media' : 'Alta');

    let horasArea = 0, ahorroMinArea = 0, ahorroMaxArea = 0;
    let sumaAxHoras = 0, manuales = 0;
    const procsArea = [];

    area.procesos.forEach(p=>{
      const ps = st.procesos[p.id];
      const peso = ESTADO[ps.estado].peso;
      if(peso === 0) return;
      manuales++;

      const V = VOLUMEN[ps.vol].val;
      const T = TIEMPO[ps.tiempo].val;
      const horasMes = (V * T / 60) * peso;

      // Fracción automatizable ajustada, acotada a un rango defendible
      const A = clamp(p.base * fReglas * fExc, 0.30, 0.85);

      const central = horasMes * A;
      const min = central * 0.80;   // banda conservadora
      const max = central * 1.00;

      horasArea += horasMes;
      ahorroMinArea += min;
      ahorroMaxArea += max;
      sumaAxHoras += A * horasMes;

      const roi = central >= 120 ? 4 : central >= 60 ? 3 : central >= 25 ? 2 : 1;

      const item = {
        id:p.id, titulo:p.t, desc:p.d, area:area.nombre, areaId:area.id,
        estado:ps.estado, personas:parseInt(ps.personas)||1,
        volumen:V, minutos:T, horasMes, A, central, min, max, roi,
        complejidad, complejidadPts, productos:p.prod,
        volLabel:VOLUMEN[ps.vol].label, tiempoLabel:TIEMPO[ps.tiempo].label
      };
      procsArea.push(item);
      oportunidades.push(item);
    });

    const totalProc = area.procesos.length;
    const cobertura = totalProc ? manuales / totalProc : 0;

    // Referencia de magnitud escalada al tamaño de la empresa:
    // 100 h/mes pesan distinto en una empresa de 40 personas que en una de 3.000.
    const refArea = clamp(empRef * 0.35, 40, 500);
    const magnitud = clamp(ahorroMaxArea / refArea, 0, 1);
    const automatabilidad = horasArea > 0 ? (sumaAxHoras / horasArea) : 0;

    const score = manuales === 0 ? 0 : Math.round(100 * (0.30*cobertura + 0.40*magnitud + 0.30*automatabilidad));

    resultadoAreas.push({
      id:area.id, nombre:area.nombre, score,
      prioridad: manuales === 0 ? 'Sin datos' : banda(score),
      color: manuales === 0 ? '#9AA8AE' : colorBanda(score),
      manuales, totalProc, horasArea, ahorroMinArea, ahorroMaxArea,
      automatabilidad, cobertura, magnitud, complejidad, refArea,
      procesos:procsArea.sort((a,b)=>b.central-a.central)
    });
  });

  oportunidades.sort((a,b)=> b.central - a.central);

  const totalMin = oportunidades.reduce((s,o)=>s+o.min,0);
  const totalMax = oportunidades.reduce((s,o)=>s+o.max,0);
  const totalHorasActuales = oportunidades.reduce((s,o)=>s+o.horasMes,0);
  const relevantes = oportunidades.filter(o=>o.central >= 25);

  const scoresConDatos = resultadoAreas.filter(a=>a.manuales>0).map(a=>a.score);
  const scoreGlobal = scoresConDatos.length
    ? Math.round(scoresConDatos.reduce((s,v)=>s+v,0)/scoresConDatos.length)
    : 0;

  const productos = {};
  oportunidades.forEach(o=>o.productos.forEach(pr=>{ productos[pr]=(productos[pr]||0)+o.central; }));
  const productosOrden = Object.entries(productos).sort((a,b)=>b[1]-a[1]).map(e=>e[0]);

  return {
    areas: resultadoAreas.sort((a,b)=>b.score-a.score),
    oportunidades, relevantes,
    totalMin, totalMax, totalHorasActuales, scoreGlobal,
    costoHora, empRef, productosOrden,
    plan: recomendarPlan(relevantes.length, totalMax),
    poc: elegirPOC(oportunidades)
  };
}

function banda(s){
  if(s>=80) return 'Muy alta';
  if(s>=65) return 'Alta';
  if(s>=50) return 'Media';
  if(s>=35) return 'Baja';
  return 'Muy baja';
}
function colorBanda(s){
  if(s>=80) return 'var(--rb-red)';
  if(s>=65) return 'var(--rb-amber)';
  if(s>=50) return 'var(--rb-blue)';
  if(s>=35) return 'var(--rb-green)';
  return '#9AA8AE';
}
function roiLabel(r){ return ['','Bajo','Medio','Alto','Muy alto'][r]; }

function recomendarPlan(nProcesos, horasMax){
  if(nProcesos === 0) return {nombre:'Sin dimensionamiento', precio:null, rango:'—',
    razon:'No se declararon procesos manuales con volumen suficiente.'};
  if(nProcesos <= 3 && horasMax < 300) return {nombre:'Entry', precio:'USD 7.990', rango:'1 a 3 procesos',
    razon:'Volumen acotado y pocos procesos candidatos: alcanza para partir y medir resultados.'};
  if(nProcesos <= 8 && horasMax < 800) return {nombre:'Standard', precio:'USD 14.990', rango:'4 a 8 procesos',
    razon:'Varios procesos en más de un área, con volumen que justifica ejecución programada.'};
  if(nProcesos <= 15 && horasMax < 2000) return {nombre:'Enterprise', precio:'USD 24.990', rango:'9 a 15 procesos',
    razon:'Cartera amplia y transversal: requiere orquestación y control centralizado.'};
  return {nombre:'Corporate', precio:'USD 49.990', rango:'Más de 15 procesos',
    razon:'Volumen y cantidad de procesos propios de un programa de automatización, no de una iniciativa puntual.'};
}

// Buen candidato a POC: alto ahorro relativo con baja complejidad.
function elegirPOC(ops){
  if(!ops.length) return null;
  const rank = ops.map(o=>({o, k: o.central / (1 + o.complejidadPts * 0.6)}))
                  .sort((a,b)=>b.k-a.k);
  return rank[0].o;
}

/* --------------------------------------------------------------------------
   5. RENDER
   -------------------------------------------------------------------------- */

const app = document.getElementById('app');
const stepsEl = document.getElementById('steps');
const progressWrap = document.getElementById('progressWrap');

if(MODO_INTERNO){
  document.getElementById('modeChip').innerHTML = '<span class="mode-chip">Modo interno</span>';
}

function renderPasos(){
  if(state.paso === 0 || state.paso > TOTAL_PASOS){ progressWrap.style.display='none'; return; }
  progressWrap.style.display='';
  const labels = ['Empresa', ...AREAS.map(a=>a.nombre.split(' ')[0])];
  stepsEl.innerHTML = labels.map((l,i)=>{
    const n = i+1;
    const cls = n === state.paso ? 'active' : (n < state.paso ? 'done' : '');
    return `<li class="step ${cls}"><span class="step-n">${String(n).padStart(2,'0')}</span>${l}</li>`;
  }).join('');
}

function opciones(obj, sel){
  return Object.entries(obj).map(([k,v])=>
    `<option value="${k}" ${k===sel?'selected':''}>${v.label}</option>`).join('');
}
function opcionesLista(arr, sel){
  return `<option value="">Selecciona…</option>` +
    arr.map(v=>`<option value="${v}" ${v===sel?'selected':''}>${v}</option>`).join('');
}

/* ---------- Intro ---------- */
function renderIntro(){
  app.innerHTML = `
  <div class="panel">
    <div class="intro-hero">
      <span class="eyebrow">Diagnóstico de automatización</span>
      <h1>Descubre qué procesos de tu empresa conviene automatizar primero.</h1>
      <p class="lede">Responde sobre lo que hoy hace tu equipo a mano. Al terminar recibes un mapa por área,
      los procesos candidatos ordenados por impacto y una ruta sugerida para partir.</p>
    </div>
    <div class="intro-facts">
      <div class="fact"><div class="n">8–10 min</div><div class="l">Duración estimada del cuestionario</div></div>
      <div class="fact"><div class="n">6 áreas</div><div class="l">Finanzas, RR.&nbsp;HH., Comercial, Atención, Operaciones y Compras</div></div>
      <div class="fact"><div class="n">33 procesos</div><div class="l">Casos frecuentes de trabajo manual evaluados</div></div>
    </div>
    <div class="panel-body">
      <div class="note">
        <strong>Cómo leer el resultado.</strong> Las horas estimadas se calculan con el volumen y el tiempo que tú
        declaras, multiplicados por una fracción automatizable propia de cada tipo de proceso. Se entregan como rango,
        no como cifra exacta, y son una estimación referencial: el dimensionamiento definitivo requiere un
        levantamiento técnico. Puedes revisar la fórmula completa al final del informe.
      </div>
      <div class="nav">
        <span style="font-size:13px;color:var(--ink-3)">No se solicitan datos de contacto para ver el resultado.</span>
        <button class="btn btn-primary" onclick="ir(1)">Comenzar diagnóstico →</button>
      </div>
    </div>
  </div>`;
}

/* ---------- Paso empresa ---------- */
function renderEmpresa(){
  const e = state.empresa;
  app.innerHTML = `
  <div class="panel">
    <div class="panel-head">
      <span class="eyebrow">Paso 01 de ${String(TOTAL_PASOS).padStart(2,'0')}</span>
      <h2>Tu empresa</h2>
      <p>Estos datos ajustan el cálculo: una misma cantidad de horas pesa distinto según el tamaño de la organización.</p>
    </div>
    <div class="panel-body">
      <div class="grid grid-2">
        <div class="field"><label for="f-ind">Industria</label>
          <select id="f-ind" onchange="setEmpresa('industria',this.value)">${opcionesLista(INDUSTRIAS,e.industria)}</select></div>
        <div class="field"><label for="f-pais">País de operación principal</label>
          <select id="f-pais" onchange="setEmpresa('pais',this.value)">${opcionesLista(PAISES,e.pais)}</select></div>
        <div class="field"><label for="f-emp">Número de empleados</label>
          <select id="f-emp" onchange="setEmpresa('empleados',this.value)">
            <option value="">Selecciona…</option>${opciones(EMPLEADOS,e.empleados)}</select></div>
        <div class="field"><label for="f-fac">Facturación anual</label>
          <select id="f-fac" onchange="setEmpresa('facturacion',this.value)">
            <option value="">Selecciona…</option>${opciones(FACTURACION,e.facturacion)}</select></div>
        <div class="field"><label for="f-erp">ERP principal</label>
          <select id="f-erp" onchange="setEmpresa('erp',this.value)">${opcionesLista(ERPS,e.erp)}</select></div>
        <div class="field"><label for="f-crm">CRM principal</label>
          <select id="f-crm" onchange="setEmpresa('crm',this.value)">${opcionesLista(CRMS,e.crm)}</select></div>
        <div class="field"><label for="f-suc">Número de sucursales o sedes</label>
          <select id="f-suc" onchange="setEmpresa('sucursales',this.value)">
            <option value="">Selecciona…</option>
            <option value="1" ${e.sucursales==='1'?'selected':''}>Una sola ubicación</option>
            <option value="2-5" ${e.sucursales==='2-5'?'selected':''}>Entre 2 y 5</option>
            <option value="6-20" ${e.sucursales==='6-20'?'selected':''}>Entre 6 y 20</option>
            <option value="20+" ${e.sucursales==='20+'?'selected':''}>Más de 20</option>
          </select></div>
        <div class="field"><label for="f-ti">Equipo de TI propio</label>
          <select id="f-ti" onchange="setEmpresa('ti',this.value)">
            <option value="">Selecciona…</option>
            <option value="no" ${e.ti==='no'?'selected':''}>No, se terceriza todo</option>
            <option value="limitado" ${e.ti==='limitado'?'selected':''}>Sí, pero con poca capacidad disponible</option>
            <option value="si" ${e.ti==='si'?'selected':''}>Sí, con equipo de desarrollo</option>
          </select></div>
        <div class="field"><label for="f-prev">Experiencia previa en automatización</label>
          <select id="f-prev" onchange="setEmpresa('previo',this.value)">
            <option value="">Selecciona…</option>
            <option value="ninguna" ${e.previo==='ninguna'?'selected':''}>Ninguna</option>
            <option value="scripts" ${e.previo==='scripts'?'selected':''}>Macros o scripts internos</option>
            <option value="rpa" ${e.previo==='rpa'?'selected':''}>Sí, con una plataforma RPA</option>
          </select></div>
        <div class="field"><label for="f-costo">Costo promedio por hora del equipo administrativo <span style="font-weight:500;color:var(--ink-3)">(opcional)</span></label>
          <input type="number" id="f-costo" min="0" step="1" placeholder="Ej: 18" value="${e.costoHora}"
            oninput="setEmpresa('costoHora',this.value)">
          <div class="hint">En USD, costo cargado por hora. Si lo indicas, el informe además traduce las horas a un rango de valor. Si lo dejas vacío, el informe solo muestra horas.</div></div>
      </div>
      <div class="nav">
        <button class="btn btn-ghost" onclick="ir(0)">← Volver</button>
        <button class="btn btn-primary" onclick="ir(2)">Continuar a Finanzas →</button>
      </div>
    </div>
  </div>`;
}

/* ---------- Paso área ---------- */
function renderArea(idx){
  const area = AREAS[idx];
  const st = state.areas[area.id];
  const n = idx + 2;
  const siguiente = idx + 1 < AREAS.length ? AREAS[idx+1].nombre : null;

  app.innerHTML = `
  <div class="panel">
    <div class="panel-head">
      <span class="eyebrow">Paso ${String(n).padStart(2,'0')} de ${String(TOTAL_PASOS).padStart(2,'0')}</span>
      <h2>${area.nombre}</h2>
      <p>${area.desc} Marca solo lo que hoy se hace a mano. Lo que no aplique, déjalo en «No aplica».</p>
    </div>
    <div class="panel-body">

      <div class="area-quals">
        <div class="quals-title">Contexto del área</div>
        <div class="grid grid-3">
          <div class="field"><label>Sistemas que intervienen habitualmente</label>
            <select onchange="setQual('${area.id}','sistemas',this.value)">${opciones(F_SISTEMAS,st.sistemas)}</select></div>
          <div class="field"><label>¿Las reglas de trabajo están definidas?</label>
            <select onchange="setQual('${area.id}','reglas',this.value)">${opciones(F_REGLAS,st.reglas)}</select></div>
          <div class="field"><label>Casos que se salen del procedimiento estándar</label>
            <select onchange="setQual('${area.id}','excepciones',this.value)">${opciones(F_EXCEPCIONES,st.excepciones)}</select></div>
        </div>
      </div>

      <div class="proc-list">
        ${area.procesos.map(p=>renderProceso(area.id,p)).join('')}
      </div>

      <div class="nav">
        <button class="btn btn-ghost" onclick="ir(${n-1})">← Volver</button>
        <button class="btn btn-primary" onclick="ir(${n+1})">
          ${siguiente ? 'Continuar a ' + siguiente + ' →' : 'Ver mis resultados →'}
        </button>
      </div>
    </div>
  </div>`;
}

function renderProceso(areaId,p){
  const ps = state.areas[areaId].procesos[p.id];
  const on = ps.estado !== 'no';
  return `
  <div class="proc ${on?'on':''}" id="proc-${p.id}">
    <div class="proc-top">
      <div class="proc-name">
        <div class="t">${p.t}</div>
        <div class="d">${p.d}</div>
      </div>
      <div class="seg" role="group" aria-label="¿Se hace manualmente?">
        ${Object.entries(ESTADO).map(([k,v])=>
          `<button type="button" data-v="${k}" aria-pressed="${ps.estado===k}"
            onclick="setEstado('${areaId}','${p.id}','${k}')">${v.label}</button>`).join('')}
      </div>
    </div>
    <div class="proc-detail">
      <div class="grid grid-3">
        <div class="field"><label>Volumen mensual aproximado</label>
          <select onchange="setProc('${areaId}','${p.id}','vol',this.value)">${opciones(VOLUMEN,ps.vol)}</select></div>
        <div class="field"><label>Tiempo promedio por caso</label>
          <select onchange="setProc('${areaId}','${p.id}','tiempo',this.value)">${opciones(TIEMPO,ps.tiempo)}</select></div>
        <div class="field"><label>Personas que participan</label>
          <select onchange="setProc('${areaId}','${p.id}','personas',this.value)">
            ${[1,2,3,5,10].map(v=>`<option value="${v}" ${String(v)===ps.personas?'selected':''}>${v===10?'10 o más':v}</option>`).join('')}
          </select></div>
      </div>
    </div>
  </div>`;
}

/* ---------- Handlers ---------- */
function setEmpresa(k,v){ state.empresa[k]=v; }
function setQual(areaId,k,v){ state.areas[areaId][k]=v; }
function setProc(areaId,procId,k,v){ state.areas[areaId].procesos[procId][k]=v; }
function setEstado(areaId,procId,v){
  state.areas[areaId].procesos[procId].estado = v;
  const box = document.getElementById('proc-'+procId);
  box.classList.toggle('on', v !== 'no');
  box.querySelectorAll('.seg button').forEach(b=>
    b.setAttribute('aria-pressed', String(b.dataset.v === v)));
}
function ir(n){
  state.paso = n;
  render();
  window.scrollTo({top:0,behavior:'auto'});
}

/* ---------- Resultados ---------- */
function renderResultados(){
  const R = calcular();
  window.__R = R; // disponible para exportación

  if(R.oportunidades.length === 0){
    app.innerHTML = `
    <div class="panel"><div class="panel-body">
      <div class="empty">
        <h2 style="margin-bottom:12px">No marcaste procesos manuales</h2>
        <p>Vuelve atrás y marca al menos un proceso como «Parcialmente» o «Sí, manual» para generar el diagnóstico.</p>
        <div style="margin-top:24px"><button class="btn btn-primary" onclick="ir(2)">Revisar respuestas</button></div>
      </div>
    </div></div>`;
    return;
  }

  const dinero = R.costoHora > 0
    ? `<div class="kpi b">
         <div class="lbl">Valor asociado a esas horas</div>
         <div class="val">USD ${fmt(R.totalMin*R.costoHora)} – ${fmt(R.totalMax*R.costoHora)}</div>
         <div class="sub">Al mes, usando el costo por hora de USD ${R.costoHora} que indicaste. No incluye el costo de la plataforma ni de la implementación.</div>
       </div>`
    : `<div class="kpi b">
         <div class="lbl">Nivel de oportunidad</div>
         <div class="val">${R.scoreGlobal} / 100</div>
         <div class="sub">Promedio de las áreas con procesos manuales declarados. Prioridad global: ${banda(R.scoreGlobal).toLowerCase()}.</div>
       </div>`;

  app.innerHTML = `
  <div class="panel">
    <div class="panel-head">
      <span class="eyebrow">Informe de diagnóstico</span>
      <h2>Resultados del Automation Opportunity Finder</h2>
      <p>${state.empresa.industria ? state.empresa.industria : 'Empresa'}${state.empresa.pais ? ' · ' + state.empresa.pais : ''}${state.empresa.empleados ? ' · ' + EMPLEADOS[state.empresa.empleados].label + ' empleados' : ''}
      — generado el ${new Date().toLocaleDateString('es-CL',{day:'numeric',month:'long',year:'numeric'})}.</p>
    </div>
    <div class="panel-body">
      <div class="kpis">
        <div class="kpi">
          <div class="lbl">Horas mensuales recuperables</div>
          <div class="val">${fmt(R.totalMin)} – ${fmt(R.totalMax)} h</div>
          <div class="sub">De un total de ${fmt(R.totalHorasActuales)} horas al mes que hoy consumen los procesos declarados.</div>
        </div>
        <div class="kpi g">
          <div class="lbl">Procesos candidatos</div>
          <div class="val">${R.relevantes.length} <span style="font-size:16px;font-weight:600;color:var(--ink-3)">de ${R.oportunidades.length}</span></div>
          <div class="sub">Con ahorro estimado sobre 25 horas al mes, el umbral desde el cual conviene automatizar.</div>
        </div>
        ${dinero}
      </div>
    </div>
  </div>

  <div class="panel">
    <div class="panel-head">
      <span class="eyebrow">Mapa por área</span>
      <h2>Dónde está concentrada la oportunidad</h2>
      <p>El puntaje combina cuántos procesos del área son manuales, cuántas horas representan en relación al tamaño de tu empresa, y qué tan automatizables son.</p>
    </div>
    <div class="panel-body">
      <div class="heat">
        ${R.areas.map(a=>`
          <div class="heat-row">
            <div class="heat-name">${a.nombre}
              <small>${a.manuales} de ${a.totalProc} procesos · ${a.manuales? fmt(a.ahorroMinArea)+'–'+fmt(a.ahorroMaxArea)+' h/mes' : 'sin procesos manuales'}</small></div>
            <div class="heat-bar">
              <div class="heat-fill" style="width:${Math.max(a.score,3)}%;background:${a.color}">
                <span class="s">${a.score}</span></div>
            </div>
            <div class="heat-tag" style="color:${a.color}">${a.prioridad}</div>
          </div>`).join('')}
      </div>
    </div>
  </div>

  <div class="panel">
    <div class="panel-head">
      <span class="eyebrow">Procesos identificados</span>
      <h2>Oportunidades ordenadas por impacto</h2>
      <p>Cada proceso muestra el rango de horas mensuales que podría liberarse y qué tan complejo sería implementarlo, según el contexto que declaraste para su área.</p>
    </div>
    <div class="panel-body">
      ${R.oportunidades.map(o=>`
        <div class="opp">
          <div class="opp-head">
            <div class="opp-title"><span class="area">${o.area}</span>${o.titulo}</div>
            <div class="opp-hours">
              <div class="h">${fmt(o.min)}–${fmt(o.max)}</div>
              <div class="u">horas/mes estimadas</div>
            </div>
          </div>
          <div class="opp-meta">
            <span class="badge b-roi-${o.roi}">Retorno ${roiLabel(o.roi).toLowerCase()}</span>
            <span class="badge b-neutral">Complejidad ${o.complejidad.toLowerCase()}</span>
            <span class="badge b-neutral">${o.estado === 'parcial' ? 'Parcialmente manual' : 'Totalmente manual'}</span>
            <span class="badge b-neutral">${o.personas} ${o.personas===1?'persona':'personas'}</span>
            ${o.productos.map(p=>`<span class="badge b-prod">${p}</span>`).join('')}
          </div>
        </div>`).join('')}
    </div>
  </div>

  ${renderRuta(R)}
  ${MODO_INTERNO ? renderInterno(R) : ''}

  <div class="panel">
    <div class="panel-body">
      <div class="nav no-print">
        <div style="display:flex;gap:10px;flex-wrap:wrap">
          <button class="btn btn-ghost btn-sm" onclick="window.print()">Descargar en PDF</button>
          <button class="btn btn-ghost btn-sm" onclick="exportarJSON()">Exportar datos (JSON)</button>
          <button class="btn btn-ghost btn-sm" onclick="ir(1)">Revisar respuestas</button>
        </div>
        <button class="btn btn-primary" onclick="alert('Conecta este botón a tu formulario, CRM o agenda.')">Agendar revisión con un especialista</button>
      </div>

      ${renderMetodologia(R)}

      <div class="footer-note">
        <strong>Alcance de este diagnóstico.</strong> Las cifras de este informe son estimaciones construidas a partir
        de los tramos de volumen y tiempo que declaraste, no de una medición de tus sistemas. Sirven para priorizar y
        ordenar una conversación, no para comprometer resultados. El dimensionamiento definitivo, los tiempos de
        implementación y el retorno real requieren un levantamiento técnico sobre los procesos y sistemas concretos.
        Rocketbot · Suite de automatización empresarial.
      </div>
    </div>
  </div>`;
}

function renderRuta(R){
  const top = R.relevantes.slice(0,3);
  const medio = R.relevantes.slice(3,8);
  const poc = R.poc;
  if(!top.length) return '';

  const areaTop = R.areas[0];

  return `
  <div class="panel">
    <div class="panel-head">
      <span class="eyebrow">Ruta sugerida</span>
      <h2>Por dónde partir</h2>
      <p>Un orden posible: primero un caso acotado que demuestre el mecanismo, después el área con más concentración, y luego el resto de la cartera.</p>
    </div>
    <div class="panel-body">
      <div class="phase">
        <div class="phase-n">01</div>
        <div>
          <div class="when">Prueba de concepto</div>
          <h4>${poc ? poc.titulo : '—'}</h4>
          <p>Es el proceso con mejor relación entre horas liberadas y complejidad de implementación dentro de lo que declaraste:
          entre ${fmt(poc.min)} y ${fmt(poc.max)} horas al mes, con complejidad ${poc.complejidad.toLowerCase()}.
          Un caso así permite validar el enfoque antes de comprometer un programa mayor.</p>
          <ul>${poc.productos.map(p=>`<li>${p}</li>`).join('')}</ul>
        </div>
      </div>
      <div class="phase">
        <div class="phase-n">02</div>
        <div>
          <div class="when">Primera ola</div>
          <h4>Concentrarse en ${areaTop.nombre}</h4>
          <p>Es el área con mayor puntaje (${areaTop.score}/100) y agrupa entre ${fmt(areaTop.ahorroMinArea)} y ${fmt(areaTop.ahorroMaxArea)} horas mensuales.
          Automatizar procesos vecinos reutiliza los mismos accesos, credenciales y conocimiento del negocio.</p>
          <ul>${top.map(o=>`<li>${o.titulo} — ${fmt(o.min)}–${fmt(o.max)} h/mes</li>`).join('')}</ul>
        </div>
      </div>
      ${medio.length ? `
      <div class="phase">
        <div class="phase-n">03</div>
        <div>
          <div class="when">Expansión</div>
          <h4>Extender al resto de la cartera</h4>
          <p>Quedan ${medio.length} procesos adicionales sobre el umbral de 25 horas mensuales. Con la primera ola en producción,
          el costo marginal de incorporarlos baja porque la infraestructura de ejecución y control ya está montada.</p>
          <ul>${medio.map(o=>`<li>${o.titulo} — ${fmt(o.min)}–${fmt(o.max)} h/mes</li>`).join('')}</ul>
        </div>
      </div>` : ''}
      ${R.productosOrden.length ? `
      <div class="note">
        <strong>Productos de la suite involucrados</strong>, en orden de peso según los procesos que marcaste:
        ${R.productosOrden.join(' · ')}.
      </div>` : ''}
    </div>
  </div>`;
}

function renderMetodologia(R){
  return `
  <details class="method no-print">
    <summary>Cómo se calcularon estas cifras</summary>
    <div class="method-body">
      <p>El cálculo es determinista: con las mismas respuestas el informe entrega siempre el mismo resultado. No hay estimaciones generadas al vuelo ni cifras traídas de otros clientes.</p>

      <h5>Horas que hoy consume un proceso</h5>
      <p><code>horas/mes = volumen mensual × minutos por caso ÷ 60</code></p>
      <p>Cada tramo se convierte a un valor representativo tomado del extremo bajo, no del punto medio. Un proceso marcado como «parcialmente manual» pondera la mitad.</p>

      <h5>Fracción automatizable</h5>
      <p><code>A = base del proceso × factor de reglas × factor de excepciones</code>, acotada entre 0,30 y 0,85.</p>
      <p>La base depende del tipo de proceso: una conciliación bancaria es más automatizable que la comparación de cotizaciones de proveedores. Los factores ajustan según lo que declaraste sobre reglas y excepciones en cada área. El techo de 0,85 refleja que ningún proceso se automatiza al 100%: siempre queda supervisión y manejo de casos fuera de norma.</p>

      <h5>Rango de ahorro</h5>
      <p><code>mínimo = horas × A × 0,80</code> · <code>máximo = horas × A × 1,00</code></p>

      <h5>Puntaje del área</h5>
      <p><code>score = 100 × (0,30 × cobertura + 0,40 × magnitud + 0,30 × automatabilidad)</code></p>
      <ul>
        <li><strong>Cobertura:</strong> proporción de procesos del área marcados como manuales.</li>
        <li><strong>Magnitud:</strong> horas del área contra una referencia que escala con el tamaño de la empresa (${fmt(R.empRef)} empleados de referencia). Por eso 100 horas al mes no significan lo mismo en una empresa de 40 personas que en una de 3.000.</li>
        <li><strong>Automatabilidad:</strong> promedio de A ponderado por horas.</li>
      </ul>

      <h5>Bandas de prioridad</h5>
      <p>80 o más: muy alta · 65 a 79: alta · 50 a 64: media · 35 a 49: baja · menos de 35: muy baja.</p>

      <h5>Clasificación de retorno por proceso</h5>
      <p>Sobre 120 h/mes: muy alto · 60 a 119: alto · 25 a 59: medio · bajo 25: bajo.</p>

      <h5>Lo que este cálculo no hace</h5>
      <ul>
        <li>No mide tus sistemas ni valida los volúmenes declarados.</li>
        <li>No estima el costo ni el plazo de implementación.</li>
        <li>No considera restricciones técnicas, de seguridad ni de cumplimiento específicas de tu organización.</li>
      </ul>
    </div>
  </details>`;
}

/* ---------- Bloque interno ---------- */
function renderInterno(R){
  const e = state.empresa;
  const poc = R.poc;

  const señales = [];
  if(e.previo === 'rpa') señales.push('Ya usa una plataforma RPA: la conversación es de reemplazo o coexistencia, no de evangelización. Preguntar cuál, cuántos robots y cuándo vence el contrato.');
  if(e.previo === 'ninguna') señales.push('Sin experiencia previa: el ciclo probablemente incluye educación de mercado. Considerar POC como paso obligado.');
  if(e.previo === 'scripts') señales.push('Tiene macros o scripts internos: hay dolor reconocido y alguien técnico con quien aliarse. Suele acortar el ciclo.');
  if(e.ti === 'no') señales.push('Sin equipo de TI propio: el patrocinio será del área de negocio y la implementación probablemente sea servicio gestionado.');
  if(e.ti === 'limitado') señales.push('TI con poca capacidad: usar eso como argumento, no como obstáculo. La automatización descarga a TI en vez de sumarle trabajo.');
  if(e.ti === 'si') señales.push('Tiene equipo de desarrollo: preparar la conversación de construir versus comprar. TI puede ser el mayor detractor o el mejor aliado.');
  if(e.erp === 'Desarrollo propio') señales.push('ERP propio: baja probabilidad de APIs documentadas. Refuerza el caso de RPA sobre integración tradicional.');
  if(e.erp === 'No usamos ERP') señales.push('Sin ERP: revisar si el volumen declarado es realista antes de dimensionar.');
  if(e.crm === 'No usamos CRM') señales.push('Sin CRM: los procesos comerciales declarados probablemente viven en planillas. Validar antes de comprometer alcance.');
  if(e.sucursales === '20+') señales.push('Más de 20 sedes: revisar si los procesos están estandarizados entre ubicaciones. Si no lo están, el alcance real es mayor al declarado.');
  if(R.totalMax > 1500) señales.push('Volumen declarado alto: verificar los tramos con el cliente antes de usar estas cifras en una propuesta.');

  const preguntas = R.relevantes.slice(0,5).map(o=>{
    const base = {
      fin_facturas:'¿En qué formato llegan las facturas y qué porcentaje viene en formato electrónico estructurado?',
      fin_concil:'¿Cuántos bancos y cuántas cuentas se concilian, y con qué frecuencia se cierra?',
      fin_pdf:'¿Los documentos tienen formato fijo o cambian según el emisor?',
      fin_reportes:'¿Quién consume esos reportes y qué decisión se toma con ellos?',
      fin_pagos:'¿Los portales tienen doble factor de autenticación o captcha?',
      fin_cobranza:'¿Existe una política de cobranza escrita o cada ejecutivo define su criterio?',
      rh_ingreso:'¿Cuántos sistemas distintos hay que actualizar por cada movimiento de personal?',
      rh_vacaciones:'¿Quién autoriza y cuántos niveles de aprobación tiene?',
      rh_nomina:'¿Cuántos días del mes se dedican solo a preparar los insumos?',
      rh_usuarios:'¿Cuánto demora hoy habilitar a una persona nueva desde que firma?',
      rh_contratos:'¿Cuántas plantillas distintas existen y quién las mantiene?',
      rh_cv:'¿Cuántas postulaciones se reciben por vacante?',
      co_crm_erp:'¿En qué dirección fluye el dato y quién es el dueño del registro maestro?',
      co_cotiza:'¿Cuánto demora una cotización desde que se pide hasta que se envía?',
      co_correos:'¿Existen plantillas o cada ejecutivo escribe de cero?',
      co_oportunidades:'¿Qué pasa cuando alguien no registra? ¿Se pierde el dato o hay control?',
      co_pedidos:'¿Los clientes envían en formato propio o usan un formato acordado?',
      at_email:'¿Cuántas casillas compartidas hay y cuál es el tiempo de primera respuesta?',
      at_repetitivas:'¿Cuáles son las cinco consultas más frecuentes y qué porcentaje del total representan?',
      at_tickets:'¿Qué herramienta de tickets se usa y tiene API?',
      at_multisistema:'¿Cuántas pantallas abre un agente para resolver un caso típico?',
      at_reclamos:'¿El seguimiento vive en el sistema oficial o en planillas paralelas?',
      op_reportes_diarios:'¿A qué hora deben estar listos y qué pasa si se atrasan?',
      op_portales:'¿Son portales propios de clientes o de organismos públicos? ¿Cambian de interfaz seguido?',
      op_copiar:'¿Por qué no están integrados hoy? ¿Es tema técnico, de costo o de prioridad?',
      op_excel:'¿Quién mantiene esas planillas y qué pasa si esa persona no está?',
      op_validaciones:'¿Qué se hace cuando se detecta un error? ¿Hay retrabajo aguas arriba?',
      op_carga_masiva:'¿Con qué frecuencia y cuántos registros por carga?',
      cp_oc:'¿Cuántos niveles de aprobación tiene una orden de compra?',
      cp_proveedores:'¿Qué documentos se piden y quién los valida?',
      cp_cotizaciones:'¿Existe un umbral de monto que obliga a pedir tres cotizaciones?',
      cp_recepcion:'¿Qué porcentaje de facturas queda bloqueada por diferencias en el match?',
      cp_seguimiento:'¿Los proveedores tienen portal o todo es por correo?'
    }[o.id] || '¿Cómo se hace hoy exactamente, paso a paso?';
    return `<li><strong>${o.titulo}:</strong> ${base}</li>`;
  }).join('');

  return `
  <div class="internal no-print">
    <span class="internal-tag">Solo uso interno · no compartir con el cliente</span>
    <h3>Notas comerciales</h3>

    <h4>Dimensionamiento referencial de plan</h4>
    <table class="itable">
      <tr><th>Plan sugerido</th><td><strong>${R.plan.nombre}</strong>${R.plan.precio ? ' · ' + R.plan.precio + ' anual (lista)' : ''}</td></tr>
      <tr><th>Rango del plan</th><td>${R.plan.rango}</td></tr>
      <tr><th>Criterio aplicado</th><td>${R.plan.razon}</td></tr>
      <tr><th>Procesos sobre umbral</th><td class="num">${R.relevantes.length}</td></tr>
      <tr><th>Horas máx. estimadas</th><td class="num">${fmt(R.totalMax)} h/mes</td></tr>
    </table>
    <p style="font-size:12.5px;color:var(--ink-3);margin-top:8px">Referencial. Contrastar contra la calculadora de recomendación de plan y la tabla canónica de límites antes de cotizar. Entry 0 (USD 4.990) no se muestra en materiales públicos.</p>

    <h4>Candidato a POC</h4>
    <p style="font-size:13.5px">${poc ? `<strong>${poc.titulo}</strong> — ${fmt(poc.min)}–${fmt(poc.max)} h/mes, complejidad ${poc.complejidad.toLowerCase()}, ${poc.productos.join(' + ')}.` : '—'}</p>

    ${señales.length ? `<h4>Señales de calificación</h4><ul style="font-size:13.5px;margin-left:18px">${señales.map(s=>`<li style="margin-bottom:6px">${s}</li>`).join('')}</ul>` : ''}

    <h4>Preguntas para el levantamiento</h4>
    <ul style="font-size:13.5px;margin-left:18px">${preguntas}</ul>

    <h4>Detalle de cálculo por proceso</h4>
    <table class="itable">
      <thead><tr><th>Proceso</th><th>Vol.</th><th>Min.</th><th>h/mes</th><th>A</th><th>Ahorro</th></tr></thead>
      <tbody>
        ${R.oportunidades.map(o=>`<tr>
          <td>${o.titulo}</td>
          <td class="num">${fmt(o.volumen)}</td>
          <td class="num">${o.minutos}</td>
          <td class="num">${fmt(o.horasMes)}</td>
          <td class="num">${o.A.toFixed(2)}</td>
          <td class="num">${fmt(o.min)}–${fmt(o.max)}</td>
        </tr>`).join('')}
      </tbody>
    </table>
  </div>`;
}

/* ---------- Exportación ---------- */
function exportarJSON(){
  const R = window.__R || calcular();
  const payload = {
    generado: new Date().toISOString(),
    herramienta:'Automation Opportunity Finder',
    empresa: {
      industria:state.empresa.industria, pais:state.empresa.pais,
      empleados:EMPLEADOS[state.empresa.empleados]?.label || null,
      facturacion:FACTURACION[state.empresa.facturacion]?.label || null,
      erp:state.empresa.erp, crm:state.empresa.crm,
      sucursales:state.empresa.sucursales, equipoTI:state.empresa.ti,
      experienciaPrevia:state.empresa.previo,
      costoHoraUSD: state.empresa.costoHora ? Number(state.empresa.costoHora) : null
    },
    resumen:{
      scoreGlobal:R.scoreGlobal,
      horasActualesMes:round(R.totalHorasActuales),
      ahorroEstimadoMesMin:round(R.totalMin),
      ahorroEstimadoMesMax:round(R.totalMax),
      procesosDeclarados:R.oportunidades.length,
      procesosSobreUmbral:R.relevantes.length,
      planReferencial:R.plan.nombre,
      candidatoPOC:R.poc ? R.poc.titulo : null
    },
    areas:R.areas.map(a=>({
      area:a.nombre, score:a.score, prioridad:a.prioridad,
      procesosManuales:a.manuales, procesosEvaluados:a.totalProc,
      ahorroMin:round(a.ahorroMinArea), ahorroMax:round(a.ahorroMaxArea),
      complejidad:a.complejidad
    })),
    procesos:R.oportunidades.map(o=>({
      area:o.area, proceso:o.titulo, estado:ESTADO[o.estado].label,
      volumenMensual:o.volumen, minutosPorCaso:o.minutos, personas:o.personas,
      horasMesActuales:round(o.horasMes), fraccionAutomatizable:round(o.A,3),
      ahorroMin:round(o.min), ahorroMax:round(o.max),
      retorno:roiLabel(o.roi), complejidad:o.complejidad, productos:o.productos
    })),
    nota:'Estimaciones referenciales construidas sobre tramos declarados por el usuario. Requieren validación mediante levantamiento técnico.'
  };
  const blob = new Blob([JSON.stringify(payload,null,2)],{type:'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `diagnostico-automatizacion-${new Date().toISOString().slice(0,10)}.json`;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/* ---------- Router ---------- */
function render(){
  renderPasos();
  if(state.paso === 0) return renderIntro();
  if(state.paso === 1) return renderEmpresa();
  if(state.paso >= 2 && state.paso <= TOTAL_PASOS) return renderArea(state.paso - 2);
  return renderResultados();
}

render();

/* ------------------------------------------------------------------
   Puente hacia window. Lo agrega scripts/extraer-motores.mjs porque el
   motor viene de un <script> clásico y el cuerpo lo llama desde onclick.
   Nada de arriba se modificó: esto solo vuelve a exponer lo que el
   ámbito de módulo dejaría privado.
   ------------------------------------------------------------------ */
Object.assign(window, { banda, calcular, clamp, colorBanda, elegirPOC, exportarJSON, fmt, ir, opciones, opcionesLista, recomendarPlan, render, renderArea, renderEmpresa, renderInterno, renderIntro, renderMetodologia, renderPasos, renderProceso, renderResultados, renderRuta, roiLabel, round, setEmpresa, setEstado, setProc, setQual });
/* Estado y catálogos que lee el envoltorio para guardar y restaurar. */
Object.assign(window, { state, AREAS });
