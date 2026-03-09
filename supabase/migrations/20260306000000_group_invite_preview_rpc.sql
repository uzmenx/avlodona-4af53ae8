-- RPC: invite preview by invite_link (bypasses RLS for preview UI)
-- This prevents private group invites from looking "expired" to non-members.

CREATE OR REPLACE FUNCTION public.get_group_invite_preview(invite text)
RETURNS TABLE (
  id uuid,
  name text,
  description text,
  avatar_url text,
  type public.chat_type,
  visibility public.chat_visibility,
  invite_link text,
  owner_id uuid
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    gc.id,
    gc.name,
    gc.description,
    gc.avatar_url,
    gc.type,
    gc.visibility,
    gc.invite_link,
    gc.owner_id
  FROM public.group_chats gc
  WHERE gc.invite_link = invite
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_group_invite_preview(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_group_invite_preview(text) TO anon;
GRANT EXECUTE ON FUNCTION public.get_group_invite_preview(text) TO authenticated;
