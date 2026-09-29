"use strict";

/* ============================================================
   HELPERS
   ============================================================ */
const $  = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));
const clamp = (v,a,b) => Math.min(b, Math.max(a, v));
const has = v => v !== null && v !== undefined && v !== '' && !(typeof v === 'number' && isNaN(v));
const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmtUSD = n => '$' + Math.round(n).toLocaleString('en-US');
const fmtN = n => Math.round(n).toLocaleString('en-US');
const pct1 = n => (n*100).toFixed(0) + '%';

/* Mapea x linealmente: at0 -> 0 puntos, at100 -> 100 puntos. Funciona en ambos sentidos. */
function lin(x, at0, at100){
  if (!has(x)) return null;
  if (at100 === at0) return x >= at100 ? 100 : 0;
  return clamp((x - at0) / (at100 - at0) * 100, 0, 100);
}
function ratio(n, d){ return (has(n) && has(d) && d > 0) ? n/d : null; }

/* ============================================================
   SUITE — seis productos, tres capas del modelo Rocketbot
   ============================================================ */
const LAYERS = [
  { k:'entrada',  n:'Entrada',   d:'Cómo entran las solicitudes y los datos al proceso' },
  { k:'ejecucion',n:'Ejecución', d:'Dónde corre efectivamente la automatización' },
  { k:'control',  n:'Control',   d:'Cómo se gobierna, se monitorea y se mide' }
];
const PRODUCTS = [
  { k:'xperience', n:'Xperience',    layer:'entrada'   },
  { k:'rpa',       n:'RPA Studio',   layer:'ejecucion' },
  { k:'saturn',    n:'Saturn Studio',layer:'ejecucion' },
  { k:'ai',        n:'Ai Studio',    layer:'ejecucion' },
  { k:'orq',       n:'Orquestador',  layer:'control'   },
  { k:'nexus',     n:'Nexus',        layer:'control'   }
];

/* ============================================================
   PILARES — pesos definidos en el brief
   ============================================================ */
const PILLARS = [
  { id:'uso',      n:'Uso de plataforma', w:30, hex:'#378ADD', v:'var(--blue)',  hi:'var(--blue-hi)',
    d:'¿Están usando lo que compraron? Todo se mide contra la capacidad licenciada, no en valores absolutos.' },
  { id:'adopcion', n:'Adopción',          w:25, hex:'#BA7517', v:'var(--amber)', hi:'var(--amber-hi)',
    d:'¿El programa crece por sí solo, o depende de que nosotros lo empujemos?' },
  { id:'valor',    n:'Valor generado',    w:25, hex:'#1D9E75', v:'var(--green)', hi:'var(--green-hi)',
    d:'¿Existe una cifra de retorno que el cliente reconozca como propia?' },
  { id:'riesgo',   n:'Salud de riesgo',   w:20, hex:'#BC0017', v:'var(--rb)',    hi:'var(--rb-hi)',
    d:'Escala invertida: 100 significa ausencia de señales de deterioro, no presencia de riesgo.' }
];

/* ============================================================
   MÉTRICAS
   ============================================================ */
const SEL_AUTO = [
  { v:'', l:'Sin dato' },
  { v:'dep', l:'Depende del partner para todo',       s:20 },
  { v:'mix', l:'Construye con apoyo puntual',         s:60 },
  { v:'aut', l:'Construye de forma autónoma',         s:100 }
];
const SEL_VALID = [
  { v:'', l:'Sin dato' },
  { v:'no',  l:'No hay cifra de impacto',             s:0 },
  { v:'ti',  l:'Estimada por TI',                     s:40 },
  { v:'neg', l:'Validada por el área de negocio',     s:75 },
  { v:'fin', l:'Auditada por Finanzas',               s:100 }
];
const SEL_SPONSOR = [
  { v:'', l:'Sin dato' },
  { v:'none',   l:'No identificado',                  s:0 },
  { v:'changed',l:'Cambió en los últimos 6 meses',    s:30 },
  { v:'passive',l:'Identificado pero pasivo',         s:55 },
  { v:'active', l:'Activo y comprometido',            s:100 }
];
const selScore = (opts, v) => { const o = opts.find(x=>x.v===v); return (o && has(o.s)) ? o.s : null; };

let MODE = 'quick';                       // 'quick' = 9 indicadores · 'full' = 18
const isQuick = () => MODE === 'quick';
const activeMetrics = () => METRICS.filter(m => !isQuick() || has(m.qw));
const wOf = m => isQuick() ? m.qw : m.w;   // peso dentro del pilar según el modo

