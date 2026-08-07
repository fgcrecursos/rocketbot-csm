"use strict";

/* ==========================================================================
   ROCKETBOT — CONSTRUCTOR DE ROADMAP DE AUTOMATIZACIÓN
   Sin backend, sin librerías externas, sin almacenamiento del navegador.
   Persistencia mediante archivo JSON que el consultor guarda y vuelve a cargar.
   ========================================================================== */

/* -------------------- Catálogos -------------------- */
const AREAS = ['Finanzas','Recursos Humanos','Comercial','Tecnología','Compras','Operaciones','Atención al Cliente'];
const INDUSTRIAS = ['Banca y servicios financieros','Seguros','Retail y consumo masivo','Manufactura','Salud','Logística y transporte','Minería y energía','Telecomunicaciones','Educación','Servicios profesionales','Sector público','Agroindustria','Construcción e inmobiliaria','Otra'];
const PAISES = ['Chile','México','Colombia','Perú','Argentina','Brasil','Ecuador','Uruguay','Costa Rica','Panamá','Estados Unidos','España','Otro'];

const FRECUENCIAS = {
  f1:{l:'Varias veces al día', mult:1.15},
  f2:{l:'Diario',              mult:1.10},
  f3:{l:'Semanal',             mult:1.00},
  f4:{l:'Mensual',             mult:0.92},
  f5:{l:'Eventual',            mult:0.85}
};

/* Criterios de IMPACTO — mayor puntaje siempre significa mayor impacto */
const C_IMPACTO = [
  {id:'horas', n:'Horas consumidas', p:1.3,
   a1:'Consume poco tiempo del equipo', a5:'Consume una parte relevante de la jornada',
   tip:'Cuánto tiempo total absorbe hoy este proceso en el área. Referencia: 1 equivale a unas pocas horas al mes; 5, a más de una persona a tiempo completo.'},
  {id:'ahorro', n:'Ahorro económico esperado', p:1.2,
   a1:'Marginal', a5:'Significativo para el presupuesto del área',
   tip:'Estimación cualitativa del ahorro. No confundir con el cálculo de horas, que se obtiene aparte a partir del volumen y el tiempo por ejecución que se ingresaron.'},
  {id:'cliente', n:'Impacto para el cliente final', p:1.0,
   a1:'El cliente no lo percibe', a5:'Afecta directamente su experiencia',
   tip:'Si automatizarlo mejora tiempos de respuesta o calidad percibida por el cliente externo. Un proceso interno invisible puntúa bajo aunque consuma mucho tiempo.'},
  {id:'errores', n:'Reducción de errores', p:1.1,
   a1:'Casi no se cometen errores hoy', a5:'Los errores son frecuentes y costosos',
   tip:'Frecuencia y costo de los errores actuales. Considerar el retrabajo aguas abajo, no solo el error en sí.'},
  {id:'riesgo', n:'Riesgo operacional', p:1.1,
   a1:'Si falla, no pasa gran cosa', a5:'Si falla, se detiene la operación',
   tip:'Qué ocurre si el proceso no se ejecuta a tiempo o se ejecuta mal. Incluye dependencia de una sola persona para que funcione.'},
  {id:'cumplimiento', n:'Cumplimiento normativo', p:1.0,
   a1:'Sin exigencia regulatoria', a5:'Sujeto a auditoría o norma específica',
   tip:'Si el proceso está alcanzado por regulación, auditoría interna o requisitos de trazabilidad. Suele elevar la prioridad más allá del ahorro.'},
  {id:'satisfaccion', n:'Satisfacción del equipo', p:0.8,
   a1:'El equipo no lo percibe como carga', a5:'Es de las tareas que más desgastan',
   tip:'Cuánto pesa este proceso en el ánimo del equipo. Importa para la adopción: automatizar primero lo que la gente odia facilita todo lo que viene después.'}
];

/* Criterios de COMPLEJIDAD — mayor puntaje siempre significa mayor complejidad */
const C_COMPLEJIDAD = [
  {id:'sistemas', n:'Cantidad de sistemas involucrados', p:1.2,
   a1:'Un solo sistema', a5:'Cinco o más sistemas distintos',
   tip:'Cuántas aplicaciones distintas hay que abrir para completar el proceso de principio a fin. Contar también planillas y correo.'},
  {id:'datos', n:'Problemas de calidad de los datos', p:1.3,
   a1:'Datos limpios y consistentes', a5:'Datos dispersos, con errores y duplicados',
   tip:'Ojo con la dirección de la escala: aquí 5 significa datos en mal estado, es decir, más complejidad. Es el factor que más suele retrasar una implementación.'},
  {id:'excepciones', n:'Cantidad de excepciones', p:1.2,
   a1:'Menos del 5% de los casos', a5:'Más del 30% se sale del procedimiento',
   tip:'Proporción de casos que no siguen el camino estándar. Cada excepción es una rama adicional que hay que construir y mantener.'},
  {id:'humano', n:'Necesidad de intervención humana', p:1.1,
   a1:'Reglas claras, sin criterio experto', a5:'Requiere juicio profesional en cada caso',
   tip:'Si una persona debe decidir con criterio propio. No impide automatizar, pero desplaza el resultado hacia automatización asistida en vez de desatendida.'},
  {id:'documentos', n:'Uso de documentos no estructurados', p:1.0,
   a1:'Datos ya estructurados en sistemas', a5:'PDF, imágenes o correos que hay que leer',
   tip:'Documentos que una persona debe interpretar para extraer el dato. Activa la recomendación de AI Studio.'},
  {id:'ia', n:'Necesidad de IA', p:1.0,
   a1:'Reglas deterministas', a5:'Requiere clasificar, interpretar o redactar',
   tip:'Si el proceso necesita comprender lenguaje, clasificar por contenido o generar texto. Suma capacidad, pero también complejidad y necesidad de validación.'},
  {id:'dependencias', n:'Dependencias externas', p:0.9,
   a1:'Todo bajo control interno', a5:'Depende de terceros o portales externos',
   tip:'Portales de organismos, sistemas de clientes o proveedores. Escapan a su control y pueden cambiar sin aviso.'}
];

/* Características del proceso — activan recomendaciones de producto */
const CARACT = [
  {id:'pdf',    l:'Documentos PDF o imágenes'},
  {id:'correo', l:'Entra por correo electrónico'},
  {id:'erp',    l:'Opera sobre SAP u otro ERP'},
  {id:'portal', l:'Requiere portales web externos'},
  {id:'excel',  l:'Usa Excel como intermediario'},
  {id:'solicitud', l:'Nace de una solicitud de un usuario'},
  {id:'aprobacion', l:'Incluye aprobaciones'},
  {id:'reporte', l:'Termina en un reporte o tablero'}
];

const PRODUCTOS = {
  'RPA Studio':{c:'var(--rb-red)', r:'Ejecución sobre los sistemas existentes, con o sin API'},
  'AI Studio':{c:'var(--rb-blue)', r:'Lectura y clasificación de documentos y texto'},
  'Saturn Studio':{c:'var(--rb-green)', r:'Orquestación de flujos, APIs y modelos de lenguaje'},
  'Orquestador':{c:'var(--rb-dark)', r:'Programación, control y trazabilidad de la ejecución'},
  'Xperience':{c:'var(--rb-amber)', r:'Entrada estructurada de solicitudes que disparan automatizaciones'},
  'Nexus':{c:'var(--rb-purple)', r:'Visibilidad ejecutiva de lo automatizado'}
};

/* -------------------- Estado -------------------- */
const state = {
  vista:'cliente',
  cliente:{empresa:'',industria:'',pais:'',area:'',consultor:'',fecha:new Date().toISOString().slice(0,10),costoHora:''},
  procesos:[],
  editando:null,
  borrador:null
};

const VISTAS = [
  {id:'cliente',  n:'01', l:'Cliente'},
  {id:'procesos', n:'02', l:'Procesos'},
  {id:'analisis', n:'03', l:'Análisis'},
  {id:'informe',  n:'04', l:'Informe'}
];

