"use strict";

/* ==========================================================================
   ROCKETBOT — AI READINESS ASSESSMENT
   6 pilares · scoring determinista · nivel restringido por cuello de botella
   Modo interno: ?modo=interno
   ========================================================================== */

const MODO_INTERNO = new URLSearchParams(location.search).get('modo') === 'interno';

/* --------------------------------------------------------------------------
   1. PILARES Y PREGUNTAS
   Cada opción vale 0 / 33 / 67 / 100. El peso pondera dentro del pilar.
   -------------------------------------------------------------------------- */

const O4 = (a,b,c,d) => [{v:0,l:a},{v:33,l:b},{v:67,l:c},{v:100,l:d}];

const PILARES = [
  {
    id:'procesos', nombre:'Procesos', peso:0.20, color:'var(--rb-red)',
    desc:'La IA se aplica sobre procesos. Si el proceso no está definido, no hay dónde ponerla.',
    preguntas:[
      {id:'pr_doc', peso:1.2, t:'¿Los procesos críticos están documentados?',
       hint:'Documentado significa que alguien nuevo podría ejecutarlo leyendo el documento.',
       o:O4('No, el conocimiento está en las personas','Algunos, con documentación desactualizada','La mayoría, razonablemente al día','Todos, con versionado y responsable')},
      {id:'pr_std', peso:1.1, t:'¿Existen procedimientos estándar que el equipo efectivamente sigue?',
       o:O4('Cada persona lo hace a su manera','Existen en papel, pero no se siguen','Sí, se siguen en general','Sí, y se auditan periódicamente')},
      {id:'pr_manual', peso:1.2, t:'¿Qué proporción del trabajo administrativo se hace manualmente?',
       o:O4('Más del 75%','Entre 50% y 75%','Entre 25% y 50%','Menos del 25%')},
      {id:'pr_correo', peso:1.0, t:'¿Qué tanto dependen del correo electrónico como canal de entrada de solicitudes?',
       hint:'Correos que alguien debe leer, interpretar y derivar a mano.',
       o:O4('Prácticamente todo entra por correo','Mucho, es el canal principal','Algo, conviven correo y sistemas','Poco, hay formularios y sistemas formales')},
      {id:'pr_dueno', peso:0.9, t:'¿Hay dueños de proceso identificados?',
       o:O4('No','De manera informal','Sí, designados','Sí, con indicadores a su cargo')},
      {id:'pr_estab', peso:0.8, t:'¿Con qué frecuencia cambian las reglas de negocio de estos procesos?',
       o:O4('Constantemente','Varias veces al año','Una vez al año','Son estables')}
    ]
  },
  {
    id:'datos', nombre:'Datos', peso:0.22, color:'var(--rb-blue)',
    desc:'Es el pilar que más condiciona el resultado: ningún modelo compensa un dato inconsistente.',
    preguntas:[
      {id:'da_dig', peso:1.1, t:'¿La información operativa está digitalizada?',
       o:O4('Circula bastante papel','Parcialmente, conviven papel y digital','Casi todo digital','Todo digital y estructurado')},
      {id:'da_fuente', peso:1.3, t:'¿Cuál es la fuente de verdad principal del negocio?',
       hint:'Dónde mira la gente cuando necesita el dato correcto.',
       o:O4('Planillas Excel','Excel apoyado en algunos sistemas','Los sistemas transaccionales (ERP, CRM)','Un data warehouse o lakehouse')},
      {id:'da_cons', peso:1.3, t:'¿Los datos maestros son consistentes entre sistemas?',
       hint:'Clientes, proveedores, productos, centros de costo.',
       o:O4('No, cada sistema tiene su versión','Hay diferencias conocidas que se corrigen a mano','Mayormente consistentes','Gobernados centralmente')},
      {id:'da_dup', peso:0.9, t:'¿Existen registros duplicados?',
       o:O4('Sí, es un problema reconocido','Bastantes','Pocos','Se controlan y depuran activamente')},
      {id:'da_pdf', peso:1.2, t:'¿Qué proporción de los documentos de negocio llega en PDF, imagen o cuerpo de correo?',
       hint:'Es decir, en formatos que una persona debe leer para extraer el dato.',
       o:O4('Casi todo','Más de la mitad','Menos de la mitad','Poco, casi todo llega estructurado')},
      {id:'da_resp', peso:0.9, t:'¿Hay alguien responsable de la calidad del dato?',
       o:O4('Nadie en particular','Informalmente, cada área la suya','Sí, un rol asignado','Sí, un equipo de gobierno de datos')}
    ]
  },
  {
    id:'tecnologia', nombre:'Tecnología', peso:0.16, color:'var(--rb-green)',
    desc:'Qué tan conectable es tu entorno actual y cuánta capacidad tiene TI para acompañar.',
    preguntas:[
      {id:'te_erp', peso:1.0, t:'¿Cuál es el ERP principal?',
       o:[{v:0,l:'No usamos ERP'},{v:50,l:'Desarrollo propio o a medida'},{v:67,l:'Regional (Softland, Defontana, Totvs, Nubox u otro)'},{v:100,l:'Tier 1 (SAP, Oracle, Microsoft Dynamics)'}]},
      {id:'te_api', peso:1.3, t:'¿Los sistemas principales exponen APIs documentadas?',
       o:O4('No lo sabemos','No, o solo con desarrollo a medida costoso','Algunos sí','Sí, la mayoría y están documentadas')},
      {id:'te_infra', peso:1.0, t:'¿Cómo está la infraestructura?',
       o:O4('Todo on-premise','Híbrida, con lo crítico on-premise','Mayormente cloud','Cloud, con prácticas modernas de despliegue')},
      {id:'te_plat', peso:0.9, tipo:'multi', t:'¿Qué plataformas usan hoy?',
       hint:'Marca todas las que apliquen.',
       o:[{v:'m365',l:'Microsoft 365'},{v:'gws',l:'Google Workspace'},{v:'azure',l:'Azure'},{v:'aws',l:'AWS'},{v:'gcp',l:'Google Cloud'},{v:'ninguna',l:'Ninguna de estas'}],
       score:(sel)=>{ if(sel.includes('ninguna')||sel.length===0) return 0;
         const prod = sel.filter(s=>s==='m365'||s==='gws').length;
         const cloud = sel.filter(s=>s==='azure'||s==='aws'||s==='gcp').length;
         return Math.min(100, prod*35 + cloud*35); }},
      {id:'te_db', peso:1.0, t:'¿Se puede consultar las bases de datos operativas?',
       o:O4('No, están cerradas','Solo TI, mediante solicitud','Sí, con permisos','Sí, con una capa de acceso definida')},
      {id:'te_cap', peso:1.1, t:'¿Cuánta capacidad tiene TI para proyectos nuevos?',
       o:O4('Ninguna, está apagando incendios','Poca, todo entra en una cola larga','Moderada','Hay equipo con capacidad asignada')}
    ]
  },
  {
    id:'ia', nombre:'IA', peso:0.14, color:'var(--rb-amber)',
    desc:'Qué tanto se usa IA hoy y bajo qué condiciones. Uso alto sin control no es madurez.',
    preguntas:[
      {id:'ia_uso', peso:1.3, t:'¿Se usan asistentes de IA generativa en el trabajo diario?',
       o:O4('No','Sí, por iniciativa individual y sin control','Sí, con licencias corporativas','Sí, integrados dentro de procesos de negocio')},
      {id:'ia_cual', peso:0.6, tipo:'multi', t:'¿Cuáles se usan?',
       hint:'Marca todas las que apliquen. Sirve para entender el entorno, no para puntuar preferencias.',
       o:[{v:'chatgpt',l:'ChatGPT'},{v:'claude',l:'Claude'},{v:'copilot',l:'Microsoft Copilot'},{v:'gemini',l:'Gemini'},{v:'otro',l:'Otro'},{v:'ninguno',l:'Ninguno'}],
       score:(sel)=>{ if(sel.includes('ninguno')||sel.length===0) return 0;
         return Math.min(100, 40 + (sel.filter(s=>s!=='ninguno').length-1)*20); }},
      {id:'ia_pol', peso:1.2, t:'¿Existe una política escrita de uso de IA?',
       hint:'Qué se puede subir a un modelo, qué no, y quién responde si algo sale mal.',
       o:O4('No','Está en elaboración','Sí, publicada','Sí, con controles y capacitación al equipo')},
      {id:'ia_pilot', peso:1.1, t:'¿Han hecho pilotos de IA aplicada a un proceso concreto?',
       o:O4('No','Uno o dos exploratorios','Varios, con resultados dispares','Sí, y algunos ya están en producción')},
      {id:'ia_pres', peso:1.0, t:'¿Hay presupuesto asignado a IA?',
       o:O4('No','Se financia desde otras partidas','Sí, acotado para este año','Sí, línea propia y plurianual')},
      {id:'ia_patr', peso:0.9, t:'¿Quién impulsa el tema internamente?',
       o:O4('Nadie','Un entusiasta individual','Un área concreta','La dirección, con patrocinio explícito')}
    ]
  },
  {
    id:'automatizacion', nombre:'Automatización', peso:0.16, color:'#6E4B9E',
    desc:'La capacidad de ejecutar sin intervención humana. Es el sustrato sobre el que la IA opera.',
    preguntas:[
      {id:'au_prod', peso:1.3, t:'¿Tienen automatizaciones funcionando en producción?',
       o:O4('No','Macros de Excel o scripts sueltos','Sí, con una plataforma de RPA','Sí, RPA más integraciones y flujos')},
      {id:'au_cant', peso:1.1, t:'¿Cuántos procesos están automatizados?',
       o:O4('Ninguno','Entre 1 y 5','Entre 6 y 20','Más de 20')},
      {id:'au_plat', peso:0.7, t:'¿Qué plataforma usan?',
       hint:'Varias plataformas conviviendo puntúa menos que una sola: la fragmentación multiplica el costo de mantener.',
       o:[{v:0,l:'Ninguna'},{v:33,l:'Macros VBA, scripts de Python u otros'},{v:67,l:'Varias plataformas conviviendo'},{v:100,l:'Una plataforma de RPA o automatización'}]},
      {id:'au_mant', peso:1.1, t:'¿Quién mantiene las automatizaciones cuando algo cambia?',
       o:O4('Nadie formalmente','La persona que las construyó','TI, dentro de su carga habitual','Un equipo con esa responsabilidad asignada')},
      {id:'au_coe', peso:1.0, t:'¿Existe un Centro de Excelencia de automatización?',
       o:O4('No','En formación o conversación','Sí, funcionando de manera informal','Sí, formalizado y con metodología')},
      {id:'au_kpi', peso:1.0, t:'¿Se miden los resultados de las automatizaciones?',
       o:O4('No','De manera anecdótica','Sí, se registran horas ahorradas','Sí, con tablero e indicadores de negocio')}
    ]
  },
  {
    id:'gobierno', nombre:'Gobierno', peso:0.12, color:'var(--ink-2)',
    desc:'Lo que determina si la IA puede escalar más allá del piloto sin generar exposición.',
    preguntas:[
      {id:'go_acc', peso:1.2, t:'¿Hay control de accesos por rol en los sistemas críticos?',
       o:O4('No, los accesos se comparten','Parcial, en algunos sistemas','Sí, definido por rol','Sí, con revisión periódica de permisos')},
      {id:'go_aud', peso:1.2, t:'¿Existe trazabilidad de quién hizo qué?',
       o:O4('No','En algunos sistemas','En los sistemas críticos','Completa, con registros centralizados')},
      {id:'go_reg', peso:1.0, tipo:'multi', t:'¿Qué marco regulatorio les aplica en materia de datos personales?',
       hint:'Marca todos los que correspondan. Determina qué controles necesita cualquier iniciativa de IA.',
       o:[{v:'cl',l:'Chile — Ley 21.719 (vigencia plena: 1 de diciembre de 2026)'},
          {v:'mx',l:'México — LFPDPPP'},
          {v:'co',l:'Colombia — Ley 1581'},
          {v:'br',l:'Brasil — LGPD'},
          {v:'eu',l:'GDPR, por operación o clientes en la Unión Europea'},
          {v:'sect',l:'Regulación sectorial (financiera, salud, seguros, sector público)'},
          {v:'nose',l:'No lo tenemos claro'}],
       score:(sel)=>{ if(sel.includes('nose')||sel.length===0) return 0;
         return sel.length >= 2 ? 100 : 67; },
       nota:'Identificar el marco aplicable suma puntaje porque saber qué regulación rige es la condición previa para cumplirla.'},
      {id:'go_cert', peso:0.9, t:'¿Tienen certificaciones o marcos formales de seguridad de la información?',
       o:O4('Ninguno','En proceso de implementación','Sí, uno (ISO 27001 u otro)','Varios, con auditoría externa vigente')},
      {id:'go_riesgo', peso:1.0, t:'¿Existe gestión formal de riesgos?',
       o:O4('No','Informal, sin registro','Sí, con matriz de riesgos','Sí, con comité y seguimiento periódico')},
      {id:'go_cred', peso:1.1, t:'¿Cómo se gestionan las credenciales y contraseñas de sistemas?',
       hint:'Relevante porque cualquier automatización necesita credenciales para operar.',
       o:O4('En planillas o compartidas por mensajería','Cada persona gestiona las suyas','Con un gestor de contraseñas','Con una bóveda corporativa de secretos')}
    ]
  }
];