const METRICS = [
  /* ---------------- USO DE PLATAFORMA ---------------- */
  { id:'uso_bots', qw:55, p:'uso', w:22, n:'Utilización de bots',
    h:'Bots que ejecutaron al menos una vez en el período, sobre los bots licenciados.',
    in:[{k:'botsAct',l:'Bots activos'},{k:'botsLic',l:'Bots licenciados'}],
    calc(D){ const r = ratio(D.botsAct, D.botsLic); return r===null ? null : lin(r, 0, 0.70); },
    read(D){ const r = ratio(D.botsAct, D.botsLic); return r===null ? '—' : `${fmtN(D.botsAct)} de ${fmtN(D.botsLic)} · ${pct1(r)}`; },
    act:{ t:'Bots licenciados sin ejecutar',
      d:'El cliente paga capacidad que no está produciendo. Es la primera cifra que aparece en cualquier revisión de costos del lado del cliente.',
      do:'Levantar en el <b>Control Room del Orquestador</b> qué bots están licenciados sin actividad. Cruzar con el backlog de procesos y comprometer un sprint de automatización con fecha, o negociar un ajuste de capacidad antes de que lo pida el cliente.' } },

  { id:'uso_ejec', p:'uso', w:22, n:'Volumen de ejecuciones',
    h:'Ejecuciones del último mes contra el volumen que se esperaba al vender o renovar.',
    in:[{k:'ejecMes',l:'Ejecuciones del mes'},{k:'ejecEsp',l:'Volumen esperado / mes'}],
    calc(D){ const r = ratio(D.ejecMes, D.ejecEsp); return r===null ? null : lin(r, 0, 1.0); },
    read(D){ const r = ratio(D.ejecMes, D.ejecEsp); return r===null ? '—' : `${fmtN(D.ejecMes)} de ${fmtN(D.ejecEsp)} · ${pct1(r)}`; },
    act:{ t:'Volumen por debajo de lo proyectado',
      d:'El caso de negocio se construyó sobre un volumen que no se está cumpliendo. El ahorro real será menor al prometido.',
      do:'Verificar si el proceso se está ejecutando fuera de la plataforma, si cambió el volumen del negocio o si hay ejecuciones bloqueadas. Ajustar la proyección de ahorro <b>antes</b> de la próxima revisión, no después.' } },

  { id:'uso_proc', p:'uso', w:20, n:'Procesos en producción',
    h:'Procesos corriendo en producción sobre los comprometidos en el plan de adopción.',
    in:[{k:'procProd',l:'Procesos productivos'},{k:'procPlan',l:'Comprometidos en el plan'}],
    calc(D){ const r = ratio(D.procProd, D.procPlan); return r===null ? null : lin(r, 0, 1.0); },
    read(D){ const r = ratio(D.procProd, D.procPlan); return r===null ? '—' : `${fmtN(D.procProd)} de ${fmtN(D.procPlan)} · ${pct1(r)}`; },
    act:{ t:'Plan de adopción incompleto',
      d:'Hay procesos comprometidos que no llegaron a producción. Cada uno es ahorro que el cliente esperaba y no recibió.',
      do:'Revisar proceso por proceso dónde se detuvo: relevamiento, desarrollo, aprobación de TI o pruebas del negocio. Los bloqueos de aprobación interna son los más frecuentes y los que más rápido se destraban con el sponsor.' } },

  { id:'uso_users', qw:45, p:'uso', w:18, n:'Usuarios activos',
    h:'Usuarios con al menos un ingreso en los últimos 30 días, sobre los usuarios licenciados.',
    in:[{k:'usrAct',l:'Usuarios activos (30d)'},{k:'usrLic',l:'Usuarios licenciados'}],
    calc(D){ const r = ratio(D.usrAct, D.usrLic); return r===null ? null : lin(r, 0, 0.60); },
    read(D){ const r = ratio(D.usrAct, D.usrLic); return r===null ? '—' : `${fmtN(D.usrAct)} de ${fmtN(D.usrLic)} · ${pct1(r)}`; },
    act:{ t:'Base de usuarios concentrada',
      d:'Pocas personas entran a la plataforma. Si una de ellas se va, la cuenta se queda sin nadie que sepa operarla.',
      do:'Identificar quiénes son los usuarios que sí entran y qué rol cumplen. Si son uno o dos, hay riesgo de persona clave: sumar al menos un usuario de negocio por proceso crítico y dejarlo capacitado.' } },

  { id:'uso_freq', p:'uso', w:18, n:'Frecuencia de uso',
    h:'Días con actividad registrada en los últimos 30. Referencia: 18 días equivale a uso diario en semana hábil.',
    in:[{k:'diasAct',l:'Días con actividad (de 30)'}],
    calc(D){ return lin(D.diasAct, 0, 18); },
    read(D){ return has(D.diasAct) ? `${fmtN(D.diasAct)} de 30 días` : '—'; },
    act:{ t:'Uso intermitente',
      d:'La plataforma se usa a ráfagas. Los procesos episódicos generan menos ahorro y se olvidan con más facilidad.',
      do:'Buscar procesos de cadencia diaria para incorporar al programa. Un proceso que corre todos los días sostiene el hábito de uso mucho mejor que cinco procesos mensuales.' } },

  /* ---------------- ADOPCIÓN ---------------- */
  { id:'ado_suite', qw:55, p:'adopcion', w:35, n:'Cobertura de la suite',
    h:'Qué productos usa el cliente y, sobre todo, cuántas de las tres capas del modelo tiene cubiertas.',
    in:[{k:'suite', type:'chips'}],
    calc(D){
      if (!D.suiteSet) return null;
      const on = PRODUCTS.filter(p=>D.suite[p.k]);
      const layers = new Set(on.map(p=>p.layer));
      return (layers.size/3)*60 + (on.length/6)*40;
    },
    read(D){
      if (!D.suiteSet) return '—';
      const on = PRODUCTS.filter(p=>D.suite[p.k]);
      const layers = new Set(on.map(p=>p.layer));
      return `${on.length} de 6 productos · ${layers.size} de 3 capas`;
    },
    act:{ t:'Capas de la suite sin cubrir',
      d:'Un cliente que ejecuta sin capa de control no tiene cómo demostrar internamente qué está pasando. Es el patrón que precede a las no renovaciones: la automatización funciona, pero nadie fuera de TI lo ve.',
      do:'Si falta <b>Control</b>: activar Orquestador y Nexus para que el sponsor vea ejecuciones y ahorro sin pedirle nada a TI. Si falta <b>Entrada</b>: Xperience convierte solicitudes en disparadores de automatización y suele abrir procesos nuevos sin desarrollo adicional.' } },

  { id:'ado_nuevos', qw:45, p:'adopcion', w:25, n:'Procesos nuevos (90 días)',
    h:'Procesos que pasaron a producción en el último trimestre. Mide si el programa avanza o se estancó.',
    in:[{k:'procNuevos',l:'Procesos nuevos en 90 días'}],
    calc(D){ if (!has(D.procNuevos)) return null; const t=[0,45,70,85,100]; return t[clamp(Math.round(D.procNuevos),0,4)]; },
    read(D){ return has(D.procNuevos) ? `${fmtN(D.procNuevos)} en el trimestre` : '—'; },
    act:{ t:'El programa se detuvo',
      d:'Sin procesos nuevos, la cuenta deja de crecer y el score empieza a bajar solo: los procesos existentes se vuelven rutina y dejan de percibirse como valor.',
      do:'Convocar una sesión de identificación de oportunidades con las áreas que aún no participan. El <b>wizard de autodiagnóstico</b> sirve para que el propio cliente arme el backlog sin depender de una consultoría.' } },

  { id:'ado_cap', p:'adopcion', w:25, n:'Usuarios capacitados',
    h:'Personas que completaron capacitación formal, sobre los usuarios licenciados.',
    in:[{k:'usrCap',l:'Usuarios capacitados'},{k:'usrLic',l:'Usuarios licenciados', mirror:true}],
    calc(D){ const r = ratio(D.usrCap, D.usrLic); return r===null ? null : lin(r, 0, 0.50); },
    read(D){ const r = ratio(D.usrCap, D.usrLic); return r===null ? '—' : `${fmtN(D.usrCap)} de ${fmtN(D.usrLic)} · ${pct1(r)}`; },
    act:{ t:'Cobertura de capacitación baja',
      d:'La capacitación es lo que convierte a un usuario en alguien capaz de resolver solo. Sin ella, cada cambio menor se transforma en un ticket.',
      do:'Agendar una cohorte de certificación con nombre y fecha. Priorizar usuarios de negocio de las áreas con más procesos: son los que generan demanda nueva.' } },

  { id:'ado_auto', p:'adopcion', w:15, n:'Autonomía del equipo',
    h:'¿El cliente puede construir y modificar automatizaciones sin nosotros?',
    in:[{k:'autonomia', type:'sel', opts:SEL_AUTO}],
    calc(D){ return selScore(SEL_AUTO, D.autonomia); },
    read(D){ const o = SEL_AUTO.find(x=>x.v===D.autonomia); return (o && o.v) ? o.l : '—'; },
    act:{ t:'Dependencia total de servicios externos',
      d:'La cuenta no puede sostenerse sin presupuesto de servicios. Cuando ese presupuesto se recorta, el programa se detiene y la licencia queda sin justificación.',
      do:'Definir con el cliente un objetivo explícito de autonomía: al menos un desarrollador interno certificado y un proceso construido de punta a punta por su equipo dentro del trimestre.' } },

  /* ---------------- VALOR GENERADO ---------------- */
  { id:'val_horas', qw:50, p:'valor', w:30, n:'Horas ahorradas',
    h:'Horas liberadas al mes contra las comprometidas en el caso de negocio original.',
    in:[{k:'horasMes',l:'Horas ahorradas / mes'},{k:'horasObj',l:'Objetivo del caso de negocio'}],
    calc(D){ const r = ratio(D.horasMes, D.horasObj); return r===null ? null : lin(r, 0, 1.0); },
    read(D){ const r = ratio(D.horasMes, D.horasObj); return r===null ? '—' : `${fmtN(D.horasMes)} de ${fmtN(D.horasObj)} h · ${pct1(r)}`; },
    act:{ t:'Ahorro por debajo del caso de negocio',
      d:'La promesa con la que se cerró la venta no se está cumpliendo. Es el argumento que va a aparecer en la mesa de renovación.',
      do:'Reconstruir la brecha por proceso: cuáles entregan lo esperado y cuáles no. Llegar a la renovación con la explicación y un plan, no con la cifra a secas.' } },

  { id:'val_medidos', p:'valor', w:25, n:'Procesos con valor cuantificado',
    h:'De los procesos en producción, cuántos tienen ahorro medido y no solamente estimado.',
    in:[{k:'procMed',l:'Procesos con ahorro medido'},{k:'procProd',l:'Procesos productivos', mirror:true}],
    calc(D){ const r = ratio(D.procMed, D.procProd); return r===null ? null : lin(r, 0, 0.80); },
    read(D){ const r = ratio(D.procMed, D.procProd); return r===null ? '—' : `${fmtN(D.procMed)} de ${fmtN(D.procProd)} · ${pct1(r)}`; },
    act:{ t:'Ahorro sin medición por proceso',
      d:'Hay automatizaciones corriendo cuyo aporte nadie cuantificó. En la práctica no existen para quien firma la renovación.',
      do:'Instrumentar la medición en Nexus para los procesos de mayor volumen. Bastan tres o cuatro procesos bien medidos para sostener una conversación de renovación.' } },

  { id:'val_roi', p:'valor', w:25, n:'ROI acumulado',
    h:'Se calcula con las horas ahorradas, el costo hora y la inversión anual del cliente.',
    in:[{k:'costoHora',l:'Costo hora del negocio (USD)'},{k:'licAnual',l:'Licencia anual (USD)'},{k:'servAnual',l:'Servicios y soporte anual (USD)'}],
    calc(D){ const r = calcRoi(D); return r===null ? null : lin(r, 0, 250); },
    read(D){ const r = calcRoi(D); return r===null ? '—' : `${r.toFixed(0)}% anual`; },
    act:{ t:'Retorno insuficiente frente a la inversión',
      d:'Con los datos cargados, lo que el cliente paga no se justifica con lo que recibe. Cualquier revisión de presupuesto va a llegar a la misma conclusión.',
      do:'Dos caminos, y conviene evaluar ambos: subir el numerador incorporando procesos de alto volumen, o ajustar el plan a la capacidad realmente utilizada. Proponerlo nosotros es mejor que recibirlo como exigencia.' } },

  { id:'val_valid', qw:50, p:'valor', w:20, n:'Validación del impacto',
    h:'Quién reconoce la cifra de ahorro dentro de la organización del cliente.',
    in:[{k:'validacion', type:'sel', opts:SEL_VALID}],
    calc(D){ return selScore(SEL_VALID, D.validacion); },
    read(D){ const o = SEL_VALID.find(x=>x.v===D.validacion); return (o && o.v) ? o.l : '—'; },
    act:{ t:'El ahorro no está validado por el cliente',
      d:'Una cifra que solo sostiene el proveedor no sobrevive a un comité de presupuesto. La validación cambia de quién es el número.',
      do:'Llevar la medición a Finanzas o Control de Gestión y pedirles que la validen con su propia metodología. Una cifra menor pero validada por ellos vale más que una mayor calculada por nosotros.' } },

  /* ---------------- RIESGO (invertido) ---------------- */
  { id:'rie_tickets', qw:25, p:'riesgo', w:22, n:'Tickets abiertos',
    h:'Tickets sin resolver, normalizados por bot activo. Los críticos pesan aparte.',
    in:[{k:'tickets',l:'Tickets abiertos'},{k:'ticketsCrit',l:'De ellos, críticos'}],
    calc(D){
      if (!has(D.tickets)) return null;
      // Divisor: bots activos; si no hay, procesos productivos; si tampoco, escala absoluta
      const den = (has(D.botsAct)&&D.botsAct>0) ? D.botsAct
                : (has(D.procProd)&&D.procProd>0) ? D.procProd : null;
      const crit = has(D.ticketsCrit) ? Math.min(D.ticketsCrit, D.tickets) : null;
      if (den === null) return lin(D.tickets, 10, 0);
      const normales = lin((D.tickets - (crit||0))/den, 2.0, 0);
      if (crit === null) return normales;
      return 0.65*normales + 0.35*lin(crit/den, 0.25, 0);
    },
    read(D){ return has(D.tickets) ? `${fmtN(D.tickets)} abiertos${has(D.ticketsCrit)&&D.ticketsCrit>0?` · ${fmtN(D.ticketsCrit)} críticos`:''}` : '—'; },
    act:{ t:'Carga de tickets elevada',
      d:'Cada ticket abierto es fricción visible para el cliente y erosiona la percepción de estabilidad, aunque la plataforma esté funcionando.',
      do:'Separar los tickets de producto de los de proceso mal diseñado: se resuelven por vías distintas. Cerrar primero los críticos con fecha comprometida y comunicar el avance, aunque todavía no estén resueltos.' } },

  { id:'rie_inact', qw:45, p:'riesgo', w:28, n:'Tiempo sin actividad',
    h:'Días desde la última ejecución registrada. Es la señal de deterioro más temprana que existe.',
    in:[{k:'diasSin',l:'Días desde la última ejecución'}],
    calc(D){ return lin(D.diasSin, 30, 3); },
    read(D){ return has(D.diasSin) ? `${fmtN(D.diasSin)} días` : '—'; },
    act:{ t:'Plataforma sin ejecuciones recientes',
      d:'Una cuenta detenida no se recupera sola. Cuanto más tiempo pasa, más difícil es reconstruir el hábito y la confianza.',
      do:'Contacto directo esta semana, no por correo. Determinar si es un problema técnico, un cambio en el proceso del cliente o una decisión que ya se tomó y no nos comunicaron.' } },

  { id:'rie_fallo', p:'riesgo', w:25, n:'Tasa de fallo',
    h:'Ejecuciones fallidas sobre el total del mes. Bajo 2% se considera operación normal.',
    in:[{k:'ejecFall',l:'Ejecuciones fallidas / mes'},{k:'ejecMes',l:'Ejecuciones del mes', mirror:true}],
    calc(D){ const r = ratio(D.ejecFall, D.ejecMes); return r===null ? null : lin(r, 0.12, 0.02); },
    read(D){ const r = ratio(D.ejecFall, D.ejecMes); return r===null ? '—' : `${(r*100).toFixed(1)}% de ${fmtN(D.ejecMes)}`; },
    act:{ t:'Fallos por encima de lo esperable',
      d:'Los fallos obligan a intervención manual y destruyen el argumento de ahorro: el proceso sigue consumiendo tiempo de personas.',
      do:'Revisión técnica de las automatizaciones con más fallos. Las causas habituales son cambios en las interfaces de los sistemas y manejo de excepciones incompleto; ambas se corrigen en horas, no en semanas.' } },

  { id:'rie_subuso', p:'riesgo', w:12, n:'Subutilización de licencia',
    h:'Derivada: toma la menor entre la utilización de bots y la de usuarios.',
    in:[],
    calc(D){
      const a = ratio(D.botsAct,D.botsLic), b = ratio(D.usrAct,D.usrLic);
      const vals = [a,b].filter(v=>v!==null);
      if (!vals.length) return null;
      return lin(Math.min(...vals), 0.10, 0.60);
    },
    read(D){
      const a = ratio(D.botsAct,D.botsLic), b = ratio(D.usrAct,D.usrLic);
      const vals = [a,b].filter(v=>v!==null);
      return vals.length ? `${pct1(Math.min(...vals))} de la capacidad` : '—';
    },
    act:{ t:'Capacidad contratada sin uso',
      d:'La brecha entre lo licenciado y lo usado es el primer recorte que propone cualquier área de compras.',
      do:'Anticiparse: llegar a la renovación con un plan de ocupación de la capacidad, o con una propuesta de ajuste que nosotros mismos hayamos originado.' } },

  { id:'rie_sponsor', qw:30, p:'riesgo', w:13, n:'Sponsor ejecutivo',
    h:'Quién defiende la inversión dentro del cliente cuando se revisa el presupuesto.',
    in:[{k:'sponsor', type:'sel', opts:SEL_SPONSOR}],
    calc(D){ return selScore(SEL_SPONSOR, D.sponsor); },
    read(D){ const o = SEL_SPONSOR.find(x=>x.v===D.sponsor); return (o && o.v) ? o.l : '—'; },
    act:{ t:'Sin sponsor ejecutivo activo',
      d:'Sin alguien que defienda la inversión desde adentro, la renovación depende de que nadie la cuestione. Es la variable que más pesa cuando el resto de los indicadores están bien y la cuenta se pierde igual.',
      do:'Mapear quién recibe el beneficio del ahorro y construir la relación con esa persona, no solo con el contacto de TI. Un reporte ejecutivo mensual desde Nexus es la vía de menor fricción para instalarla.' } }
];

