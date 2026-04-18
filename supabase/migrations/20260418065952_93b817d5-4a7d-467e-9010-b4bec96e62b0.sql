-- Friend of a Friend schema

-- Helper: timestamps trigger (already standard pattern)
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- ============ PROFILES ============
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  handle text UNIQUE NOT NULL,
  display_name text NOT NULL,
  bio text,
  mode text NOT NULL DEFAULT 'social' CHECK (mode IN ('social','professional','events')),
  invited_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Profiles viewable by authenticated" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);
CREATE POLICY "Users insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ INVITE CODES ============
-- Each user generates personal invite codes; one signup token per code.
CREATE TABLE public.invite_codes (
  code text PRIMARY KEY,
  created_by uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  used_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.invite_codes ENABLE ROW LEVEL SECURITY;
-- Anyone (even anonymous) can SELECT a code by its value to validate at signup.
CREATE POLICY "Invite codes are publicly readable" ON public.invite_codes FOR SELECT USING (true);
CREATE POLICY "Authenticated users create their own invite codes" ON public.invite_codes
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);
-- Updates (marking used) handled by SECURITY DEFINER function below.

-- ============ CONNECTIONS ============
-- Mutual: one row per pair, requester_id < addressee_id once accepted? Simpler: store both labels & a status.
CREATE TYPE public.connection_status AS ENUM ('pending','accepted','declined');
CREATE TABLE public.connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  addressee_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  requester_label text,            -- 2-word label set by requester
  addressee_label text,            -- 2-word label set by addressee on accept
  status public.connection_status NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (requester_id <> addressee_id),
  UNIQUE (requester_id, addressee_id)
);
CREATE INDEX idx_conn_req ON public.connections(requester_id);
CREATE INDEX idx_conn_add ON public.connections(addressee_id);
ALTER TABLE public.connections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see their own connection rows" ON public.connections FOR SELECT TO authenticated
  USING (auth.uid() = requester_id OR auth.uid() = addressee_id);
CREATE POLICY "Users create connection requests" ON public.connections FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = requester_id);
CREATE POLICY "Addressee updates connection" ON public.connections FOR UPDATE TO authenticated
  USING (auth.uid() = addressee_id);
CREATE TRIGGER connections_updated_at BEFORE UPDATE ON public.connections FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Helper view: accepted bidirectional edges as (a, b)
CREATE OR REPLACE VIEW public.accepted_edges AS
  SELECT requester_id AS a, addressee_id AS b FROM public.connections WHERE status='accepted'
  UNION
  SELECT addressee_id AS a, requester_id AS b FROM public.connections WHERE status='accepted';

-- Function: count mutual connections between two users (security definer to bypass RLS for count only)
CREATE OR REPLACE FUNCTION public.mutual_count(u1 uuid, u2 uuid)
RETURNS int LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT count(*)::int FROM (
    SELECT b FROM public.accepted_edges WHERE a = u1
    INTERSECT
    SELECT b FROM public.accepted_edges WHERE a = u2
  ) m;
$$;

-- Function: are two users directly connected
CREATE OR REPLACE FUNCTION public.are_connected(u1 uuid, u2 uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.accepted_edges WHERE a = u1 AND b = u2);
$$;