/* --------------------------------------------------------------------------
   2. NIVELES
   El nivel no es el promedio: está limitado por el pilar más débil de los que
   condicionan esa etapa. Se puede tener tecnología excelente y no pasar de
   nivel 2 si el dato no acompaña.
   -------------------------------------------------------------------------- */

const NIVELES = [
  {n:1, nombre:'Explorador', corto:'Explorador',
   desc:'El trabajo se sostiene en personas, planillas y correo. No hay una base sobre la cual aplicar IA todavía, y ese es el punto de partida honesto: lo primero no es un modelo, es ordenar y ejecutar.'},
  {n:2, nombre:'Experimentador', corto:'Experimentador',
   desc:'Hay curiosidad y uso puntual de herramientas de IA, generalmente por iniciativa de personas más que de la organización. Existen pilotos, pero no un mecanismo que los convierta en operación.'},
  {n:3, nombre:'Automatizador', corto:'Automatizador',
   desc:'La ejecución ya no depende enteramente de personas: hay procesos corriendo solos y sistemas que se hablan. Es la etapa donde incorporar IA deja de ser un experimento y pasa a tener dónde apoyarse.'},
  {n:4, nombre:'AI Driven', corto:'AI Driven',
   desc:'La IA está dentro de procesos productivos, no al costado. Hay orquestación, medición y gobierno suficientes para escalar sin que cada nuevo caso sea una negociación.'},
  {n:5, nombre:'Autonomous Enterprise', corto:'Autonomous',
   desc:'Procesos que operan de extremo a extremo con supervisión por excepción. Los agentes coordinan entre sí, las decisiones se apoyan en datos gobernados y el monitoreo es continuo.'}
];