/* -------------------- Utilidades -------------------- */
const $ = id => document.getElementById(id);
const clamp = (v,a,b) => Math.max(a,Math.min(b,v));
const round = (v,d=0) => {const m=Math.pow(10,d);return Math.round(v*m)/m;};
const fmt = n => new Intl.NumberFormat('es-CL',{maximumFractionDigits:0}).format(Math.round(n||0));
const esc = s => String(s==null?'':s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

function nuevoBorrador(){
  const b = {id:'p'+Date.now(), nombre:'', area:'', desc:'', frecuencia:'f3',
             volumen:'', minutos:'', personas:'1', caract:[], imp:{}, cx:{}};
  C_IMPACTO.forEach(c=>b.imp[c.id]=3);
  C_COMPLEJIDAD.forEach(c=>b.cx[c.id]=3);
  return b;
}

/* -------------------- Motor de cálculo -------------------- */

// Normaliza un bloque de criterios 1-5 a una escala 0-100
function normalizar(vals, criterios){
  let s=0, p=0;
  criterios.forEach(c=>{ s += (vals[c.id]||3)*c.p; p += c.p; });
  return round(((s/p) - 1) / 4 * 100);
}

function evaluar(pr){
  const impacto = normalizar(pr.imp, C_IMPACTO);
  const complejidad = normalizar(pr.cx, C_COMPLEJIDAD);

  // Cuadrante: el punto medio de una escala 1-5 es 3, que normalizado da 50.
  const altoImp = impacto >= 50, altaCx = complejidad >= 50;
  const cuad = altoImp ? (altaCx ? 'sp' : 'qw') : (altaCx ? 'av' : 'fi');

  // Prioridad: favorece el impacto pero penaliza la complejidad.
  const prioridad = round(impacto*0.65 + (100-complejidad)*0.35);

  // Índice de retorno relativo. NO es un ROI financiero y se rotula como tal.
  const retorno = round(impacto / Math.max(complejidad, 12), 2);

  // Horas: salen de los datos duros declarados, no de las escalas 1-5.
  const V = parseFloat(pr.volumen)||0;
  const T = parseFloat(pr.minutos)||0;
  const horasMes = V*T/60;
  // Fracción automatizable: baja conforme sube la complejidad. Techo 0,85:
  // ningún proceso se automatiza al 100%, siempre queda supervisión.
  const A = clamp(0.85 - (complejidad/100)*0.45, 0.40, 0.85);
  const ahorroMin = horasMes*A*0.80, ahorroMax = horasMes*A*1.00;

  // Nivel de automatización alcanzable
  const hum = pr.cx.humano||3, exc = pr.cx.excepciones||3;
  const nivel = (hum<=2 && exc<=2) ? 'Desatendida'
              : (hum>=4 || exc>=4) ? 'Asistida' : 'Mixta';

  // Banda de implementación referencial, derivada de la complejidad
  const impl = complejidad<30 ? {l:'2 a 4 semanas', w:3}
             : complejidad<50 ? {l:'4 a 8 semanas', w:6}
             : complejidad<70 ? {l:'8 a 14 semanas', w:11}
             : {l:'Más de 14 semanas', w:16};

  return {impacto, complejidad, cuad, prioridad, retorno, horasMes, A,
          ahorroMin, ahorroMax, nivel, impl, productos:recomendar(pr, complejidad)};
}

/* Recomendación por proceso. Solo productos cuya necesidad varía caso a caso.
   El Orquestador y Nexus se deciden a nivel de cartera: recomendar un
   orquestador para un solo proceso no tiene sentido, y un producto que
   aparece en el 100% de los procesos no aporta información para priorizar. */
function recomendar(pr, cx){
  const R = [], add = (n,por) => { if(!R.find(x=>x.n===n)) R.push({n,por}); };
  const c = pr.caract||[], k = id => c.includes(id);
  const cxv = pr.cx;

  if(k('erp') || k('portal') || k('excel') || (cxv.sistemas||0) >= 2)
    add('RPA Studio', k('erp') ? 'Opera sobre el ERP directamente, sin depender de que exponga API'
      : k('portal') ? 'Accede a portales externos por interfaz, que es la única capa siempre disponible'
      : 'Ejecuta sobre los sistemas actuales sin exigir integración previa');

  if(k('pdf') || (cxv.documentos||0) >= 4)
    add('AI Studio', 'Hay documentos que hoy alguien debe leer para extraer el dato');
  if(k('correo'))
    add('AI Studio', 'Las solicitudes llegan por correo y requieren interpretar el contenido antes de derivar');
  if((cxv.ia||0) >= 4)
    add('AI Studio', 'El proceso exige clasificar o interpretar, no solo aplicar reglas');

  if((cxv.ia||0) >= 3 && (cxv.sistemas||0) >= 3)
    add('Saturn Studio', 'Combina varios sistemas con decisiones no triviales: es un flujo, no una tarea');
  if(k('aprobacion'))
    add('Saturn Studio', 'Las aprobaciones requieren un flujo con estados, no una ejecución lineal');

  if(k('solicitud'))
    add('Xperience', 'Captura la solicitud como formulario estructurado en origen, en vez de interpretarla después');
  if(k('correo') && !k('solicitud'))
    add('Xperience', 'Reemplazar el correo por un formulario evita tener que interpretar la solicitud después');

  if(R.length === 0) add('RPA Studio', 'Ejecución del proceso sobre los sistemas actuales');
  return R;
}

/* Productos que se justifican por el tamaño y la forma de la cartera completa,
   no por un proceso individual. */
function recomendarCartera(evs){
  const R = [], add = (n,por) => R.push({n, por});
  const n = evs.length;
  const diarios = evs.filter(x=>x.p.frecuencia==='f1'||x.p.frecuencia==='f2').length;
  const conExcep = evs.filter(x=>(x.p.cx.excepciones||0)>=4).length;
  const multiSis = evs.filter(x=>(x.p.cx.sistemas||0)>=4).length;
  const reportes = evs.filter(x=>(x.p.caract||[]).includes('reporte')).length;

  const razonesOrq = [];
  if(n >= 3) razonesOrq.push(`con ${n} procesos en cartera hace falta programar y coordinar la ejecución desde un solo lugar`);
  if(diarios >= 2) razonesOrq.push(`${diarios} procesos corren a diario o más seguido, lo que exige calendarización y no lanzamiento manual`);
  if(conExcep >= 1) razonesOrq.push(`${conExcep} proceso${conExcep>1?'s tienen':' tiene'} un volumen de excepciones que necesita una cola de casos registrada`);
  if(multiSis >= 1) razonesOrq.push(`${multiSis} proceso${multiSis>1?'s cruzan':' cruza'} cuatro o más sistemas y requiere trazabilidad centralizada`);
  if(razonesOrq.length) add('Orquestador', razonesOrq);

  const razonesNex = [];
  if(n >= 5) razonesNex.push(`una cartera de ${n} procesos deja de poder seguirse a mano: sin una lectura consolidada, el programa depende de la percepción`);
  if(reportes >= 1) razonesNex.push(`${reportes} proceso${reportes>1?'s terminan':' termina'} en un reporte, que conviene que viva en un tablero y no en un archivo que alguien arma`);
  if(razonesNex.length) add('Nexus', razonesNex);

  return R;
}

function analisis(){
  const evs = state.procesos.map(p=>({p, e:evaluar(p)}));
  evs.sort((a,b)=> b.e.prioridad - a.e.prioridad);

  const costoHora = parseFloat(state.cliente.costoHora)||0;
  const horasMes = evs.reduce((s,x)=>s+x.e.horasMes,0);
  const ahMin = evs.reduce((s,x)=>s+x.e.ahorroMin,0);
  const ahMax = evs.reduce((s,x)=>s+x.e.ahorroMax,0);
  const retProm = evs.length ? round(evs.reduce((s,x)=>s+x.e.retorno,0)/evs.length, 2) : 0;
  const impProm = evs.length ? round(evs.reduce((s,x)=>s+x.e.impacto,0)/evs.length) : 0;
  const cxProm  = evs.length ? round(evs.reduce((s,x)=>s+x.e.complejidad,0)/evs.length) : 0;

  const q = {qw:[],sp:[],fi:[],av:[]};
  evs.forEach(x=>q[x.e.cuad].push(x));

  // Fases del roadmap
  const fases = [
    {n:1, t:'Quick Wins', c:'var(--q-green)', when:'Primeros 2 a 3 meses',
     d:'Alto impacto con baja complejidad. Son los que demuestran el mecanismo y financian la conversación siguiente.',
     items:q.qw},
    {n:2, t:'Consolidación', c:'var(--q-amber)', when:'Meses 3 a 6',
     d:'Procesos de menor impacto individual pero baratos de automatizar. Se hacen aprovechando accesos, credenciales y conocimiento que la fase 1 ya dejó montados.',
     items:q.fi},
    {n:3, t:'Proyectos estratégicos', c:'var(--q-blue)', when:'Meses 6 a 12',
     d:'Alto impacto y alta complejidad. Requieren levantamiento formal, y con la infraestructura de las fases previas en operación el riesgo baja de manera sustancial.',
     items:q.sp},
    {n:4, t:'Rediseño antes de automatizar', c:'var(--q-red)', when:'Sin fecha comprometida',
     d:'Bajo impacto y alta complejidad. Automatizarlos en su forma actual consolidaría un proceso que conviene revisar primero. La recomendación honesta no es programarlos sino rediseñarlos.',
     items:q.av}
  ];

  // Semanas acumuladas por fase, con paralelismo parcial.
  // La fase 4 no lleva plazo: recomendar rediseñar y a la vez estimar una
  // duración de implementación sería contradictorio.
  fases.forEach(f=>{
    f.semanas = (f.n < 4 && f.items.length) ? Math.round(f.items.reduce((s,x)=>s+x.e.impl.w,0) * 0.7) : 0;
  });

  // Nivel general de la cartera
  const n = evs.length;
  const pctBueno = n ? (q.qw.length + q.sp.length)/n : 0;
  const nivelGeneral = n === 0 ? {l:'Sin datos', d:''}
    : pctBueno >= 0.7 && cxProm < 55 ? {l:'Cartera favorable', d:'La mayoría de los procesos evaluados tienen impacto alto y complejidad manejable. Es un punto de partida poco frecuente.'}
    : pctBueno >= 0.5 ? {l:'Cartera equilibrada', d:'Hay una base clara para partir y algunos casos que requieren levantamiento más profundo antes de comprometer alcance.'}
    : cxProm >= 60 ? {l:'Cartera compleja', d:'La complejidad promedio es alta. Conviene acotar el alcance inicial a los pocos casos de menor complejidad antes de proponer un programa.'}
    : {l:'Cartera de bajo impacto', d:'Los procesos evaluados no concentran suficiente impacto. Antes de dimensionar, vale la pena revisar si quedaron procesos fuera del levantamiento.'};

  const productos = {};
  evs.forEach(x=>x.e.productos.forEach(pr=>{
    if(!productos[pr.n]) productos[pr.n] = {n:pr.n, cnt:0, motivos:new Set()};
    productos[pr.n].cnt++; productos[pr.n].motivos.add(pr.por);
  }));
  const prodOrden = Object.values(productos).sort((a,b)=>b.cnt-a.cnt)
    .map(p=>({n:p.n, cnt:p.cnt, motivos:[...p.motivos]}));
  const prodCartera = recomendarCartera(evs);

  return {evs, q, fases, costoHora, horasMes, ahMin, ahMax, retProm, impProm, cxProm,
          nivelGeneral, prodOrden, prodCartera, total:evs.length,
          semanasTotal: fases.slice(0,3).reduce((s,f)=>s+f.semanas,0)};
}

const CUAD = {
  qw:{l:'Quick Win', c:'var(--q-green)', k:'t-qw'},
  sp:{l:'Proyecto estratégico', c:'var(--q-blue)', k:'t-sp'},
  fi:{l:'Complementario', c:'var(--q-amber)', k:'t-fi'},
  av:{l:'Rediseñar primero', c:'var(--q-red)', k:'t-av'}
};

/* -------------------- Render: navegación -------------------- */
function renderNav(){
  const listo = {cliente: !!state.cliente.empresa, procesos: state.procesos.length>0,
                 analisis: state.procesos.length>0, informe: state.procesos.length>0};
  $('nav').innerHTML = VISTAS.map(v=>`
    <button class="nav-i ${state.vista===v.id?'on':''} ${listo[v.id]&&state.vista!==v.id?'done':''}" onclick="ir('${v.id}')">
      <span class="nav-n">${v.n}</span><span class="lbl-txt">${v.l}</span>
      ${v.id==='procesos'&&state.procesos.length?`<span class="nav-badge">${state.procesos.length}</span>`:''}
    </button>`).join('');
  const pct = Math.min(100, state.procesos.length*20);
  $('prog').style.width = pct+'%';
  $('progTxt').textContent = state.procesos.length===0 ? 'Sin procesos'
    : state.procesos.length+' proceso'+(state.procesos.length>1?'s':'')+' evaluado'+(state.procesos.length>1?'s':'');
}

function ir(v){
  if(state.vista==='procesos' && state.borrador) { if(!confirm('Hay un proceso sin guardar. ¿Descartarlo?')) return; state.borrador=null; state.editando=null; }
  state.vista=v; render(); window.scrollTo({top:0});
}

function tema(){
  const d = document.documentElement.getAttribute('data-theme')==='dark';
  document.documentElement.setAttribute('data-theme', d?'light':'dark');
  $('temaBtn').textContent = d?'Modo oscuro':'Modo claro';
}
if(window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches){
  document.documentElement.setAttribute('data-theme','dark');
}

function toast(msg){
  const t=document.createElement('div'); t.className='toast'; t.textContent=msg;
  document.body.appendChild(t); setTimeout(()=>t.remove(), 2600);
}

/* -------------------- Vista: Cliente -------------------- */
function vCliente(){
  const c = state.cliente;
  const opt = (arr,sel) => `<option value="">Selecciona…</option>`+arr.map(v=>`<option ${v===sel?'selected':''}>${esc(v)}</option>`).join('');
  return `
  <div class="view on" id="v-cliente">
    <div class="page-head">
      <span class="eyebrow">Paso 01</span>
      <h1>Datos del cliente</h1>
      <p>Encabezan el informe que se genera al final. Se pueden completar durante la reunión o antes de empezar.</p>
    </div>
    <div class="card"><div class="card-b">
      <div class="grid g2">
        <div class="f"><label>Empresa</label><input value="${esc(c.empresa)}" oninput="setC('empresa',this.value)" placeholder="Nombre de la organización"></div>
        <div class="f"><label>Industria</label><select onchange="setC('industria',this.value)">${opt(INDUSTRIAS,c.industria)}</select></div>
        <div class="f"><label>País</label><select onchange="setC('pais',this.value)">${opt(PAISES,c.pais)}</select></div>
        <div class="f"><label>Área evaluada</label><select onchange="setC('area',this.value)">${opt(['Transversal (varias áreas)'].concat(AREAS),c.area)}</select></div>
        <div class="f"><label>Consultor</label><input value="${esc(c.consultor)}" oninput="setC('consultor',this.value)" placeholder="Quien conduce la sesión"></div>
        <div class="f"><label>Fecha</label><input type="date" value="${c.fecha}" onchange="setC('fecha',this.value)"></div>
      </div>
      <div style="margin-top:18px">
        <div class="f"><label>Costo promedio por hora del equipo, en USD <span style="font-weight:500;color:var(--ink-3)">(opcional)</span></label>
          <input type="number" min="0" step="1" value="${esc(c.costoHora)}" oninput="setC('costoHora',this.value)" placeholder="Ej: 18" style="max-width:220px">
          <div class="hint">Si se completa, el informe traduce las horas a un rango de valor. Si se deja vacío, el informe habla solo de horas, que es lo defendible sin este dato.</div></div>
      </div>
      <div class="btn-row">
        <button class="btn btn-p" onclick="ir('procesos')">Continuar a procesos →</button>
        <button class="btn btn-g" onclick="cargarJSON()">Cargar sesión guardada</button>
      </div>
    </div></div>
    <div class="note">
      <strong>La sesión no se guarda sola.</strong> Esta aplicación no almacena nada en el navegador ni envía datos
      a ningún servidor, así que funciona sin conexión y sin dejar información del cliente en el equipo.
      Para conservar el avance, exporta el archivo de sesión desde la pantalla de informe y vuelve a cargarlo cuando lo necesites.
    </div>
  </div>`;
}
function setC(k,v){ state.cliente[k]=v; if(k==='empresa') renderNav(); }

/* -------------------- Vista: Procesos -------------------- */
function vProcesos(){
  if(state.borrador) return vFormulario();
  const lista = state.procesos.length === 0
    ? `<div class="empty">
         <h3>Todavía no hay procesos</h3>
         <p>Agrega el primer proceso candidato. En una sesión típica se evalúan entre cinco y doce; con menos de tres, la matriz no alcanza a ordenar nada.</p>
         <button class="btn btn-p" onclick="nuevo()">+ Agregar proceso</button>
       </div>`
    : `<div class="plist">${state.procesos.map((p,i)=>{
        const e = evaluar(p), q = CUAD[e.cuad];
        return `<div class="pi" style="border-left-color:${q.c}">
          <span class="pi-n">${String(i+1).padStart(2,'0')}</span>
          <div class="pi-b">
            <div class="t">${esc(p.nombre||'Sin nombre')}</div>
            <div class="m">${esc(p.area||'Área sin definir')} · ${FRECUENCIAS[p.frecuencia].l}${p.volumen?' · '+fmt(p.volumen)+' al mes':''}</div>
          </div>
          <div class="pi-s">
            <div><div class="l">Impacto</div><div class="v" style="color:var(--rb-green)">${e.impacto}</div></div>
            <div><div class="l">Complej.</div><div class="v" style="color:var(--rb-amber)">${e.complejidad}</div></div>
            <div><div class="l">Prioridad</div><div class="v">${e.prioridad}</div></div>
          </div>
          <span class="tag ${q.k}">${q.l}</span>
          <div class="pi-a">
            <button class="btn btn-g btn-s" onclick="editar('${p.id}')">Editar</button>
            <button class="btn btn-g btn-s" onclick="borrar('${p.id}')">Eliminar</button>
          </div>
        </div>`;}).join('')}</div>`;

  return `
  <div class="view on" id="v-procesos">
    <div class="page-head">
      <span class="eyebrow">Paso 02</span>
      <h1>Procesos candidatos</h1>
      <p>Cada proceso se evalúa en siete criterios de impacto y siete de complejidad. La clasificación aparece en pantalla mientras se completa, lo que permite discutirla con el cliente en el momento.</p>
    </div>
    <div class="card">
      <div class="card-h"><h2>Procesos evaluados${state.procesos.length?' ('+state.procesos.length+')':''}</h2>
        ${state.procesos.length?`<button class="btn btn-p btn-s" onclick="nuevo()">+ Agregar proceso</button>`:''}</div>
      <div class="card-b">${lista}</div>
    </div>
    ${state.procesos.length?`<div class="btn-row"><button class="btn btn-p" onclick="ir('analisis')">Ver análisis →</button></div>`:''}
  </div>`;
}

function nuevo(){ state.borrador = nuevoBorrador(); state.editando=null; render(); }
function editar(id){ state.borrador = JSON.parse(JSON.stringify(state.procesos.find(p=>p.id===id))); state.editando=id; render(); window.scrollTo({top:0}); }
function borrar(id){ if(!confirm('¿Eliminar este proceso del análisis?')) return; state.procesos = state.procesos.filter(p=>p.id!==id); renderNav(); render(); }

function vFormulario(){
  const b = state.borrador, e = evaluar(b), q = CUAD[e.cuad];
  const escala = (bloque, crit) => `
    <div class="crit">
      <div class="crit-t">${crit.n}
        <span class="tip">?<span class="tip-box">${crit.tip}</span></span>
      </div>
      <div class="scale ${bloque==='cx'?'cx':''}">
        ${[1,2,3,4,5].map(v=>`<button class="${(b[bloque][crit.id]===v)?'on':''}" onclick="setEval('${bloque}','${crit.id}',${v})">${v}</button>`).join('')}
      </div>
      <div class="anchors"><span>1 · ${crit.a1}</span><span>5 · ${crit.a5}</span></div>
    </div>`;

  return `
  <div class="view on" id="v-procesos">
    <div class="page-head">
      <span class="eyebrow">${state.editando?'Editando proceso':'Nuevo proceso'}</span>
      <h1>${esc(b.nombre)||'Proceso sin nombre'}</h1>
      <p>Los criterios de complejidad están orientados para que un puntaje mayor signifique siempre mayor dificultad. Revisa los textos de referencia bajo cada escala.</p>
    </div>

    <div class="card">
      <div class="card-h"><h2>Identificación</h2></div>
      <div class="card-b">
        <div class="grid g2">
          <div class="f"><label>Nombre del proceso</label>
            <input value="${esc(b.nombre)}" oninput="setB('nombre',this.value)" placeholder="Ej: Conciliación bancaria"></div>
          <div class="f"><label>Área responsable</label>
            <select onchange="setB('area',this.value)"><option value="">Selecciona…</option>
              ${AREAS.map(a=>`<option ${a===b.area?'selected':''}>${a}</option>`).join('')}</select></div>
        </div>
        <div class="f" style="margin-top:16px"><label>Descripción</label>
          <textarea oninput="setB('desc',this.value)" placeholder="Cómo se hace hoy, paso a paso. Este texto aparece en el informe.">${esc(b.desc)}</textarea></div>
        <div class="grid g4" style="margin-top:16px">
          <div class="f"><label>Frecuencia</label>
            <select onchange="setB('frecuencia',this.value)">
              ${Object.entries(FRECUENCIAS).map(([k,v])=>`<option value="${k}" ${k===b.frecuencia?'selected':''}>${v.l}</option>`).join('')}</select></div>
          <div class="f"><label>Cantidad mensual</label>
            <input type="number" min="0" value="${esc(b.volumen)}" oninput="setB('volumen',this.value)" placeholder="Ej: 250"></div>
          <div class="f"><label>Minutos por ejecución</label>
            <input type="number" min="0" value="${esc(b.minutos)}" oninput="setB('minutos',this.value)" placeholder="Ej: 18"></div>
          <div class="f"><label>Personas involucradas</label>
            <input type="number" min="1" value="${esc(b.personas)}" oninput="setB('personas',this.value)"></div>
        </div>
        <div class="f" style="margin-top:18px"><label>Características del proceso</label>
          <div class="chips">${CARACT.map(c=>`
            <button class="chip-b ${b.caract.includes(c.id)?'on':''}" onclick="toggleCar('${c.id}')">${c.l}</button>`).join('')}</div>
          <div class="hint">Determinan qué productos de la suite se recomiendan. Marcar todas las que apliquen.</div></div>
      </div>
    </div>

    <div class="grid g2" style="margin-top:16px;align-items:start">
      <div class="card">
        <div class="card-h"><h2>Impacto</h2><div class="sub">Un puntaje más alto significa mayor impacto de automatizar.</div></div>
        <div class="card-b" style="padding-top:6px">${C_IMPACTO.map(c=>escala('imp',c)).join('')}</div>
      </div>
      <div class="card">
        <div class="card-h"><h2>Complejidad</h2><div class="sub">Un puntaje más alto significa siempre mayor dificultad de implementar.</div></div>
        <div class="card-b" style="padding-top:6px">${C_COMPLEJIDAD.map(c=>escala('cx',c)).join('')}</div>
      </div>
    </div>

    <div class="card" style="margin-top:16px">
      <div class="card-h"><h2>Resultado de esta evaluación</h2><div class="sub">Se actualiza mientras respondes, para discutirlo con el cliente en el momento.</div></div>
      <div class="card-b">
        <div class="live">
          <div class="live-i"><div class="l">Impacto</div><div class="v" style="color:var(--rb-green)">${e.impacto}</div></div>
          <div class="live-i"><div class="l">Complejidad</div><div class="v" style="color:var(--rb-amber)">${e.complejidad}</div></div>
          <div class="live-i"><div class="l">Prioridad</div><div class="v">${e.prioridad}</div></div>
          <div class="live-i"><div class="l">Clasificación</div><div class="v" style="font-size:15px;color:${q.c}">${q.l}</div></div>
          <div class="live-i"><div class="l">Automatización</div><div class="v" style="font-size:15px">${e.nivel}</div></div>
          <div class="live-i"><div class="l">Horas al mes</div><div class="v" style="font-size:15px">${e.horasMes>0?fmt(e.ahorroMin)+'–'+fmt(e.ahorroMax):'—'}</div></div>
        </div>
        ${e.horasMes===0?`<div class="note w">Sin cantidad mensual y minutos por ejecución no se puede estimar horas. Los puntajes de impacto y complejidad funcionan igual, pero el informe no podrá cuantificar ahorro para este proceso.</div>`:''}
        ${e.productos.length?`<div style="margin-top:18px"><div style="font-size:12px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--ink-3);margin-bottom:9px">Productos sugeridos</div>
          <div class="chips">${e.productos.map(p=>`<span class="tag t-pr">${p.n}</span>`).join('')}</div></div>`:''}
        <div class="btn-row">
          <button class="btn btn-p" onclick="guardar()">${state.editando?'Guardar cambios':'Agregar al análisis'}</button>
          <button class="btn btn-g" onclick="cancelar()">Cancelar</button>
        </div>
      </div>
    </div>
  </div>`;
}

function setB(k,v){
  state.borrador[k]=v;
  if(k==='nombre'){ const h=document.querySelector('#v-procesos .page-head h1'); if(h) h.textContent = v||'Proceso sin nombre'; return; }
  if(k==='volumen'||k==='minutos') refrescarLive();
}
function setEval(bloque,id,v){ state.borrador[bloque][id]=v; render(); }
function toggleCar(id){
  const c=state.borrador.caract, i=c.indexOf(id);
  if(i>=0) c.splice(i,1); else c.push(id);
  render();
}
function refrescarLive(){ const b=state.borrador; if(b) render(); }
function cancelar(){ state.borrador=null; state.editando=null; render(); }
function guardar(){
  const b=state.borrador;
  if(!b.nombre.trim()){ alert('El proceso necesita un nombre para aparecer en el informe.'); return; }
  if(!b.area){ alert('Selecciona el área responsable.'); return; }
  if(state.editando){ const i=state.procesos.findIndex(p=>p.id===state.editando); state.procesos[i]=b; }
  else state.procesos.push(b);
  state.borrador=null; state.editando=null;
  renderNav(); render(); toast(state.editando?'Proceso actualizado':'Proceso agregado');
}

/* -------------------- Matriz SVG -------------------- */
function matriz(evs, w){
  const W=w||620, H=460, m={l:58,r:22,t:22,b:56};
  const pw=W-m.l-m.r, ph=H-m.t-m.b;
  const X = v => m.l + (v/100)*pw;
  const Y = v => m.t + ph - (v/100)*ph;
  const cx=X(50), cy=Y(50);

  const quads = [
    {x:m.l, y:m.t, w:cx-m.l, h:cy-m.t, c:'var(--q-green)', t:'Quick Wins', st:'Alto impacto · baja complejidad'},
    {x:cx, y:m.t, w:m.l+pw-cx, h:cy-m.t, c:'var(--q-blue)', t:'Proyectos estratégicos', st:'Alto impacto · alta complejidad'},
    {x:m.l, y:cy, w:cx-m.l, h:m.t+ph-cy, c:'var(--q-amber)', t:'Complementarios', st:'Bajo impacto · baja complejidad'},
    {x:cx, y:cy, w:m.l+pw-cx, h:m.t+ph-cy, c:'var(--q-red)', t:'Rediseñar primero', st:'Bajo impacto · alta complejidad'}
  ];

  return `<svg viewBox="0 0 ${W} ${H}" width="100%" style="max-width:${W}px" role="img" aria-label="Matriz de impacto contra complejidad">
    ${quads.map(q=>`<rect x="${q.x}" y="${q.y}" width="${q.w}" height="${q.h}" fill="${q.c}" opacity="0.055"/>`).join('')}
    ${quads.map(q=>`
      <text x="${q.x+q.w/2}" y="${q.y+18}" text-anchor="middle" font-family="Montserrat" font-size="11.5" font-weight="700" fill="${q.c}" opacity=".85">${q.t}</text>
      <text x="${q.x+q.w/2}" y="${q.y+32}" text-anchor="middle" font-family="Mulish" font-size="9.5" fill="${q.c}" opacity=".6">${q.st}</text>`).join('')}
    <line x1="${cx}" y1="${m.t}" x2="${cx}" y2="${m.t+ph}" stroke="var(--line)" stroke-width="1.5" stroke-dasharray="4 4"/>
    <line x1="${m.l}" y1="${cy}" x2="${m.l+pw}" y2="${cy}" stroke="var(--line)" stroke-width="1.5" stroke-dasharray="4 4"/>
    <rect x="${m.l}" y="${m.t}" width="${pw}" height="${ph}" fill="none" stroke="var(--line)" stroke-width="1.5"/>
    <text x="${m.l+pw/2}" y="${H-16}" text-anchor="middle" font-family="Montserrat" font-size="11.5" font-weight="700" fill="var(--ink-3)">Complejidad de implementación →</text>
    <text x="16" y="${m.t+ph/2}" text-anchor="middle" transform="rotate(-90 16 ${m.t+ph/2})" font-family="Montserrat" font-size="11.5" font-weight="700" fill="var(--ink-3)">Impacto en el negocio →</text>
    ${[0,50,100].map(v=>`
      <text x="${X(v)}" y="${m.t+ph+16}" text-anchor="middle" font-family="JetBrains Mono" font-size="9" fill="var(--ink-3)">${v}</text>
      <text x="${m.l-9}" y="${Y(v)+3}" text-anchor="end" font-family="JetBrains Mono" font-size="9" fill="var(--ink-3)">${v}</text>`).join('')}
    ${evs.map((x,i)=>{
      const px=X(x.e.complejidad), py=Y(x.e.impacto), c=CUAD[x.e.cuad].c;
      return `<g class="mx-pt" onclick="verProceso('${x.p.id}')">
        <circle cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" r="14" fill="${c}" stroke="var(--surface)" stroke-width="2.5"/>
        <text x="${px.toFixed(1)}" y="${(py+4).toFixed(1)}" text-anchor="middle" font-family="JetBrains Mono" font-size="11" font-weight="700" fill="#fff">${i+1}</text>
        <title>${esc(x.p.nombre)} — impacto ${x.e.impacto}, complejidad ${x.e.complejidad}</title></g>`;
    }).join('')}
  </svg>`;
}
function verProceso(id){ state.vista='procesos'; editar(id); }

/* -------------------- Bloque de productos (compartido) -------------------- */
function fila(n, sub, motivos){
  const info = PRODUCTOS[n];
  return `<div class="fase" style="grid-template-columns:44px 1fr;padding:15px 0">
    <div class="fase-n" style="background:${info.c};width:38px;height:38px;font-size:11px">${n.split(' ').map(w=>w[0]).join('').slice(0,2)}</div>
    <div>
      <h4 style="font-size:15px">${n} ${sub?`<span style="font-family:'JetBrains Mono';font-size:11px;font-weight:500;color:var(--ink-3)">· ${sub}</span>`:''}</h4>
      <p style="font-size:13px;color:var(--ink-3);margin-top:2px">${info.r}</p>
      ${motivos.length?`<ul>${motivos.slice(0,3).map(m=>`<li>${m}</li>`).join('')}</ul>`:''}
    </div></div>`;
}
function bloqueProductos(A){
  const porProceso = A.prodOrden.map(p=>fila(p.n, `${p.cnt} de ${A.total} proceso${A.total!==1?'s':''}`, p.motivos)).join('');
  const cartera = A.prodCartera.map(p=>fila(p.n, 'por el tamaño de la cartera', p.por)).join('');
  return `
    <div style="font-family:'JetBrains Mono';font-size:10px;font-weight:700;letter-spacing:.09em;text-transform:uppercase;color:var(--ink-3)">Según los procesos evaluados</div>
    ${porProceso}
    ${cartera?`
      <div style="font-family:'JetBrains Mono';font-size:10px;font-weight:700;letter-spacing:.09em;text-transform:uppercase;color:var(--ink-3);margin-top:22px;padding-top:18px;border-top:1px solid var(--line-soft)">Según el conjunto de la cartera</div>
      ${cartera}
      <div class="note">Estos dos productos no se justifican por un proceso aislado sino por el conjunto: nadie
      necesita un orquestador para una sola automatización. Entran cuando la cartera alcanza un tamaño donde
      coordinar y medir deja de poder hacerse a mano.</div>`:''}`;
}

/* -------------------- Vista: Análisis -------------------- */
function vAnalisis(){
  const A = analisis();
  if(!A.total) return `<div class="view on"><div class="card"><div class="empty">
    <h3>No hay procesos que analizar</h3><p>Agrega al menos un proceso para ver la matriz y el ranking.</p>
    <button class="btn btn-p" onclick="ir('procesos')">Ir a procesos</button></div></div></div>`;

  return `
  <div class="view on" id="v-analisis">
    <div class="page-head">
      <span class="eyebrow">Paso 03</span>
      <h1>Análisis de la cartera</h1>
      <p>La matriz ordena los procesos por impacto y complejidad. Haz clic en cualquier punto para volver a su evaluación y ajustarla junto al cliente.</p>
    </div>

    <div class="card">
      <div class="card-h"><h2>Matriz de impacto y complejidad</h2></div>
      <div class="card-b">
        <div class="matrix-wrap">${matriz(A.evs)}</div>
        <div class="mx-legend">${A.evs.map((x,i)=>`
          <div class="mxl"><b style="background:${CUAD[x.e.cuad].c}">${i+1}</b>
            <div>${esc(x.p.nombre)}<br><span style="color:var(--ink-3);font-size:11.5px">${CUAD[x.e.cuad].l}</span></div></div>`).join('')}</div>
      </div>
    </div>

    <div class="card">
      <div class="card-h"><h2>Ranking por prioridad</h2><div class="sub">Ordenado automáticamente. La prioridad pondera el impacto en 65% y penaliza la complejidad en 35%.</div></div>
      <div class="card-b"><div class="tw"><table>
        <thead><tr><th>#</th><th>Proceso</th><th>Área</th><th>Imp.</th><th>Cplj.</th><th>Prior.</th><th>Retorno rel.</th><th>Horas/mes</th><th>Automatización</th><th>Implementación</th><th>Clasificación</th></tr></thead>
        <tbody>${A.evs.map((x,i)=>`<tr>
          <td class="num">${i+1}</td>
          <td><strong>${esc(x.p.nombre)}</strong></td>
          <td>${esc(x.p.area)}</td>
          <td class="num" style="color:var(--rb-green);font-weight:700">${x.e.impacto}</td>
          <td class="num" style="color:var(--rb-amber);font-weight:700">${x.e.complejidad}</td>
          <td class="num" style="font-weight:700">${x.e.prioridad}</td>
          <td class="num">${x.e.retorno.toFixed(2)}</td>
          <td class="num">${x.e.horasMes>0?fmt(x.e.ahorroMin)+'–'+fmt(x.e.ahorroMax):'—'}</td>
          <td>${x.e.nivel}</td>
          <td>${x.e.impl.l}</td>
          <td><span class="tag ${CUAD[x.e.cuad].k}">${CUAD[x.e.cuad].l}</span></td>
        </tr>`).join('')}</tbody></table></div>
        <div class="note"><strong>Retorno relativo</strong> es el cociente entre impacto y complejidad. Sirve para ordenar,
        no es un retorno de inversión: un ROI financiero exige conocer el costo de implementación, que en esta etapa
        todavía no está determinado.</div>
      </div>
    </div>

    <div class="card">
      <div class="card-h"><h2>Roadmap sugerido</h2><div class="sub">Las fases se arman desde los cuadrantes. El orden importa: cada fase deja montada infraestructura que abarata la siguiente.</div></div>
      <div class="card-b">${A.fases.filter(f=>f.items.length).map(f=>`
        <div class="fase">
          <div class="fase-n" style="background:${f.c}">0${f.n}</div>
          <div>
            <div class="when" style="color:${f.c}">${f.when}${f.semanas?' · aprox. '+f.semanas+' semanas de trabajo':''}</div>
            <h4>${f.t}</h4>
            <p>${f.d}</p>
            <ul>${f.items.map(x=>`<li><strong>${esc(x.p.nombre)}</strong> — prioridad ${x.e.prioridad}${x.e.horasMes>0?', '+fmt(x.e.ahorroMin)+'–'+fmt(x.e.ahorroMax)+' h/mes':''} · ${x.e.impl.l}</li>`).join('')}</ul>
          </div>
        </div>`).join('')}
        ${A.q.av.length?`<div class="note r"><strong>Sobre la fase 4.</strong> Los ${A.q.av.length} proceso${A.q.av.length>1?'s':''} de este grupo combinan bajo impacto con alta complejidad. Automatizarlos tal como están hoy fijaría en código un proceso que conviene revisar antes. La recomendación es rediseñarlos y volver a evaluarlos después, no programarlos.</div>`:''}
      </div>
    </div>

    <div class="card">
      <div class="card-h"><h2>Productos recomendados</h2><div class="sub">Derivados de las características y los criterios de cada proceso, no de una lista genérica.</div></div>
      <div class="card-b">
        ${bloqueProductos(A)}
      </div>
    </div>

    <div class="btn-row"><button class="btn btn-p" onclick="ir('informe')">Generar informe →</button></div>
  </div>`;
}

/* -------------------- Vista: Informe -------------------- */
function vInforme(){
  const A = analisis();
  if(!A.total) return `<div class="view on" id="v-informe"><div class="card"><div class="empty">
    <h3>No hay datos para el informe</h3><p>Agrega procesos antes de generar el informe.</p>
    <button class="btn btn-p" onclick="ir('procesos')">Ir a procesos</button></div></div></div>`;

  const c = state.cliente;
  const fecha = new Date(c.fecha+'T12:00:00').toLocaleDateString('es-CL',{day:'numeric',month:'long',year:'numeric'});
  const top5 = A.evs.slice(0,5);
  const dinero = A.costoHora>0;

  return `
  <div class="view on" id="v-informe">
    <div class="rep-head">
      <div style="display:flex;justify-content:space-between;align-items:flex-end;gap:20px">
        <div>
          <div style="font-family:'JetBrains Mono';font-size:10px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:var(--rb-red)">Rocketbot · Diagnóstico de automatización</div>
          <div style="font-family:'Montserrat';font-weight:800;font-size:20px;margin-top:4px">${esc(c.empresa)||'Cliente'}</div>
          <div style="font-size:12px;color:var(--ink-3)">${[c.industria,c.pais,c.area].filter(Boolean).map(esc).join(' · ')}</div>
        </div>
        <div style="text-align:right;font-size:11.5px;color:var(--ink-3)">
          ${esc(c.consultor)?'Consultor: '+esc(c.consultor)+'<br>':''}${fecha}
        </div>
      </div>
    </div>

    <div class="page-head no-print">
      <span class="eyebrow">Paso 04</span>
      <h1>Informe</h1>
      <p>Esto es exactamente lo que se imprime. Revísalo antes de exportar.</p>
    </div>

    <div class="btn-row no-print" style="margin-top:0;margin-bottom:20px">
      <button class="btn btn-p" onclick="window.print()">Exportar a PDF</button>
      <button class="btn btn-g" onclick="exportarCSV()">Exportar a Excel</button>
      <button class="btn btn-g" onclick="guardarJSON()">Guardar sesión</button>
      <button class="btn btn-g" onclick="cargarJSON()">Cargar sesión</button>
    </div>

    <div class="card">
      <div class="card-h"><h2>Resumen ejecutivo</h2></div>
      <div class="card-b">
        <div class="kpis">
          <div class="kpi"><div class="l">Procesos analizados</div><div class="v">${A.total}</div>
            <div class="s">${A.q.qw.length} quick wins · ${A.q.sp.length} estratégicos · ${A.q.fi.length} complementarios · ${A.q.av.length} a rediseñar</div></div>
          <div class="kpi g"><div class="l">Horas mensuales recuperables</div><div class="v">${A.ahMax>0?fmt(A.ahMin)+'–'+fmt(A.ahMax):'—'}</div>
            <div class="s">${A.horasMes>0?'De un total de '+fmt(A.horasMes)+' horas al mes que hoy consumen estos procesos.':'Falta volumen y tiempo por ejecución para estimarlo.'}</div></div>
          ${dinero?`<div class="kpi b"><div class="l">Valor anual asociado</div><div class="v">USD ${fmt(A.ahMin*A.costoHora*12)}–${fmt(A.ahMax*A.costoHora*12)}</div>
            <div class="s">Con el costo por hora de USD ${A.costoHora} indicado. No descuenta el costo de la plataforma ni de la implementación.</div></div>`
          :`<div class="kpi b"><div class="l">Retorno relativo promedio</div><div class="v">${A.retProm.toFixed(2)}</div>
            <div class="s">Cociente entre impacto y complejidad. Sobre 1,5 indica una cartera favorable.</div></div>`}
          <div class="kpi a"><div class="l">Implementación estimada</div><div class="v">${A.semanasTotal>0?A.semanasTotal+' semanas':'—'}</div>
            <div class="s">Fases 1 a 3, con solapamiento parcial. Referencial: el plazo firme requiere levantamiento técnico.</div></div>
          <div class="kpi p"><div class="l">Nivel de la cartera</div><div class="v" style="font-size:17px">${A.nivelGeneral.l}</div>
            <div class="s">Impacto promedio ${A.impProm} · complejidad promedio ${A.cxProm}</div></div>
        </div>
        <div class="note" style="margin-top:20px">${A.nivelGeneral.d}
        ${A.q.qw.length?` El punto de partida recomendado es <strong>${esc(A.q.qw[0].p.nombre)}</strong>, que combina el mayor impacto con la menor complejidad de la cartera.`:
          A.evs.length?` Ningún proceso califica como quick win, de modo que el punto de partida sugerido es <strong>${esc(A.evs[0].p.nombre)}</strong>, el de mayor prioridad, asumiendo un levantamiento previo.`:''}</div>
      </div>
    </div>

    <div class="card">
      <div class="card-h"><h2>Matriz de impacto y complejidad</h2></div>
      <div class="card-b">
        <div class="matrix-wrap">${matriz(A.evs, 560)}</div>
        <div class="mx-legend">${A.evs.map((x,i)=>`
          <div class="mxl"><b style="background:${CUAD[x.e.cuad].c}">${i+1}</b>
            <div>${esc(x.p.nombre)}<br><span style="color:var(--ink-3);font-size:11.5px">${CUAD[x.e.cuad].l}</span></div></div>`).join('')}</div>
      </div>
    </div>

    <div class="card page-break">
      <div class="card-h"><h2>Top 5 procesos recomendados</h2></div>
      <div class="card-b">
        ${top5.map((x,i)=>`
          <div class="fase" style="grid-template-columns:44px 1fr;padding:16px 0">
            <div class="fase-n" style="background:${CUAD[x.e.cuad].c};width:38px;height:38px;font-size:13px">${i+1}</div>
            <div>
              <h4 style="font-size:15px">${esc(x.p.nombre)}</h4>
              <div class="when" style="color:var(--ink-3)">${esc(x.p.area)} · ${CUAD[x.e.cuad].l} · automatización ${x.e.nivel.toLowerCase()}</div>
              ${x.p.desc?`<p>${esc(x.p.desc)}</p>`:''}
              <ul>
                <li>Impacto ${x.e.impacto} · complejidad ${x.e.complejidad} · prioridad ${x.e.prioridad}</li>
                ${x.e.horasMes>0?`<li>Entre ${fmt(x.e.ahorroMin)} y ${fmt(x.e.ahorroMax)} horas al mes recuperables, de ${fmt(x.e.horasMes)} que consume hoy</li>`:''}
                <li>Implementación estimada: ${x.e.impl.l}</li>
                <li>Productos sugeridos: ${x.e.productos.map(p=>p.n).join(', ')}</li>
              </ul>
            </div>
          </div>`).join('')}
      </div>
    </div>

    <div class="card">
      <div class="card-h"><h2>Ranking completo</h2></div>
      <div class="card-b"><div class="tw"><table>
        <thead><tr><th>#</th><th>Proceso</th><th>Área</th><th>Imp.</th><th>Cplj.</th><th>Prior.</th><th>Horas/mes</th><th>Clasificación</th></tr></thead>
        <tbody>${A.evs.map((x,i)=>`<tr>
          <td class="num">${i+1}</td><td><strong>${esc(x.p.nombre)}</strong></td><td>${esc(x.p.area)}</td>
          <td class="num">${x.e.impacto}</td><td class="num">${x.e.complejidad}</td><td class="num"><strong>${x.e.prioridad}</strong></td>
          <td class="num">${x.e.horasMes>0?fmt(x.e.ahorroMin)+'–'+fmt(x.e.ahorroMax):'—'}</td>
          <td><span class="tag ${CUAD[x.e.cuad].k}">${CUAD[x.e.cuad].l}</span></td></tr>`).join('')}</tbody>
      </table></div></div>
    </div>

    <div class="card page-break">
      <div class="card-h"><h2>Roadmap propuesto</h2></div>
      <div class="card-b">${A.fases.filter(f=>f.items.length).map(f=>`
        <div class="fase">
          <div class="fase-n" style="background:${f.c}">0${f.n}</div>
          <div>
            <div class="when" style="color:${f.c}">${f.when}${f.semanas?' · aprox. '+f.semanas+' semanas':''}</div>
            <h4>${f.t}</h4><p>${f.d}</p>
            <ul>${f.items.map(x=>`<li><strong>${esc(x.p.nombre)}</strong> — ${x.e.impl.l}${x.e.horasMes>0?', '+fmt(x.e.ahorroMin)+'–'+fmt(x.e.ahorroMax)+' h/mes':''}</li>`).join('')}</ul>
          </div>
        </div>`).join('')}
      </div>
    </div>

    <div class="card">
      <div class="card-h"><h2>Productos de la suite recomendados</h2></div>
      <div class="card-b">${bloqueProductos(A)}</div>
    </div>

    <div class="card">
      <div class="card-h"><h2>Próximos pasos propuestos</h2></div>
      <div class="card-b">
        <div class="fase" style="grid-template-columns:44px 1fr;padding:15px 0">
          <div class="fase-n" style="background:var(--q-green);width:38px;height:38px;font-size:13px">1</div>
          <div><h4 style="font-size:15px">Validar el levantamiento con las áreas involucradas</h4>
            <p>Los puntajes de este informe provienen de una sesión de trabajo, no de una medición. Confirmar volúmenes y tiempos con quienes ejecutan los procesos antes de comprometer alcance.</p></div>
        </div>
        <div class="fase" style="grid-template-columns:44px 1fr;padding:15px 0">
          <div class="fase-n" style="background:var(--q-blue);width:38px;height:38px;font-size:13px">2</div>
          <div><h4 style="font-size:15px">Prueba de concepto sobre ${esc((A.q.qw[0]||A.evs[0]).p.nombre)}</h4>
            <p>Un proceso real y acotado, con criterio de éxito definido de antemano. Es la forma de validar los supuestos de este informe antes de dimensionar un programa completo.</p></div>
        </div>
        <div class="fase" style="grid-template-columns:44px 1fr;padding:15px 0">
          <div class="fase-n" style="background:var(--q-amber);width:38px;height:38px;font-size:13px">3</div>
          <div><h4 style="font-size:15px">Sesión técnica con el equipo de tecnología</h4>
            <p>Revisar accesos, credenciales, ambientes y restricciones de seguridad. Es donde aparecen los bloqueos que no se ven en una sesión de negocio, y anticiparlos evita que surjan durante la implementación.</p></div>
        </div>
        <div class="fase" style="grid-template-columns:44px 1fr;padding:15px 0">
          <div class="fase-n" style="background:var(--rb-purple);width:38px;height:38px;font-size:13px">4</div>
          <div><h4 style="font-size:15px">Dimensionamiento y propuesta</h4>
            <p>Con el levantamiento validado, definir plan, alcance de la primera ola y modelo de acompañamiento.</p></div>
        </div>
      </div>
    </div>

    ${metodologia(A)}

    <div class="disc">
      <strong>Alcance de este informe.</strong> Las cifras presentadas se construyen a partir de la evaluación
      realizada durante la sesión de trabajo y de los volúmenes declarados por el cliente. No constituyen una auditoría
      de procesos ni una medición sobre los sistemas. Los puntajes de impacto y complejidad reflejan el criterio de
      quienes participaron en la sesión y sirven para priorizar, no para comprometer resultados. Las horas estimadas
      se calculan sobre el volumen y el tiempo por ejecución declarados, aplicando una fracción automatizable que
      nunca supera el 85%: ningún proceso se automatiza por completo, siempre queda supervisión y manejo de
      excepciones. Los plazos de implementación son bandas referenciales derivadas de la complejidad evaluada;
      el plazo firme requiere levantamiento técnico sobre los sistemas concretos.
      <br><br>Rocketbot · Suite de automatización empresarial.
    </div>
  </div>`;
}

function metodologia(A){
  return `
  <details class="meth no-print">
    <summary>Cómo se calcularon estos resultados</summary>
    <div class="meth-b">
      <p>El cálculo es determinista: las mismas respuestas producen siempre el mismo informe. No hay contenido generado al vuelo ni comparación contra bases externas.</p>

      <h5>Impacto y complejidad</h5>
      <p>Cada bloque tiene siete criterios calificados de 1 a 5, con pesos distintos. El puntaje del bloque es
      <code>((Σ(valor × peso) ÷ Σpeso) − 1) ÷ 4 × 100</code>, lo que lleva la escala 1-5 a un rango de 0 a 100.
      Los criterios de complejidad están orientados para que un valor mayor signifique siempre mayor dificultad.</p>
      <table style="font-size:12px;margin-top:8px"><thead><tr><th>Criterio de impacto</th><th>Peso</th><th>Criterio de complejidad</th><th>Peso</th></tr></thead>
      <tbody>${C_IMPACTO.map((c,i)=>`<tr><td>${c.n}</td><td class="num">${c.p}</td><td>${C_COMPLEJIDAD[i].n}</td><td class="num">${C_COMPLEJIDAD[i].p}</td></tr>`).join('')}</tbody></table>

      <h5>Clasificación en cuadrantes</h5>
      <p>El punto medio de una escala de 1 a 5 es 3, que normalizado equivale a 50. Ese es el umbral en ambos ejes:
      impacto sobre 50 y complejidad bajo 50 da quick win; ambos sobre 50, proyecto estratégico; y así sucesivamente.</p>

      <h5>Prioridad</h5>
      <p><code>prioridad = impacto × 0,65 + (100 − complejidad) × 0,35</code>. Favorece el impacto pero penaliza la
      complejidad, porque un proceso de alto impacto que tarda un año en implementarse no debería encabezar un roadmap.</p>

      <h5>Retorno relativo, y por qué no se llama ROI</h5>
      <p><code>retorno = impacto ÷ complejidad</code>. Es un cociente entre dos puntajes de una escala subjetiva y sirve
      para ordenar procesos entre sí. Un retorno de inversión exige conocer el costo de implementación, que en esta
      etapa aún no está determinado. Presentar este número como ROI ante un comité financiero es la forma más rápida
      de perder credibilidad, así que el informe lo rotula por lo que es.</p>

      <h5>Horas estimadas</h5>
      <p><code>horas/mes = cantidad mensual × minutos por ejecución ÷ 60</code>, multiplicado por una fracción
      automatizable <code>A = 0,85 − (complejidad ÷ 100) × 0,45</code>, acotada entre 0,40 y 0,85. El rango que se
      muestra va del 80% al 100% de ese valor. Estas cifras no dependen de las escalas de impacto: salen del volumen
      y el tiempo declarados.</p>

      <h5>Plazos de implementación</h5>
      <p>Bandas por complejidad: bajo 30, de 2 a 4 semanas; de 30 a 50, de 4 a 8; de 50 a 70, de 8 a 14; sobre 70,
      más de 14 semanas. El total del roadmap aplica un factor de 0,7 por solapamiento parcial entre procesos.</p>

      <h5>Recomendación de productos</h5>
      <p>Reglas explícitas sobre las características marcadas y los criterios de complejidad. Por ejemplo: documentos
      en 4 o más, o característica de PDF, activa AI Studio; cuatro o más sistemas activa Orquestador; una solicitud
      de usuario activa Xperience. Un producto solo aparece si alguna regla lo activó.</p>

      <h5>Lo que este cálculo no hace</h5>
      <ul>
        <li>No verifica ni audita los datos declarados en la sesión.</li>
        <li>No estima el costo de implementación ni el precio de la solución.</li>
        <li>No considera restricciones de seguridad, arquitectura o cumplimiento específicas del cliente.</li>
        <li>No compara contra referencias de industria: no existe una base pública confiable para ese contraste.</li>
      </ul>
    </div>
  </details>`;
}

/* -------------------- Exportaciones -------------------- */
function descargar(blob, nombre){
  const url=URL.createObjectURL(blob), a=document.createElement('a');
  a.href=url; a.download=nombre; document.body.appendChild(a); a.click();
  document.body.removeChild(a); URL.revokeObjectURL(url);
}
const slug = s => (s||'cliente').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,40);