function calcRoi(D){
  if (!has(D.horasMes) || !has(D.costoHora)) return null;
  const inv = (has(D.licAnual)?D.licAnual:0) + (has(D.servAnual)?D.servAnual:0);
  if (inv <= 0) return null;
  const valor = D.horasMes * 12 * D.costoHora;
  return (valor - inv) / inv * 100;
}

/* ============================================================
   MOTOR DE SCORE
   Los datos ausentes NO puntúan cero: se excluyen y el pilar
   se re-pondera entre las métricas disponibles. Se informa
   por separado cuánto peso quedó sin cubrir.
   ============================================================ */
function computeScore(D){
  const perMetric = activeMetrics().map(m => {
    let s = null;
    try { s = m.calc(D); } catch(e){ s = null; }
    if (s !== null && !isFinite(s)) s = null;
    return { m, score: s===null ? null : clamp(s,0,100), read: m.read(D) };
  });

  const pillars = PILLARS.map(p => {
    const ms = perMetric.filter(x => x.m.p === p.id);
    const avail = ms.filter(x => x.score !== null);
    const wSum = avail.reduce((s,x)=>s+wOf(x.m),0);
    const score = wSum > 0 ? avail.reduce((s,x)=>s+x.score*wOf(x.m),0)/wSum : null;
    const totalW = ms.reduce((s,x)=>s+wOf(x.m),0);
    return { ...p, metrics:ms, score, coverage: totalW>0 ? wSum/totalW : 0, missing: ms.filter(x=>x.score===null) };
  });

  const availP = pillars.filter(p => p.score !== null);
  const wTotal = availP.reduce((s,p)=>s+p.w,0);
  const total = wTotal > 0 ? Math.round(availP.reduce((s,p)=>s+p.score*p.w,0)/wTotal) : null;

  // Confianza = fracción del peso global efectivamente respaldada por datos
  const confidence = pillars.reduce((s,p)=>s + (p.w/100)*p.coverage, 0);

  return { perMetric, pillars, total, confidence, D };
}