/* --------------------------------------------------------------------------
   3. ESTADO
   -------------------------------------------------------------------------- */

const state = { paso:0, resp:{}, multi:{}, empresa:{industria:'',pais:'',empleados:''} };
PILARES.forEach(p=>p.preguntas.forEach(q=>{ if(q.tipo==='multi') state.multi[q.id]=[]; else state.resp[q.id]=null; }));

const TOTAL_PASOS = PILARES.length;

/* --------------------------------------------------------------------------
   4. MOTOR
   -------------------------------------------------------------------------- */

const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const round=(v,d=0)=>{const m=Math.pow(10,d);return Math.round(v*m)/m;};

function puntajePregunta(q){
  if(q.tipo === 'multi') return q.score(state.multi[q.id] || []);
  const v = state.resp[q.id];
  return v === null ? null : v;
}

function calcular(){
  const pilares = PILARES.map(p=>{
    let suma=0, pesos=0, respondidas=0;
    const detalle = p.preguntas.map(q=>{
      const v = puntajePregunta(q);
      if(v !== null){ suma += v*q.peso; pesos += q.peso; respondidas++; }
      return {id:q.id, t:q.t, valor:v, peso:q.peso};
    });
    const score = pesos > 0 ? Math.round(suma/pesos) : 0;
    return {id:p.id, nombre:p.nombre, color:p.color, peso:p.peso, score,
            respondidas, total:p.preguntas.length, detalle};
  });

  const map = {}; pilares.forEach(p=>map[p.id]=p.score);

  const global = Math.round(pilares.reduce((s,p)=>s+p.score*p.peso,0));

  // --- Nivel restringido -------------------------------------------------
  const puertas = [
    {n:5, prom:82, req:[['datos',70],['gobierno',70],['automatizacion',70],['ia',70]]},
    {n:4, prom:68, req:[['datos',55],['automatizacion',55],['gobierno',50]]},
    {n:3, prom:52, req:[['automatizacion',45],['procesos',45]]},
    {n:2, prom:34, req:[]}
  ];

  let nivel = 1, bloqueo = null, nivelPotencial = 1;
  for(const g of puertas){
    if(global >= g.prom){
      nivelPotencial = Math.max(nivelPotencial, g.n);
      const fallan = g.req.filter(([k,min])=> map[k] < min);
      if(fallan.length === 0){ nivel = g.n; break; }
      if(!bloqueo) bloqueo = {nivel:g.n, fallan:fallan.map(([k,min])=>({
        pilar:pilares.find(p=>p.id===k).nombre, score:map[k], min}))};
    }
  }
  if(nivel === 1 && global >= 34) nivel = 2;

  const masDebil = [...pilares].sort((a,b)=>a.score-b.score)[0];
  const masFuerte = [...pilares].sort((a,b)=>b.score-a.score)[0];

  return {
    pilares, map, global, nivel, nivelPotencial, bloqueo, masDebil, masFuerte,
    hallazgos: hallazgos(map, state),
    productos: recomendarProductos(map, state, nivel)
  };
}

/* --------------------------------------------------------------------------
   5. HALLAZGOS
   Patrones que solo se ven cruzando pilares. Aparecen únicamente si aplican.
   -------------------------------------------------------------------------- */

function hallazgos(m, s){
  const H = [];

  if(m.ia >= 50 && m.gobierno < 45){
    H.push({tipo:'riesgo', t:'Uso de IA por delante del gobierno',
      p:`El pilar de IA está en ${m.ia} y el de gobierno en ${m.gobierno}. En la práctica significa que hay personas usando herramientas de IA con información de la empresa sin una política que defina qué se puede y qué no. La exposición no viene de la tecnología sino de la ausencia de reglas: no hay registro de qué información salió, ni forma de reconstruirlo después. Cerrar esa brecha es más urgente que ampliar el uso.`});
  }
  if(m.tecnologia >= 65 && m.procesos < 50){
    H.push({tipo:'atencion', t:'Infraestructura sólida sobre procesos poco definidos',
      p:`Tecnología en ${m.tecnologia} frente a procesos en ${m.procesos}. Hay con qué construir, pero falta claridad sobre qué construir. Los proyectos de IA que fracasan en esta situación suelen hacerlo por alcance difuso, no por limitaciones técnicas. Documentar y estabilizar los procesos candidatos rinde más ahora que sumar herramientas.`});
  }
  if(m.datos < 50 && m.datos <= Math.min(m.procesos, m.tecnologia, m.automatizacion)){
    H.push({tipo:'riesgo', t:'El dato es el techo de todo lo demás',
      p:`Con datos en ${m.datos}, cualquier iniciativa de IA va a heredar los problemas de la fuente: inconsistencias entre sistemas, duplicados y documentos que alguien debe interpretar. Ninguna herramienta compensa eso. La buena noticia es que buena parte del trabajo de saneamiento se puede automatizar, y ese suele ser un primer caso de uso más rentable que el que la empresa tenía en mente.`});
  }
  if(m.automatizacion >= 50 && (s.resp.au_coe === 0 || s.resp.au_coe === 33) && (s.resp.au_kpi === 0 || s.resp.au_kpi === 33)){
    H.push({tipo:'atencion', t:'Automatizaciones sin control central',
      p:`Hay automatizaciones funcionando pero sin centro de excelencia ni medición formal. El patrón conocido es que crecen hasta que alguien clave se va o un sistema cambia de interfaz, y entonces nadie sabe qué se rompió ni cuánto costaba. Antes de sumar volumen conviene ordenar ejecución, monitoreo y responsabilidad.`});
  }
  if(s.resp.go_cred === 0){
    H.push({tipo:'riesgo', t:'Credenciales sin gestión formal',
      p:`Las credenciales se comparten en planillas o mensajería. Toda automatización necesita credenciales para operar, así que este punto se vuelve bloqueante en cuanto se pasa del piloto a producción. Es un requisito previo, no una mejora deseable.`});
  }
  if(s.resp.pr_correo === 0 || s.resp.pr_correo === 33){
    H.push({tipo:'info', t:'El correo funciona como sistema de gestión',
      p:`Las solicitudes entran por correo y alguien las lee, interpreta y deriva. Es el punto donde más trabajo manual se acumula y donde menos trazabilidad existe: no hay estado, ni prioridad, ni forma de saber cuánto demora algo. Estructurar la entrada suele liberar más tiempo que automatizar lo que viene después.`});
  }
  if(s.resp.da_pdf === 0 || s.resp.da_pdf === 33){
    H.push({tipo:'info', t:'Documentos que alguien tiene que leer',
      p:`Más de la mitad de los documentos de negocio llegan en PDF, imagen o cuerpo de correo. Ese es exactamente el tipo de tarea donde la IA aplicada aporta más: no reemplaza el criterio, extrae el dato para que el criterio se aplique sobre información ya cargada.`});
  }
  if(m.procesos >= 60 && m.datos >= 60 && m.automatizacion >= 55){
    H.push({tipo:'fortaleza', t:'Base sólida para escalar',
      p:`Procesos, datos y automatización están todos sobre 55. Es una combinación poco frecuente y significa que el siguiente paso no es preparar terreno sino ampliar alcance. El foco debería estar en orquestación, medición y en incorporar IA dentro de procesos que ya funcionan.`});
  }
  if(m.gobierno >= 70 && m.ia < 45){
    H.push({tipo:'fortaleza', t:'Gobierno listo para lo que aún no se usa',
      p:`El gobierno está en ${m.gobierno} pero la adopción de IA en ${m.ia}. Es la situación inversa a la habitual y es cómoda: los controles ya existen, falta el caso de uso. El riesgo aquí es la parálisis, no la exposición.`});
  }
  const otros = [m.procesos, m.datos, m.tecnologia, m.automatizacion];
  const promOtros = otros.reduce((a,b)=>a+b,0)/otros.length;
  if(m.ia < 45 && promOtros - m.ia >= 25){
    H.push({tipo:'info', t:'La IA es el único pilar rezagado',
      p:`Con IA en ${m.ia} frente a un promedio de ${Math.round(promOtros)} en las dimensiones operativas, el rezago no es estructural sino de adopción. Es la posición más favorable para empezar: el terreno ya está preparado y lo que falta es el primer caso concreto, no una transformación previa. Conviene elegir un proceso acotado y medible antes que un programa amplio.`});
  }
  return H;
}