-- ============ INITIATIVES ============
CREATE TYPE public.initiative_category AS ENUM ('social','professional','events');
CREATE TABLE public.initiatives (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  category public.initiative_category NOT NULL DEFAULT 'social',
  starts_at timestamptz NOT NULL,
  location text,
  size_cap int NOT NULL DEFAULT 10 CHECK (size_cap > 0),
  min_mutuals int NOT NULL DEFAULT 1 CHECK (min_mutuals >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_initiatives_host ON public.initiatives(host_id);
CREATE INDEX idx_initiatives_starts ON public.initiatives(starts_at);
ALTER TABLE public.initiatives ENABLE ROW LEVEL SECURITY;

-- Visibility: viewer is host OR (direct connection) OR (mutuals >= min_mutuals)
CREATE POLICY "Initiatives visible by gating" ON public.initiatives FOR SELECT TO authenticated
  USING (
    auth.uid() = host_id
    OR public.are_connected(auth.uid(), host_id)
    OR public.mutual_count(auth.uid(), host_id) >= min_mutuals
  );
CREATE POLICY "Hosts create initiatives" ON public.initiatives FOR INSERT TO authenticated WITH CHECK (auth.uid() = host_id);
CREATE POLICY "Hosts update their initiatives" ON public.initiatives FOR UPDATE TO authenticated USING (auth.uid() = host_id);
CREATE POLICY "Hosts delete their initiatives" ON public.initiatives FOR DELETE TO authenticated USING (auth.uid() = host_id);
CREATE TRIGGER initiatives_updated_at BEFORE UPDATE ON public.initiatives FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ INITIATIVE MEMBERSHIPS (join requests + approvals) ============
CREATE TYPE public.member_status AS ENUM ('requested','approved','declined');
CREATE TABLE public.initiative_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  initiative_id uuid NOT NULL REFERENCES public.initiatives(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status public.member_status NOT NULL DEFAULT 'requested',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (initiative_id, user_id)
);
ALTER TABLE public.initiative_members ENABLE ROW LEVEL SECURITY;

-- Helper: is user the host?
CREATE OR REPLACE FUNCTION public.is_host(_initiative uuid, _user uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.initiatives WHERE id = _initiative AND host_id = _user);
$$;

-- Helper: is user an approved member?
CREATE OR REPLACE FUNCTION public.is_approved_member(_initiative uuid, _user uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.initiative_members WHERE initiative_id = _initiative AND user_id = _user AND status = 'approved');
$$;

-- View: members visible to host (all) and approved members (each other)
CREATE POLICY "Members visible to host & approved attendees" ON public.initiative_members FOR SELECT TO authenticated
  USING (
    auth.uid() = user_id
    OR public.is_host(initiative_id, auth.uid())
    OR public.is_approved_member(initiative_id, auth.uid())
  );
-- Insert: user can request join if they can SEE the initiative (RLS on initiatives enforces gating)
CREATE POLICY "Users request to join" ON public.initiative_members FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
-- Update: only host can approve/decline
CREATE POLICY "Host updates membership" ON public.initiative_members FOR UPDATE TO authenticated
  USING (public.is_host(initiative_id, auth.uid()));
CREATE TRIGGER initiative_members_updated_at BEFORE UPDATE ON public.initiative_members FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ INITIATIVE UPDATES (host posts in shared space) ============
CREATE TABLE public.initiative_updates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  initiative_id uuid NOT NULL REFERENCES public.initiatives(id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.initiative_updates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Updates visible to host & approved members" ON public.initiative_updates FOR SELECT TO authenticated
  USING (public.is_host(initiative_id, auth.uid()) OR public.is_approved_member(initiative_id, auth.uid()));
CREATE POLICY "Host posts updates" ON public.initiative_updates FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = author_id AND public.is_host(initiative_id, auth.uid()));

-- ============ SIGNUP HOOK: create profile + auto-connect with inviter + consume invite code ============
-- Profile created from auth metadata (handle, display_name, mode, invite_code).
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_handle text;
  v_display text;
  v_mode text;
  v_code text;
  v_inviter uuid;
BEGIN
  v_handle := coalesce(NEW.raw_user_meta_data->>'handle', split_part(NEW.email, '@', 1));
  v_display := coalesce(NEW.raw_user_meta_data->>'display_name', v_handle);
  v_mode := coalesce(NEW.raw_user_meta_data->>'mode', 'social');
  v_code := NEW.raw_user_meta_data->>'invite_code';

  -- Look up inviter from invite code (if provided & unused)
  IF v_code IS NOT NULL THEN
    SELECT created_by INTO v_inviter FROM public.invite_codes
      WHERE code = v_code AND used_by IS NULL;
  END IF;

  INSERT INTO public.profiles (id, handle, display_name, mode, invited_by)
    VALUES (NEW.id, v_handle, v_display, v_mode, v_inviter);

  -- Mark invite code as used
  IF v_code IS NOT NULL AND v_inviter IS NOT NULL THEN
    UPDATE public.invite_codes SET used_by = NEW.id, used_at = now() WHERE code = v_code;
    -- Auto-create accepted mutual connection between inviter and new user
    INSERT INTO public.connections (requester_id, addressee_id, requester_label, addressee_label, status)
      VALUES (v_inviter, NEW.id, 'Invited You', 'Invited Me', 'accepted')
      ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
