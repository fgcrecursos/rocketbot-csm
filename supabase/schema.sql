-- ==========================================================================
-- Plataforma CSM Rocketbot — estructura de base
-- --------------------------------------------------------------------------
-- Correr entero en el SQL Editor de Supabase. Es idempotente: se puede volver
-- a correr sin romper lo que ya exista.
--
-- Decisión de fondo: el estado crudo de cada herramienta va en un jsonb
-- (`datos`) y no en columnas. Los motores de cálculo son de las herramientas y
-- van a seguir cambiando de forma; congelar su estructura en columnas
-- obligaría a una migración por cada ajuste de una pregunta. Lo que sí se
-- normaliza es `resultado`, que es lo que consultan el panel y los informes
-- entre cuentas, y sobre eso se pueden hacer índices.
-- ==========================================================================

-- ---------- Cuentas ----------
create table if not exists public.csm_cuentas (
  id                  text primary key,
  nombre              text not null,
  industria           text default '',
  pais                text default '',
  empleados           text default '',
  facturacion         text default '',
  erp                 text default '',
  crm                 text default '',
  sucursales          text default '',
  equipo_ti           text default '',
  experiencia_previa  text default '',
  costo_hora          text default '',
  plan                text default '14990',
  csm                 text default '',
  cliente_desde       text default '',
  renovacion          text default '',
  notas               text default '',
  creado              timestamptz not null default now(),
  actualizado         timestamptz not null default now()
);

create index if not exists csm_cuentas_actualizado_idx
  on public.csm_cuentas (actualizado desc);

-- ---------- Evaluaciones ----------
-- Una fila por cuenta y herramienta. El índice único es lo que permite el
-- upsert con onConflict:'cuenta_id,herramienta' que usa el almacén.
create table if not exists public.csm_evaluaciones (
  id            text primary key,
  cuenta_id     text not null references public.csm_cuentas (id) on delete cascade,
  herramienta   text not null check (herramienta in ('health','madurez','oportunidades','roadmap')),
  estado        text not null default 'borrador' check (estado in ('borrador','completa')),
  origen        text not null default 'interno' check (origen in ('interno','cliente')),
  datos         jsonb,
  resultado     jsonb,
  creado        timestamptz not null default now(),
  actualizado   timestamptz not null default now()
);

create unique index if not exists csm_evaluaciones_cuenta_herr_idx
  on public.csm_evaluaciones (cuenta_id, herramienta);

-- Consultas de cartera: "todas las cuentas con Health Score bajo 50".
create index if not exists csm_evaluaciones_resultado_idx
  on public.csm_evaluaciones using gin (resultado);

-- ---------- Invitaciones ----------
-- El link que se le manda al cliente para que complete una evaluación solo.
create table if not exists public.csm_invitaciones (
  token        text primary key,
  cuenta_id    text not null references public.csm_cuentas (id) on delete cascade,
  herramienta  text not null check (herramienta in ('madurez','oportunidades')),
  expira       timestamptz not null,
  completada   boolean not null default false,
  creado       timestamptz not null default now()
);

create index if not exists csm_invitaciones_cuenta_idx
  on public.csm_invitaciones (cuenta_id);

-- ---------- Usuarios permitidos ----------
-- El alta dejó de ser abierta: solo estas direcciones pueden crear cuenta o
-- iniciar sesión en Centro CSM. 'supervisor' además puede leer el estado de
-- las cuentas de 'equipo' (ver csm_estado_equipo() más abajo). Se mantiene a
-- mano acá — no hay pantalla para editarla, un update por SQL alcanza.
create table if not exists public.csm_usuarios_permitidos (
  email  text primary key,
  rol    text not null default 'equipo' check (rol in ('equipo', 'supervisor'))
);

insert into public.csm_usuarios_permitidos (email, rol) values
  ('william.gonzalez@rocketbot.com', 'equipo'),
  ('juliana.gaviria@rocketbot.com', 'equipo'),
  ('sara.martinez@rocketbot.com', 'equipo'),
  ('wladimir.munoz@rocketbot.com', 'equipo'),
  ('cristobal.loyola@rocketbot.com', 'equipo'),
  ('rafael.fuentes@rocketbot.com', 'equipo'),
  ('franco.guinazu@rocketbot.com', 'supervisor'),
  ('rafael@rocketbot.com', 'supervisor')
on conflict (email) do update set rol = excluded.rol;

alter table public.csm_usuarios_permitidos enable row level security;

-- Lectura abierta (incluso a `anon`): login.js consulta esta tabla antes de
-- llamar a signUp/signIn para dar un mensaje claro sin gastar un intento
-- contra Supabase Auth. No hay nada sensible en email+rol de gente del equipo.
drop policy if exists csm_usuarios_permitidos_leer on public.csm_usuarios_permitidos;
create policy csm_usuarios_permitidos_leer on public.csm_usuarios_permitidos
  for select to anon, authenticated using (true);