/* --------------------------------------------------------------------------
   6. RECOMENDACIÓN DE PRODUCTOS
   Reglas explícitas sobre los puntajes y las respuestas. Cada producto entra
   por un motivo concreto y en una fase determinada.
   -------------------------------------------------------------------------- */

const CATALOGO = {
  'RPA Studio':{color:'var(--rb-red)', ini:'RS', rol:'Ejecución sobre sistemas existentes',
    hace:['Opera los sistemas que ya usan, incluso los que no tienen API','Sustituye el trabajo de copiar, pegar, descargar y cargar entre plataformas','Ejecuta reglas definidas sin intervención humana']},
  'AI Studio':{color:'var(--rb-blue)', ini:'AS', rol:'Comprensión de documentos y texto',
    hace:['Extrae datos de facturas, contratos, comprobantes y correos','Clasifica y deriva según contenido, no según remitente','Entrega el dato ya estructurado al proceso que lo necesita']},
  'Saturn Studio':{color:'var(--rb-green)', ini:'SS', rol:'Orquestación de flujos e integraciones',
    hace:['Conecta los productos de la suite entre sí y con APIs externas','Incorpora modelos de lenguaje dentro de un flujo controlado','Reemplaza integraciones a medida por flujos mantenibles']},
  'Orquestador':{color:'var(--rb-dark)', ini:'OR', rol:'Control, programación y monitoreo',
    hace:['Programa y coordina la ejecución de las automatizaciones','Centraliza registros de ejecución y trazabilidad','Da visibilidad de qué corrió, cuándo y con qué resultado']},
  'Xperience':{color:'var(--rb-amber)', ini:'XP', rol:'Entrada estructurada de solicitudes',
    hace:['Convierte solicitudes por correo en formularios que disparan automatizaciones','Captura el dato en origen, con los campos que el proceso necesita','Deja registro del estado de cada solicitud desde el inicio']},
  'Nexus':{color:'#6E4B9E', ini:'NX', rol:'Visibilidad ejecutiva',
    hace:['Consolida en un tablero los indicadores de lo que está automatizado','Muestra resultados en términos de negocio, no de robots','Da a la dirección una lectura sin depender de reportes armados a mano']}
};

function recomendarProductos(m, s, nivel){
  const R = [];
  const add = (nombre, fase, prioridad, porque) => {
    if(R.find(r=>r.nombre===nombre)) return;
    R.push({nombre, fase, prioridad, porque, ...CATALOGO[nombre]});
  };

  const pocoAutomatizado = m.automatizacion < 45;
  const muchosDocumentos = s.resp.da_pdf === 0 || s.resp.da_pdf === 33;
  const correoCanal = s.resp.pr_correo === 0 || s.resp.pr_correo === 33;
  const excelFuente = s.resp.da_fuente === 0 || s.resp.da_fuente === 33;
  const sinControl = m.automatizacion >= 40 && (s.resp.au_coe === 0 || s.resp.au_kpi === 0 || s.resp.au_mant === 0 || s.resp.au_mant === 33);
  const conApis = m.tecnologia >= 60;
  const iaSinGobierno = m.ia >= 50 && m.gobierno < 45;

  // Regla 1 — sin ejecución no hay dónde apoyar la IA
  if(pocoAutomatizado){
    add('RPA Studio','Fase 1','alta',
      `Con automatización en ${m.automatizacion}, el trabajo sigue dependiendo de que alguien lo ejecute. Antes de incorporar inteligencia hace falta capacidad de ejecución: es lo que convierte una decisión en una acción sobre los sistemas. Es también el producto que menos depende del estado de tus datos, porque opera sobre las interfaces que tu equipo ya usa.`);
  } else {
    add('RPA Studio','Fase 1','media',
      `Ya hay automatizaciones corriendo (pilar en ${m.automatizacion}). RPA Studio consolida esa base y extiende la cobertura a los sistemas que hoy quedan fuera, especialmente aquellos sin API donde la integración tradicional no es viable.`);
  }

  // Regla 2 — documentos no estructurados
  if(muchosDocumentos){
    add('AI Studio', pocoAutomatizado ? 'Fase 2' : 'Fase 1', 'alta',
      `Más de la mitad de los documentos llegan en PDF, imagen o correo, y con datos en ${m.datos} ese material es hoy trabajo humano puro. Es el caso donde la IA aplicada tiene el retorno más directo y más medible: extraer el dato para que la persona decida en vez de transcribir.`);
  } else if(m.datos < 60){
    add('AI Studio','Fase 2','media',
      `Aunque el volumen documental no es el problema principal, con datos en ${m.datos} hay tareas de interpretación y clasificación que siguen recayendo en personas. AI Studio aporta ahí, aplicado a casos acotados.`);
  }

  // Regla 3 — entrada de solicitudes
  if(correoCanal){
    add('Xperience','Fase 2','alta',
      `Las solicitudes entran por correo y alguien debe leerlas para saber qué hacer. Xperience captura esa entrada como formulario que dispara la automatización directamente, con los campos que el proceso necesita. Es la diferencia entre automatizar la interpretación de un correo y no tener que interpretarlo.`);
  }

  // Regla 4 — control central
  if(sinControl || m.automatizacion >= 55){
    add('Orquestador', m.automatizacion >= 55 ? 'Fase 2' : 'Fase 3', 'alta',
      `Hay automatizaciones en operación sin control central suficiente: falta claridad sobre quién mantiene, qué corrió y con qué resultado. El Orquestador programa la ejecución y centraliza la trazabilidad, que es además lo que exige cualquier marco regulatorio cuando un proceso automatizado toca datos personales.`);
  }

  // Regla 5 — integraciones y LLM en flujo
  if(conApis && m.ia >= 40){
    add('Saturn Studio','Fase 2','alta',
      `Con tecnología en ${m.tecnologia} y adopción de IA en ${m.ia}, ya existe el entorno para conectar sistemas y modelos dentro de un flujo controlado. Saturn Studio es donde el uso de IA deja de ser una ventana aparte y pasa a estar dentro del proceso, con registro de lo que ocurrió.`);
  } else if(conApis){
    add('Saturn Studio','Fase 3','media',
      `Tu entorno tiene APIs y servicios cloud (tecnología en ${m.tecnologia}). Saturn Studio permite aprovechar eso sin construir integraciones a medida que después haya que mantener.`);
  }

  // Regla 6 — visibilidad ejecutiva
  if(excelFuente || (m.automatizacion >= 45 && (s.resp.au_kpi === 0 || s.resp.au_kpi === 33))){
    add('Nexus','Fase 3','media',
      excelFuente
        ? `La fuente de verdad hoy son planillas, lo que significa que cada reporte se arma a mano y cada versión difiere. Nexus entrega la capa de visibilidad sobre lo que está automatizado, sin sustituir tus sistemas ni exigir un data warehouse previo.`
        : `Hay automatizaciones en producción pero los resultados no se miden formalmente. Sin esa lectura, el programa depende de la percepción y es lo primero que se cuestiona en una revisión de presupuesto.`);
  }

  const orden = {'Fase 1':1,'Fase 2':2,'Fase 3':3};
  const pr = {alta:0, media:1};
  R.sort((a,b)=> orden[a.fase]-orden[b.fase] || pr[a.prioridad]-pr[b.prioridad]);

  // El alcance de la recomendación se ajusta al nivel: proponer una cartera
  // amplia a una organización en nivel 1 es la forma más común de que el
  // programa no arranque. Lo que se omite se declara, no se esconde.
  const tope = nivel <= 1 ? 2 : nivel === 2 ? 3 : 4;
  const omitidos = R.slice(tope).map(p=>p.nombre);

  return {items:R.slice(0,tope), omitidos, tope, iaSinGobierno};
}