const BANDS = [
  { min:85, n:'Saludable',     v:'var(--green)', hi:'var(--green-hi)', hex:'#1D9E75',
    d:'La cuenta usa lo que compró, el programa avanza y el valor está reconocido. Perfil de expansión, no de retención.' },
  { min:70, n:'Estable',       v:'var(--blue)',  hi:'var(--blue-hi)',  hex:'#378ADD',
    d:'Relación sana con puntos concretos por corregir. Sin acción, tiende a bajar en lugar de sostenerse.' },
  { min:50, n:'En observación',v:'var(--amber)', hi:'var(--amber-hi)', hex:'#BA7517',
    d:'Hay deterioro visible en más de un frente. Requiere un plan con responsable y fecha, no seguimiento pasivo.' },
  { min:0,  n:'En riesgo',     v:'var(--rb)',    hi:'var(--rb-hi)',    hex:'#BC0017',
    d:'Riesgo concreto de no renovación. Escalar a la conversación ejecutiva y tratar la cuenta como recuperación, no como mantención.' }
];
/* Con poca cobertura de datos el número existe pero la etiqueta no debe afirmar nada. */
const CONF_MIN = 0.35;
function displayBand(C){
  const b = bandOf(C.total);
  if (C.total !== null && C.confidence < CONF_MIN){
    return { n:'Datos insuficientes', v:'var(--line)', hi:'var(--faint)', hex:'#5F717A',
      d:'Solo el ' + Math.round(C.confidence*100) + '% del peso del score está respaldado por datos. El número es preliminar y no debería usarse para clasificar la cuenta.' };
  }
  return b;
}
const bandOf = s => s===null ? { n:'Sin datos', v:'var(--line)', hi:'var(--faint)', hex:'#5F717A', d:'Carga los indicadores para obtener el diagnóstico.' } : BANDS.find(b=>s>=b.min);

/* ============================================================
   ALERTAS — ordenadas por puntos recuperables en el score global
   ============================================================ */
function buildAlerts(C){
  return C.perMetric
    .filter(x => x.score !== null && x.score < 60)
    .map(x => {
      const p = PILLARS.find(p=>p.id===x.m.p);
      const pill = C.pillars.find(pp=>pp.id===x.m.p);
      // Peso efectivo tras la re-ponderación por datos faltantes
      const wSum = pill.metrics.filter(mm=>mm.score!==null).reduce((s,mm)=>s+wOf(mm.m),0);
      const availW = C.pillars.filter(pp=>pp.score!==null).reduce((s,pp)=>s+pp.w,0);
      const eff = wSum>0 && availW>0 ? (p.w/availW)*(wOf(x.m)/wSum) : 0;
      return { ...x, pillar:p, gain: eff*(100-x.score), sev: x.score<30?'hi':x.score<45?'md':'lo' };
    })
    .sort((a,b)=>b.gain-a.gain);
}

function expansionSignals(C){
  const D = C.D, out = [];
  const rb = ratio(D.botsAct,D.botsLic), ru = ratio(D.usrAct,D.usrLic), re = ratio(D.ejecMes,D.ejecEsp);
  if (rb !== null && rb >= 0.90) out.push('Los bots licenciados están ocupados al ' + pct1(rb) + '. Sin capacidad libre, el próximo proceso no tiene dónde correr.');
  if (ru !== null && ru >= 0.90) out.push('Los usuarios licenciados están ocupados al ' + pct1(ru) + '. Sumar áreas exige ampliar licencias.');
  if (re !== null && re >= 1.10) out.push('El volumen supera en ' + pct1(re-1) + ' lo proyectado: el caso de negocio real es mejor que el vendido y conviene documentarlo.');
  if (D.suiteSet){
    const on = PRODUCTS.filter(p=>D.suite[p.k]);
    const layers = new Set(on.map(p=>p.layer));
    const usoOk = C.pillars.find(p=>p.id==='uso');
    if (usoOk && usoOk.score !== null && usoOk.score >= 65 && layers.size < 3){
      const falt = LAYERS.filter(l=>!layers.has(l.k)).map(l=>l.n.toLowerCase());
      out.push('La cuenta usa bien lo que tiene pero no cubre la capa de ' + falt.join(' ni de ') + '. Es la vía natural de crecimiento sin pedir presupuesto nuevo de golpe.');
    }
  }
  return out;
}

/* ============================================================
   ESTADO
   ============================================================ */
const D = {
  cliente:'', industria:'Banca y Servicios Financieros', plan:'14990', csm:'', desde:'', renueva:'',
  suite:{}, suiteSet:false
};
PRODUCTS.forEach(p => D.suite[p.k] = false);
[ 'botsAct','botsLic','ejecMes','ejecEsp','procProd','procPlan','usrAct','usrLic','diasAct',
  'procNuevos','usrCap','horasMes','horasObj','procMed','costoHora','licAnual','servAnual',
  'tickets','ticketsCrit','diasSin','ejecFall'
].forEach(k => D[k] = null);
D.autonomia = ''; D.validacion = ''; D.sponsor = '';

/* ============================================================
   FORMULARIO — generado desde METRICS para no duplicar verdad
   ============================================================ */
function inputHTML(mi, m){
  const uid = `i_${m.id}_${mi.k}`;
  if (mi.type === 'sel'){
    return `<div class="field"><label for="${uid}">${esc(m.n)}</label>
      <select class="input" id="${uid}" data-k="${mi.k}" data-t="sel">
        ${mi.opts.map(o=>`<option value="${o.v}">${esc(o.l)}</option>`).join('')}
      </select></div>`;
  }
  return `<div class="field"><label for="${uid}">${esc(mi.l)}${mi.mirror?' <span class="hint">· compartido</span>':''}</label>
    <input class="input blank" id="${uid}" data-k="${mi.k}" data-t="num" type="number" min="0" step="1" placeholder="Sin dato"></div>`;
}

function chipsHTML(){
  return `<div class="layers" id="suiteChips">
    ${LAYERS.map(l=>`
      <div class="layer" data-layer="${l.k}">
        <div class="l-h"><span class="l-n">${esc(l.n)}</span><span class="l-st">Sin cobertura</span></div>
        <div style="font-size:11.5px; color:var(--faint); margin:-4px 0 10px">${esc(l.d)}</div>
        <div class="prods">
          ${PRODUCTS.filter(p=>p.layer===l.k).map(p=>`<button type="button" class="prod" data-prod="${p.k}" aria-pressed="false">${esc(p.n)}</button>`).join('')}
        </div>
      </div>`).join('')}
  </div>`;
}

function buildForm(){
  PILLARS.forEach(p => {
    const card = document.getElementById('card' + p.id.charAt(0).toUpperCase() + p.id.slice(1));
    const ms = activeMetrics().filter(m => m.p === p.id);
    card.innerHTML = `
      <div class="card-h">
        <h2>${esc(p.n)}</h2>
        <span class="w-chip">${p.w}% del score</span>
      </div>
      <p class="card-sub">${esc(p.d)}</p>
      ${ms.map(m => `
        <div class="metric" data-metric="${m.id}">
          <div class="m-top">
            <span class="m-name">${esc(m.n)}</span>
            <span class="m-badge"><span class="m-w">${wOf(m)}%</span><span class="m-score" data-ms="${m.id}">—</span></span>
            <span class="m-hint">${esc(m.h)}</span>
          </div>
          ${m.in.length === 0
            ? `<div class="callout" style="padding:9px 12px; font-size:12px">
                 <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><path d="M4 17l6-6 4 4 6-6"/><path d="M20 9V4h-5" opacity=".55"/></svg>
                 <span>Se calcula con los datos de utilización de bots y usuarios ya cargados arriba.</span></div>`
            : (m.in[0].type === 'chips' ? chipsHTML()
               : `<div class="grid ${m.in.length > 1 ? 'g2' : ''}">${m.in.map(mi=>inputHTML(mi,m)).join('')}</div>`)}
        </div>`).join('')}`;
  });
}

