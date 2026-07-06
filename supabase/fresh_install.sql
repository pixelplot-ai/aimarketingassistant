-- ============================================================
-- AI Marketing Assistant — fresh install (no users, no data)
-- ============================================================
--
-- HOW TO USE (new Supabase project):
--   1. Enable extensions: pg_cron, pg_net (Database → Extensions)
--   2. SQL Editor → paste and run PART 1
--   3. SQL Editor → paste and run PART 2
--   4. Deploy to Vercel, set env vars, then run PART 3
--
-- First admin to sign in becomes workspace owner automatically.
-- Do NOT set WORKSPACE_OWNER_USER_ID in env on fresh install.
-- ============================================================


-- ════════════════════════════════════════════════════════════
-- PART 1 — Schema, functions, RLS, seed data
-- ════════════════════════════════════════════════════════════

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Enums

CREATE TYPE public.ai_provider AS ENUM ('openai', 'gemini');
CREATE TYPE public.connection_status AS ENUM ('connected', 'expired', 'error', 'disconnected');
CREATE TYPE public.job_status AS ENUM ('pending', 'processing', 'completed', 'failed');
CREATE TYPE public.media_type AS ENUM ('none', 'image', 'video');
CREATE TYPE public.post_media_type AS ENUM ('uploaded_image', 'generated_image', 'uploaded_video');
CREATE TYPE public.post_status AS ENUM ('draft', 'scheduled', 'publishing', 'published', 'failed', 'cancelled');
CREATE TYPE public.publication_status AS ENUM ('success', 'failed');

