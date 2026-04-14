-- Fix notifications table: the original CHECK constraint only allowed
-- 'follow', 'like', 'comment', 'message' — this blocks follow_request
-- and all other newer types used in the frontend. We drop and recreate it.

ALTER TABLE public.notifications
  DROP CONSTRAINT IF EXISTS notifications_type_check;

ALTER TABLE public.notifications
  ADD CONSTRAINT notifications_type_check
  CHECK (type IN (
    'follow',
    'follow_request',
    'like',
    'story_like',
    'comment',
    'message',
    'mention',
    'collab_request',
    'collab_accepted',
    'family_invitation',
    'family_invitation_accepted',
    'family_connection_request',
    'story',
    'calendar_event'
  ));
