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

-- ---------- Perfiles del equipo ----------
-- Una fila por cuenta de Supabase Auth. El registro es de auto-alta: cualquiera
-- que llegue a la pantalla de login puede crear la suya con nombre, email y
-- puesto. No hay aprobación de un admin ni restricción de dominio de correo;
-- si más adelante se necesita, es acá donde se agregaría.
create table if not exists public.csm_perfiles (
  id      uuid primary key references auth.users (id) on delete cascade,
  nombre  text not null,
  email   text not null,
  puesto  text default '',
  creado  timestamptz not null default now()
);

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
  insert into public.csm_perfiles (id, nombre, email, puesto)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data->>'nombre', ''), new.email),
    new.email,
    coalesce(new.raw_user_meta_data->>'puesto', '')
  );
  return new;
end;
$$;

drop trigger if exists csm_on_auth_user_created on auth.users;
create trigger csm_on_auth_user_created
  after insert on auth.users
  for each row execute function public.csm_crear_perfil();

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