/* ============================================================
   GAUGE
   ============================================================ */
function gauge(score, band){
  const W=260, H=176, cx=130, cy=134, r=100, sw=15;
  const a0 = Math.PI*0.86, a1 = Math.PI*2.14;          // arco de 232°
  const pt = (rad,a) => [cx + rad*Math.cos(a), cy + rad*Math.sin(a)];
  const arcPath = (from,to) => {
    const [x1,y1]=pt(r,from), [x2,y2]=pt(r,to);
    return `M${x1.toFixed(2)},${y1.toFixed(2)} A${r},${r} 0 ${(to-from)>Math.PI?1:0} 1 ${x2.toFixed(2)},${y2.toFixed(2)}`;
  };
  const frac = score===null ? 0 : score/100;
  let g = `<path d="${arcPath(a0,a1)}" fill="none" stroke="var(--surface-3)" stroke-width="${sw}" stroke-linecap="round"/>`;

  // marcas de banda
  [50,70,85].forEach(v=>{
    const a = a0 + (a1-a0)*(v/100);
    const [x1,y1]=pt(r-sw/2-3,a), [x2,y2]=pt(r+sw/2+3,a);
    g += `<line x1="${x1.toFixed(2)}" y1="${y1.toFixed(2)}" x2="${x2.toFixed(2)}" y2="${y2.toFixed(2)}" stroke="var(--bg)" stroke-width="2.4"/>`;
  });

  if (score !== null){
    const aEnd = a0 + (a1-a0)*frac;
    const len = Math.PI*2*r;
    g += `<path d="${arcPath(a0, Math.max(a0+0.001, aEnd))}" fill="none" stroke="${band.hex}" stroke-width="${sw}" stroke-linecap="round"
             pathLength="1" stroke-dasharray="1" stroke-dashoffset="1" style="animation:draw .95s var(--ease) .1s forwards"/>`;
    const [dx,dy] = pt(r, aEnd);
    g += `<circle cx="${dx.toFixed(2)}" cy="${dy.toFixed(2)}" r="4.5" fill="var(--bg)" stroke="${band.hex}" stroke-width="3"/>`;
  }

  g += `<text class="g-val" x="${cx}" y="${cy-4}" text-anchor="middle" fill="${score===null?'var(--faint)':band.hex}">${score===null?'—':score}</text>
        <text class="g-of" x="${cx}" y="${cy+18}" text-anchor="middle">de 100</text>
        <text class="mono" x="${pt(r+2,a0)[0]-4}" y="${pt(r+2,a0)[1]+16}" text-anchor="middle" font-size="9" fill="var(--faint)">0</text>
        <text class="mono" x="${pt(r+2,a1)[0]+4}" y="${pt(r+2,a1)[1]+16}" text-anchor="middle" font-size="9" fill="var(--faint)">100</text>`;
  return `<svg class="gauge" viewBox="0 0 ${W} ${H}" role="img" aria-label="Health score ${score===null?'sin datos':score+' de 100'}">${g}</svg>`;
}

/* ============================================================
   PANEL DE SCORE
   ============================================================ */
function renderPanel(C){
  const band = displayBand(C);
  const conf = Math.round(C.confidence*100);
  const confMsg = conf >= 75 ? 'Base de datos suficiente para decidir.'
                : conf >= 50 ? 'Faltan datos en algunos frentes; el score es orientativo.'
                : 'Datos insuficientes: el score todavía no debería usarse para decidir.';

  $('#scorePanel').style.setProperty('--band', band.hex);
  $('#scorePanel').innerHTML = `
    <div class="gauge-wrap">${gauge(C.total, band)}</div>
    <div class="band-name" style="color:${band.hex}">${esc(band.n)}</div>
    <div class="band-desc">${esc(band.d)}</div>
    <div class="pill-list">
      ${C.pillars.map((p,i)=>`
        <div class="pill">
          <span class="p-n"><i style="width:8px;height:8px;border-radius:2px;background:${p.hex};display:inline-block"></i>${esc(p.n)} <span class="p-w">${p.w}%</span></span>
          <span class="p-v" style="color:${p.score===null?'var(--faint)':p.hex}">${p.score===null?'—':Math.round(p.score)}</span>
          <span class="p-bar"><i style="width:${p.score===null?0:p.score}%; background:${p.hex}; animation-delay:${0.06*i}s"></i></span>
        </div>`).join('')}
    </div>
    <div class="conf">
      <div class="c-h"><span>Confianza del diagnóstico</span><span class="c-v">${conf}%</span></div>
      <div class="c-bar"><i style="width:${conf}%; background:${conf>=75?'var(--green)':conf>=50?'var(--amber)':'var(--rb)'}"></i></div>
      <div style="margin-top:8px; font-size:11.5px">${esc(confMsg)}</div>
    </div>`;

  const tb = $('#tbScore');
  $('#tbVal').textContent = C.total===null ? '—' : C.total;
  $('#tbVal').style.color = band.hex;
  $('#tbBand').textContent = band.n;
  tb.classList.toggle('on', window.scrollY > 260);

  // marcador por métrica en el formulario
  C.perMetric.forEach(x=>{
    const el = document.querySelector(`[data-ms="${x.m.id}"]`);
    if (!el) return;
    if (x.score === null){ el.textContent = '—'; el.style.background='var(--surface-3)'; el.style.color='var(--faint)'; return; }
    const b = bandOf(Math.round(x.score));
    el.textContent = Math.round(x.score);
    el.style.background = `color-mix(in srgb, ${b.hex} 18%, transparent)`;
    el.style.color = b.hex;
  });

  // estado de las capas de la suite
  $$('#suiteChips .layer').forEach(l=>{
    const on = PRODUCTS.filter(p=>p.layer===l.dataset.layer && D.suite[p.k]);
    l.classList.toggle('on', on.length>0);
    l.querySelector('.l-st').textContent = on.length>0 ? `${on.length} en uso` : 'Sin cobertura';
  });
}

/* ============================================================
   DIAGNÓSTICO COMPLETO
   ============================================================ */
function daysToRenewal(){
  if (!D.renueva) return null;
  const t = new Date(D.renueva + 'T00:00:00');
  if (isNaN(t)) return null;
  return Math.round((t - new Date(new Date().toDateString())) / 86400000);
}

function renewalRead(C){
  const d = daysToRenewal();
  const sponsor = C.perMetric.find(x=>x.m.id==='rie_sponsor');
  const valid = C.perMetric.find(x=>x.m.id==='val_valid');
  const parts = [];
  if (d === null) parts.push('No hay fecha de renovación cargada, así que no se puede priorizar por tiempo.');
  else if (d < 0) parts.push('La fecha de renovación registrada ya pasó hace ' + Math.abs(d) + ' días.');
  else parts.push('Faltan ' + d + ' días para la renovación.');

  if (C.total !== null && C.confidence < CONF_MIN){
    parts.push('El score de ' + C.total + ' se apoya en el ' + Math.round(C.confidence*100) + '% del peso total, así que todavía no sostiene una lectura de renovación. Completar los indicadores faltantes es el primer paso.');
  } else if (C.total !== null){
    if (C.total >= 85) parts.push('Con score ' + C.total + ', la conversación debería ser de ampliación y no de defensa.');
    else if (C.total >= 70) parts.push('Con score ' + C.total + ', la renovación es alcanzable si se cierran los puntos abiertos antes de sentarse a negociar.');
    else if (C.total >= 50) parts.push('Con score ' + C.total + ', llegar sin un plan ejecutado significa negociar desde atrás.');
    else parts.push('Con score ' + C.total + ', la cuenta debe tratarse como recuperación: plan formal, responsable asignado y seguimiento semanal.');
  }
  if (valid && valid.score !== null && valid.score < 50) parts.push('No hay una cifra de ahorro que el cliente reconozca como propia, que es el argumento que más pesa en la mesa.');
  if (sponsor && sponsor.score !== null && sponsor.score < 50) parts.push('Sin sponsor ejecutivo activo, la decisión queda en manos de quien revise el presupuesto.');

  const urgent = d !== null && d <= 90 && C.total !== null && C.total < 70 && C.confidence >= CONF_MIN;
  return { text: parts.join(' '), urgent, days:d };
}

