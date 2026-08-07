# Centro CSM — Rocketbot

Plataforma interna de Customer Success. Reúne las cuatro herramientas de
diagnóstico que antes eran archivos HTML sueltos, con una cartera de cuentas
compartida y un enlace para que el cliente complete lo suyo.

```bash
npm install
npm run dev      # http://localhost:5187
```

## Las herramientas

| # | Herramienta | Qué responde | Enlace al cliente |
|---|---|---|---|
| 01 | Customer Automation Health Score | Qué tan saludable está la cuenta, de 0 a 100 | no |
| 02 | AI Readiness Assessment | Si una iniciativa de IA va a funcionar en esa organización | sí |
| 03 | Automation Opportunity Finder | Qué procesos conviene automatizar primero | sí |
| 04 | Roadmap de Automatización | En qué orden se hacen y cómo se presentan | no |

## Cómo está armado

Los cuatro motores de cálculo vienen de los HTML originales y **no se
modifican**. `scripts/extraer-motores.mjs` los separa en CSS, cuerpo y
JavaScript, y les agrega al final un puente que vuelve a exponer en `window` lo
que el ámbito de módulo dejaría privado. Alrededor de eso:

```
index.html            cartera de cuentas
health · madurez · oportunidades · roadmap    una página por herramienta
login.html             login / auto-registro del equipo (solo existe en modo Supabase)
confirmado.html        a dónde vuelve el link del email de confirmación
publico.html          lo que ve el cliente invitado

src/lib/modelo.js      catálogos canónicos, forma de una cuenta, puentes por herramienta
src/lib/almacen.js     una interfaz, dos respaldos (localStorage / Supabase)
src/lib/auth.js        sesión del equipo (Supabase Auth); no hace nada en modo local
src/lib/shell.js       barra lateral, barra superior, cuenta activa, tema, guardia de sesión
src/lib/puente-motor.js  enganches para enterarse de que el motor cambió algo
src/styles/tokens.css  única fuente de color y tipografía
src/styles/parches.css ajustes de las herramientas heredadas, agrupados por motivo
supabase/schema.sql    tablas, RLS, perfiles del equipo y las funciones del acceso por token
```

Los scripts de `scripts/` se corrieron una vez para arrancar. Lo que generaron
ya es la fuente y se edita a mano; volver a correrlos pisa los ajustes
posteriores.

### Lo que comparten las herramientas

Una cuenta guarda un solo perfil —industria, país, tamaño, ERP, CRM, costo
hora, plan, renovación— y las cuatro leen de ahí. Cargar la industria en
cualquiera de ellas la deja disponible en las otras tres.

El nombre de la cuenta viaja en un solo sentido, de la cuenta a la herramienta.
Health Score y Roadmap tienen un campo de texto libre para el cliente, y si ese
campo escribiera de vuelta, corregir una tilde ahí renombraría la cuenta real.

Además, el Roadmap importa con un botón los procesos que ya relevó el
Opportunity Finder, con su volumetría; quedan pendientes de calificar impacto y
complejidad, que es lo único que el Finder no mide.

## Base de datos

Sin credenciales, todo se guarda en `localStorage` y la plataforma funciona
completa salvo por una cosa: **el enlace al cliente solo existe en ese
navegador**, así que todavía no sirve para mandárselo a nadie.

Para conectar Supabase:

1. Correr `supabase/schema.sql` en el SQL Editor.
2. Copiar `.env.example` a `.env` y completar las dos variables.
3. Reiniciar el dev server.

No hay que tocar código: `src/lib/almacen.js` elige el respaldo según haya o no
credenciales. Para probar en local con Supabase ya configurado,
`localStorage.setItem('rbcsm.forzarLocal','1')`.

### Login del equipo

En modo Supabase, `index.html`/`health.html`/etc. exigen sesión: sin ella
redirigen a `login.html`. El alta es de **auto-registro** — cualquiera que
llegue a esa pantalla puede crear su cuenta con nombre, email, puesto y
contraseña, sin aprobación de un admin ni restricción de dominio de correo. Es
la política que se acordó al conectar la base: prioriza que el equipo se sume
solo por sobre cerrar el acceso.

