-- RPC to allow a user to join a private or public group via invite link.
-- Bypass RLS so the user can insert themselves if the valid link is provided.

CREATE OR REPLACE FUNCTION public.join_group_via_invite(invite_str text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  target_group_id uuid;
BEGIN
  -- 1. Find the group by invite link
  SELECT id INTO target_group_id
  FROM public.group_chats
  WHERE invite_link = invite_str
  LIMIT 1;

  IF target_group_id IS NULL THEN
    RAISE EXCEPTION 'Yaroqsiz yoki o''chirilgan taklif havolasi.';
  END IF;

  -- 2. Check if the user is already a member
  IF EXISTS (
    SELECT 1 FROM public.group_members
    WHERE group_id = target_group_id AND user_id = auth.uid()
  ) THEN
    -- If already a member, just return true silently so UI can redirect
    RETURN true;
  END IF;

  -- 3. Insert the user into the group
  INSERT INTO public.group_members (group_id, user_id, role)
  VALUES (target_group_id, auth.uid(), 'member');

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.join_group_via_invite(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.join_group_via_invite(text) TO authenticated;
