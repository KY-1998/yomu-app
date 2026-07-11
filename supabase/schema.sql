-- ============================================================
-- yomu-app: Supabase スキーマ定義
-- 4カテゴリ（顔・景色・天気・ご飯）の1日1投稿SNS
-- 相互主義: 自分が今日投稿しないと友達の投稿は見れない
-- ============================================================

-- ---------- 拡張 ----------
create extension if not exists "pgcrypto";

-- ---------- ENUM 型 ----------
do $$ begin
  create type friendship_status as enum ('pending', 'accepted');
exception when duplicate_object then null; end $$;

do $$ begin
  create type post_category as enum ('face', 'scene', 'weather', 'food');
exception when duplicate_object then null; end $$;

-- ============================================================
-- テーブル定義
-- ============================================================

-- profiles: ユーザープロフィール（auth.users と 1:1）
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  username    text unique not null check (username ~ '^[a-z0-9_]{3,20}$'),
  display_name text not null default '',
  avatar_url  text,
  bio         text default '',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- friendships: 友達関係
-- user_a < user_b の正規化で重複ペアを防ぐ（申請方向は requested_by で保持）
create table if not exists public.friendships (
  id           uuid primary key default gen_random_uuid(),
  user_a       uuid not null references public.profiles(id) on delete cascade,
  user_b       uuid not null references public.profiles(id) on delete cascade,
  requested_by uuid not null references public.profiles(id) on delete cascade,
  status       friendship_status not null default 'pending',
  created_at   timestamptz not null default now(),
  accepted_at  timestamptz,
  constraint friendships_order check (user_a < user_b),
  constraint friendships_requester check (requested_by in (user_a, user_b)),
  unique (user_a, user_b)
);

-- posts: 1日1投稿（JST基準の post_date でユニーク）
create table if not exists public.posts (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  post_date  date not null default ((now() at time zone 'Asia/Tokyo')::date),
  note       text default '' check (char_length(note) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, post_date)  -- 1日1回の制約
);

-- post_items: カテゴリ別の写真（1投稿につき各カテゴリ最大1枚 = 部分投稿OK）
create table if not exists public.post_items (
  id         uuid primary key default gen_random_uuid(),
  post_id    uuid not null references public.posts(id) on delete cascade,
  category   post_category not null,
  image_url  text not null,
  caption    text default '' check (char_length(caption) <= 140),
  created_at timestamptz not null default now(),
  unique (post_id, category)
);

-- reactions: 絵文字リアクション
create table if not exists public.reactions (
  id         uuid primary key default gen_random_uuid(),
  post_id    uuid not null references public.posts(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  emoji      text not null check (char_length(emoji) <= 8),
  created_at timestamptz not null default now(),
  unique (post_id, user_id, emoji)  -- 同じ絵文字は1人1回
);

-- invites: 招待コード
create table if not exists public.invites (
  id         uuid primary key default gen_random_uuid(),
  code       text unique not null default encode(gen_random_bytes(6), 'hex'),
  created_by uuid not null references public.profiles(id) on delete cascade,
  used_by    uuid references public.profiles(id) on delete set null,
  used_at    timestamptz,
  expires_at timestamptz not null default (now() + interval '7 days'),
  created_at timestamptz not null default now()
);

-- ---------- インデックス ----------
create index if not exists idx_friendships_user_a on public.friendships(user_a) where status = 'accepted';
create index if not exists idx_friendships_user_b on public.friendships(user_b) where status = 'accepted';
create index if not exists idx_posts_user_date on public.posts(user_id, post_date desc);
create index if not exists idx_post_items_post on public.post_items(post_id);
create index if not exists idx_reactions_post on public.reactions(post_id);

-- ============================================================
-- ヘルパー関数（RLSで使用 / security definer で再帰RLSを回避）
-- ============================================================

-- 今日（JST）の日付
create or replace function public.jst_today()
returns date
language sql stable
as $$
  select (now() at time zone 'Asia/Tokyo')::date;
$$;

-- 2人が「友達（accepted）」かどうか
create or replace function public.is_friend(uid_1 uuid, uid_2 uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.friendships f
    where f.status = 'accepted'
      and f.user_a = least(uid_1, uid_2)
      and f.user_b = greatest(uid_1, uid_2)
  );
$$;

-- 相互主義の核: 自分が「今日（JST）」に post_items を1つ以上持つ投稿を済ませているか
create or replace function public.has_posted_today(uid uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1
    from public.posts p
    join public.post_items pi on pi.post_id = p.id
    where p.user_id = uid
      and p.post_date = public.jst_today()
  );
$$;

-- ============================================================
-- RLS（Row Level Security）
-- ============================================================

alter table public.profiles    enable row level security;
alter table public.friendships enable row level security;
alter table public.posts       enable row level security;
alter table public.post_items  enable row level security;
alter table public.reactions   enable row level security;
alter table public.invites     enable row level security;

-- ---------- profiles ----------
create policy "profiles_select" on public.profiles
  for select using (
    id = auth.uid() or public.is_friend(auth.uid(), id)
  );

create policy "profiles_insert_own" on public.profiles
  for insert with check (id = auth.uid());

create policy "profiles_update_own" on public.profiles
  for update using (id = auth.uid());

-- ---------- friendships ----------
create policy "friendships_select_own" on public.friendships
  for select using (auth.uid() in (user_a, user_b));

create policy "friendships_insert" on public.friendships
  for insert with check (
    requested_by = auth.uid() and auth.uid() in (user_a, user_b)
  );

create policy "friendships_update_receiver" on public.friendships
  for update using (
    auth.uid() in (user_a, user_b) and requested_by <> auth.uid()
  );

create policy "friendships_delete" on public.friendships
  for delete using (auth.uid() in (user_a, user_b));

-- ---------- posts ----------
create policy "posts_select_reciprocal" on public.posts
  for select using (
    user_id = auth.uid()
    or (
      public.is_friend(auth.uid(), user_id)
      and public.has_posted_today(auth.uid())
    )
  );

create policy "posts_insert_own" on public.posts
  for insert with check (
    user_id = auth.uid()
    and post_date = public.jst_today()
  );

create policy "posts_update_own" on public.posts
  for update using (user_id = auth.uid());

create policy "posts_delete_own" on public.posts
  for delete using (user_id = auth.uid());

-- ---------- post_items ----------
create policy "post_items_select" on public.post_items
  for select using (
    exists (
      select 1 from public.posts p
      where p.id = post_id
        and (
          p.user_id = auth.uid()
          or (
            public.is_friend(auth.uid(), p.user_id)
            and public.has_posted_today(auth.uid())
          )
        )
    )
  );

create policy "post_items_insert_own" on public.post_items
  for insert with check (
    exists (select 1 from public.posts p where p.id = post_id and p.user_id = auth.uid())
  );

create policy "post_items_update_own" on public.post_items
  for update using (
    exists (select 1 from public.posts p where p.id = post_id and p.user_id = auth.uid())
  );

create policy "post_items_delete_own" on public.post_items
  for delete using (
    exists (select 1 from public.posts p where p.id = post_id and p.user_id = auth.uid())
  );

-- ---------- reactions ----------
create policy "reactions_select" on public.reactions
  for select using (
    exists (
      select 1 from public.posts p
      where p.id = post_id
        and (
          p.user_id = auth.uid()
          or (public.is_friend(auth.uid(), p.user_id) and public.has_posted_today(auth.uid()))
        )
    )
  );

create policy "reactions_insert" on public.reactions
  for insert with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.posts p
      where p.id = post_id
        and (
          p.user_id = auth.uid()
          or (public.is_friend(auth.uid(), p.user_id) and public.has_posted_today(auth.uid()))
        )
    )
  );