-- Tables

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text,
  display_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.platforms (
  id text PRIMARY KEY,
  display_name text NOT NULL,
  icon_key text NOT NULL,
  is_enabled boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  config_schema jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE public.workspace_settings (
  id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  owner_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE TABLE public.workspace_members (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.settings (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  timezone text NOT NULL DEFAULT 'UTC',
  date_format text NOT NULL DEFAULT 'MM/DD/YYYY',
  default_post_status public.post_status NOT NULL DEFAULT 'draft',
  default_platform_ids text[] NOT NULL DEFAULT '{}',
  openai_model text NOT NULL DEFAULT 'gpt-4o-mini',
  openai_temperature numeric NOT NULL DEFAULT 0.7,
  openai_max_tokens integer NOT NULL DEFAULT 1024,
  gemini_model text NOT NULL DEFAULT 'gemini-2.5-flash',
  gemini_image_size text NOT NULL DEFAULT '1024x1024',
  gemini_image_style text NOT NULL DEFAULT 'natural',
  text_ai_provider public.ai_provider NOT NULL DEFAULT 'openai',
  default_text_prompt text NOT NULL DEFAULT '',
  default_image_prompt text NOT NULL DEFAULT '',
  default_text_length_prompt text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.brand_profiles (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  brand_name text NOT NULL DEFAULT '',
  business_description text NOT NULL DEFAULT '',
  industry text NOT NULL DEFAULT '',
  website text,
  email text,
  phone text,
  address text,
  target_audience text NOT NULL DEFAULT '',
  brand_voice text[] NOT NULL DEFAULT '{}',
  writing_style text[] NOT NULL DEFAULT '{}',
  brand_values text[] NOT NULL DEFAULT '{}',
  products_services jsonb NOT NULL DEFAULT '[]'::jsonb,
  preferred_ctas text[] NOT NULL DEFAULT '{}',
  keywords text[] NOT NULL DEFAULT '{}',
  avoid_words text[] NOT NULL DEFAULT '{}',
  competitors text[] NOT NULL DEFAULT '{}',
  color_primary text NOT NULL DEFAULT '#000000',
  color_secondary text NOT NULL DEFAULT '#666666',
  color_accent text NOT NULL DEFAULT '#0066cc',
  logo_storage_path text,
  is_default boolean NOT NULL DEFAULT true,
  is_complete boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE TABLE public.brand_assets (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  brand_profile_id uuid NOT NULL REFERENCES public.brand_profiles(id) ON DELETE CASCADE,
  storage_path text NOT NULL,
  asset_type text NOT NULL,
  file_name text NOT NULL,
  mime_type text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.posts (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  brand_profile_id uuid REFERENCES public.brand_profiles(id) ON DELETE SET NULL,
  title text NOT NULL DEFAULT '',
  content text NOT NULL DEFAULT '',
  status public.post_status NOT NULL DEFAULT 'draft',
  scheduled_at timestamptz,
  timezone text NOT NULL DEFAULT 'UTC',
  media_type public.media_type NOT NULL DEFAULT 'none',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE TABLE public.post_media (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  media_type public.post_media_type NOT NULL,
  storage_path text NOT NULL,
  mime_type text NOT NULL,
  file_size bigint,
  width integer,
  height integer,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.post_platforms (
  post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  platform_id text NOT NULL REFERENCES public.platforms(id) ON DELETE CASCADE,
  PRIMARY KEY (post_id, platform_id)
);

CREATE TABLE public.platform_connections (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  platform_id text NOT NULL REFERENCES public.platforms(id) ON DELETE CASCADE,
  external_account_id text,
  account_name text,
  access_token_encrypted text,
  refresh_token_encrypted text,
  token_expires_at timestamptz,
  status public.connection_status NOT NULL DEFAULT 'disconnected',
  scopes text[] NOT NULL DEFAULT '{}',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, platform_id)
);

CREATE TABLE public.scheduled_jobs (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  platform_id text NOT NULL REFERENCES public.platforms(id) ON DELETE CASCADE,
  run_at timestamptz NOT NULL,
  status public.job_status NOT NULL DEFAULT 'pending',
  attempts integer NOT NULL DEFAULT 0,
  max_attempts integer NOT NULL DEFAULT 3,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.publication_logs (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  platform_id text NOT NULL REFERENCES public.platforms(id) ON DELETE CASCADE,
  platform_connection_id uuid REFERENCES public.platform_connections(id) ON DELETE SET NULL,
  status public.publication_status NOT NULL,
  external_post_id text,
  request_payload jsonb,
  response_payload jsonb,
  error_message text,
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.ai_generations (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  post_id uuid REFERENCES public.posts(id) ON DELETE SET NULL,
  brand_profile_id uuid REFERENCES public.brand_profiles(id) ON DELETE SET NULL,
  provider public.ai_provider NOT NULL,
  operation text NOT NULL,
  prompt_summary text,
  tokens_used integer,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('product', 'service')),
  name text NOT NULL,
  description text,
  source_url text,
  image_storage_path text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.marketing_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  duration_days integer NOT NULL CHECK (duration_days >= 1 AND duration_days <= 30),
  campaign_goal text NOT NULL,
  target_audience text,
  seasonality text,
  extra_instructions text,
  product_ids uuid[] NOT NULL DEFAULT '{}',
  strategy jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_active boolean NOT NULL DEFAULT false,
  strategy_content_mode text NOT NULL DEFAULT 'text_and_image'
    CHECK (strategy_content_mode IN ('text_only', 'text_and_image')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes

CREATE INDEX idx_brand_profiles_user ON public.brand_profiles (user_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_platform_connections_user ON public.platform_connections (user_id, platform_id);
CREATE INDEX idx_posts_scheduled ON public.posts (scheduled_at)
  WHERE status = 'scheduled' AND deleted_at IS NULL;
CREATE INDEX idx_posts_user_status ON public.posts (user_id, status) WHERE deleted_at IS NULL;
CREATE INDEX idx_publication_logs_post ON public.publication_logs (post_id, created_at DESC);
CREATE INDEX idx_scheduled_jobs_run ON public.scheduled_jobs (run_at, status) WHERE status = 'pending';
CREATE INDEX products_user_id_idx ON public.products (user_id);
CREATE INDEX products_type_idx ON public.products (type);
CREATE INDEX products_created_at_idx ON public.products (created_at DESC);
CREATE INDEX marketing_campaigns_user_id_idx ON public.marketing_campaigns (user_id);
CREATE INDEX marketing_campaigns_active_idx ON public.marketing_campaigns (user_id) WHERE is_active = true;

-- Functions

CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_brand_profile_complete()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO public
AS $$
BEGIN
  NEW.is_complete := (
    length(trim(NEW.brand_name)) > 0 AND
    length(trim(NEW.business_description)) > 0 AND
    length(trim(NEW.target_audience)) > 0 AND
    array_length(NEW.brand_voice, 1) > 0
  );
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email));
  INSERT INTO public.settings (user_id) VALUES (NEW.id);
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.workspace_owner_id()
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO public
AS $$
  SELECT owner_user_id FROM public.workspace_settings WHERE id = 1 LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.is_workspace_member()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.workspace_members WHERE user_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.owns_workspace_row(row_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO public
AS $$
  SELECT row_user_id IS NOT NULL
    AND row_user_id = public.workspace_owner_id()
    AND public.is_workspace_member();
$$;

CREATE OR REPLACE FUNCTION public.bootstrap_workspace_owner(p_claimant uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
  current_owner uuid;
BEGIN
  SELECT owner_user_id INTO current_owner
  FROM public.workspace_settings
  WHERE id = 1
  FOR UPDATE;

  IF current_owner IS NULL THEN
    UPDATE public.workspace_settings
    SET owner_user_id = p_claimant
    WHERE id = 1;
    current_owner := p_claimant;
    INSERT INTO public.workspace_members (user_id)
    VALUES (p_claimant)
    ON CONFLICT (user_id) DO NOTHING;
  END IF;

  RETURN current_owner;
END;
$$;

CREATE OR REPLACE FUNCTION public.pin_workspace_owner(p_owner uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
  current_owner uuid;
BEGIN
  SELECT owner_user_id INTO current_owner
  FROM public.workspace_settings
  WHERE id = 1
  FOR UPDATE;

  IF current_owner IS NULL THEN
    UPDATE public.workspace_settings
    SET owner_user_id = p_owner
    WHERE id = 1;
    current_owner := p_owner;
  END IF;

  INSERT INTO public.workspace_members (user_id)
  VALUES (p_owner)
  ON CONFLICT (user_id) DO NOTHING;

  RETURN current_owner;
END;
$$;

-- Triggers

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE TRIGGER brand_profiles_complete
  BEFORE INSERT OR UPDATE ON public.brand_profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_brand_profile_complete();

CREATE TRIGGER brand_profiles_updated_at
  BEFORE UPDATE ON public.brand_profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER platform_connections_updated_at
  BEFORE UPDATE ON public.platform_connections
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER posts_updated_at
  BEFORE UPDATE ON public.posts
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER scheduled_jobs_updated_at
  BEFORE UPDATE ON public.scheduled_jobs
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER settings_updated_at
  BEFORE UPDATE ON public.settings
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Function permissions

REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO postgres, service_role;
GRANT EXECUTE ON FUNCTION public.bootstrap_workspace_owner(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.pin_workspace_owner(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.workspace_owner_id() TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.is_workspace_member() TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.owns_workspace_row(uuid) TO authenticated, anon, service_role;

-- RLS

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.brand_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.brand_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_media ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_platforms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platforms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scheduled_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.publication_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_generations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY profiles_select ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY profiles_insert ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY profiles_update ON public.profiles FOR UPDATE USING (auth.uid() = id);

CREATE POLICY settings_all ON public.settings FOR ALL
  USING (owns_workspace_row(user_id))
  WITH CHECK (owns_workspace_row(user_id));

CREATE POLICY brand_profiles_all ON public.brand_profiles FOR ALL
  USING (owns_workspace_row(user_id))
  WITH CHECK (owns_workspace_row(user_id));

CREATE POLICY brand_assets_all ON public.brand_assets FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.brand_profiles bp
    WHERE bp.id = brand_assets.brand_profile_id AND owns_workspace_row(bp.user_id)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.brand_profiles bp
    WHERE bp.id = brand_assets.brand_profile_id AND owns_workspace_row(bp.user_id)
  ));

CREATE POLICY posts_all ON public.posts FOR ALL
  USING (owns_workspace_row(user_id))
  WITH CHECK (owns_workspace_row(user_id));

CREATE POLICY post_media_all ON public.post_media FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.posts p
    WHERE p.id = post_media.post_id AND owns_workspace_row(p.user_id)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.posts p
    WHERE p.id = post_media.post_id AND owns_workspace_row(p.user_id)
  ));

CREATE POLICY post_platforms_all ON public.post_platforms FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.posts p
    WHERE p.id = post_platforms.post_id AND owns_workspace_row(p.user_id)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.posts p
    WHERE p.id = post_platforms.post_id AND owns_workspace_row(p.user_id)
  ));

CREATE POLICY platforms_select ON public.platforms FOR SELECT TO authenticated USING (true);

CREATE POLICY platform_connections_all ON public.platform_connections FOR ALL
  USING (owns_workspace_row(user_id))
  WITH CHECK (owns_workspace_row(user_id));

CREATE POLICY scheduled_jobs_all ON public.scheduled_jobs FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.posts p
    WHERE p.id = scheduled_jobs.post_id AND owns_workspace_row(p.user_id)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.posts p
    WHERE p.id = scheduled_jobs.post_id AND owns_workspace_row(p.user_id)
  ));

CREATE POLICY publication_logs_all ON public.publication_logs FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.posts p
    WHERE p.id = publication_logs.post_id AND owns_workspace_row(p.user_id)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.posts p
    WHERE p.id = publication_logs.post_id AND owns_workspace_row(p.user_id)
  ));

CREATE POLICY ai_generations_all ON public.ai_generations FOR ALL
  USING (
    (post_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.posts p
      WHERE p.id = ai_generations.post_id AND owns_workspace_row(p.user_id)
    ))
    OR (brand_profile_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.brand_profiles bp
      WHERE bp.id = ai_generations.brand_profile_id AND owns_workspace_row(bp.user_id)
    ))
    OR (post_id IS NULL AND brand_profile_id IS NULL AND is_workspace_member())
  )
  WITH CHECK (is_workspace_member());

CREATE POLICY "owner access" ON public.products FOR ALL
  USING (owns_workspace_row(user_id))
  WITH CHECK (owns_workspace_row(user_id));

CREATE POLICY "users manage own campaigns" ON public.marketing_campaigns FOR ALL
  USING (owns_workspace_row(user_id))
  WITH CHECK (owns_workspace_row(user_id));

CREATE POLICY workspace_members_select ON public.workspace_members FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY workspace_members_insert ON public.workspace_members FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY workspace_members_update ON public.workspace_members FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY workspace_settings_select ON public.workspace_settings FOR SELECT TO authenticated
  USING (true);

-- Seed: platforms

INSERT INTO public.platforms (id, display_name, icon_key, is_enabled, sort_order) VALUES
  ('facebook',  'Facebook',       'facebook',  true,  1),
  ('instagram', 'Instagram',      'instagram', true,  2),
  ('linkedin',  'LinkedIn',       'linkedin',  false, 3),
  ('tiktok',    'TikTok',         'tiktok',    false, 4),
  ('wordpress', 'WordPress',      'wordpress', false, 5),
  ('x',         'X (Twitter)',    'x',         false, 6),
  ('threads',   'Threads',        'threads',   false, 7),
  ('pinterest', 'Pinterest',      'pinterest', false, 8),
  ('youtube',   'YouTube',        'youtube',   false, 9),
  ('telegram',  'Telegram',       'telegram',  false, 10),
  ('discord',   'Discord',        'discord',   false, 11);

-- Seed: empty workspace (first login sets owner)

INSERT INTO public.workspace_settings (id, owner_user_id) VALUES (1, NULL);


-- ════════════════════════════════════════════════════════════
-- PART 2 — Storage buckets + policies
-- Run as a separate query after Part 1 succeeds.
-- ════════════════════════════════════════════════════════════

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('logos', 'logos', false, 5242880,
    ARRAY['image/png','image/jpeg','image/webp','image/svg+xml']),
  ('images', 'images', false, 10485760,
    ARRAY['image/png','image/jpeg','image/webp','image/gif']),
  ('videos', 'videos', false, 104857600,
    ARRAY['video/mp4','video/webm','video/quicktime']),
  ('generated-images', 'generated-images', false, 10485760,
    ARRAY['image/png','image/jpeg','image/webp']),
  ('brand-assets', 'brand-assets', false, 20971520,
    ARRAY['image/png','image/jpeg','application/pdf','font/ttf','font/otf','font/woff','font/woff2']),
  ('product-images', 'product-images', false, 10485760,
    ARRAY['image/jpeg','image/png','image/webp','image/gif'])
ON CONFLICT (id) DO NOTHING;

CREATE POLICY storage_logos ON storage.objects FOR ALL
  USING (bucket_id = 'logos' AND (
    (auth.uid())::text = (storage.foldername(name))[1]
    OR ((storage.foldername(name))[1] = (workspace_owner_id())::text AND is_workspace_member())
  ))
  WITH CHECK (bucket_id = 'logos' AND (
    (auth.uid())::text = (storage.foldername(name))[1]
    OR ((storage.foldername(name))[1] = (workspace_owner_id())::text AND is_workspace_member())
  ));

CREATE POLICY storage_images ON storage.objects FOR ALL
  USING (bucket_id = 'images' AND (
    (auth.uid())::text = (storage.foldername(name))[1]
    OR ((storage.foldername(name))[1] = (workspace_owner_id())::text AND is_workspace_member())
  ))
  WITH CHECK (bucket_id = 'images' AND (
    (auth.uid())::text = (storage.foldername(name))[1]
    OR ((storage.foldername(name))[1] = (workspace_owner_id())::text AND is_workspace_member())
  ));

CREATE POLICY storage_videos ON storage.objects FOR ALL
  USING (bucket_id = 'videos' AND (
    (auth.uid())::text = (storage.foldername(name))[1]
    OR ((storage.foldername(name))[1] = (workspace_owner_id())::text AND is_workspace_member())
  ))
  WITH CHECK (bucket_id = 'videos' AND (
    (auth.uid())::text = (storage.foldername(name))[1]
    OR ((storage.foldername(name))[1] = (workspace_owner_id())::text AND is_workspace_member())
  ));

CREATE POLICY storage_generated ON storage.objects FOR ALL
  USING (bucket_id = 'generated-images' AND (
    (auth.uid())::text = (storage.foldername(name))[1]
    OR ((storage.foldername(name))[1] = (workspace_owner_id())::text AND is_workspace_member())
  ))
  WITH CHECK (bucket_id = 'generated-images' AND (
    (auth.uid())::text = (storage.foldername(name))[1]
    OR ((storage.foldername(name))[1] = (workspace_owner_id())::text AND is_workspace_member())
  ));

CREATE POLICY storage_brand_assets ON storage.objects FOR ALL
  USING (bucket_id = 'brand-assets' AND (
    (auth.uid())::text = (storage.foldername(name))[1]
    OR ((storage.foldername(name))[1] = (workspace_owner_id())::text AND is_workspace_member())
  ))
  WITH CHECK (bucket_id = 'brand-assets' AND (
    (auth.uid())::text = (storage.foldername(name))[1]
    OR ((storage.foldername(name))[1] = (workspace_owner_id())::text AND is_workspace_member())
  ));

CREATE POLICY "owner can manage product images" ON storage.objects FOR ALL
  USING (bucket_id = 'product-images' AND (
    (auth.uid())::text = (storage.foldername(name))[1]
    OR ((storage.foldername(name))[1] = (workspace_owner_id())::text AND is_workspace_member())
  ))
  WITH CHECK (bucket_id = 'product-images' AND (
    (auth.uid())::text = (storage.foldername(name))[1]
    OR ((storage.foldername(name))[1] = (workspace_owner_id())::text AND is_workspace_member())
  ));