// CSV con BOM y delimitador ";" — es lo que abre limpio en Excel con
// configuración regional latinoamericana, y no necesita ninguna librería.
function exportarCSV(){
  const A = analisis();
  const q = v => '"'+String(v==null?'':v).replace(/"/g,'""')+'"';
  const filas = [];
  filas.push(['Cliente', state.cliente.empresa]);
  filas.push(['Industria', state.cliente.industria]);
  filas.push(['País', state.cliente.pais]);
  filas.push(['Área', state.cliente.area]);
  filas.push(['Consultor', state.cliente.consultor]);
  filas.push(['Fecha', state.cliente.fecha]);
  filas.push([]);
  filas.push(['#','Proceso','Área','Descripción','Frecuencia','Cantidad mensual','Minutos por ejecución','Personas',
    'Impacto','Complejidad','Prioridad','Retorno relativo','Horas mes actuales','Ahorro mín h/mes','Ahorro máx h/mes',
    'Nivel de automatización','Implementación','Clasificación','Productos sugeridos']);
  A.evs.forEach((x,i)=>filas.push([
    i+1, x.p.nombre, x.p.area, x.p.desc, FRECUENCIAS[x.p.frecuencia].l,
    x.p.volumen, x.p.minutos, x.p.personas,
    x.e.impacto, x.e.complejidad, x.e.prioridad, x.e.retorno.toFixed(2),
    round(x.e.horasMes), round(x.e.ahorroMin), round(x.e.ahorroMax),
    x.e.nivel, x.e.impl.l, CUAD[x.e.cuad].l, x.e.productos.map(p=>p.n).join(' + ')
  ]));
  filas.push([]);
  filas.push(['Detalle de criterios']);
  filas.push(['Proceso'].concat(C_IMPACTO.map(c=>'I: '+c.n)).concat(C_COMPLEJIDAD.map(c=>'C: '+c.n)));
  A.evs.forEach(x=>filas.push([x.p.nombre]
    .concat(C_IMPACTO.map(c=>x.p.imp[c.id]))
    .concat(C_COMPLEJIDAD.map(c=>x.p.cx[c.id]))));

  const csv = '\uFEFF' + filas.map(f=>f.map(q).join(';')).join('\r\n');
  descargar(new Blob([csv],{type:'text/csv;charset=utf-8;'}),
    `roadmap-${slug(state.cliente.empresa)}-${state.cliente.fecha}.csv`);
  toast('Archivo descargado. Se abre directamente en Excel.');
}

function guardarJSON(){
  const data = {version:1, generado:new Date().toISOString(), cliente:state.cliente, procesos:state.procesos};
  descargar(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}),
    `sesion-${slug(state.cliente.empresa)}-${state.cliente.fecha}.json`);
  toast('Sesión guardada. Cárgala desde este mismo archivo cuando la necesites.');
}

