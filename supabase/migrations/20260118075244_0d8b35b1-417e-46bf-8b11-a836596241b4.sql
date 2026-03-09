-- Add media columns to messages table
ALTER TABLE public.messages 
ADD COLUMN IF NOT EXISTS media_url TEXT,
ADD COLUMN IF NOT EXISTS media_type TEXT; -- 'image', 'video', 'audio'

-- Create message_media storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('message_media', 'message_media', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for message_media bucket
CREATE POLICY "Users can upload message media"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'message_media' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can view message media"
ON storage.objects FOR SELECT
USING (bucket_id = 'message_media');

CREATE POLICY "Users can delete own message media"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'message_media'
  AND auth.uid()::text = (storage.foldername(name))[1]
);