El perfil (`csm_perfiles`) se puebla solo: un trigger en `auth.users` copia
`nombre`/`puesto` de los metadatos que manda `signUp()`. Ver el motivo completo
en el comentario de `csm_crear_perfil()` en `schema.sql`.

La vista pública (`publico.html`) no pasa por esta guardia — el cliente
invitado nunca ve la pantalla de login del equipo.

### Confirmación de email

`registrarse()` manda `emailRedirectTo: location.origin + '/confirmado.html'`,
así que el link del correo vuelve a un origen u otro según desde dónde se haya
registrado la persona (local o producción) sin hardcodear ninguno de los dos.

Para que Supabase acepte ese redirect hay que tenerlo cargado en
**Authentication → URL Configuration → Redirect URLs** del proyecto — si no
está en esa lista, Supabase lo ignora en silencio y cae al Site URL en su
lugar, sin avisar de ningún error. Hoy están cargadas:

```
https://rocketbot-csm.vercel.app/confirmado.html
http://localhost:5187/confirmado.html
```

`confirmado.html` cubre los dos formatos con los que Supabase puede volver
—hash implícito (`#access_token=...`, el que usa este proyecto por default,
sesión creada sola por `detectSessionInUrl`) o PKCE (`?code=...`, canjeado a
mano con `exchangeCodeForSession`)— y también el caso de link vencido o ya
usado, que llega como `error_description` en la URL en vez de una sesión.

### Acceso del cliente invitado

El cliente no está autenticado y las tablas tienen RLS sin política para `anon`.
Su único acceso son dos funciones `security definer` que reciben el token, lo
validan del lado del servidor y tocan nada más que la evaluación de esa
invitación: `csm_invitacion_abrir` y `csm_invitacion_guardar`.

## Despliegue

Vercel se conectó solo al repo de GitHub y arma un proyecto (`rocketbot-csm`,
https://rocketbot-csm.vercel.app) apenas hay un push a `main`. **El build no
hereda `.env`** — Vite lo lee en build time y `.env` está en `.gitignore`, así
que sin este paso el sitio compila en modo local: nadie ve el login, y cada
visitante escribe en el localStorage de su propio navegador sin saberlo. Pasó
una vez (2026-08-07) y así se detectó.

Después de correr `supabase/schema.sql`, cargar las mismas dos variables de
`.env` en Vercel:

```bash
vercel link --yes --project rocketbot-csm
printf '<url>' | vercel env add VITE_SUPABASE_URL production
printf '<anon key>' | vercel env add VITE_SUPABASE_ANON_KEY production
vercel --prod --yes   # las env vars nuevas no aplican a un build ya hecho
```

Confirmar que prendió mirando el bundle servido, no solo la consola de Vercel
—`vercel env ls` puede mostrar la variable cargada y aun así el deploy vigente
ser uno anterior sin ella—:

```bash
curl -s https://rocketbot-csm.vercel.app/ | grep -o '/assets/almacen-[^"]*\.js'
curl -s https://rocketbot-csm.vercel.app/assets/almacen-XXXX.js | grep -o 'https://[a-z0-9]*\.supabase\.co'
```

## Notas de diseño

Los tokens de color salen del sitio rocketbot.com, no de los prototipos: los
cuatro archivos originales traían tres paletas distintas y el rojo cambiaba de
valor entre ellos. El logo es el archivo real del sitio, no la letra dibujada
que usaban los prototipos.

Cada accent de marca existe en dos variantes porque cumple dos papeles con
exigencias opuestas: `--rb-blue` como relleno y `--rb-blue-txt` como texto. El
detalle está comentado en `tokens.css`. Las herramientas heredadas no se
reescribieron: `parches.css` redefine las variables sobre los elementos que las
usan, lo que alcanza incluso cuando el color viene de un estilo en línea que
escribe el motor.

Ambos temas pasan el contraste mínimo AA (4.5:1 para texto normal, 3:1 para
texto grande) en las seis páginas, con y sin datos cargados.
