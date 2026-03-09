-- Drop existing problematic policies on group_members
DROP POLICY IF EXISTS "Members are viewable by group members" ON public.group_members;
DROP POLICY IF EXISTS "Owners and admins can add members" ON public.group_members;
DROP POLICY IF EXISTS "Owners can remove members" ON public.group_members;

-- Create security definer functions to avoid recursion
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

CREATE OR REPLACE FUNCTION public.is_group_owner(_user_id uuid, _group_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.group_chats
    WHERE id = _group_id AND owner_id = _user_id
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

-- Recreate policies using the security definer functions
CREATE POLICY "Members are viewable by group members"
ON public.group_members FOR SELECT
USING (
  public.is_group_owner(auth.uid(), group_id) OR 
  public.is_group_member(auth.uid(), group_id)
);

CREATE POLICY "Owners and admins can add members"
ON public.group_members FOR INSERT
WITH CHECK (
  public.is_group_owner(auth.uid(), group_id) OR 
  public.is_group_admin(auth.uid(), group_id)
);

CREATE POLICY "Owners can remove members"
ON public.group_members FOR DELETE
USING (
  public.is_group_owner(auth.uid(), group_id) OR 
  user_id = auth.uid()
);

-- Also fix group_messages policies
DROP POLICY IF EXISTS "Messages viewable by members" ON public.group_messages;
DROP POLICY IF EXISTS "Members can send messages" ON public.group_messages;

CREATE POLICY "Messages viewable by members"
ON public.group_messages FOR SELECT
USING (
  public.is_group_owner(auth.uid(), group_id) OR 
  public.is_group_member(auth.uid(), group_id)
);

CREATE POLICY "Members can send messages"
ON public.group_messages FOR INSERT
WITH CHECK (
  auth.uid() = sender_id AND (
    public.is_group_owner(auth.uid(), group_id) OR 
    public.is_group_member(auth.uid(), group_id)
  )
);