/* --------------------------------------------------------------------------
   7. RENDER
   -------------------------------------------------------------------------- */

const app = document.getElementById('app');
const stepsEl = document.getElementById('steps');
const progressWrap = document.getElementById('progressWrap');
if(MODO_INTERNO) document.getElementById('modeChip').innerHTML = '<span class="mode-chip">Modo interno</span>';

function renderPasos(){
  if(state.paso === 0 || state.paso > TOTAL_PASOS){ progressWrap.style.display='none'; return; }
  progressWrap.style.display='';
  stepsEl.innerHTML = PILARES.map((p,i)=>{
    const n=i+1, cls = n===state.paso ? 'active' : (n<state.paso ? 'done':'');
    return `<li class="step ${cls}"><span class="step-n">${String(n).padStart(2,'0')}</span>${p.nombre}</li>`;
  }).join('');
}

function renderIntro(){
  app.innerHTML = `
  <div class="panel">
    <div class="intro-hero">
      <span class="eyebrow">Evaluación de preparación para IA</span>
      <h1>Antes de preguntarte qué IA usar, conviene saber sobre qué la vas a aplicar.</h1>
      <p class="lede">Esta evaluación mide seis dimensiones que determinan si una iniciativa de inteligencia artificial
      va a funcionar en tu organización o va a quedarse en piloto. Al terminar obtienes un perfil por pilar,
      un nivel de madurez y qué productos necesitas en qué orden.</p>
    </div>
    <div class="pillar-strip">
      ${PILARES.map((p,i)=>`<div class="pstrip"><div class="n">${String(i+1).padStart(2,'0')}</div><div class="l">${p.nombre}</div></div>`).join('')}
    </div>
    <div class="panel-body">
      <div class="note">
        <strong>Sobre el nivel de madurez.</strong> No es el promedio de los pilares. Está limitado por el más débil
        de los que condicionan cada etapa: se puede tener una infraestructura excelente y no pasar del nivel 2 si el
        dato no acompaña. El informe te dice cuál es ese cuello de botella, que suele ser la información más
        accionable del resultado.
      </div>
      <div class="note" style="border-left-color:var(--rb-amber);background:rgba(186,117,23,.06)">
        <strong>Qué no hace esta evaluación.</strong> No audita tus sistemas ni verifica lo que declaras. Es un
        instrumento de conversación estructurada, no un diagnóstico técnico ni una evaluación de cumplimiento
        normativo. Las respuestas no se envían a ningún servidor.
      </div>
      <div class="nav">
        <span style="font-size:13px;color:var(--ink-3)">36 preguntas · 10 a 12 minutos · sin registro previo</span>
        <button class="btn btn-primary" onclick="ir(1)">Comenzar evaluación →</button>
      </div>
    </div>
  </div>`;
}

function renderPilar(idx){
  const p = PILARES[idx], n = idx+1;
  const siguiente = idx+1 < PILARES.length ? PILARES[idx+1].nombre : null;
  const faltan = p.preguntas.filter(q=>q.tipo!=='multi' && state.resp[q.id]===null).length;

  app.innerHTML = `
  <div class="panel">
    <div class="panel-head">
      <span class="eyebrow">Pilar ${String(n).padStart(2,'0')} de ${String(TOTAL_PASOS).padStart(2,'0')}</span>
      <h2>${p.nombre}</h2>
      <p>${p.desc}</p>
    </div>
    <div class="panel-body">
      ${faltan>0 ? `<div class="warn" id="warn">Quedan ${faltan} preguntas sin responder en este pilar. Las preguntas sin responder no se promedian.</div>` : ''}
      ${p.preguntas.map((q,i)=>renderPregunta(q,i+1)).join('')}
      <div class="nav">
        <button class="btn btn-ghost" onclick="ir(${n-1})">← Volver</button>
        <button class="btn btn-primary" onclick="ir(${n+1})">${siguiente ? 'Continuar a ' + siguiente + ' →' : 'Ver mi perfil →'}</button>
      </div>
    </div>
  </div>`;
}

function renderPregunta(q,i){
  const multi = q.tipo === 'multi';
  const sel = multi ? (state.multi[q.id]||[]) : state.resp[q.id];
  const answered = multi ? sel.length>0 : sel!==null;
  return `
  <div class="q ${answered?'answered':''}" id="q-${q.id}">
    <div class="q-t"><span class="q-n">${String(i).padStart(2,'0')}</span><span>${q.t}</span></div>
    ${q.hint?`<div class="q-hint">${q.hint}</div>`:''}
    <div class="opts ${multi && q.o.length>4 ?'':''}">
      ${q.o.map((o,j)=>{
        const on = multi ? sel.includes(o.v) : sel===o.v && sel!==null;
        return `<label class="opt ${on?'sel':''} ${multi?'multi':''}" data-q="${q.id}" data-v="${o.v}">
          <input type="${multi?'checkbox':'radio'}" name="${q.id}" ${on?'checked':''}
            onchange="${multi?`setMulti('${q.id}','${o.v}',this.checked)`:`setResp('${q.id}',${o.v})`}">
          <span>${o.l}</span></label>`;
      }).join('')}
    </div>
    ${q.nota?`<div class="q-hint" style="margin-top:10px">${q.nota}</div>`:''}
  </div>`;
}