/* Errores de carga que invalidan el diagnóstico antes que cualquier umbral. */
function dataWarnings(D){
  const w = [];
  const gt = (a,b,ta,tb) => { if (has(D[a]) && has(D[b]) && D[a] > D[b]) w.push(`${ta} (${fmtN(D[a])}) supera ${tb} (${fmtN(D[b])}).`); };
  gt('botsAct','botsLic','Bots activos','los licenciados');
  gt('usrAct','usrLic','Usuarios activos','los licenciados');
  gt('usrCap','usrLic','Usuarios capacitados','los licenciados');
  gt('procMed','procProd','Procesos con ahorro medido','los procesos productivos');
  gt('ejecFall','ejecMes','Ejecuciones fallidas','el total de ejecuciones del mes');
  gt('ticketsCrit','tickets','Tickets críticos','el total de tickets abiertos');
  if (has(D.diasAct) && D.diasAct > 30) w.push(`Días con actividad (${fmtN(D.diasAct)}) supera los 30 del período.`);
  if (has(D.diasAct) && has(D.diasSin) && D.diasAct > 0 && D.diasSin > 30)
    w.push(`Hay ${fmtN(D.diasAct)} días con actividad en el último mes pero ${fmtN(D.diasSin)} días desde la última ejecución. Las dos cifras no pueden ser ciertas a la vez.`);
  return w;
}

function renderReport(C){
  if (C.total === null){
    $('#report').innerHTML = `<div class="sec-title">Diagnóstico</div>
      <div class="card"><div class="callout">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 16v-4M12 8h.01"/></svg>
        <span>Carga al menos un indicador para generar el diagnóstico. También puedes usar <strong>Cargar ejemplo</strong> para ver la herramienta completa con una cuenta ficticia.</span>
      </div></div>`;
    return;
  }

  const alerts = buildAlerts(C);
  const exp = expansionSignals(C);
  const ren = renewalRead(C);
  const missing = C.perMetric.filter(x=>x.score===null);
  const roi = calcRoi(D);
  const valorAnual = (has(D.horasMes)&&has(D.costoHora)) ? D.horasMes*12*D.costoHora : null;
  const inv = (has(D.licAnual)?D.licAnual:0) + (has(D.servAnual)?D.servAnual:0);

  const warns = dataWarnings(D);

  $('#report').innerHTML = `
  ${warns.length ? `<div class="sec-title">Revisar los datos cargados</div>
  <div class="card rise rise-1"><div class="callout bad">
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><path d="M10.3 3.9L1.8 18a2 2 0 001.7 3h17a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z"/><path d="M12 9v4M12 17h.01"/></svg>
    <span><strong>Hay cifras que no cuadran entre sí.</strong> El score se calcula igual, pero conviene corregirlas antes de usarlo.<br>${warns.map(x=>'· '+esc(x)).join('<br>')}</span>
  </div></div>` : ''}
  <div class="sec-title">Lectura de renovación</div>
  <div class="card rise rise-1">
    <div class="callout ${ren.urgent?'bad':C.total>=85?'good':C.total>=70?'':'warn'}">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><rect x="3" y="4.5" width="18" height="17" rx="2"/><path d="M16 2.5v4M8 2.5v4M3 10h18"/></svg>
      <span>${esc(ren.text)}</span>
    </div>
    ${valorAnual !== null && inv > 0 ? `
    <div class="kpi-row" style="margin-top:16px">
      <div class="kpi"><div class="k-l">Valor anual generado</div><div class="k-v" style="color:var(--green-hi)">${fmtUSD(valorAnual)}</div><div class="k-s">${fmtN(D.horasMes)} h/mes × ${fmtUSD(D.costoHora)}/h</div></div>
      <div class="kpi"><div class="k-l">Inversión anual</div><div class="k-v">${fmtUSD(inv)}</div><div class="k-s">Licencia + servicios</div></div>
      <div class="kpi"><div class="k-l">ROI anual</div><div class="k-v" style="color:${roi>=0?'var(--green-hi)':'var(--rb-hi)'}">${roi.toFixed(0)}%</div><div class="k-s">Sobre la inversión declarada</div></div>
      <div class="kpi"><div class="k-l">Valor neto</div><div class="k-v" style="color:${valorAnual-inv>=0?'var(--green-hi)':'var(--rb-hi)'}">${fmtUSD(valorAnual-inv)}</div><div class="k-s">Por año</div></div>
    </div>` : ''}
  </div>

  <div class="sec-title">Dónde actuar${alerts.length?` · ${alerts.length} punto${alerts.length>1?'s':''} bajo 60`:''}</div>
  <div class="card rise rise-2">
    ${alerts.length ? `
      <p class="card-sub">Ordenados por puntos que recupera el score global si el indicador vuelve a 100. La cifra ya incorpora el peso del pilar y la re-ponderación por datos faltantes.</p>
      ${alerts.slice(0,6).map((a,i)=>`
        <div class="alert sev-${a.sev}">
          <span class="a-rank">${i+1}</span>
          <div class="a-body">
            <div class="a-t">${esc(a.m.act.t)}
              <span class="a-gain">+${a.gain.toFixed(1)} pts</span>
              <span class="chip">${esc(a.pillar.n)} · ${esc(a.m.n)}: ${Math.round(a.score)}</span>
            </div>
            <div class="a-d">${a.m.act.d}</div>
            <div class="a-do">${a.m.act.do}</div>
          </div>
        </div>`).join('')}
      ${alerts.length>6?`<p style="font-size:12px; color:var(--faint); margin-top:12px">Hay ${alerts.length-6} indicador${alerts.length-6>1?'es':''} más bajo 60 con impacto menor; están en la tabla de detalle.</p>`:''}
    ` : `<div class="callout good">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><path d="M20 6L9 17l-5-5"/></svg>
        <span>Ningún indicador con dato cargado está bajo 60. Revisa igualmente los datos faltantes: lo que no se mide no aparece acá.</span></div>`}
  </div>

  ${exp.length ? `
  <div class="sec-title">Señales de expansión</div>
  <div class="card rise rise-3">
    <p class="card-sub">Condiciones detectadas en los datos que habilitan una conversación de crecimiento. No son recomendaciones de venta automáticas: requieren validar el caso con el cliente.</p>
    ${exp.map(e=>`<div class="callout good" style="margin-bottom:9px">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M22 7l-8.5 8.5-5-5L2 17"/><path d="M16 7h6v6"/></svg>
      <span>${esc(e)}</span></div>`).join('')}
  </div>` : ''}

  <div class="sec-title">Cobertura de la suite</div>
  <div class="card rise rise-4">
    <p class="card-sub">Las tres capas del modelo Rocketbot. Una cuenta que ejecuta sin capa de control funciona, pero nadie fuera de TI puede ver que funciona.</p>
    <div class="layers">
      ${LAYERS.map(l=>{
        const on = PRODUCTS.filter(p=>p.layer===l.k && D.suite[p.k]);
        const off = PRODUCTS.filter(p=>p.layer===l.k && !D.suite[p.k]);
        return `<div class="layer ${on.length?'on':''}">
          <div class="l-h"><span class="l-n">${esc(l.n)}</span><span class="l-st">${on.length?`${on.length} en uso`:'Sin cobertura'}</span></div>
          <div style="font-size:11.5px; color:var(--faint); margin:-4px 0 10px">${esc(l.d)}</div>
          <div class="prods">
            ${on.map(p=>`<span class="prod" aria-pressed="true" style="cursor:default">${esc(p.n)}</span>`).join('')}
            ${off.map(p=>`<span class="prod" style="cursor:default; opacity:.5">${esc(p.n)}</span>`).join('')}
          </div>
        </div>`;
      }).join('')}
    </div>
  </div>

  <div class="sec-title page-break">Detalle por indicador · evaluación ${isQuick()?'rápida':'completa'}</div>
  <div class="card rise rise-4">
    <div class="tbl-scroll"><table class="tbl">
      <thead><tr><th>Indicador</th><th>Pilar</th><th class="num">Peso</th><th>Observado</th><th class="num">Puntaje</th></tr></thead>
      <tbody>
        ${C.perMetric.map(x=>{
          const p = PILLARS.find(p=>p.id===x.m.p);
          const b = x.score===null?null:bandOf(Math.round(x.score));
          return `<tr>
            <td>${esc(x.m.n)}</td>
            <td class="lbl">${esc(p.n)}</td>
            <td class="num lbl">${(p.w*wOf(x.m)/100).toFixed(1)}%</td>
            <td class="lbl">${esc(x.read)}</td>
            <td class="num">${x.score===null
              ? '<span class="pil" style="background:var(--surface-3); color:var(--faint)">sin dato</span>'
              : `<span class="pil" style="background:color-mix(in srgb,${b.hex} 18%,transparent); color:${b.hex}">${Math.round(x.score)}</span>`}</td>
          </tr>`;
        }).join('')}
      </tbody>
    </table></div>
    ${missing.length ? `<div class="callout warn" style="margin-top:15px">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><path d="M10.3 3.9L1.8 18a2 2 0 001.7 3h17a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z"/><path d="M12 9v4M12 17h.01"/></svg>
      <span><strong>${missing.length} indicador${missing.length>1?'es':''} sin dato</strong>, equivalente al ${Math.round((1-C.confidence)*100)}% del peso total: ${missing.map(x=>esc(x.m.n).toLowerCase()).join(', ')}. No puntúan cero — quedan fuera del cálculo y el resto se re-pondera. Por eso el score sube o baja cuando se completan.</span>
    </div>` : ''}
  </div>

  <div class="sec-title">Cómo se calcula</div>
  <details class="assump">
    <summary>
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><path d="M4 6h16M4 12h16M4 18h10"/></svg>
      Ver los umbrales y reglas del modelo (los 18 indicadores)
      <svg class="cv" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 9l6 6 6-6"/></svg>
    </summary>
    <div class="ab">
      <div class="tbl-scroll"><table class="tbl">
        <thead><tr><th>Indicador</th><th>Puntaje 0</th><th>Puntaje 100</th></tr></thead>
        <tbody>
          <tr><td>Utilización de bots</td><td class="lbl">0% de los licenciados</td><td class="lbl">70% o más</td></tr>
          <tr><td>Volumen de ejecuciones</td><td class="lbl">0% del esperado</td><td class="lbl">100% del esperado</td></tr>
          <tr><td>Procesos en producción</td><td class="lbl">0% del plan</td><td class="lbl">100% del plan</td></tr>
          <tr><td>Usuarios activos</td><td class="lbl">0% de los licenciados</td><td class="lbl">60% o más</td></tr>
          <tr><td>Frecuencia de uso</td><td class="lbl">0 días de 30</td><td class="lbl">18 días de 30</td></tr>
          <tr><td>Cobertura de la suite</td><td class="lbl">ningún producto</td><td class="lbl">6 productos y 3 capas · capas 60% / productos 40%</td></tr>
          <tr><td>Procesos nuevos (90d)</td><td class="lbl">0 procesos</td><td class="lbl">4 o más · escala 0/45/70/85/100</td></tr>
          <tr><td>Usuarios capacitados</td><td class="lbl">0% de los licenciados</td><td class="lbl">50% o más</td></tr>
          <tr><td>Autonomía del equipo</td><td class="lbl">depende del partner (20)</td><td class="lbl">construye solo (100)</td></tr>
          <tr><td>Horas ahorradas</td><td class="lbl">0% del objetivo</td><td class="lbl">100% del objetivo</td></tr>
          <tr><td>Procesos con valor cuantificado</td><td class="lbl">0% de los productivos</td><td class="lbl">80% o más</td></tr>
          <tr><td>ROI acumulado</td><td class="lbl">0% o negativo</td><td class="lbl">250% anual</td></tr>
          <tr><td>Validación del impacto</td><td class="lbl">sin cifra (0)</td><td class="lbl">auditada por Finanzas (100)</td></tr>
          <tr><td>Tickets abiertos</td><td class="lbl">2 no críticos por bot activo</td><td class="lbl">ninguno · críticos aparte, 0 a 1 cada 4 bots · 65/35</td></tr>
          <tr><td>Tiempo sin actividad</td><td class="lbl">30 días o más</td><td class="lbl">3 días o menos</td></tr>
          <tr><td>Tasa de fallo</td><td class="lbl">12% de las ejecuciones</td><td class="lbl">2% o menos</td></tr>
          <tr><td>Subutilización</td><td class="lbl">10% de la capacidad</td><td class="lbl">60% o más</td></tr>
          <tr><td>Sponsor ejecutivo</td><td class="lbl">no identificado (0)</td><td class="lbl">activo y comprometido (100)</td></tr>
        </tbody>
      </table></div>
      <div class="callout warn" style="margin-top:15px">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><path d="M10.3 3.9L1.8 18a2 2 0 001.7 3h17a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z"/><path d="M12 9v4M12 17h.01"/></svg>
        <span><strong>Qué es y qué no es este score.</strong> Es una forma estructurada de mirar una cuenta, no una predicción de renovación: los umbrales son criterios definidos por nosotros, no correlaciones medidas sobre datos históricos. Sirven para comparar cuentas entre sí bajo la misma vara y para ordenar por dónde empezar. Cuando exista histórico propio de renovaciones, estos cortes deberían recalibrarse contra él.<br><br>
        <strong>Doble conteo deliberado.</strong> La subutilización aparece en Uso de plataforma y otra vez en Riesgo, con 12% del pilar. Es intencional: es a la vez un hecho de uso y la causa más común de recorte en la renovación. Si prefieres eliminarlo, el peso de ese indicador es el único que hay que tocar.<br><br>
        <strong>La escala de riesgo va invertida.</strong> 100 significa ausencia de señales de deterioro. Un pilar de riesgo en 30 indica problemas graves, no ausencia de ellos.</span>
      </div>
    </div>
  </details>

  <div class="no-print" style="display:flex; gap:10px; margin-top:24px; flex-wrap:wrap">
    <div style="flex:1"></div>
    <button class="btn" id="btnSave2">Guardar evaluación</button>
    <button class="btn btn-primary" id="btnPdf2">Exportar PDF</button>
  </div>`;

  const s2 = $('#btnSave2'), p2 = $('#btnPdf2');
  if (s2) s2.addEventListener('click', saveJson);
  if (p2) p2.addEventListener('click', exportPdf);
}