create policy "reactions_delete_own" on public.reactions
  for delete using (user_id = auth.uid());

-- ---------- invites ----------
create policy "invites_select_own" on public.invites
  for select using (created_by = auth.uid() or used_by = auth.uid());

create policy "invites_insert_own" on public.invites
  for insert with check (created_by = auth.uid());

create or replace function public.redeem_invite(invite_code text)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  inviter uuid;
begin
  update public.invites
  set used_by = auth.uid(), used_at = now()
  where code = invite_code
    and used_by is null
    and expires_at > now()
    and created_by <> auth.uid()
  returning created_by into inviter;

  if inviter is null then
    raise exception '招待コードが無効です';
  end if;

  insert into public.friendships (user_a, user_b, requested_by, status, accepted_at)
  values (least(inviter, auth.uid()), greatest(inviter, auth.uid()), inviter, 'accepted', now())
  on conflict (user_a, user_b) do nothing;

  return inviter;
end;
$$;

-- ============================================================
-- トリガー: サインアップ時に profiles を自動作成
-- ============================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  insert into public.profiles (id, username, display_name, avatar_url)
  values (
    new.id,
    'user_' || substr(replace(new.id::text, '-', ''), 1, 12),
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
-- Storage: 投稿画像バケット
-- ============================================================
insert into storage.buckets (id, name, public)
values ('post-images', 'post-images', false)
on conflict (id) do nothing;

create policy "post_images_insert_own" on storage.objects
  for insert with check (
    bucket_id = 'post-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "post_images_update_own" on storage.objects
  for update using (
    bucket_id = 'post-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "post_images_delete_own" on storage.objects
  for delete using (
    bucket_id = 'post-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "post_images_select_reciprocal" on storage.objects
  for select using (
    bucket_id = 'post-images'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or (
        public.is_friend(auth.uid(), ((storage.foldername(name))[1])::uuid)
        and public.has_posted_today(auth.uid())
      )
    )
  );


-- ============================================================
-- get_invite_info: 招待コードの情報を返す（未ログインユーザーからも呼び出し可能）
-- ============================================================
create or replace function public.get_invite_info(invite_code text)
returns json
language plpgsql security definer set search_path = public
as $$
declare
  result json;
begin
  select json_build_object(
    'inviter_name', p.display_name,
    'expires_at',   i.expires_at,
    'valid',        (i.used_by is null and i.expires_at > now())
  )
  into result
  from public.invites i
  join public.profiles p on p.id = i.created_by
  where i.code = invite_code;

  return result;
end;
$$;