-- La barrera real: nadie puede insertar en auth.users (ni por signUp ni por
-- ninguna otra vía) si el email no está en la whitelist de arriba. Esto es lo
-- que hace que el chequeo del cliente no sea la única puerta.
create or replace function public.csm_verificar_email_permitido()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.csm_usuarios_permitidos where email = lower(new.email)
  ) then
    raise exception 'Este email no está autorizado a crear una cuenta en Centro CSM.';
  end if;
  return new;
end;
$$;

drop trigger if exists csm_on_auth_user_created_verificar on auth.users;
create trigger csm_on_auth_user_created_verificar
  before insert on auth.users
  for each row execute function public.csm_verificar_email_permitido();

-- ---------- Perfiles del equipo ----------
-- Una fila por cuenta de Supabase Auth. El alta ya no es abierta: solo entra
-- quien esté en csm_usuarios_permitidos (lo bloquea el trigger de arriba). El
-- rol se copia de esa misma tabla para no tener que consultarla de nuevo en
-- cada lectura del perfil.
create table if not exists public.csm_perfiles (
  id      uuid primary key references auth.users (id) on delete cascade,
  nombre  text not null,
  email   text not null,
  puesto  text default '',
  rol     text not null default 'equipo' check (rol in ('equipo', 'supervisor')),
  creado  timestamptz not null default now()
);

alter table public.csm_perfiles add column if not exists rol text not null default 'equipo';
alter table public.csm_perfiles drop constraint if exists csm_perfiles_rol_check;
alter table public.csm_perfiles add constraint csm_perfiles_rol_check check (rol in ('equipo', 'supervisor'));

-- Backfill para perfiles que ya existían antes de esta migración (el caso real:
-- franco.guinazu@rocketbot.com, dado de alta cuando el registro todavía era libre).
update public.csm_perfiles pf
set rol = up.rol
from public.csm_usuarios_permitidos up
where lower(pf.email) = up.email and pf.rol is distinct from up.rol;

alter table public.csm_perfiles enable row level security;

-- Cualquier miembro del equipo puede ver el directorio del equipo (para saber
-- quién es el CSM de una cuenta, por ejemplo), pero solo edita su propia fila.
drop policy if exists csm_perfiles_leer on public.csm_perfiles;
create policy csm_perfiles_leer on public.csm_perfiles
  for select to authenticated using (true);

drop policy if exists csm_perfiles_editar_propio on public.csm_perfiles;
create policy csm_perfiles_editar_propio on public.csm_perfiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- El perfil se crea solo, disparado por el alta en auth.users. `nombre` y
-- `puesto` viajan en los metadatos que manda signUp() desde el cliente; si
-- llegaran vacíos (alta por otra vía), el nombre cae al email para que la
-- fila nunca quede con nombre en blanco.
create or replace function public.csm_crear_perfil()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.csm_perfiles (id, nombre, email, puesto, rol)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data->>'nombre', ''), new.email),
    new.email,
    coalesce(new.raw_user_meta_data->>'puesto', ''),
    coalesce((select rol from public.csm_usuarios_permitidos where email = lower(new.email)), 'equipo')
  );
  return new;
end;
$$;

drop trigger if exists csm_on_auth_user_created on auth.users;
create trigger csm_on_auth_user_created
  after insert on auth.users
  for each row execute function public.csm_crear_perfil();

-- Estado de las cuentas del equipo, para la pantalla de supervisión
-- (equipo.html). Solo responde si quien llama tiene rol 'supervisor' — el
-- chequeo va adentro de la función, no en una política de RLS, porque necesita
-- leer auth.users (email_confirmed_at, last_sign_in_at) y csm_perfiles no
-- alcanza para eso.
create or replace function public.csm_estado_equipo()
returns table (
  email             text,
  nombre            text,
  puesto            text,
  cuenta_creada     boolean,
  email_confirmado  boolean,
  ultimo_ingreso    timestamptz,
  creado            timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1
    from public.csm_usuarios_permitidos up
    join auth.users au on lower(au.email) = up.email
    where au.id = auth.uid() and up.rol = 'supervisor'
  ) then
    raise exception 'No autorizado.';
  end if;

  return query
    select
      up.email,
      pf.nombre,
      pf.puesto,
      (pf.id is not null) as cuenta_creada,
      (au.email_confirmed_at is not null) as email_confirmado,
      au.last_sign_in_at as ultimo_ingreso,
      pf.creado
    from public.csm_usuarios_permitidos up
    left join public.csm_perfiles pf on lower(pf.email) = up.email
    left join auth.users au on lower(au.email) = up.email
    where up.rol = 'equipo'
    order by up.email;