function cargarJSON(){
  const inp = document.createElement('input');
  inp.type='file'; inp.accept='.json,application/json';
  inp.onchange = ev => {
    const f = ev.target.files[0]; if(!f) return;
    const r = new FileReader();
    r.onload = () => {
      try{
        const d = JSON.parse(r.result);
        if(!d.procesos || !Array.isArray(d.procesos)) throw new Error('formato');
        // Rellena criterios ausentes para tolerar archivos de versiones anteriores
        d.procesos.forEach(p=>{
          p.imp = p.imp||{}; p.cx = p.cx||{}; p.caract = p.caract||[];
          C_IMPACTO.forEach(c=>{ if(p.imp[c.id]==null) p.imp[c.id]=3; });
          C_COMPLEJIDAD.forEach(c=>{ if(p.cx[c.id]==null) p.cx[c.id]=3; });
          if(!FRECUENCIAS[p.frecuencia]) p.frecuencia='f3';
        });
        state.cliente = Object.assign(state.cliente, d.cliente||{});
        state.procesos = d.procesos;
        state.borrador=null; state.editando=null; state.vista='procesos';
        renderNav(); render();
        toast(`Sesión cargada: ${d.procesos.length} proceso${d.procesos.length!==1?'s':''}.`);
      }catch(err){
        alert('No se pudo leer el archivo. Debe ser una sesión exportada desde esta misma herramienta.');
      }
    };
    r.readAsText(f);
  };
  inp.click();
}

/* -------------------- Router -------------------- */
function render(){
  renderNav();
  const v = state.vista;
  $('main').innerHTML = v==='cliente' ? vCliente()
    : v==='procesos' ? vProcesos()
    : v==='analisis' ? vAnalisis()
    : vInforme();
}

render();

/* ------------------------------------------------------------------
   Puente hacia window. Lo agrega scripts/extraer-motores.mjs porque el
   motor viene de un <script> clásico y el cuerpo lo llama desde onclick.
   Nada de arriba se modificó: esto solo vuelve a exponer lo que el
   ámbito de módulo dejaría privado.
   ------------------------------------------------------------------ */
Object.assign(window, { $, analisis, bloqueProductos, borrar, cancelar, cargarJSON, clamp, descargar, editar, esc, evaluar, exportarCSV, fila, fmt, guardar, guardarJSON, ir, matriz, metodologia, normalizar, nuevo, nuevoBorrador, recomendar, recomendarCartera, refrescarLive, render, renderNav, round, setB, setC, setEval, slug, tema, toast, toggleCar, vAnalisis, vCliente, vFormulario, vInforme, vProcesos, verProceso });
/* Estado y catálogos que lee el envoltorio para guardar y restaurar. */
Object.assign(window, { state });