function setResp(id,v){
  state.resp[id]=v;
  const box=document.getElementById('q-'+id);
  box.classList.add('answered');
  box.querySelectorAll('.opt').forEach(l=>l.classList.toggle('sel', Number(l.dataset.v)===v));
}
function setMulti(id,v,on){
  const arr=state.multi[id];
  const excl = ['ninguna','ninguno','nose'];
  if(on){
    if(excl.includes(v)) state.multi[id]=[v];
    else { if(!arr.includes(v)) arr.push(v); state.multi[id]=arr.filter(x=>!excl.includes(x)); }
  } else {
    state.multi[id]=arr.filter(x=>x!==v);
  }
  const box=document.getElementById('q-'+id);
  box.classList.toggle('answered', state.multi[id].length>0);
  box.querySelectorAll('.opt').forEach(l=>{
    const on2 = state.multi[id].includes(l.dataset.v);
    l.classList.toggle('sel', on2);
    l.querySelector('input').checked = on2;
  });
}
function ir(n){ state.paso=n; render(); window.scrollTo({top:0,behavior:'auto'}); }

/* ---------- Radar SVG ---------- */
function radar(pilares){
  const cx=200, cy=190, R=132, N=6;
  const ang = i => (-90 + i*(360/N)) * Math.PI/180;
  const pt = (i,r) => [cx + r*Math.cos(ang(i)), cy + r*Math.sin(ang(i))];

  const anillos = [20,40,60,80,100].map(v=>{
    const pts = Array.from({length:N},(_,i)=>pt(i, R*v/100).map(n=>n.toFixed(1)).join(',')).join(' ');
    return `<polygon points="${pts}" fill="none" stroke="var(--line)" stroke-width="1"/>`;
  }).join('');

  const ejes = Array.from({length:N},(_,i)=>{
    const [x,y]=pt(i,R);
    return `<line x1="${cx}" y1="${cy}" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}" stroke="var(--line)" stroke-width="1"/>`;
  }).join('');

  const forma = pilares.map((p,i)=>pt(i, R*Math.max(p.score,2)/100).map(n=>n.toFixed(1)).join(',')).join(' ');

  const puntos = pilares.map((p,i)=>{
    const [x,y]=pt(i, R*Math.max(p.score,2)/100);
    return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="4.5" fill="${p.color}" stroke="#fff" stroke-width="2"/>`;
  }).join('');

  const labels = pilares.map((p,i)=>{
    const [x,y]=pt(i, R+30);
    const anchor = Math.abs(x-cx)<14 ? 'middle' : (x>cx ? 'start':'end');
    const dy = y<cy-40 ? -2 : (y>cy+40 ? 12 : 4);
    return `<text x="${x.toFixed(1)}" y="${(y+dy).toFixed(1)}" text-anchor="${anchor}"
      font-family="Montserrat" font-size="12.5" font-weight="700" fill="var(--ink)">${p.nombre}</text>
      <text x="${x.toFixed(1)}" y="${(y+dy+15).toFixed(1)}" text-anchor="${anchor}"
      font-family="JetBrains Mono" font-size="12" font-weight="700" fill="${p.color}">${p.score}</text>`;
  }).join('');

  return `<svg viewBox="0 0 400 390" width="100%" style="max-width:400px" role="img"
    aria-label="Gráfico radar con el puntaje de los seis pilares">
    ${anillos}${ejes}
    <polygon points="${forma}" fill="rgba(188,0,23,.13)" stroke="var(--rb-red)" stroke-width="2.5" stroke-linejoin="round"/>
    ${puntos}${labels}
    <text x="${cx}" y="${cy+R+6}" text-anchor="middle" font-family="JetBrains Mono" font-size="9.5" fill="var(--ink-3)">0 · 50 · 100</text>
  </svg>`;
}

/* ---------- Resultados ---------- */
function renderResultados(){
  const R = calcular();
  window.__R = R;
  const nv = NIVELES[R.nivel-1];

  app.innerHTML = `
  <div class="panel">
    <div class="level-hero">
      <div class="level-num">Nivel ${R.nivel} de 5 · Puntaje global ${R.global}/100</div>
      <div class="level-name">${nv.nombre}</div>
      <div class="level-desc">${nv.desc}</div>
      <div class="level-scale">
        ${NIVELES.map(l=>`<div class="lv ${l.n===R.nivel?'on':(l.n<R.nivel?'past':'')}">${l.n}<br>${l.corto}</div>`).join('')}
      </div>
    </div>
    <div class="panel-body">
      <div class="split">
        <div class="radar-wrap">${radar(R.pilares)}</div>
        <div>
          <div class="bars">
            ${R.pilares.map(p=>`
              <div class="bar-row">
                <div class="bar-name">${p.nombre}</div>
                <div class="bar-track"><div class="bar-fill" style="width:${Math.max(p.score,2)}%;background:${p.color}"></div></div>
                <div class="bar-val" style="color:${p.color}">${p.score}</div>
              </div>`).join('')}
          </div>
          ${R.bloqueo ? `
            <div class="gate">
              <strong>Tu promedio alcanza para nivel ${R.bloqueo.nivel}, pero no llegas todavía.</strong>
              ${R.bloqueo.fallan.map(f=>`${f.pilar} está en ${f.score} y ese nivel requiere al menos ${f.min}`).join('; ')}.
              Ese es el cuello de botella: mejorarlo mueve el nivel completo, mientras que reforzar los pilares
              que ya están altos no lo hace.
            </div>` : `
            <div class="gate" style="border-left-color:var(--rb-green);background:rgba(29,158,117,.07)">
              <strong>Perfil equilibrado.</strong> Ningún pilar está frenando al conjunto en este nivel.
              El pilar más bajo es ${R.masDebil.nombre} (${R.masDebil.score}) y el más alto ${R.masFuerte.nombre} (${R.masFuerte.score}).
            </div>`}
        </div>
      </div>
    </div>
  </div>

  ${R.hallazgos.length ? `
  <div class="panel">
    <div class="panel-head">
      <span class="eyebrow">Lectura del perfil</span>
      <h2>Qué dice el cruce entre pilares</h2>
      <p>Estos hallazgos surgen de combinaciones entre dimensiones, no de un puntaje aislado. Solo aparecen los que aplican a tu caso.</p>
    </div>
    <div class="panel-body">
      ${R.hallazgos.map(h=>`
        <div class="finding ${h.tipo}">
          <span class="f-tag">${{riesgo:'Riesgo',atencion:'Punto de atención',fortaleza:'Fortaleza',info:'Observación'}[h.tipo]}</span>
          <h4>${h.t}</h4><p>${h.p}</p>
        </div>`).join('')}
    </div>
  </div>` : ''}

  <div class="panel">
    <div class="panel-head">
      <span class="eyebrow">Recomendación</span>
      <h2>Qué necesitas, y en qué orden</h2>
      <p>Cada producto entra por un motivo concreto derivado de tus respuestas. El orden importa más que la lista: adoptar todo a la vez es la forma más común de que un programa de automatización se estanque.</p>
    </div>
    <div class="panel-body">
      ${R.productos.iaSinGobierno ? `
        <div class="warn">Antes de cualquier producto: con IA en ${R.map.ia} y gobierno en ${R.map.gobierno}, lo primero
        es una política de uso y control de accesos. No es un requisito formal que se pueda dejar para después;
        es lo que determina si el programa puede escalar o queda detenido en la primera revisión de auditoría.</div>` : ''}
      ${R.productos.items.map(p=>`
        <div class="prod">
          <div class="prod-head">
            <div class="prod-badge" style="background:${p.color}">${p.ini}</div>
            <div class="prod-name"><div class="n">${p.nombre}</div><div class="r">${p.rol}</div></div>
            <div class="prod-fase">${p.fase}</div>
          </div>
          <div class="prod-body">
            <div class="why">${p.porque}</div>
            <div class="prod-does"><strong>Qué resuelve</strong>
              <ul>${p.hace.map(h=>`<li>${h}</li>`).join('')}</ul>
            </div>
          </div>
        </div>`).join('')}
      <div class="note">
        ${R.productos.omitidos.length ? `
          <strong>Lo que quedó deliberadamente fuera.</strong> Tus respuestas también activaron
          ${R.productos.omitidos.join(' y ')}, pero en nivel ${R.nivel} incorporarlos ahora dispersa el esfuerzo.
          Entran cuando las fases anteriores estén en operación, no antes.`
        : `<strong>Sobre lo que no aparece en esta lista.</strong> Los productos de la suite que no fueron recomendados
          no son irrelevantes: simplemente no resuelven un problema que hayas declarado hoy. Suelen entrar más
          adelante, cuando las fases anteriores están en operación.`}
      </div>
    </div>
  </div>

  ${MODO_INTERNO ? renderInterno(R) : ''}

  <div class="panel">
    <div class="panel-body">
      <div class="nav no-print">
        <div style="display:flex;gap:10px;flex-wrap:wrap">
          <button class="btn btn-ghost btn-sm" onclick="window.print()">Descargar en PDF</button>
          <button class="btn btn-ghost btn-sm" onclick="exportarJSON()">Exportar datos (JSON)</button>
          <button class="btn btn-ghost btn-sm" onclick="ir(1)">Revisar respuestas</button>
        </div>
        <button class="btn btn-primary" onclick="alert('Conecta este botón a tu formulario, CRM o agenda.')">Conversar el resultado con un especialista</button>
      </div>
      ${renderMetodologia(R)}
      <div class="footer-note">
        <strong>Alcance.</strong> Esta evaluación se construye sobre respuestas declaradas por quien completa el
        cuestionario. No constituye una auditoría de sistemas, una evaluación de cumplimiento normativo ni una
        recomendación legal. Los marcos regulatorios mencionados se incluyen para identificar qué controles necesita
        una iniciativa de IA, y su interpretación corresponde al asesor legal de cada organización.
        Rocketbot · Suite de automatización empresarial.
      </div>
    </div>
  </div>`;
}

function renderMetodologia(R){
  return `
  <details class="method no-print">
    <summary>Cómo se calculó este resultado</summary>
    <div class="method-body">
      <p>El cálculo es determinista: las mismas respuestas producen siempre el mismo perfil. No hay contenido generado al vuelo ni comparación contra bases de datos externas.</p>

      <h5>Puntaje de cada pilar</h5>
      <p>Cada opción vale 0, 33, 67 o 100. El pilar es el promedio ponderado de sus preguntas: <code>Σ(valor × peso) ÷ Σ(peso)</code>. Las preguntas sin responder se excluyen del promedio en lugar de contar como cero.</p>

      <h5>Puntaje global y peso de cada pilar</h5>
      <table class="mtable">
        <thead><tr><th>Pilar</th><th>Peso</th><th>Puntaje</th></tr></thead>
        <tbody>${R.pilares.map(p=>`<tr><td>${p.nombre}</td><td class="num">${Math.round(p.peso*100)}%</td><td class="num">${p.score}</td></tr>`).join('')}
        <tr><td><strong>Global</strong></td><td class="num">100%</td><td class="num"><strong>${R.global}</strong></td></tr></tbody>
      </table>
      <p style="margin-top:8px">Datos pesa más que el resto porque es el pilar que más condiciona el resultado de cualquier iniciativa de IA. Gobierno pesa menos en el promedio, pero actúa como restricción de nivel, que es una forma más fuerte de influir.</p>

      <h5>Determinación del nivel</h5>
      <p>El nivel no es el promedio. Cada nivel exige un puntaje global mínimo <em>y además</em> pisos en pilares específicos:</p>
      <table class="mtable">
        <thead><tr><th>Nivel</th><th>Global mín.</th><th>Pisos por pilar</th></tr></thead>
        <tbody>
          <tr><td>5 · Autonomous Enterprise</td><td class="num">82</td><td>Datos, Gobierno, Automatización e IA ≥ 70</td></tr>
          <tr><td>4 · AI Driven</td><td class="num">68</td><td>Datos y Automatización ≥ 55 · Gobierno ≥ 50</td></tr>
          <tr><td>3 · Automatizador</td><td class="num">52</td><td>Automatización y Procesos ≥ 45</td></tr>
          <tr><td>2 · Experimentador</td><td class="num">34</td><td>Sin pisos adicionales</td></tr>
          <tr><td>1 · Explorador</td><td class="num">—</td><td>Punto de partida</td></tr>
        </tbody>
      </table>
      <p style="margin-top:8px">Es deliberado: una empresa con tecnología en 91 y datos en 40 no está preparada para IA, por mucho que el promedio sugiera lo contrario. El modelo prefiere señalar el cuello de botella antes que suavizarlo con un promedio.</p>

      <h5>Recomendación de productos</h5>
      <p>Se aplican reglas explícitas sobre los puntajes y sobre respuestas concretas. Por ejemplo: si más de la mitad de los documentos llega en PDF o correo, entra AI Studio; si las solicitudes llegan por correo, entra Xperience; si hay automatizaciones sin centro de excelencia ni medición, entra Orquestador. Un producto solo aparece si alguna regla lo activa.</p>

      <h5>Lo que este instrumento no hace</h5>
      <ul>
        <li>No verifica ni audita lo que se declara.</li>
        <li>No compara contra promedios de industria: no existe una base pública confiable para ese contraste en la región.</li>
        <li>No evalúa cumplimiento normativo ni sustituye asesoría legal.</li>
        <li>No estima costos, plazos ni retorno. Eso requiere un levantamiento sobre procesos concretos.</li>
      </ul>
    </div>
  </details>`;
}

/* ---------- Bloque interno ---------- */
function renderInterno(R){
  const m = R.map, s = state;
  const señales = [];

  const plat = s.resp.au_plat;
  if(plat === 100) señales.push('Ya opera con una plataforma de automatización. La conversación es de reemplazo o coexistencia. Preguntar cuál, cuántos procesos, costo anual de licencias y fecha de renovación antes de posicionar nada.');
  if(plat === 33) señales.push('Macros y scripts internos: hay dolor reconocido y alguien técnico con quien aliarse. Suele acortar el ciclo. Buen momento para la comparación construir versus comprar.');
  if(plat === 0) señales.push('Sin plataforma: el ciclo incluye educación de mercado. Considerar una prueba de concepto como paso previo obligado.');

  if(m.ia >= 50 && m.gobierno < 45) señales.push('Uso de IA sin gobierno. Es el ángulo de entrada más fuerte: el interlocutor natural pasa a ser quien responde por riesgo o cumplimiento, no solo el área de operaciones.');
  if(s.resp.te_cap === 0 || s.resp.te_cap === 33) señales.push('TI sin capacidad disponible. Usarlo como argumento, no como obstáculo: la automatización descarga a TI en vez de sumarle cola de trabajo.');
  if(s.resp.te_api === 0) señales.push('No saben si sus sistemas tienen API. Refuerza el caso de RPA sobre integración tradicional, y anticipa que el levantamiento técnico va a tomar más tiempo del previsto.');
  if(s.resp.te_erp === 100) señales.push('ERP tier 1. Integración vía API existe pero suele ser cara y lenta de aprobar internamente. RPA es habitualmente el camino pragmático.');
  if(s.resp.te_erp === 0) señales.push('Sin ERP. Validar el volumen real de transacciones antes de dimensionar cualquier propuesta.');
  if(s.resp.ia_pres === 0) señales.push('Sin presupuesto de IA asignado. Verificar de qué partida saldría la inversión antes de invertir tiempo en una propuesta formal.');
  if(s.resp.ia_patr === 100) señales.push('Patrocinio de dirección. Ciclo potencialmente más corto. Confirmar quién es y si participa en la próxima reunión.');
  if(s.resp.go_cred === 0) señales.push('Credenciales compartidas en planillas. Es un bloqueante técnico real para producción, no un detalle. Anticiparlo evita que aparezca como sorpresa en la implementación.');

  const regs = state.multi.go_reg || [];
  if(regs.includes('cl')) señales.push('Sujeto a Ley 21.719 en Chile, con vigencia plena el 1 de diciembre de 2026. Es un plazo concreto que ordena la conversación de trazabilidad y control de accesos.');
  if(regs.includes('nose')) señales.push('No tienen claro qué regulación les aplica. Oportunidad de aportar valor en la conversación, pero sin emitir opinión legal.');
  if(regs.includes('sect')) señales.push('Regulación sectorial. Esperar un proceso de evaluación de proveedor más largo y con requisitos de seguridad formales.');

  return `
  <div class="internal no-print">
    <span class="internal-tag">Solo uso interno · no compartir con el cliente</span>
    <h3>Notas comerciales</h3>

    <h4>Lectura rápida</h4>
    <table class="mtable">
      <tr><th>Nivel</th><td>${R.nivel} — ${NIVELES[R.nivel-1].nombre}${R.bloqueo?` (frenado desde nivel ${R.bloqueo.nivel})`:''}</td></tr>
      <tr><th>Global</th><td class="num">${R.global}</td></tr>
      <tr><th>Pilar más débil</th><td>${R.masDebil.nombre} (${R.masDebil.score}) — es el ángulo de la conversación</td></tr>
      <tr><th>Pilar más fuerte</th><td>${R.masFuerte.nombre} (${R.masFuerte.score}) — reconocerlo antes de señalar brechas</td></tr>
      <tr><th>Productos sugeridos</th><td>${R.productos.items.map(p=>p.nombre).join(' · ')}</td></tr>
    </table>

    ${señales.length ? `<h4>Señales de calificación</h4><ul>${señales.map(x=>`<li>${x}</li>`).join('')}</ul>`:''}

    <h4>Cómo abrir la conversación</h4>
    <ul>
      <li>Partir por el pilar más fuerte. El informe señala brechas y nadie recibe bien una lista de defectos sin reconocimiento previo.</li>
      <li>El cuello de botella es el argumento, no la lista de productos. Si el nivel está frenado por un pilar, ese pilar ordena toda la propuesta.</li>
      <li>Las fases son secuencia, no menú. Vender las tres a la vez es la forma más rápida de que el proyecto se estanque en la fase uno.</li>
      <li>Si el nivel es 1 o 2, la venta razonable es una prueba de concepto. Proponer un programa completo a esa altura suele terminar en un ciclo largo sin cierre.</li>
    </ul>

    <div class="guardrail">
      <strong>Restricciones que aplican a este material.</strong>
      Las preguntas sobre marcos regulatorios evalúan la situación del cliente, no la de Rocketbot. Si el cliente
      pregunta por certificaciones propias, la única afirmación autorizada es ISO 27001 a nivel de suite. No afirmar
      SOC 2, no afirmar cumplimiento GDPR, y no ofrecer interpretación legal de la Ley 21.719 ni de ninguna otra
      norma: derivar a su asesor legal. Para reconocimiento de terceros, usar únicamente Gartner Peer Insights
      «Voice of the Customer». Ningún puntaje de este informe debe presentarse como una medición verificada.
    </div>

    <h4>Detalle de respuestas</h4>
    <table class="mtable">
      <thead><tr><th>Pilar</th><th>Pregunta</th><th>Valor</th><th>Peso</th></tr></thead>
      <tbody>${R.pilares.map(p=>p.detalle.map(d=>`<tr>
        <td>${p.nombre}</td><td>${d.t}</td>
        <td class="num">${d.valor===null?'—':d.valor}</td><td class="num">${d.peso}</td></tr>`).join('')).join('')}</tbody>
    </table>
  </div>`;
}

/* ---------- Export ---------- */
function exportarJSON(){
  const R = window.__R || calcular();
  const payload = {
    generado:new Date().toISOString(),
    herramienta:'AI Readiness Assessment',
    resultado:{
      nivel:R.nivel, nivelNombre:NIVELES[R.nivel-1].nombre,
      puntajeGlobal:R.global,
      nivelPotencialPorPromedio:R.nivelPotencial,
      cuelloDeBotella:R.bloqueo ? R.bloqueo.fallan.map(f=>({pilar:f.pilar,score:f.score,minimoRequerido:f.min})) : null
    },
    pilares:R.pilares.map(p=>({pilar:p.nombre, score:p.score, peso:p.peso, respondidas:p.respondidas, total:p.total})),
    hallazgos:R.hallazgos.map(h=>({tipo:h.tipo, titulo:h.t})),
    productosRecomendados:R.productos.items.map(p=>({producto:p.nombre, fase:p.fase, prioridad:p.prioridad, rol:p.rol})),
    respuestas:{...state.resp, ...state.multi},
    nota:'Autodeclarado por el usuario. No constituye auditoría, evaluación de cumplimiento ni asesoría legal.'
  };
  const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'});
  const url=URL.createObjectURL(blob), a=document.createElement('a');
  a.href=url; a.download=`ai-readiness-${new Date().toISOString().slice(0,10)}.json`;
  document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
}

function render(){
  renderPasos();
  if(state.paso===0) return renderIntro();
  if(state.paso>=1 && state.paso<=TOTAL_PASOS) return renderPilar(state.paso-1);
  return renderResultados();
}
render();

/* ------------------------------------------------------------------
   Puente hacia window. Lo agrega scripts/extraer-motores.mjs porque el
   motor viene de un <script> clásico y el cuerpo lo llama desde onclick.
   Nada de arriba se modificó: esto solo vuelve a exponer lo que el
   ámbito de módulo dejaría privado.
   ------------------------------------------------------------------ */
Object.assign(window, { O4, calcular, clamp, exportarJSON, hallazgos, ir, puntajePregunta, radar, recomendarProductos, render, renderInterno, renderIntro, renderMetodologia, renderPasos, renderPilar, renderPregunta, renderResultados, round, setMulti, setResp });
/* Estado y catálogos que lee el envoltorio para guardar y restaurar. */
Object.assign(window, { state, PILARES, NIVELES });