end;
$$;

revoke all on function public.csm_estado_equipo() from public;
grant execute on function public.csm_estado_equipo() to authenticated;

-- ==========================================================================
-- Seguridad
-- --------------------------------------------------------------------------
-- Dos públicos distintos sobre las mismas tablas:
--   · el equipo de Rocketbot, autenticado, ve y edita todo;
--   · el cliente invitado llega con un token en la URL y no está autenticado.
--
-- Al cliente no se le puede dar `select` sobre csm_cuentas ni sobre las
-- evaluaciones de otras cuentas. Por eso el acceso anónimo no pasa por RLS
-- sino por funciones `security definer` que reciben el token, lo validan y
-- devuelven o escriben únicamente lo de esa invitación.
-- ==========================================================================

alter table public.csm_cuentas      enable row level security;
alter table public.csm_evaluaciones enable row level security;
alter table public.csm_invitaciones enable row level security;

-- Equipo Rocketbot: acceso completo con sesión iniciada.
drop policy if exists csm_cuentas_equipo on public.csm_cuentas;
create policy csm_cuentas_equipo on public.csm_cuentas
  for all to authenticated using (true) with check (true);

drop policy if exists csm_evaluaciones_equipo on public.csm_evaluaciones;
create policy csm_evaluaciones_equipo on public.csm_evaluaciones
  for all to authenticated using (true) with check (true);

drop policy if exists csm_invitaciones_equipo on public.csm_invitaciones;
create policy csm_invitaciones_equipo on public.csm_invitaciones
  for all to authenticated using (true) with check (true);

-- Sin políticas para `anon`: el rol anónimo no toca las tablas directamente.

-- ---------- Acceso del cliente invitado ----------

-- Qué se le muestra al abrir el link: el nombre de su empresa y qué se le pide.
-- No devuelve el resto del perfil de la cuenta ni ninguna evaluación ajena.
create or replace function public.csm_invitacion_abrir(p_token text)
returns table (
  cuenta_nombre text,
  industria     text,
  pais          text,
  herramienta   text,
  datos         jsonb,
  completada    boolean
)
language sql
security definer
set search_path = public
as $$
  select c.nombre, c.industria, c.pais, i.herramienta, e.datos, i.completada
  from   csm_invitaciones i
  join   csm_cuentas c on c.id = i.cuenta_id
  left join csm_evaluaciones e
         on e.cuenta_id = i.cuenta_id and e.herramienta = i.herramienta
  where  i.token = p_token
    and  i.expira > now();
$$;

-- Guarda el avance del cliente contra la evaluación de su cuenta.
-- El token es la única credencial y define a qué fila puede escribir.
create or replace function public.csm_invitacion_guardar(
  p_token     text,
  p_datos     jsonb,
  p_resultado jsonb,
  p_estado    text default 'borrador'
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inv csm_invitaciones%rowtype;
begin
  select * into v_inv
  from csm_invitaciones
  where token = p_token and expira > now();

  if not found then
    return false;
  end if;

  if p_estado not in ('borrador','completa') then
    raise exception 'estado inválido: %', p_estado;
  end if;

  insert into csm_evaluaciones (id, cuenta_id, herramienta, estado, origen, datos, resultado)
  values ('e' || replace(gen_random_uuid()::text, '-', ''),
          v_inv.cuenta_id, v_inv.herramienta, p_estado, 'cliente', p_datos, p_resultado)
  on conflict (cuenta_id, herramienta) do update
    set datos       = excluded.datos,
        resultado   = excluded.resultado,
        estado      = excluded.estado,
        origen      = 'cliente',
        actualizado = now();

  if p_estado = 'completa' then
    update csm_invitaciones set completada = true where token = p_token;
  end if;

  return true;
end;
$$;

revoke all on function public.csm_invitacion_abrir(text)                   from public;
revoke all on function public.csm_invitacion_guardar(text, jsonb, jsonb, text) from public;
grant execute on function public.csm_invitacion_abrir(text)                   to anon, authenticated;
grant execute on function public.csm_invitacion_guardar(text, jsonb, jsonb, text) to anon, authenticated;

-- ---------- Mantenimiento de `actualizado` ----------
create or replace function public.csm_touch()
returns trigger language plpgsql as $$
begin
  new.actualizado = now();
  return new;
end;
$$;

drop trigger if exists csm_cuentas_touch on public.csm_cuentas;
create trigger csm_cuentas_touch before update on public.csm_cuentas
  for each row execute function public.csm_touch();

drop trigger if exists csm_evaluaciones_touch on public.csm_evaluaciones;
create trigger csm_evaluaciones_touch before update on public.csm_evaluaciones
  for each row execute function public.csm_touch();
