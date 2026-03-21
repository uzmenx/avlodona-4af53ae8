-- Fix group creation policies properly to avoid infinite recursion

-- Ensure created_by has a value if missing
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'group_chats' AND column_name = 'created_by') THEN
        ALTER TABLE public.group_chats ADD COLUMN created_by UUID;
        UPDATE public.group_chats SET created_by = owner_id WHERE created_by IS NULL;
        ALTER TABLE public.group_chats ALTER COLUMN created_by SET NOT NULL;
    END IF;
END $$;

UPDATE public.group_chats SET created_by = owner_id WHERE created_by IS NULL;

-- 1. Create or replace SECURITY DEFINER functions to bypass RLS and break recursion
CREATE OR REPLACE FUNCTION public.is_group_member(_user_id uuid, _group_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.group_members
    WHERE group_id = _group_id AND user_id = _user_id
  )
$$;

CREATE OR REPLACE FUNCTION public.is_group_admin(_user_id uuid, _group_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.group_members
    WHERE group_id = _group_id AND user_id = _user_id AND role = 'admin'
  )
$$;

CREATE OR REPLACE FUNCTION public.is_group_owner_or_creator(_user_id uuid, _group_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.group_chats
    WHERE id = _group_id AND (owner_id = _user_id OR created_by = _user_id)
  )
$$;

-- 2. Drop existing group_chats policies
DROP POLICY IF EXISTS "Public groups are viewable by everyone" ON public.group_chats;
DROP POLICY IF EXISTS "Members see group chats" ON public.group_chats;
DROP POLICY IF EXISTS "Users can create groups" ON public.group_chats;
DROP POLICY IF EXISTS "Owners can update their groups" ON public.group_chats;
DROP POLICY IF EXISTS "Owners can delete their groups" ON public.group_chats;

-- Recreate group_chats policies
CREATE POLICY "Members see group chats" ON public.group_chats
FOR SELECT USING (
  visibility = 'public'
  OR owner_id = auth.uid()
  OR created_by = auth.uid()
  OR public.is_group_member(auth.uid(), id)
);

CREATE POLICY "Users can create groups" ON public.group_chats
FOR INSERT WITH CHECK (
  auth.uid() = owner_id OR auth.uid() = created_by
);

CREATE POLICY "Owners can update their groups" ON public.group_chats
FOR UPDATE USING (
  auth.uid() = owner_id OR auth.uid() = created_by
);

CREATE POLICY "Owners can delete their groups" ON public.group_chats
FOR DELETE USING (
  auth.uid() = owner_id OR auth.uid() = created_by
);

-- 3. Drop existing group_members policies
DROP POLICY IF EXISTS "Members are viewable by group members" ON public.group_members;
DROP POLICY IF EXISTS "Members see group members" ON public.group_members;
DROP POLICY IF EXISTS "Owners and admins can add members" ON public.group_members;
DROP POLICY IF EXISTS "Owners can remove members" ON public.group_members;

-- Recreate group_members policies
CREATE POLICY "Members see group members" ON public.group_members
FOR SELECT USING (
  public.is_group_owner_or_creator(auth.uid(), group_id)
  OR public.is_group_member(auth.uid(), group_id)
);

CREATE POLICY "Owners and admins can add members" ON public.group_members
FOR INSERT WITH CHECK (
  public.is_group_owner_or_creator(auth.uid(), group_id)
  OR public.is_group_admin(auth.uid(), group_id)
);

CREATE POLICY "Owners can remove members" ON public.group_members
FOR DELETE USING (
  public.is_group_owner_or_creator(auth.uid(), group_id)
  OR user_id = auth.uid()
);