/* ============================================================
   CABLEADO
   ============================================================ */
let renderTimer = null;
function refresh(now){
  clearTimeout(renderTimer);
  const C = computeScore(D);
  renderPanel(C);
  const run = () => { renderReport(C); updatePrintHeader(C); };
  if (now) run(); else renderTimer = setTimeout(run, 160);
}

function updatePrintHeader(C){
  const band = displayBand(C);
  const d = daysToRenewal();
  $('#printHeader').innerHTML = `
    <div style="border-top:2px solid #BC0017; padding-top:8px; margin-top:6px; display:flex; justify-content:space-between; gap:16px; font-size:9.5pt">
      <div><strong>${esc(D.cliente || 'Cliente sin nombre')}</strong> · ${esc(D.industria)}${D.csm?' · '+esc(D.csm):''}</div>
      <div style="color:#48595F; white-space:nowrap">Score ${C.total===null?'—':C.total} · ${esc(band.n)}${d!==null?` · renueva en ${d} días`:''} · evaluación ${isQuick()?'rápida':'completa'} · ${new Date().toLocaleDateString('es-CL')}</div>
    </div>`;
}

function bindMetricInputs(){
  $$('#cardUso [data-k], #cardAdopcion [data-k], #cardValor [data-k], #cardRiesgo [data-k]').forEach(el=>{
    const k = el.dataset.k, t = el.dataset.t;
    el.addEventListener('input', ()=>{
      if (t === 'sel'){ D[k] = el.value; }
      else {
        const raw = el.value.trim();
        D[k] = raw === '' ? null : Math.max(0, parseFloat(raw));
        if (isNaN(D[k])) D[k] = null;
        el.classList.toggle('blank', raw === '');
      }
      // los campos compartidos aparecen en más de un pilar
      $$(`[data-k="${k}"]`).forEach(o=>{ if (o !== el) o.value = el.value; o.classList.toggle('blank', el.value.trim()===''); });
      refresh();
    });
  });

  const chips = $('#suiteChips');
  if (chips) chips.addEventListener('click', e=>{
    const b = e.target.closest('button[data-prod]'); if (!b) return;
    const k = b.dataset.prod;
    D.suite[k] = !D.suite[k]; D.suiteSet = true;
    b.setAttribute('aria-pressed', String(D.suite[k]));
    refresh();
  });

}

