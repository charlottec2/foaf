-- Rename
ALTER TABLE public.initiatives RENAME TO gathers;
ALTER TABLE public.initiative_members RENAME TO gather_members;
ALTER TABLE public.initiative_updates RENAME TO gather_updates;
ALTER TABLE public.gather_members RENAME COLUMN initiative_id TO gather_id;
ALTER TABLE public.gather_updates RENAME COLUMN initiative_id TO gather_id;

-- Drop helpers (CASCADE will also drop dependent policies; we recreate them below)
DROP FUNCTION IF EXISTS public.is_host(uuid, uuid) CASCADE;
DROP FUNCTION IF EXISTS public.is_approved_member(uuid, uuid) CASCADE;

CREATE OR REPLACE FUNCTION public.is_host(_gather uuid, _user uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.gathers WHERE id = _gather AND host_id = _user);
$$;

CREATE OR REPLACE FUNCTION public.is_approved_member(_gather uuid, _user uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.gather_members WHERE gather_id = _gather AND user_id = _user AND status = 'approved');
$$;

-- Drop any policies on gathers that may still exist (the visibility one used mutual_count; CASCADE above only removed those depending on is_host/is_approved_member)
DROP POLICY IF EXISTS "Initiatives visible by gating" ON public.gathers;
DROP POLICY IF EXISTS "Hosts create initiatives" ON public.gathers;
DROP POLICY IF EXISTS "Hosts update their initiatives" ON public.gathers;
DROP POLICY IF EXISTS "Hosts delete their initiatives" ON public.gathers;

-- ============ GROUPS ============
CREATE TABLE public.groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  creator_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER groups_updated_at BEFORE UPDATE ON public.groups FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TYPE public.group_member_status AS ENUM ('invited','member','declined');
CREATE TABLE public.group_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status public.group_member_status NOT NULL DEFAULT 'member',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (group_id, user_id)
);
CREATE INDEX idx_gm_group ON public.group_members(group_id);
CREATE INDEX idx_gm_user ON public.group_members(user_id);
ALTER TABLE public.group_members ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER group_members_updated_at BEFORE UPDATE ON public.group_members FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.is_group_member(_group uuid, _user uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.group_members WHERE group_id = _group AND user_id = _user AND status = 'member');
$$;

CREATE OR REPLACE FUNCTION public.is_group_creator(_group uuid, _user uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.groups WHERE id = _group AND creator_id = _user);
$$;

CREATE POLICY "Groups visible to members and invited" ON public.groups FOR SELECT TO authenticated
  USING (
    auth.uid() = creator_id
    OR EXISTS (
      SELECT 1 FROM public.group_members gm
      WHERE gm.group_id = id AND gm.user_id = auth.uid() AND gm.status IN ('member','invited')
    )
  );
CREATE POLICY "Users create groups" ON public.groups FOR INSERT TO authenticated WITH CHECK (auth.uid() = creator_id);
CREATE POLICY "Creator updates group" ON public.groups FOR UPDATE TO authenticated USING (auth.uid() = creator_id);
CREATE POLICY "Creator deletes group" ON public.groups FOR DELETE TO authenticated USING (auth.uid() = creator_id);

CREATE POLICY "Members see members of their groups" ON public.group_members FOR SELECT TO authenticated
  USING (
    auth.uid() = user_id
    OR public.is_group_creator(group_id, auth.uid())
    OR public.is_group_member(group_id, auth.uid())
  );
CREATE POLICY "Creator adds members or self insert" ON public.group_members FOR INSERT TO authenticated
  WITH CHECK (public.is_group_creator(group_id, auth.uid()) OR auth.uid() = user_id);
CREATE POLICY "User updates own membership or creator updates any" ON public.group_members FOR UPDATE TO authenticated
  USING (auth.uid() = user_id OR public.is_group_creator(group_id, auth.uid()));
CREATE POLICY "User leaves or creator removes" ON public.group_members FOR DELETE TO authenticated
  USING (auth.uid() = user_id OR public.is_group_creator(group_id, auth.uid()));

CREATE TABLE public.group_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_gp_group ON public.group_posts(group_id, created_at DESC);
ALTER TABLE public.group_posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Group posts readable by group members" ON public.group_posts FOR SELECT TO authenticated
  USING (public.is_group_member(group_id, auth.uid()) OR public.is_group_creator(group_id, auth.uid()));
CREATE POLICY "Group members post" ON public.group_posts FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = author_id
    AND (public.is_group_member(group_id, auth.uid()) OR public.is_group_creator(group_id, auth.uid()))
  );
CREATE POLICY "Author deletes own post" ON public.group_posts FOR DELETE TO authenticated USING (auth.uid() = author_id);

ALTER TABLE public.gathers ADD COLUMN source_group_id uuid REFERENCES public.groups(id) ON DELETE SET NULL;
CREATE INDEX idx_gathers_source_group ON public.gathers(source_group_id);

CREATE POLICY "Gathers visible by gating" ON public.gathers FOR SELECT TO authenticated
  USING (
    auth.uid() = host_id
    OR public.are_connected(auth.uid(), host_id)
    OR public.mutual_count(auth.uid(), host_id) >= min_mutuals
    OR (source_group_id IS NOT NULL AND public.is_group_member(source_group_id, auth.uid()))
  );
CREATE POLICY "Hosts create gathers" ON public.gathers FOR INSERT TO authenticated WITH CHECK (auth.uid() = host_id);
CREATE POLICY "Hosts update their gathers" ON public.gathers FOR UPDATE TO authenticated USING (auth.uid() = host_id);
CREATE POLICY "Hosts delete their gathers" ON public.gathers FOR DELETE TO authenticated USING (auth.uid() = host_id);

CREATE POLICY "Gather members visible to host & approved attendees" ON public.gather_members FOR SELECT TO authenticated
  USING (
    auth.uid() = user_id
    OR public.is_host(gather_id, auth.uid())
    OR public.is_approved_member(gather_id, auth.uid())
  );
CREATE POLICY "Users request to join or host adds" ON public.gather_members FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id OR public.is_host(gather_id, auth.uid()));
CREATE POLICY "Host updates membership" ON public.gather_members FOR UPDATE TO authenticated
  USING (public.is_host(gather_id, auth.uid()));

CREATE POLICY "Gather updates visible to host & approved members" ON public.gather_updates FOR SELECT TO authenticated
  USING (public.is_host(gather_id, auth.uid()) OR public.is_approved_member(gather_id, auth.uid()));
CREATE POLICY "Host posts gather updates" ON public.gather_updates FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = author_id AND public.is_host(gather_id, auth.uid()));