function bindContext(){
  [['c_name','cliente'],['c_ind','industria'],['c_plan','plan'],['c_csm','csm'],['c_start','desde'],['c_renew','renueva']]
    .forEach(([id,k])=>{
      const el = $('#'+id); if (!el) return;
      el.addEventListener('input', ()=>{
        D[k] = el.value;
        if (k === 'plan' && el.value !== 'custom'){
          D.licAnual = parseFloat(el.value);
          $$('[data-k="licAnual"]').forEach(li=>{ li.value = D.licAnual; li.classList.remove('blank'); });
        }
        refresh();
      });
    });
}

/* ============================================================
   GUARDAR / CARGAR / EJEMPLO
   ============================================================ */
function syncToForm(){
  Object.keys(D).forEach(k=>{
    if (k === 'suite' || k === 'suiteSet') return;
    $$(`[data-k="${k}"]`).forEach(el=>{
      el.value = (D[k]===null || D[k]===undefined) ? '' : D[k];
      if (el.dataset.t === 'num') el.classList.toggle('blank', el.value === '');
    });
  });
  const ctx = [['c_name','cliente'],['c_ind','industria'],['c_plan','plan'],['c_csm','csm'],['c_start','desde'],['c_renew','renueva']];
  ctx.forEach(([id,k])=>{ const el = $('#'+id); if (el && D[k] !== undefined) el.value = D[k] || ''; });
  $$('#suiteChips [data-prod]').forEach(b=>b.setAttribute('aria-pressed', String(!!D.suite[b.dataset.prod])));
  refresh(true);
}

function saveJson(){
  const payload = { _tool:'rocketbot-health-score', _v:1, _fecha:new Date().toISOString(), datos:D };
  const blob = new Blob([JSON.stringify(payload,null,2)], {type:'application/json'});
  const a = document.createElement('a');
  const slug = (D.cliente||'cuenta').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,40) || 'cuenta';
  a.href = URL.createObjectURL(blob);
  a.download = `health-score-${slug}-${new Date().toISOString().slice(0,10)}.json`;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  setTimeout(()=>URL.revokeObjectURL(a.href), 2000);
}

function loadJson(file){
  const r = new FileReader();
  r.onload = () => {
    try {
      const p = JSON.parse(r.result);
      const src = (p && p.datos) ? p.datos : p;
      if (!src || typeof src !== 'object') throw new Error('formato');
      Object.keys(D).forEach(k=>{
        if (k === 'suite'){
          if (src.suite && typeof src.suite === 'object')
            PRODUCTS.forEach(pr => D.suite[pr.k] = !!src.suite[pr.k]);
        } else if (k in src) D[k] = src[k];
      });
      D.suiteSet = !!src.suiteSet;
      syncToForm();
    } catch(e){
      alert('El archivo no tiene el formato de una evaluación guardada. Usa un archivo generado con el botón Guardar.');
    }
  };
  r.readAsText(file);
}

function clearAll(){
  Object.keys(D).forEach(k=>{
    if (k === 'suite'){ PRODUCTS.forEach(p=>D.suite[p.k]=false); }
    else if (k === 'suiteSet') D.suiteSet = false;
    else if (['cliente','csm','desde','renueva','autonomia','validacion','sponsor'].includes(k)) D[k] = '';
    else if (k === 'industria') D[k] = 'Banca y Servicios Financieros';
    else if (k === 'plan') D[k] = '14990';
    else D[k] = null;
  });
  syncToForm();
}

function loadDemo(){
  Object.assign(D, {
    cliente:'Distribuidora Andes S.A.', industria:'Consumo Masivo (CPG)', plan:'24990',
    csm:'—', desde:'2024-03', renueva:new Date(Date.now()+76*86400000).toISOString().slice(0,10),
    botsAct:7, botsLic:14, ejecMes:8200, ejecEsp:14000, procProd:9, procPlan:15,
    usrAct:11, usrLic:35, diasAct:16,
    procNuevos:1, usrCap:6, autonomia:'mix',
    horasMes:640, horasObj:1100, procMed:3, costoHora:19, licAnual:24990, servAnual:11000, validacion:'ti',
    tickets:9, ticketsCrit:2, diasSin:6, ejecFall:520, sponsor:'changed'
  });
  PRODUCTS.forEach(p=>D.suite[p.k]=false);
  D.suite.rpa = true; D.suite.orq = true; D.suite.saturn = true;
  D.suiteSet = true;
  syncToForm();
  window.scrollTo({ top: 340, behavior: matchMedia('(prefers-reduced-motion:reduce)').matches ? 'auto' : 'smooth' });
}

/* ============================================================
   PDF
   ============================================================ */
function exportPdf(){
  const d = document.querySelector('details.assump');
  const was = d ? d.open : false;
  if (d) d.open = true;
  window.addEventListener('afterprint', function once(){
    if (d) d.open = was;
    window.removeEventListener('afterprint', once);
  });
  setTimeout(()=>window.print(), 140);
}

/* ============================================================
   INIT
   ============================================================ */
function rebuildForm(){ buildForm(); bindMetricInputs(); syncToForm(); }

function init(){
  buildForm();
  bindMetricInputs();
  bindContext();
  $('#modeSeg').addEventListener('click', e=>{
    const b = e.target.closest('button[data-mode]'); if (!b) return;
    MODE = b.dataset.mode;
    $$('#modeSeg button').forEach(x=>x.setAttribute('aria-pressed', String(x===b)));
    $('#modeHint').textContent = isQuick()
      ? 'Lo esencial para barrer una cartera.'
      : 'Los 18 indicadores, para revisiones de cuenta a fondo.';
    rebuildForm();
  });
  $('#btnTheme').addEventListener('click', ()=>{
    const c = document.documentElement.dataset.theme;
    document.documentElement.dataset.theme = c === 'dark' ? 'light' : 'dark';
  });
  $('#btnPdf').addEventListener('click', exportPdf);
  $('#btnSave').addEventListener('click', saveJson);
  $('#btnLoad').addEventListener('click', ()=>$('#fileIn').click());
  $('#fileIn').addEventListener('change', e=>{ if (e.target.files[0]) loadJson(e.target.files[0]); e.target.value=''; });
  $('#btnDemo').addEventListener('click', loadDemo);
  $('#btnClear').addEventListener('click', clearAll);
  window.addEventListener('scroll', ()=>{
    $('#tbScore').classList.toggle('on', window.scrollY > 260);
  }, { passive:true });
  D.licAnual = 14990;
  $$('[data-k="licAnual"]').forEach(li=>{ li.value = 14990; li.classList.remove('blank'); });
  refresh(true);
}
document.addEventListener('DOMContentLoaded', init);

/* ------------------------------------------------------------------
   Puente hacia window. Lo agrega scripts/extraer-motores.mjs porque el
   motor viene de un <script> clásico y el cuerpo lo llama desde onclick.
   Nada de arriba se modificó: esto solo vuelve a exponer lo que el
   ámbito de módulo dejaría privado.
   ------------------------------------------------------------------ */
Object.assign(window, { $, $$, activeMetrics, bandOf, bindContext, bindMetricInputs, buildAlerts, buildForm, calcRoi, chipsHTML, clamp, clearAll, computeScore, dataWarnings, daysToRenewal, displayBand, esc, expansionSignals, exportPdf, fmtN, fmtUSD, gauge, has, init, inputHTML, isQuick, lin, loadDemo, loadJson, pct1, ratio, rebuildForm, refresh, renderPanel, renderReport, renewalRead, saveJson, selScore, syncToForm, updatePrintHeader, wOf });
/* Estado y catálogos que lee el envoltorio para guardar y restaurar. */
Object.assign(window, { D, PILLARS, METRICS, PRODUCTS, BANDS, LAYERS });
